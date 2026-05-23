import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_employee/settings")({
  component: SettingsPage,
});

import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { translateAuthError } from "@/lib/auth-errors";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowLeft, KeyRound, CheckCircle2, User, CreditCard, Palette } from "lucide-react";

function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Password change
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // Optional data
  const [taxNumber, setTaxNumber] = useState("");
  const [ssn, setSsn] = useState("");
  const [iban, setIban] = useState("");
  const [dataLoading, setDataLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load optional data on mount
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("tax_number, social_security_number, iban").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setTaxNumber(data.tax_number ?? "");
        setSsn(data.social_security_number ?? "");
        setIban(data.iban ?? "");
      }
      setDataLoaded(true);
    });
  }, [user]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Fehler", description: "Mindestens 6 Zeichen.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Fehler", description: "Passwörter stimmen nicht überein.", variant: "destructive" });
      return;
    }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setPwLoading(false);
    if (error) {
      toast({ title: "Fehler", description: translateAuthError(error.message), variant: "destructive" });
      return;
    }
    toast({ title: "✅ Passwort geändert!" });
    setPassword("");
    setConfirm("");
  };

  const handleSaveOptionalData = async () => {
    if (!user) return;
    setDataLoading(true);
    const { error } = await supabase.from("profiles").update({
      tax_number: taxNumber.trim() || null,
      social_security_number: ssn.trim() || null,
      iban: iban.trim() || null,
    }).eq("user_id", user.id);
    setDataLoading(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅ Daten gespeichert!" });
  };

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-heading font-bold">Einstellungen</h1>
      </div>

      {/* Erscheinungsbild */}
      <Card className="animate-fade-in border-none shadow-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Erscheinungsbild</CardTitle>
          </div>
          <CardDescription>Wähle zwischen hellem und dunklem Modus.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle variant="outline" />
        </CardContent>
      </Card>

      {/* Password change */}
      <Card className="animate-fade-in border-none shadow-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Passwort ändern</CardTitle>
          </div>
          <CardDescription>Wähle ein neues sicheres Passwort für dein Konto.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Neues Passwort</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mindestens 6 Zeichen" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Passwort bestätigen</label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Passwort wiederholen" className="h-11" />
            </div>
            <Button type="submit" disabled={pwLoading || !password || !confirm} className="gap-2">
              {pwLoading ? "Wird gespeichert…" : "Passwort ändern"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Optional data */}
      <Card className="animate-fade-in border-none shadow-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Optionale Daten</CardTitle>
          </div>
          <CardDescription>Diese Daten kannst du jederzeit ergänzen oder aktualisieren.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Steuernummer</label>
            <Input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} placeholder="Optional" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Sozialversicherungsnummer</label>
            <Input value={ssn} onChange={(e) => setSsn(e.target.value)} placeholder="Optional" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">IBAN</label>
            <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="DE..." className="h-11" />
          </div>
          <Button onClick={handleSaveOptionalData} disabled={dataLoading} className="gap-2">
            {dataLoading ? "Speichern…" : "Daten speichern"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
