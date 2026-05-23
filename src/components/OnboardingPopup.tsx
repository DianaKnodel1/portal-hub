import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PartyPopper,
  UserCheck,
  CheckCircle2,
  FileSignature,
  CalendarDays,
  Smartphone,
  Compass,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";

const POPUP_KEY = "welcome_popup_v3_";

const NEXT_STEPS = [
  {
    icon: CheckCircle2,
    title: "Checkliste abarbeiten",
    desc: "Vervollständigen Sie Ihre Daten und verifizieren Sie sich",
  },
  {
    icon: FileSignature,
    title: "Arbeitsvertrag unterschreiben",
    desc: "Unterschreiben Sie Ihren Arbeitsvertrag und starten Sie Ihre Tätigkeit",
  },
  {
    icon: CalendarDays,
    title: "Ersten Termin buchen",
    desc: "Wählen Sie flexibel Ihre Arbeitszeiten aus",
  },
  {
    icon: Smartphone,
    title: "Apps testen & verdienen",
    desc: "Prüfen Sie mobile Anwendungen auf Qualität und Benutzerfreundlichkeit",
  },
];

export function OnboardingPopup() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    const key = `${POPUP_KEY}${user.id}`;
    if (localStorage.getItem(key)) return;

    supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const first = (data?.full_name || "").split(" ")[0] || "";
        setName(first);
        setOpen(true);
      });
  }, [user]);

  const close = () => {
    if (user) localStorage.setItem(`${POPUP_KEY}${user.id}`, "true");
    setOpen(false);
  };

  const startTour = () => {
    if (user) {
      localStorage.setItem(`${POPUP_KEY}${user.id}`, "true");
      localStorage.removeItem(`guided_tour_v2_${user.id}`);
      // Flag setzen, damit GuidedOnboarding nach Reload startet
      sessionStorage.setItem(`start_tour_${user.id}`, "1");
    }
    setOpen(false);
    setTimeout(() => window.location.reload(), 50);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-start md:items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4 md:p-8 animate-fade-in">
      <div className="relative w-full max-w-2xl bg-card rounded-2xl shadow-2xl border border-border my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
              <PartyPopper className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-heading font-bold text-foreground">
                Willkommen{name ? `, ${name}` : ""}!
              </h2>
              <p className="text-xs text-muted-foreground">Schön, dass Sie Teil unseres Teams sind</p>
            </div>
          </div>
          <button
            onClick={close}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-6 space-y-6">
          {/* Hero block */}
          <div className="text-center space-y-3 py-2">
            <div className="h-16 w-16 mx-auto rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
              <UserCheck className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-heading font-bold text-foreground">
              Herzlich willkommen als Mobiler Anwendungsprüfer!
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Sie sind jetzt Teil unseres professionellen Software-Tester-Teams.
              Lassen Sie uns gemeinsam die Qualität digitaler Produkte verbessern.
            </p>
          </div>

          <div className="border-t border-border" />

          {/* Next steps list */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              Das erwartet Sie als nächstes:
            </div>
            <ul className="space-y-3">
              {NEXT_STEPS.map((s) => (
                <li key={s.title} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0 mt-0.5">
                    <s.icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Dashboard-Tour CTA */}
          <div className="rounded-xl border-2 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
                <Compass className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">Dashboard-Tour</p>
                  <Badge className="bg-blue-600 text-white hover:bg-blue-600 text-[10px] px-1.5 py-0">Empfohlen</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Lassen Sie sich durch Ihr neues Mitarbeiterportal führen und entdecken Sie alle Funktionen
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border bg-muted/30 rounded-b-2xl">
          <Button variant="ghost" onClick={close} className="text-muted-foreground">
            Später
          </Button>
          <Button onClick={startTour} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <Compass className="h-4 w-4" />
            Tour starten
          </Button>
        </div>
      </div>
    </div>
  );
}
