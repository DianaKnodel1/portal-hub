
-- 1) Booking storno-tracking
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by_role text;

-- Trigger: bei status->storniert cancelled_by/at automatisch setzen
CREATE OR REPLACE FUNCTION public.track_booking_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'storniert' AND (OLD.status IS DISTINCT FROM 'storniert') THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
    NEW.cancelled_by := COALESCE(NEW.cancelled_by, auth.uid());
    IF NEW.cancelled_by_role IS NULL THEN
      IF public.has_role(auth.uid(), 'admin'::public.app_role) AND NEW.cancelled_by IS DISTINCT FROM NEW.user_id THEN
        NEW.cancelled_by_role := 'admin';
      ELSE
        NEW.cancelled_by_role := 'employee';
      END IF;
    END IF;

    -- Mitteilung an den Mitarbeiter (außer er selbst hat storniert)
    IF NEW.cancelled_by_role = 'admin' THEN
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (
        NEW.user_id,
        'warning',
        'Termin storniert',
        'Dein Termin am ' || to_char(COALESCE(NEW.booking_date, CURRENT_DATE), 'DD.MM.YYYY') ||
        COALESCE(' um ' || to_char(NEW.booking_time, 'HH24:MI') || ' Uhr', '') ||
        ' wurde vom Admin storniert.'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_booking_cancellation ON public.bookings;
CREATE TRIGGER trg_track_booking_cancellation
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.track_booking_cancellation();


-- 2) SMS-Weiterleitung stoppen nach Auftragsabschluss
CREATE OR REPLACE FUNCTION public.forward_inbound_sms_to_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _leader_id uuid;
  _has_active_assignment boolean := false;
BEGIN
  IF NEW.direction <> 'inbound' OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Prüfen ob Nutzer noch einen aktiven Auftrag hat (nicht genehmigt/abgelehnt/abgeschlossen)
  SELECT EXISTS (
    SELECT 1 FROM public.task_assignments
    WHERE user_id = NEW.user_id
      AND status NOT IN ('genehmigt', 'abgelehnt', 'abgeschlossen', 'entwurf')
  ) INTO _has_active_assignment;

  IF NOT _has_active_assignment THEN
    -- Keine aktive Aufgabe -> keine Weiterleitung
    RETURN NEW;
  END IF;

  SELECT team_leader_id INTO _leader_id FROM public.profiles WHERE user_id = NEW.user_id;
  IF _leader_id IS NULL THEN
    SELECT ur.user_id INTO _leader_id FROM public.user_roles ur WHERE ur.role = 'admin' LIMIT 1;
  END IF;
  IF _leader_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.chat_messages (sender_id, receiver_id, message)
  VALUES (_leader_id, NEW.user_id, '📩 SMS Code: ' || COALESCE(NEW.body, ''));

  -- Zusätzliche Mitteilung
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (NEW.user_id, 'info', 'Neuer SMS-Code erhalten', 'Im Chat findest du den Code zum Abschließen deines Auftrags.');

  RETURN NEW;
END;
$$;


-- 3) Notifications bei Auftrags-Statusänderungen
CREATE OR REPLACE FUNCTION public.notify_assignment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _title text;
  _task_title text;
  _type text := 'info';
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT title INTO _task_title FROM public.task_templates WHERE id = NEW.task_template_id;

  IF NEW.status = 'eingereicht' THEN
    _title := 'Auftrag eingereicht';
    _type := 'info';
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (NEW.user_id, _type, _title,
      'Dein Auftrag „' || COALESCE(_task_title, 'Auftrag') || '" ist in Prüfung. Du wirst benachrichtigt, sobald er bearbeitet wurde.');
  ELSIF NEW.status = 'in_pruefung' THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (NEW.user_id, 'info', 'Auftrag in Prüfung',
      'Dein Auftrag „' || COALESCE(_task_title, 'Auftrag') || '" wird gerade geprüft.');
  ELSIF NEW.status = 'genehmigt' THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (NEW.user_id, 'task_approved', 'Auftrag genehmigt 🎉',
      'Dein Auftrag „' || COALESCE(_task_title, 'Auftrag') || '" wurde genehmigt. Vergütung wird gutgeschrieben.');
  ELSIF NEW.status = 'abgelehnt' THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (NEW.user_id, 'task_rejected', 'Auftrag abgelehnt',
      'Dein Auftrag „' || COALESCE(_task_title, 'Auftrag') || '" wurde abgelehnt.' ||
      COALESCE(E'\n\nKommentar: ' || NEW.admin_comment, ''));
  ELSIF NEW.status = 'nachbesserung' THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (NEW.user_id, 'warning', 'Nachbesserung erforderlich',
      'Dein Auftrag „' || COALESCE(_task_title, 'Auftrag') || '" benötigt Korrekturen.' ||
      COALESCE(E'\n\nKommentar: ' || NEW.admin_comment, ''));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_assignment_status_change ON public.task_assignments;
CREATE TRIGGER trg_notify_assignment_status_change
AFTER UPDATE OF status ON public.task_assignments
FOR EACH ROW
EXECUTE FUNCTION public.notify_assignment_status_change();
