import { useEffect, useState } from "react";
import { Link, useLocation } from "@/lib/router-compat";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, X } from "lucide-react";

/**
 * Zeigt einen dezenten Banner im Mitarbeiter-Portal, wenn IBAN / Steuer-Nr.
 * oder Sozialversicherungsnummer noch nicht hinterlegt sind. Diese Felder
 * dürfen bei der Registrierung übersprungen werden, müssen aber nachgereicht
 * werden — ohne sie kann z.B. keine Auszahlung erfolgen.
 */
export function MissingPayrollDataBanner() {
  const { user } = useAuth();
  const location = useLocation();
  const [missing, setMissing] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(sessionStorage.getItem("payroll_banner_dismissed") === "1");
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("iban, tax_number, social_security_number")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const m: string[] = [];
        if (!data.iban) m.push("IBAN");
        if (!data.tax_number) m.push("Steuer-Nr.");
        if (!data.social_security_number) m.push("SV-Nr.");
        setMissing(m);
      });
  }, [user, location.pathname]);

  if (
    dismissed ||
    missing.length === 0 ||
    location.pathname.startsWith("/settings") ||
    location.pathname.startsWith("/personal-data")
  ) {
    return null;
  }

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-5 py-2.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 text-sm">
          <CreditCard className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-foreground">
            Bitte ergänze noch{" "}
            <strong>{missing.join(", ")}</strong> — ohne diese Daten ist
            keine Auszahlung deiner Vergütung möglich.
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Link
            to="/settings"
            className="text-xs font-semibold text-amber-700 hover:text-amber-800 underline underline-offset-2 px-2"
          >
            Jetzt nachreichen
          </Link>
          <button
            onClick={() => {
              sessionStorage.setItem("payroll_banner_dismissed", "1");
              setDismissed(true);
            }}
            className="p-1 rounded hover:bg-amber-500/20 text-muted-foreground"
            aria-label="Hinweis ausblenden"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
