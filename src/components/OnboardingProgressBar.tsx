import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/NavLink";

interface StepDef {
  key: string;
  label: string;
  to: string;
}

const STEPS: StepDef[] = [
  { key: "kyc",        label: "Verifizierung",      to: "/verification" },
  { key: "contract",   label: "Vertrag",            to: "/contract" },
  { key: "onboarding", label: "Einführung",         to: "/onboarding" },
  { key: "appointment",label: "Erster Termin",      to: "/appointments" },
];

/**
 * Sticky Progress-Bar oben im EmployeeLayout — zeigt „2/4 Schritten erledigt"
 * Versteckt sich automatisch, sobald alle Schritte erledigt sind.
 */
export function OnboardingProgressBar() {
  const { user } = useAuth();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: profile }, { data: kyc }, { data: bookings }] = await Promise.all([
        supabase.from("profiles")
          .select("contract_signed_at, onboarding_status")
          .eq("user_id", user.id).maybeSingle(),
        supabase.from("kyc_verifications")
          .select("status").eq("user_id", user.id).maybeSingle(),
        supabase.from("bookings")
          .select("id").eq("user_id", user.id).limit(1),
      ]);

      setDone({
        kyc:          kyc?.status === "verifiziert",
        contract:     !!profile?.contract_signed_at,
        onboarding:   profile?.onboarding_status === "abgeschlossen",
        appointment:  (bookings?.length ?? 0) > 0,
      });
      setLoaded(true);
    };
    load();

    // Realtime invalidation
    const ch = supabase
      .channel("onboarding-progress")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        () => load())
      .on("postgres_changes",
        { event: "*", schema: "public", table: "kyc_verifications", filter: `user_id=eq.${user.id}` },
        () => load())
      .on("postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `user_id=eq.${user.id}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  if (!loaded) return null;
  const doneCount = STEPS.filter((s) => done[s.key]).length;
  if (doneCount === STEPS.length) return null; // Alles erledigt → ausblenden

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-gradient-to-r from-primary/10 via-primary/5 to-accent/5 backdrop-blur-sm">
      <div className="px-5 py-2.5 flex items-center gap-4 max-w-7xl mx-auto">
        <div className="text-xs font-semibold text-foreground shrink-0">
          Onboarding: <span className="text-primary">{doneCount}/{STEPS.length} erledigt</span>
        </div>
        <div className="flex-1 flex items-center gap-1 overflow-x-auto">
          {STEPS.map((step, idx) => {
            const isDone = done[step.key];
            const isCurrent = !isDone && STEPS.slice(0, idx).every((s) => done[s.key]);
            return (
              <NavLink
                key={step.key}
                to={step.to}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0",
                  isDone
                    ? "text-accent-foreground/70 hover:bg-accent/10"
                    : isCurrent
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted"
                )}
              >
                {isDone ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Circle className={cn("h-3 w-3", isCurrent && "fill-primary-foreground/30")} />
                )}
                {step.label}
              </NavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
}
