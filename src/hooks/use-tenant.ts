import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTenantDomain } from "@/lib/domain-utils";

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  logo_url: string | null;
  primary_color: string | null;
  sender_email: string | null;
  sender_name: string | null;
  is_active: boolean;
  hero_title: string;
  hero_subtitle: string;
  features: any[];
  created_at: string;
  team_leader_name: string;
  team_leader_title: string;
  team_leader_avatar_url: string | null;
  team_leader_online: boolean | null;
  team_leader_response_time: string;
  company_address: string | null;
  company_contact_person: string | null;
  company_signer_name: string | null;
  company_signer_title: string | null;
  company_email: string | null;
  contract_additions: string | null;
  default_task_template_id: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password: string | null;
  reply_to_email: string | null;
  welcome_email_subject: string | null;
  welcome_email_body: string | null;
  email_signature: string | null;
  smtp_debug_enabled: boolean;
  company_ceo_name: string | null;
  company_city: string | null;
  company_signature_url: string | null;
  whatsapp_number: string | null;
  reset_email_subject: string | null;
  reset_email_body: string | null;
}

export function useTenantByDomain() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const domain = getTenantDomain();
    
    supabase
      .from("tenants_public" as any)
      .select("*")
      .eq("domain", domain)
      .maybeSingle()
      .then(({ data }: any) => {
        setTenant(data as Tenant | null);
        setLoading(false);
      });
  }, []);

  return { tenant, loading };
}

export function useAllTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTenants = async () => {
    const { data } = await supabase.from("tenants").select("*").order("created_at", { ascending: false });
    setTenants((data as unknown as Tenant[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadTenants(); }, []);

  return { tenants, loading, reload: loadTenants };
}
