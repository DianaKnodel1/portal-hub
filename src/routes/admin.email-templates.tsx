import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/email-templates")({
  component: AdminEmailTemplatesPage,
});

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PageHeaderSkeleton } from "@/components/SkeletonLoaders";
import { Mail, Save, Send, Eye, AlertTriangle, CheckCircle2, Copy, Loader2 } from "lucide-react";

interface TenantEmail {
  id: string;
  name: string;
  domain: string;
  primary_color: string | null;
  logo_url: string | null;
  sender_email: string | null;
  sender_name: string | null;
  reply_to_email: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password: string | null;
  welcome_email_subject: string | null;
  welcome_email_body: string | null;
  reset_email_subject: string | null;
  reset_email_body: string | null;
  email_signature: string | null;
  team_leader_name: string;
  company_email?: string | null;
}

const PLACEHOLDERS = [
  { key: "first_name", label: "Vorname", preview: "Max" },
  { key: "last_name", label: "Nachname", preview: "Mustermann" },
  { key: "email", label: "E-Mail", preview: "max@example.com" },
  { key: "company_name", label: "Firmenname", preview: "TeamPortal" },
  { key: "portal_link", label: "Portal-Link", preview: "https://portal.example.com/register?token=abc" },
  { key: "team_leader_name", label: "Teamleiter", preview: "Anna Schmidt" },
  { key: "tenant_name", label: "Tenant-Name", preview: "BCU Beratung" },
  { key: "support_email", label: "Support-E-Mail", preview: "support@example.com" },
  { key: "reset_link", label: "Reset-Link", preview: "https://portal.example.com/reset-password?token=xyz" },
];

function replacePlaceholders(text: string, tenant: TenantEmail): string {
  const map: Record<string, string> = {
    first_name: "Max",
    last_name: "Mustermann",
    email: "max@example.com",
    company_name: tenant.name,
    portal_link: `https://${tenant.domain}/register?token=demo123`,
    team_leader_name: tenant.team_leader_name,
    tenant_name: tenant.name,
    support_email: tenant.company_email || tenant.sender_email || "support@example.com",
    reset_link: `https://${tenant.domain}/reset-password?token=demo123`,
  };
  let result = text;
  for (const [key, value] of Object.entries(map)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }
  return result;
}

function generateEmailHtml(
  subject: string,
  body: string,
  signature: string,
  tenant: TenantEmail
): string {
  const color = tenant.primary_color || "#000000";
  const resolvedBody = replacePlaceholders(body, tenant);
  const resolvedSignature = replacePlaceholders(signature, tenant);

  // Convert newlines to <br> and detect {{portal_link}}/{{reset_link}} for CTA button
  const bodyHtml = resolvedBody
    .replace(/\n/g, "<br>")
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      `<a href="$1" style="color:${color};text-decoration:underline;">$1</a>`
    );

  const logoHtml = tenant.logo_url
    ? `<div style="text-align:center;margin-bottom:24px;"><img src="${tenant.logo_url}" alt="${tenant.name}" style="max-height:48px;max-width:200px;" /></div>`
    : "";

  const sigHtml = resolvedSignature
    ? `<div style="border-top:1px solid #e5e7eb;margin-top:24px;padding-top:16px;color:#9ca3af;font-size:13px;line-height:20px;">${resolvedSignature.replace(/\n/g, "<br>")}</div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
<div style="background:#ffffff;border-radius:12px;padding:32px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
${logoHtml}
<h1 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 20px;line-height:1.3;">
${replacePlaceholders(subject, tenant)}
</h1>
<div style="color:#374151;font-size:15px;line-height:26px;">
${bodyHtml}
</div>
${sigHtml}
</div>
<div style="text-align:center;margin-top:16px;color:#9ca3af;font-size:11px;">
© ${new Date().getFullYear()} ${tenant.name}
</div>
</div>
</body>
</html>`;
}

function PlaceholderChips({ onInsert }: { onInsert: (key: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {PLACEHOLDERS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onInsert(`{{${p.key}}}`)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-[11px] text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
          title={`${p.label} einfügen`}
        >
          <Copy className="h-3 w-3" />
          {`{{${p.key}}}`}
        </button>
      ))}
    </div>
  );
}

