-- 1) Tenant-Resolution: TLD-agnostisch + Alias-Liste
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS domain_aliases text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE VIEW public.tenants_public
WITH (security_invoker=on) AS
SELECT id, name, domain, domain_aliases, primary_color, logo_url,
  team_leader_name, team_leader_title, team_leader_avatar_url,
  team_leader_online, team_leader_response_time,
  whatsapp_number, company_ceo_name, company_address, company_city,
  company_signature_url, hero_title, hero_subtitle, features, is_active,
  ai_enabled
FROM public.tenants
WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.get_public_tenant_by_domain(_domain text)
RETURNS SETOF public.tenants_public
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
  WITH q AS (SELECT lower(trim(_domain)) AS d),
       base AS (SELECT d, regexp_replace(d, '\.[a-z]{2,10}$', '') AS base FROM q)
  SELECT tp.* FROM public.tenants_public tp, base
   WHERE tp.is_active = true
     AND (
       tp.domain = base.d
       OR base.d = ANY(tp.domain_aliases)
       OR regexp_replace(tp.domain, '\.[a-z]{2,10}$', '') = base.base
       OR EXISTS (
         SELECT 1 FROM unnest(tp.domain_aliases) a
          WHERE regexp_replace(a, '\.[a-z]{2,10}$', '') = base.base
       )
     )
   ORDER BY (tp.domain = base.d) DESC,
            (base.d = ANY(tp.domain_aliases)) DESC
   LIMIT 1;
$fn$;

-- 2) Strikte Freischaltung: angenommen nur bei Vertrag + KYC
CREATE OR REPLACE FUNCTION public.enforce_employee_acceptance_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  _is_admin boolean;
  _kyc_ok   boolean;
BEGIN
  IF NEW.status = 'angenommen' AND (OLD.status IS DISTINCT FROM 'angenommen') THEN
    SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'admin') INTO _is_admin;
    IF NOT _is_admin THEN
      IF NEW.contract_signed_at IS NULL THEN
        RAISE EXCEPTION 'Freischaltung nicht möglich: Arbeitsvertrag wurde noch nicht unterschrieben.' USING ERRCODE = 'check_violation';
      END IF;
      SELECT EXISTS (SELECT 1 FROM public.kyc_verifications WHERE user_id = NEW.user_id AND status = 'verifiziert') INTO _kyc_ok;
      IF NOT _kyc_ok THEN
        RAISE EXCEPTION 'Freischaltung nicht möglich: Personalausweis (KYC) ist noch nicht verifiziert.' USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_enforce_employee_acceptance_gate ON public.profiles;
CREATE TRIGGER trg_enforce_employee_acceptance_gate
  BEFORE UPDATE OF status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_employee_acceptance_gate();
