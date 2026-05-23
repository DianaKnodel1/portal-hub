import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { translateAuthError } from "@/lib/auth-errors";
import { KeyRound, CheckCircle2 } from "lucide-react";

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setHasRecovery(true);
    }
    // Also listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setHasRecovery(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Fehler", description: "Passwort muss mindestens 6 Zeichen lang sein.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Fehler", description: "Passwörter stimmen nicht überein.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Fehler", description: translateAuthError(error.message), variant: "destructive" });
      return;
    }
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/50 p-4">
        <Card className="w-full max-w-md animate-fade-in shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7 text-accent" />
            </div>
            <h2 className="text-xl font-heading font-bold">Passwort geändert!</h2>
            <p className="text-sm text-muted-foreground">Dein Passwort wurde erfolgreich aktualisiert.</p>
            <Button onClick={() => navigate("/dashboard")}>Zum Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/50 p-4">
        <Card className="w-full max-w-md animate-fade-in shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <p className="text-sm text-muted-foreground">Ungültiger oder abgelaufener Reset-Link.</p>
            <Button variant="outline" onClick={() => navigate("/forgot-password")}>Neuen Link anfordern</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/50 p-4">
      <Card className="w-full max-w-md animate-fade-in shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center space-y-3 pb-6">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-heading font-bold">Neues Passwort setzen</CardTitle>
          <CardDescription>Wähle ein neues sicheres Passwort.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Neues Passwort</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mindestens 6 Zeichen" className="h-12" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Passwort bestätigen</label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Passwort wiederholen" className="h-12" required />
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading ? "Wird gespeichert…" : "Passwort ändern"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
