import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TeamLeaderSettings {
  name: string;
  title: string;
  avatar_url: string | null;
  is_online: boolean;
  response_time: string;
}

const DEFAULT: TeamLeaderSettings = {
  name: "Teamleiter",
  title: "Dein Ansprechpartner",
  avatar_url: null,
  is_online: true,
  response_time: "Antwortet in wenigen Minuten",
};

export function useTeamLeader() {
  const { user } = useAuth();
  const [leader, setLeader] = useState<TeamLeaderSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id, team_leader_id, leader_title, leader_avatar_url, leader_online")
          .eq("user_id", user.id)
          .maybeSingle();

        // 1) Tenant defaults (fallback)
        let tenantDefaults: Partial<TeamLeaderSettings> = {};
        if (profile?.tenant_id) {
          const { data: tenant } = await supabase
            .from("tenants_public")
            .select("team_leader_name, team_leader_title, team_leader_avatar_url, team_leader_online, team_leader_response_time")
            .eq("id", profile.tenant_id)
            .maybeSingle();
          if (tenant) {
            tenantDefaults = {
              name: (tenant as any).team_leader_name || "Teamleiter",
              title: (tenant as any).team_leader_title || "Dein Ansprechpartner",
              avatar_url: (tenant as any).team_leader_avatar_url || null,
              is_online: (tenant as any).team_leader_online ?? true,
              response_time: (tenant as any).team_leader_response_time || "Antwortet in wenigen Minuten",
            };
          }
        }

        // 2) Per-leader override: if a team_leader_id is set, prefer the leader's own profile (name + avatar)
        let leaderProfile: { full_name?: string; leader_avatar_url?: string | null } = {};
        if (profile?.team_leader_id) {
          const { data: lp } = await supabase
            .from("profiles")
            .select("full_name, leader_avatar_url")
            .eq("user_id", profile.team_leader_id)
            .maybeSingle();
          if (lp) leaderProfile = lp as any;
        }

        setLeader({
          ...DEFAULT,
          ...tenantDefaults,
          name: leaderProfile.full_name || tenantDefaults.name || "Teamleiter",
          avatar_url:
            leaderProfile.leader_avatar_url ||
            profile?.leader_avatar_url ||
            tenantDefaults.avatar_url ||
            null,
          title: profile?.leader_title || tenantDefaults.title || "Dein Ansprechpartner",
          is_online: profile?.leader_online ?? tenantDefaults.is_online ?? true,
        });
        setLoading(false);
        return;
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const initials = leader.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const lastActiveText = leader.is_online ? "Online" : "";

  return { leader, loading, initials, lastActiveText };
}
