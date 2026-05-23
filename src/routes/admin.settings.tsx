import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettingsPage,
});

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { translateAuthError } from "@/lib/auth-errors";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Lock, Save, Palette, Bot, ArrowRight, Globe, Users as UsersIcon, Mail } from "lucide-react";
import { BookingLimitsCard } from "@/components/admin/BookingLimitsCard";
import { StandardTasksCard } from "@/components/admin/StandardTasksCard";
import { Link } from "@tanstack/react-router";

function AdminSettingsPage() {
  const { toast } = useToast();
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);

  const changePassword = async () => {
    if (newPw.length < 6) {
      toast({ title: "Fehler", description: "Mindestens 6 Zeichen.", variant: "destructive" });
      return;
    }
    if (newPw !== confirmPw) {
      toast({ title: "Fehler", description: "Passwörter stimmen nicht überein.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) {
      toast({ title: "Fehler", description: translateAuthError(error.message), variant: "destructive" });
    } else {
      toast({ title: "Passwort geändert" });
      setNewPw("");
      setConfirmPw("");
    }
    setSaving(false);
  };

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-heading font-bold text-foreground">Admin-Einstellungen</h1>
        <p className="text-sm text-muted-foreground mt-1">Zentrale Konfiguration: Domains, Standard-Aufträge, KI, Teamleiter, E-Mails, Sicherheit.</p>
      </div>

      {/* Quick-Links zu größeren Setup-Bereichen */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Link to="/admin/tenants" className="group">
          <Card className="hover:border-primary/40 transition-colors h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4" /> Domains</CardTitle>
              <CardDescription className="text-xs">Rebranding, Hero, Logo, SMTP, Unternehmensdaten</CardDescription>
            </CardHeader>
            <CardContent className="pt-0"><span className="text-xs text-primary inline-flex items-center gap-1">Öffnen <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" /></span></CardContent>
          </Card>
        </Link>
        <Link to="/admin/team-leader-settings" className="group">
          <Card className="hover:border-primary/40 transition-colors h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><UsersIcon className="h-4 w-4" /> Teamleiter</CardTitle>
              <CardDescription className="text-xs">Profil, Avatar, Online-Status</CardDescription>
            </CardHeader>
            <CardContent className="pt-0"><span className="text-xs text-primary inline-flex items-center gap-1">Öffnen <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" /></span></CardContent>
          </Card>
        </Link>
        <Link to="/admin/ai-settings" className="group">
          <Card className="hover:border-primary/40 transition-colors h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Bot className="h-4 w-4" /> KI-Assistent</CardTitle>
              <CardDescription className="text-xs">An/Aus, FAQ, System-Prompt, Modell</CardDescription>
            </CardHeader>
            <CardContent className="pt-0"><span className="text-xs text-primary inline-flex items-center gap-1">Öffnen <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" /></span></CardContent>
          </Card>
        </Link>
        <Link to="/admin/email-templates" className="group">
          <Card className="hover:border-primary/40 transition-colors h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" /> E-Mail-Vorlagen</CardTitle>
              <CardDescription className="text-xs">Willkommen, Reset, Signatur</CardDescription>
            </CardHeader>
            <CardContent className="pt-0"><span className="text-xs text-primary inline-flex items-center gap-1">Öffnen <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" /></span></CardContent>
          </Card>
        </Link>
      </div>

      <StandardTasksCard />

      <BookingLimitsCard />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Palette className="h-4 w-4" /> Erscheinungsbild
          </CardTitle>
          <CardDescription>Wähle zwischen hellem und dunklem Modus.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle variant="outline" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock className="h-4 w-4" /> Passwort ändern
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Neues Passwort</Label>
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Mindestens 6 Zeichen" />
          </div>
          <div className="space-y-2">
            <Label>Passwort bestätigen</Label>
            <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Nochmal eingeben" />
          </div>
          <Button onClick={changePassword} disabled={saving || !newPw} className="w-full gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Speichern…" : "Passwort ändern"}
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        SMS API Keys werden im Bereich <strong>SMS</strong> verwaltet.
      </p>
    </div>
  );
}
