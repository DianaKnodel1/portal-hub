-- Fix: Acceptance-Gate prüft den HANDELNDEN User (auth.uid()), nicht den Mitarbeiter selbst.
-- Admins (Actor mit Rolle 'admin') dürfen immer manuell freigeben.
-- Self-Service / nicht-Admin-Wege müssen Vertrag + KYC erfüllt haben.

CREATE OR REPLACE FUNCTION public.enforce_employee_acceptance_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  _actor       uuid := auth.uid();
  _actor_admin boolean := false;
  _kyc_ok      boolean := false;
BEGIN
  IF NEW.status = 'angenommen' AND (OLD.status IS DISTINCT FROM 'angenommen') THEN
    IF _actor IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles
         WHERE user_id = _actor AND role = 'admin'
      ) INTO _actor_admin;
    END IF;

    IF NOT _actor_admin THEN
      IF NEW.contract_signed_at IS NULL THEN
        RAISE EXCEPTION 'Freischaltung nicht möglich: Arbeitsvertrag wurde noch nicht unterschrieben.'
          USING ERRCODE = 'check_violation';
      END IF;
      SELECT EXISTS (
        SELECT 1 FROM public.kyc_verifications
         WHERE user_id = NEW.user_id AND status = 'verifiziert'
      ) INTO _kyc_ok;
      IF NOT _kyc_ok THEN
        RAISE EXCEPTION 'Freischaltung nicht möglich: Personalausweis (KYC) ist noch nicht verifiziert.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
