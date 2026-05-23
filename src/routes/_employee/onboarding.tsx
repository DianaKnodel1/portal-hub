import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_employee/onboarding")({
  component: OnboardingPage,
});

import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  PartyPopper,
  Users,
  ClipboardList,
  HeadphonesIcon,
  CalendarDays,
  Wallet,
  CheckCircle2,
} from "lucide-react";

const STEPS = [
  {
    title: "Willkommen im Team! 🎉",
    icon: PartyPopper,
    content: (
      <div className="space-y-4">
        <p>
          Herzlich willkommen! Wir freuen uns, dich im Team zu haben. In den nächsten Schritten
          erklären wir dir alles, was du wissen musst, um erfolgreich zu starten.
        </p>
        <p>
          Nimm dir ein paar Minuten Zeit – nach dem Onboarding bist du startklar für deine
          ersten Aufgaben.
        </p>
      </div>
    ),
  },
  {
    title: "Deine Rolle",
    icon: Users,
    content: (
      <div className="space-y-4">
        <p>
          Als Servicemitarbeiter bist du ein wichtiger Teil unseres Teams. Deine Hauptaufgabe
          ist es, zugewiesene Aufgaben termingerecht und qualitativ hochwertig zu erledigen.
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li>Du arbeitest eigenständig an deinen zugewiesenen Aufgaben</li>
          <li>Die Qualität deiner Arbeit wird regelmäßig bewertet</li>
          <li>Bei Fragen steht dir immer ein Ansprechpartner zur Verfügung</li>
        </ul>
      </div>
    ),
  },
  {
    title: "Aufgaben-System",
    icon: ClipboardList,
    content: (
      <div className="space-y-4">
        <p>
          Aufgaben werden dir über das Dashboard zugewiesen. Jede Aufgabe enthält:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li><strong>Beschreibung</strong> – Was genau zu tun ist</li>
          <li><strong>Deadline</strong> – Bis wann die Aufgabe erledigt sein muss</li>
          <li><strong>Vergütung</strong> – Was du dafür erhältst</li>
          <li><strong>Status</strong> – Offen, In Bearbeitung, Erledigt</li>
        </ul>
        <p className="text-muted-foreground">
          Du kannst Aufgaben annehmen, bearbeiten und als erledigt markieren.
        </p>
      </div>
    ),
  },
  {
    title: "Teamleiter & Support",
    icon: HeadphonesIcon,
    content: (
      <div className="space-y-4">
        <p>
          Du bist nicht allein! Bei Problemen oder Fragen stehen dir folgende Anlaufstellen
          zur Verfügung:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li><strong>Teamleiter</strong> – Dein direkter Ansprechpartner für fachliche Fragen</li>
          <li><strong>Support</strong> – Für technische Probleme oder Kontofragen</li>
          <li><strong>FAQ</strong> – Häufig gestellte Fragen findest du im Hilfebereich</li>
        </ul>
      </div>
    ),
  },
  {
    title: "Terminbuchung",
    icon: CalendarDays,
    content: (
      <div className="space-y-4">
        <p>
          Für bestimmte Aufgaben kannst du Termine buchen. Das Terminbuchungssystem ermöglicht:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li>Flexible Terminwahl nach deinem Zeitplan</li>
          <li>Automatische Erinnerungen vor dem Termin</li>
          <li>Einfache Umbuchung oder Stornierung</li>
        </ul>
        <p className="text-muted-foreground">
          Details zur Terminbuchung erhältst du, sobald entsprechende Aufgaben verfügbar sind.
        </p>
      </div>
    ),
  },
  {
    title: "Auszahlung",
    icon: Wallet,
    content: (
      <div className="space-y-4">
        <p>
          Deine Vergütung wird aufgabenbasiert berechnet. So funktioniert die Auszahlung:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li>Erledigte Aufgaben werden geprüft und freigegeben</li>
          <li>Die Vergütung wird deinem Konto gutgeschrieben</li>
          <li>Auszahlungen erfolgen regelmäßig auf dein hinterlegtes Bankkonto</li>
        </ul>
        <p className="text-muted-foreground">
          Deine Bankdaten kannst du später in deinem Profil hinterlegen.
        </p>
      </div>
    ),
  },
];

function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }

    const loadData = async () => {
      try {
        const { data, error: dbError } = await supabase
          .from("profiles")
          .select("onboarding_status, contract_signed_at")
          .eq("user_id", user.id)
          .maybeSingle();

        if (dbError) throw dbError;

        if (!data) {
          setError("Profil nicht gefunden.");
          setLoading(false);
          return;
        }

        if (!data.contract_signed_at) {
          navigate("/contract");
          return;
        }
        if (data.onboarding_status === "abgeschlossen") setCompleted(true);
      } catch (err: any) {
        console.error("Onboarding load error:", err);
        setError(err.message || "Daten konnten nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, authLoading, navigate]);

  const handleNext = async () => {
    if (step === 0 && user) {
      // Mark onboarding as in progress
      await supabase
        .from("profiles")
        .update({ onboarding_status: "in_bearbeitung" as any })
        .eq("user_id", user.id);
    }

    if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  };

  const handleComplete = async () => {
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_status: "abgeschlossen" as any })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }

    setCompleted(true);
    toast({ title: "Onboarding abgeschlossen!", description: "Du bist jetzt vollständig eingerichtet." });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Laden…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-destructive font-medium">Fehler beim Laden</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>Zurück zum Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-heading font-bold">Onboarding</h1>
            </div>
            <Badge className="bg-status-active/15 text-status-active">Abgeschlossen</Badge>
          </div>
        </header>
        <main className="container py-8 max-w-2xl">
          <Card className="border-accent/50 animate-fade-in">
            <CardContent className="pt-6 text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-accent mx-auto" />
              <h2 className="text-xl font-heading font-bold">Onboarding abgeschlossen!</h2>
              <p className="text-muted-foreground">
                Du bist vollständig eingerichtet und kannst jetzt Aufgaben bearbeiten.
              </p>
              <Button onClick={() => navigate("/dashboard")}>Zum Dashboard</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const currentStep = STEPS[step];
  const Icon = currentStep.icon;
  const progress = ((step + 1) / STEPS.length) * 100;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-heading font-bold">Onboarding</h1>
          </div>
          <Badge variant="secondary">
            Schritt {step + 1} von {STEPS.length}
          </Badge>
        </div>
      </header>

      <main className="container py-8 max-w-2xl space-y-6">
        <Progress value={progress} className="h-2" />

        <Card className="animate-fade-in" key={step}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-xl">{currentStep.title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-foreground leading-relaxed">
            {currentStep.content}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep(step - 1)}
            disabled={step === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Zurück
          </Button>

          {isLast ? (
            <Button onClick={handleComplete}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Onboarding abschließen
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Weiter
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
