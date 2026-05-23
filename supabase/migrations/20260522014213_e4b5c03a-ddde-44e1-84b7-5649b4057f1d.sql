
-- 1) Neue Tabelle für geordnete Standard-Aufträge
CREATE TABLE IF NOT EXISTS public.tenant_default_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_template_id uuid NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_tenant_default_tasks_tenant ON public.tenant_default_tasks(tenant_id, sort_order);

ALTER TABLE public.tenant_default_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage tenant_default_tasks"
  ON public.tenant_default_tasks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Authenticated read tenant_default_tasks"
  ON public.tenant_default_tasks
  FOR SELECT TO authenticated
  USING (true);

-- 2) Backfill aus alter Single-Default-Spalte
INSERT INTO public.tenant_default_tasks (tenant_id, task_template_id, sort_order)
SELECT id, default_task_template_id, 1
FROM public.tenants
WHERE default_task_template_id IS NOT NULL
ON CONFLICT (tenant_id, sort_order) DO NOTHING;

-- 3) Auto-Assign neu schreiben: läuft nicht mehr beim Status-Change,
--    sondern beim Booking-Insert. Weist je nach Booking-Index den
--    entsprechenden Standard-Auftrag zu.
CREATE OR REPLACE FUNCTION public.auto_assign_default_task_on_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id uuid;
  _booking_index int;
  _template_id uuid;
  _already_assigned int;
BEGIN
  -- Tenant des Users holen
  SELECT tenant_id INTO _tenant_id FROM public.profiles WHERE user_id = NEW.user_id;
  IF _tenant_id IS NULL THEN RETURN NEW; END IF;

  -- Anzahl bisheriger Buchungen des Users (inkl. diese)
  SELECT count(*) INTO _booking_index FROM public.bookings WHERE user_id = NEW.user_id;
  IF _booking_index IS NULL OR _booking_index < 1 THEN _booking_index := 1; END IF;

  -- Standard-Auftrag für diesen Booking-Index (sort_order = _booking_index)
  SELECT task_template_id INTO _template_id
  FROM public.tenant_default_tasks
  WHERE tenant_id = _tenant_id AND sort_order = _booking_index
  LIMIT 1;

  IF _template_id IS NULL THEN RETURN NEW; END IF;

  -- Falls bereits zugewiesen, nichts tun
  SELECT count(*) INTO _already_assigned FROM public.task_assignments
  WHERE user_id = NEW.user_id AND task_template_id = _template_id;
  IF _already_assigned > 0 THEN RETURN NEW; END IF;

  INSERT INTO public.task_assignments (user_id, task_template_id, status)
  VALUES (NEW.user_id, _template_id, 'zugewiesen');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_default_task_on_booking ON public.bookings;
CREATE TRIGGER trg_auto_assign_default_task_on_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_default_task_on_booking();

-- 4) Alten Status-Trigger (auto_assign_default_task) deaktivieren falls vorhanden.
DROP TRIGGER IF EXISTS trg_auto_assign_default_task ON public.profiles;
