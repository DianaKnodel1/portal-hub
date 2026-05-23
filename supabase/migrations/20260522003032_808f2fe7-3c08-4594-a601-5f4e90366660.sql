CREATE OR REPLACE VIEW public.tenants_public
WITH (security_invoker=on) AS
SELECT id, name, domain, primary_color, logo_url,
  team_leader_name, team_leader_title, team_leader_avatar_url,
  team_leader_online, team_leader_response_time,
  whatsapp_number, company_ceo_name, company_address, company_city,
  company_signature_url, hero_title, hero_subtitle, features, is_active,
  ai_enabled
FROM public.tenants
WHERE is_active = true;