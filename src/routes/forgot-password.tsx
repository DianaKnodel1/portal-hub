import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/50 p-4">
        <Card className="w-full max-w-md animate-fade-in shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7 text-accent" />
            </div>
            <h2 className="text-xl font-heading font-bold text-foreground">E-Mail gesendet!</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Wenn ein Konto mit dieser E-Mail existiert, erhältst du einen Link zum Zurücksetzen deines Passworts.
            </p>
            <Button variant="outline" onClick={() => navigate("/login")} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Zurück zum Login
            </Button>
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
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-heading font-bold">Passwort vergessen</CardTitle>
          <CardDescription>Gib deine E-Mail ein und wir senden dir einen Reset-Link.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">E-Mail</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="max@beispiel.de"
                className="h-12"
                required
              />
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading ? "Wird gesendet…" : "Reset-Link senden"}
            </Button>
          </form>
          <p className="text-center">
            <button onClick={() => navigate("/login")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← Zurück zum Login
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
