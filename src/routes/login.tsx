import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { translateAuthError } from "@/lib/auth-errors";
import { ShieldCheck, Lock, FileText, Calendar, CheckCircle2, MailCheck } from "lucide-react";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tenant } = useTenant();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNeedsVerify(false);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        setNeedsVerify(true);
        toast({
          title: "E-Mail nicht bestätigt",
          description: "Bitte bestätige zuerst deine E-Mail-Adresse. Wir haben dir einen Link gesendet.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Anmeldung fehlgeschlagen", description: translateAuthError(error.message), variant: "destructive" });
      return;
    }
    if (data.user) {
      if (!data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        setNeedsVerify(true);
        toast({
          title: "E-Mail nicht bestätigt",
          description: "Bitte bestätige zuerst deine E-Mail-Adresse, um dich anzumelden.",
          variant: "destructive",
        });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id, status")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (profile?.status === "deaktiviert") {
        await supabase.auth.signOut();
        toast({ title: "Zugang deaktiviert", description: "Dein Zugang wurde deaktiviert. Bitte kontaktiere deinen Ansprechpartner.", variant: "destructive" });
        return;
      }

      if (tenant && profile && profile.tenant_id && profile.tenant_id !== tenant.id) {
        await supabase.auth.signOut();
        toast({ title: "Fehler", description: "Bitte melde dich über deine Unternehmensseite an.", variant: "destructive" });
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (roleData) {
        navigate("/admin");
        return;
      }
    }
    navigate("/dashboard");
  };

  const resendVerify = async () => {
    if (!email.trim()) return;
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
    if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
    else toast({ title: "Bestätigungs-E-Mail versendet", description: `An ${email.trim()}` });
  };

  return (
    <div className="min-h-screen flex bg-[#0a0d1a] text-white relative overflow-hidden">
      {/* Decorative wave on left */}
      <div className="hidden lg:block absolute inset-y-0 left-0 w-1/2 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-200/95 via-slate-300/90 to-slate-400/85" />
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 1000" preserveAspectRatio="xMidYMid slice" fill="none">
          <path d="M0,400 Q200,300 400,450 T800,400 L800,1000 L0,1000 Z" fill="url(#wave1)" opacity="0.35" />
          <path d="M0,500 Q300,400 500,550 T800,500 L800,1000 L0,1000 Z" fill="url(#wave2)" opacity="0.25" />
          <defs>
            <linearGradient id="wave1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>
            <linearGradient id="wave2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Left content */}
      <aside className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-between p-12 xl:p-16 text-slate-900">
        <div className="flex items-center gap-3">
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.name ?? "Logo"} className="h-9 w-auto" />
          ) : (
            <div className="h-9 w-9 rounded-lg bg-slate-900/10 backdrop-blur-sm flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-slate-700" />
            </div>
          )}
          <span className="font-heading font-semibold text-base tracking-tight text-slate-700">
            {tenant?.name ?? "Mitarbeiter-Portal"}
          </span>
        </div>

        <div className="space-y-8 max-w-md">
          <div className="space-y-4">
            <h2 className="text-4xl xl:text-5xl font-heading font-bold leading-tight tracking-tight text-slate-900">
              Dein sicherer Zugang zum Arbeitsbereich.
            </h2>
            <p className="text-base xl:text-lg text-slate-600 leading-relaxed">
              Aufträge, Termine und Dokumente — übersichtlich an einem Ort. Schnell, sicher und jederzeit verfügbar.
            </p>
          </div>

          <ul className="space-y-3">
            {[
              { icon: FileText, text: "Aufträge & Dokumente zentral verwalten" },
              { icon: Calendar, text: "Termine im Blick behalten" },
              { icon: ShieldCheck, text: "DSGVO-orientiert & verschlüsselt" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-700">
                <span className="h-8 w-8 rounded-lg bg-white/70 backdrop-blur flex items-center justify-center shrink-0 shadow-sm">
                  <Icon className="h-4 w-4 text-slate-700" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Lock className="h-3.5 w-3.5" />
          <span>Verschlüsselte Verbindung · SSL/TLS</span>
        </div>
      </aside>

      {/* Right form */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10 relative z-10">
        <div className="w-full max-w-md relative">
          {/* Mobile brand */}
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center mb-3">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <span className="font-heading font-semibold text-white">
              {tenant?.name ?? "Mitarbeiter-Portal"}
            </span>
          </div>

          {/* Glass card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-2xl shadow-black/40 p-8 sm:p-10 space-y-7 animate-fade-in">
            <div className="space-y-2">
              <h1 className="text-3xl font-heading font-bold tracking-tight text-white">
                Willkommen zurück
              </h1>
              <p className="text-sm text-white/60 leading-relaxed">
                Melde dich an, um deine Aufträge, Termine und Dokumente zu verwalten.
              </p>
            </div>

            {needsVerify && (
              <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 flex items-start gap-3">
                <MailCheck className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <p className="text-xs text-amber-100">Bitte bestätige deine E-Mail-Adresse, bevor du dich anmeldest.</p>
                  <button type="button" onClick={resendVerify} className="text-xs font-medium text-amber-200 underline hover:text-amber-100">
                    Bestätigungslink erneut senden
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-white/90">
                  E-Mail-Adresse
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@unternehmen.de"
                  autoComplete="email"
                  className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/20 focus-visible:border-white/30"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium text-white/90">
                    Passwort
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-xs font-medium text-white/50 hover:text-white transition-colors"
                  >
                    Vergessen?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/20 focus-visible:border-white/30"
                  required
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full h-11 text-sm font-semibold bg-white text-slate-900 hover:bg-white/90 shadow-lg shadow-white/10"
                disabled={loading}
              >
                {loading ? "Wird angemeldet…" : "Anmelden"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                <span className="bg-[#11141f] px-3 text-white/40">Neu hier?</span>
              </div>
            </div>

            <Button
              size="lg"
              variant="outline"
              className="w-full h-11 text-sm font-medium border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={() => navigate("/register")}
            >
              Konto erstellen
            </Button>
          </div>

          {/* Trust footer */}
          <div className="mt-6 flex items-center justify-center gap-5 text-xs text-white/40">
            <div className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              <span>Sicherer Login</span>
            </div>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>DSGVO-orientiert</span>
            </div>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>100% online</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
