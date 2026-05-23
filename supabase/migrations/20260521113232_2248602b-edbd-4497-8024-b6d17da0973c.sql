
CREATE TABLE IF NOT EXISTS public.booking_limits (
  employment_type public.employment_type PRIMARY KEY,
  daily_limit INT NOT NULL DEFAULT 1,
  monthly_limit INT,
  min_pause_days INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage booking_limits" ON public.booking_limits
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Authenticated read booking_limits" ON public.booking_limits
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.booking_limits (employment_type, daily_limit, monthly_limit, min_pause_days) VALUES
  ('minijob', 1, 15, 2),
  ('teilzeit', 2, NULL, 0),
  ('vollzeit', 3, NULL, 0)
ON CONFLICT (employment_type) DO NOTHING;

-- Update validation trigger to use booking_limits per employment_type
CREATE OR REPLACE FUNCTION public.validate_booking_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _caller_is_admin BOOLEAN := false;
  _target_is_admin BOOLEAN := false;
  _same_day_count INT := 0;
  _month_count INT := 0;
  _pause_conflict INT := 0;
  _slot_date DATE;
  _slot_start TIME;
  _emp_status TEXT;
  _emp_type public.employment_type;
  _limit_daily INT := 1;
  _limit_monthly INT;
  _limit_pause INT := 0;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role) INTO _caller_is_admin;
  IF COALESCE(_caller_is_admin, false) THEN RETURN NEW; END IF;
  IF COALESCE(NEW.admin_override, false) THEN RETURN NEW; END IF;

  SELECT public.has_role(NEW.user_id, 'admin'::public.app_role) INTO _target_is_admin;
  IF COALESCE(_target_is_admin, false) THEN RETURN NEW; END IF;

  SELECT p.status::text, p.employment_type INTO _emp_status, _emp_type
    FROM public.profiles p WHERE p.user_id = NEW.user_id;
  IF _emp_status IS NULL OR _emp_status <> 'angenommen' THEN
    RAISE EXCEPTION 'Du wurdest noch nicht freigeschaltet.';
  END IF;

  IF NEW.time_slot_id IS NOT NULL THEN
    SELECT ts.slot_date, ts.start_time INTO _slot_date, _slot_start
      FROM public.time_slots ts WHERE ts.id = NEW.time_slot_id;
  ELSE
    _slot_date := NEW.booking_date; _slot_start := NEW.booking_time;
  END IF;
  IF _slot_date IS NULL OR _slot_start IS NULL THEN
    RAISE EXCEPTION 'Ungültiger Zeitslot.';
  END IF;

  IF (_slot_date::timestamp + _slot_start) < (now() + interval '24 hours') THEN
    RAISE EXCEPTION 'Buchung mindestens 24 Stunden im Voraus.';
  END IF;
  IF _slot_start < '09:00'::time OR _slot_start >= '20:00'::time THEN
    RAISE EXCEPTION 'Termine nur zwischen 09:00 und 20:00 Uhr.';
  END IF;

  IF _emp_type IS NOT NULL THEN
    SELECT bl.daily_limit, bl.monthly_limit, bl.min_pause_days
      INTO _limit_daily, _limit_monthly, _limit_pause
      FROM public.booking_limits bl WHERE bl.employment_type = _emp_type;
  END IF;

  -- Tageslimit
  SELECT count(*) INTO _same_day_count FROM public.bookings b
    LEFT JOIN public.time_slots ts ON ts.id = b.time_slot_id
    WHERE b.user_id = NEW.user_id
      AND b.status IN ('gebucht', 'bestätigt')
      AND COALESCE(ts.slot_date, b.booking_date) = _slot_date;
  IF _same_day_count >= COALESCE(_limit_daily, 1) THEN
    RAISE EXCEPTION 'Tageslimit erreicht (%/Tag für deine Beschäftigungsart).', COALESCE(_limit_daily, 1);
  END IF;

  -- Monatslimit
  IF _limit_monthly IS NOT NULL THEN
    SELECT count(*) INTO _month_count FROM public.bookings b
      LEFT JOIN public.time_slots ts ON ts.id = b.time_slot_id
      WHERE b.user_id = NEW.user_id
        AND b.status IN ('gebucht', 'bestätigt')
        AND date_trunc('month', COALESCE(ts.slot_date, b.booking_date)) = date_trunc('month', _slot_date);
    IF _month_count >= _limit_monthly THEN
      RAISE EXCEPTION 'Monatslimit erreicht (%/Monat für deine Beschäftigungsart).', _limit_monthly;
    END IF;
  END IF;

  -- Mindest-Pause
  IF COALESCE(_limit_pause, 0) > 0 THEN
    SELECT count(*) INTO _pause_conflict FROM public.bookings b
      LEFT JOIN public.time_slots ts ON ts.id = b.time_slot_id
      WHERE b.user_id = NEW.user_id
        AND b.status IN ('gebucht', 'bestätigt')
        AND COALESCE(ts.slot_date, b.booking_date) BETWEEN (_slot_date - (_limit_pause || ' days')::interval)::date
                                                       AND (_slot_date + (_limit_pause || ' days')::interval)::date
        AND COALESCE(ts.slot_date, b.booking_date) <> _slot_date;
    IF _pause_conflict > 0 THEN
      RAISE EXCEPTION 'Mindestens % Tag(e) Pause zwischen zwei Terminen erforderlich.', _limit_pause;
    END IF;
  END IF;

  RETURN NEW;
END; $$;
