import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AdminBadges {
  unreadChat: number;
  pendingKyc: number;
  newApplications: number;
}

export function useAdminBadges(): AdminBadges {
  const { user, isAdmin } = useAuth();
  const [badges, setBadges] = useState<AdminBadges>({ unreadChat: 0, pendingKyc: 0, newApplications: 0 });

  useEffect(() => {
    if (!user || !isAdmin) return;
    let cancelled = false;

    const load = async () => {
      const [chatRes, kycRes, appRes] = await Promise.all([
        supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("receiver_id", user.id)
          .eq("read", false),
        supabase
          .from("kyc_verifications")
          .select("id", { count: "exact", head: true })
          .eq("status", "eingereicht"),
        supabase
          .from("applications")
          .select("id", { count: "exact", head: true })
          .eq("status", "neu"),
      ]);
      if (cancelled) return;
      setBadges({
        unreadChat: chatRes.count ?? 0,
        pendingKyc: kycRes.count ?? 0,
        newApplications: appRes.count ?? 0,
      });
    };

    load();

    const channel = supabase
      .channel("admin-badges")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "kyc_verifications" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, load)
      .subscribe();

    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user, isAdmin]);

  return badges;
}
