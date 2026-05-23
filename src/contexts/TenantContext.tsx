import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTenantDomain, isLocalOrPreview } from "@/lib/domain-utils";

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  logo_url: string | null;
  primary_color: string | null;
  sender_email: string | null;
  sender_name: string | null;
  is_active: boolean;
  hero_title: string | null;
  hero_subtitle: string | null;
  features: any;
  created_at: string;
  team_leader_name: string;
  team_leader_title: string;
  team_leader_avatar_url: string | null;
  team_leader_online: boolean;
  team_leader_response_time: string;
  company_address: string | null;
  company_contact_person: string | null;
  company_signer_name: string | null;
  company_signer_title: string | null;
  company_email: string | null;
  company_city: string | null;
  company_ceo_name: string | null;
  company_signature_url: string | null;
  contract_additions: string | null;
  default_task_template_id: string | null;
  ai_enabled: boolean;
}

interface TenantContextType {
  tenant: Tenant | null;
  loading: boolean;
  error: boolean; // true if domain not found
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  loading: true,
  error: false,
});

export const useTenant = () => useContext(TenantContext);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const domain = getTenantDomain();

    (async () => {
      // Try domain-based lookup first
      const { data: byDomain } = await (supabase.rpc as any)("get_public_tenant_by_domain", { _domain: domain });
      let resolved = Array.isArray(byDomain) ? byDomain[0] : byDomain;

      // Preview / localhost fallback: take the first active tenant
      if (!resolved && isLocalOrPreview()) {
        const { data: firstActive } = await (supabase.rpc as any)("get_first_active_public_tenant");
        resolved = Array.isArray(firstActive) ? firstActive[0] : firstActive;
      }

      if (!resolved) {
        if (!isLocalOrPreview()) setError(true);
        setTenant(null);
      } else {
        setTenant(resolved as unknown as Tenant);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, loading, error }}>
      {children}
    </TenantContext.Provider>
  );
}