function TemplateEditor({
  label,
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  signature,
  onSignatureChange,
  tenant,
}: {
  label: string;
  subject: string;
  onSubjectChange: (v: string) => void;
  body: string;
  onBodyChange: (v: string) => void;
  signature: string;
  onSignatureChange: (v: string) => void;
  tenant: TenantEmail;
}) {
  const [showPreview, setShowPreview] = useState(true);
  const previewHtml = useMemo(
    () => generateEmailHtml(subject, body, signature, tenant),
    [subject, body, signature, tenant]
  );

  const insertIntoBody = (placeholder: string) => {
    onBodyChange(body + placeholder);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Editor */}
      <div className="space-y-4">
        <div>
          <Label className="text-xs font-medium">Betreff</Label>
          <Input
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="E-Mail Betreff…"
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs font-medium">Inhalt</Label>
          <Textarea
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder="E-Mail Text…"
            className="mt-1 min-h-[200px] font-mono text-sm"
            rows={10}
          />
          <p className="text-[11px] text-muted-foreground mt-1">Platzhalter anklicken zum Einfügen:</p>
          <PlaceholderChips onInsert={insertIntoBody} />
        </div>
        <div>
          <Label className="text-xs font-medium">Signatur</Label>
          <Textarea
            value={signature}
            onChange={(e) => onSignatureChange(e.target.value)}
            placeholder="Herzliche Grüße,&#10;Dein {{company_name}}-Team"
            className="mt-1 min-h-[80px] text-sm"
            rows={3}
          />
        </div>
      </div>

      {/* Preview */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Vorschau
          </Label>
          <Badge variant="secondary" className="text-[10px]">Live-Vorschau</Badge>
        </div>
        <div className="border rounded-xl overflow-hidden bg-muted/30">
          <iframe
            srcDoc={previewHtml}
            className="w-full h-[500px] border-0"
            title="E-Mail Vorschau"
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}

function AdminEmailTemplatesPage() {
  const [tenants, setTenants] = useState<TenantEmail[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testType, setTestType] = useState<"welcome" | "reset">("welcome");
  const { toast } = useToast();

  // Template state
  const [welcomeSubject, setWelcomeSubject] = useState("");
  const [welcomeBody, setWelcomeBody] = useState("");
  const [resetSubject, setResetSubject] = useState("");
  const [resetBody, setResetBody] = useState("");
  const [signature, setSignature] = useState("");
  const [senderName, setSenderName] = useState("");
  const [replyTo, setReplyTo] = useState("");

  const loadTenants = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tenants")
      .select("id, name, domain, primary_color, logo_url, sender_email, sender_name, reply_to_email, smtp_host, smtp_port, smtp_username, smtp_password, welcome_email_subject, welcome_email_body, reset_email_subject, reset_email_body, email_signature, team_leader_name")
      .order("name");
    setTenants((data as any as TenantEmail[]) ?? []);
    if (data && data.length > 0 && !selectedTenantId) {
      setSelectedTenantId(data[0].id);
      loadTenantData(data[0] as any);
    }
    setLoading(false);
  };

  const loadTenantData = (t: TenantEmail) => {
    setWelcomeSubject(t.welcome_email_subject || "Willkommen im Team!");
    setWelcomeBody(
      t.welcome_email_body ||
        "Hallo {{first_name}},\n\nherzlich willkommen! Deine Bewerbung wurde angenommen.\n\nBitte registriere dich über folgenden Link:\n{{portal_link}}\n\nBei Fragen steht dir {{team_leader_name}} zur Verfügung.\n\nViele Grüße,\n{{company_name}}"
    );
    setResetSubject(t.reset_email_subject || "Passwort zurücksetzen");
    setResetBody(
      t.reset_email_body ||
        "Hallo {{first_name}},\n\ndu hast eine Anfrage zum Zurücksetzen deines Passworts gestellt.\n\nKlicke auf den folgenden Link, um dein Passwort zurückzusetzen:\n{{reset_link}}\n\nFalls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail.\n\nViele Grüße,\n{{company_name}}"
    );
    setSignature(t.email_signature || "");
    setSenderName(t.sender_name || "");
    setReplyTo(t.reply_to_email || "");
  };

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    const t = tenants.find((t) => t.id === selectedTenantId);
    if (t) loadTenantData(t);
  }, [selectedTenantId]);

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId);
  const smtpConfigured = !!(
    selectedTenant?.smtp_host &&
    selectedTenant?.smtp_username &&
    selectedTenant?.smtp_password &&
    selectedTenant?.sender_email
  );

  const handleSave = async () => {
    if (!selectedTenantId) return;
    setSaving(true);
    const { error } = await supabase
      .from("tenants")
      .update({
        welcome_email_subject: welcomeSubject,
        welcome_email_body: welcomeBody,
        reset_email_subject: resetSubject,
        reset_email_body: resetBody,
        email_signature: signature,
        sender_name: senderName || null,
        reply_to_email: replyTo || null,
      } as any)
      .eq("id", selectedTenantId);
    setSaving(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Templates gespeichert" });
      loadTenants();
    }
  };

  const handleTestSend = async () => {
    if (!testEmail || !selectedTenant) return;
    setTesting(true);
    try {
      const subject = testType === "welcome" ? welcomeSubject : resetSubject;
      const body = testType === "welcome" ? welcomeBody : resetBody;
      const html = generateEmailHtml(subject, body, signature, selectedTenant);

      const { data, error } = await supabase.functions.invoke("send-invitation-email", {
        body: {
          to: testEmail,
          fullName: "Test Benutzer",
          firstName: "Test",
          lastName: "Benutzer",
          registrationLink: `https://${selectedTenant.domain}/register?token=test`,
          tenantId: selectedTenantId,
          isTestEmail: true,
          customSubject: replacePlaceholders(subject, selectedTenant),
          customHtml: html,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: "Test-E-Mail gesendet", description: `An ${testEmail}` });
    } catch (err: any) {
      toast({ title: "Fehler beim Versand", description: err.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-5">
        <PageHeaderSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">E-Mail Templates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            E-Mail-Vorlagen pro Tenant verwalten und testen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
            <SelectTrigger className="w-56 h-9 text-xs">
              <SelectValue placeholder="Tenant wählen…" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={saving || !selectedTenantId} size="sm" className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Speichern
          </Button>
        </div>
      </div>

      {/* SMTP Warning */}
      {selectedTenant && !smtpConfigured && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>SMTP nicht konfiguriert</strong> – E-Mail-Versand ist für diesen Tenant nicht möglich.
            Bitte zuerst unter <em>Domains</em> die SMTP-Einstellungen hinterlegen.
          </span>
        </div>
      )}

      {selectedTenant && smtpConfigured && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-accent/30 bg-accent/5 text-accent text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            SMTP aktiv: <strong>{selectedTenant.smtp_host}</strong> · Absender:{" "}
            <strong>{selectedTenant.sender_email}</strong>
          </span>
        </div>
      )}

      {/* Sender Settings */}
      {selectedTenant && (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium">Absender-Einstellungen</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-5">
            <div>
              <Label className="text-xs">Absendername</Label>
              <Input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder={selectedTenant.name}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Reply-To</Label>
              <Input
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder={selectedTenant.sender_email || "reply@example.com"}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Template Tabs */}
      {selectedTenant && (
        <Tabs defaultValue="welcome" className="space-y-4">
          <TabsList>
            <TabsTrigger value="welcome" className="text-xs gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Willkommen / Einladung
            </TabsTrigger>
            <TabsTrigger value="reset" className="text-xs gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Passwort zurücksetzen
            </TabsTrigger>
          </TabsList>

          <TabsContent value="welcome">
            <TemplateEditor
              label="Willkommensmail"
              subject={welcomeSubject}
              onSubjectChange={setWelcomeSubject}
              body={welcomeBody}
              onBodyChange={setWelcomeBody}
              signature={signature}
              onSignatureChange={setSignature}
              tenant={selectedTenant}
            />
          </TabsContent>

          <TabsContent value="reset">
            <TemplateEditor
              label="Passwort zurücksetzen"
              subject={resetSubject}
              onSubjectChange={setResetSubject}
              body={resetBody}
              onBodyChange={setResetBody}
              signature={signature}
              onSignatureChange={setSignature}
              tenant={selectedTenant}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Test Send */}
      {selectedTenant && (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Send className="h-4 w-4" /> Test-E-Mail senden
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">Empfänger-E-Mail</Label>
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                  className="mt-1"
                />
              </div>
              <div className="w-48">
                <Label className="text-xs">Template</Label>
                <Select value={testType} onValueChange={(v) => setTestType(v as "welcome" | "reset")}>
                  <SelectTrigger className="mt-1 h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="welcome">Willkommen</SelectItem>
                    <SelectItem value="reset">Passwort-Reset</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleTestSend}
                disabled={testing || !testEmail || !smtpConfigured}
                className="gap-1.5"
              >
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Senden
              </Button>
            </div>
            {!smtpConfigured && (
              <p className="text-xs text-destructive mt-2">
                Testversand nicht möglich – SMTP ist nicht konfiguriert.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
