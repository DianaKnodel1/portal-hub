import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateLandingZip } from "@/lib/landing-generator.functions";
import { THEME_LIST, THEMES } from "@/lib/landing-themes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Download, Globe, Loader2, CheckCircle2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/landing-generator")({
  component: LandingGeneratorPage,
});

type Branding = {
  firmenname: string;
  primary_color: string;
  secondary_color: string;
  whatsapp_number: string;
  email: string;
  telefon: string;
  telefon_2: string;
  strasse: string;
  plz: string;
  stadt: string;
  hrb: string;
  registergericht: string;
  ust_id: string;
  steuernummer: string;
  geschaeftsfuehrer: string;
  impressum: string;
  landing_domain: string;
  api_endpoint: string;
  portal_url: string;
  supabase_url: string;
  supabase_anon_key: string;
  tenant_id: string;
};

const EMPTY: Branding = {
  firmenname: "",
  primary_color: "#2563eb",
  secondary_color: "#1e40af",
  whatsapp_number: "",
  email: "",
  telefon: "",
  telefon_2: "",
  strasse: "",
  plz: "",
  stadt: "",
  hrb: "",
  registergericht: "",
  ust_id: "",
  steuernummer: "",
  geschaeftsfuehrer: "",
  impressum: "",
  landing_domain: "",
  api_endpoint: "",
  portal_url: "",
  supabase_url: "",
  supabase_anon_key: "",
  tenant_id: "",
};

function LandingGeneratorPage() {
  const { toast } = useToast();
  const generate = useServerFn(generateLandingZip);

  const [themeId, setThemeId] = useState<string>(THEME_LIST[0]?.id ?? "");
  const [branding, setBranding] = useState<Branding>(EMPTY);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [faviconDataUrl, setFaviconDataUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastFile, setLastFile] = useState<string | null>(null);

  const set = (key: keyof Branding) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setBranding((b) => ({ ...b, [key]: e.target.value }));

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) { setLogoDataUrl(null); return; }
    if (f.size > 2 * 1024 * 1024) {
      toast({ title: "Logo zu groß", description: "Max. 2 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  };

  const onFavicon = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) { setFaviconDataUrl(null); return; }
    if (f.size > 200 * 1024) {
      toast({ title: "Favicon zu groß", description: "Max. 200 KB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setFaviconDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  };

  // Live-Preview: Theme-HTML/CSS clientseitig mit Platzhaltern füllen und
  // als single-doc <iframe srcdoc> rendern (Logo als data-URL inline).
  const previewSrcDoc = (() => {
    const theme = THEMES.find((t) => t.id === themeId);
    if (!theme) return "";
    const replace = (src: string) => {
      let out = src;
      for (const [k, v] of Object.entries(branding)) {
        out = out.split(`{{${k}}}`).join(String(v ?? ""));
      }
      return out;
    };
    let html = replace(theme.html);
    const css = replace(theme.css);
    // <link rel="stylesheet" href="style.css"> durch inline <style> ersetzen
    html = html.replace(
      /<link[^>]+href=["']style\.css["'][^>]*>/i,
      `<style>${css}</style>`,
    );
    // Logo durch data-URL ersetzen, sonst Platzhalter-Pixel
    const logoSrc = logoDataUrl ?? "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='40'><rect width='100%' height='100%' fill='%23e2e8f0'/><text x='50%' y='55%' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%2364748b'>Logo</text></svg>";
    html = html.replace(/assets\/logo\.[a-z]+/gi, logoSrc);
    // script.js entfernen (Preview ohne Submit)
    html = html.replace(/<script[^>]*src=["']script\.js["'][^>]*><\/script>/i, "");
    return html;
  })();

  const handleGenerate = async () => {
    if (!branding.firmenname || !branding.email || !branding.api_endpoint) {
      toast({ title: "Fehlende Felder", description: "Firmenname, E-Mail und API-Endpoint sind Pflicht.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await generate({ data: { themeId, branding, logoDataUrl, faviconDataUrl } });
      // Base64 → Blob → Download
      const bin = atob(res.zipBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setLastFile(res.filename);
      toast({ title: "ZIP heruntergeladen", description: res.filename });
    } catch (err: any) {
      toast({ title: "Fehler", description: err?.message ?? "Generierung fehlgeschlagen", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const apiPlaceholder = branding.landing_domain
    ? `https://${branding.landing_domain.replace(/^https?:\/\//, "")}/api/public/applications`
    : "https://portal.deine-domain.de/api/public/applications";

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
          <Globe className="h-5 w-5" /> Landing-Page-Generator
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Theme auswählen, Branding ausfüllen, ZIP herunterladen und per FileZilla auf deinen VPS hochladen.
        </p>
      </div>

      {/* Step 1: Theme */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">1. Theme wählen</CardTitle>
          <CardDescription>Weitere Themes (02–06) folgen, sobald du sie lieferst.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {THEME_LIST.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setThemeId(t.id)}
                className={cn(
                  "text-left rounded-lg border-2 p-4 transition-all",
                  themeId === t.id
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/40",
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{t.name}</span>
                  {themeId === t.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground">{t.description}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-2 font-mono">{t.id}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Branding */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">2. Branding & Inhalte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Firmenname *"><Input value={branding.firmenname} onChange={set("firmenname")} placeholder="Mustermann GmbH" /></Field>
            <Field label="Logo (PNG/JPG/SVG, max 2 MB)">
              <div className="space-y-2">
                <Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={onLogo} />
                {logoDataUrl && (
                  <div className="rounded border bg-muted/30 p-2 flex items-center justify-center h-16">
                    <img src={logoDataUrl} alt="Logo Preview" className="max-h-12 object-contain" />
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">Empfohlen: ≥200×60 px, transparenter Hintergrund.</p>
              </div>
            </Field>
            <Field label="Favicon (ICO/PNG/SVG, max 200 KB)">
              <div className="space-y-2">
                <Input type="file" accept="image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml" onChange={onFavicon} />
                {faviconDataUrl && (
                  <div className="rounded border bg-muted/30 p-2 flex items-center justify-center h-12">
                    <img src={faviconDataUrl} alt="Favicon Preview" className="max-h-8 object-contain" />
                  </div>
                )}
              </div>
            </Field>
            <Field label="Primärfarbe">
              <div className="flex gap-2">
                <Input type="color" value={branding.primary_color} onChange={set("primary_color")} className="w-16 p-1 h-10" />
                <Input value={branding.primary_color} onChange={set("primary_color")} />
              </div>
            </Field>
            <Field label="Sekundärfarbe">
              <div className="flex gap-2">
                <Input type="color" value={branding.secondary_color} onChange={set("secondary_color")} className="w-16 p-1 h-10" />
                <Input value={branding.secondary_color} onChange={set("secondary_color")} />
              </div>
            </Field>
            <Field label="WhatsApp-Nummer (international, ohne +)"><Input value={branding.whatsapp_number} onChange={set("whatsapp_number")} placeholder="491234567890" /></Field>
            <Field label="Kontakt-E-Mail *"><Input type="email" value={branding.email} onChange={set("email")} /></Field>
            <Field label="Telefon"><Input value={branding.telefon} onChange={set("telefon")} /></Field>
            <Field label="Straße & Hausnummer"><Input value={branding.strasse} onChange={set("strasse")} /></Field>
            <Field label="PLZ"><Input value={branding.plz} onChange={set("plz")} maxLength={20} /></Field>
            <Field label="Stadt"><Input value={branding.stadt} onChange={set("stadt")} /></Field>
            <Field label="HRB-Nummer"><Input value={branding.hrb} onChange={set("hrb")} /></Field>
            <Field label="Registergericht"><Input value={branding.registergericht} onChange={set("registergericht")} placeholder="Amtsgericht Berlin" /></Field>
            <Field label="USt-IdNr."><Input value={branding.ust_id} onChange={set("ust_id")} placeholder="DE123456789" /></Field>
            <Field label="Steuernummer"><Input value={branding.steuernummer} onChange={set("steuernummer")} /></Field>
            <Field label="Geschäftsführer"><Input value={branding.geschaeftsfuehrer} onChange={set("geschaeftsfuehrer")} /></Field>
            <Field label="Telefon 2 (optional)"><Input value={branding.telefon_2} onChange={set("telefon_2")} /></Field>
            <Field label="Landing-Domain (für SEO/Canonical)"><Input value={branding.landing_domain} onChange={set("landing_domain")} placeholder="kunde-x.de" /></Field>
            <Field label="API-Endpoint für Bewerbungen *">
              <Input value={branding.api_endpoint} onChange={set("api_endpoint")} placeholder={apiPlaceholder} />
            </Field>
            <Field label="Mitarbeiter-Portal URL (Redirect nach Bewerbung)">
              <Input value={branding.portal_url} onChange={set("portal_url")} placeholder="https://portal.deine-domain.de" />
            </Field>
            <Field label="Supabase URL (Backend, falls direkter Insert)">
              <Input value={branding.supabase_url} onChange={set("supabase_url")} placeholder="https://db.deine-domain.de" />
            </Field>
            <Field label="Supabase Anon Key">
              <Input value={branding.supabase_anon_key} onChange={set("supabase_anon_key")} placeholder="eyJhbGciOi..." />
            </Field>
            <Field label="Tenant-ID (für Multi-Tenant-Filter)">
              <Input value={branding.tenant_id} onChange={set("tenant_id")} placeholder="uuid" />
            </Field>
          </div>
          <Field label="Impressum-Text">
            <Textarea rows={4} value={branding.impressum} onChange={set("impressum")} />
          </Field>
        </CardContent>
      </Card>

      {/* Step 3: Build */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">3. ZIP generieren</CardTitle>
          <CardDescription>Lade die ZIP herunter und entpacke sie auf deinem VPS.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowPreview((s) => !s)} className="gap-2">
              <Eye className="h-4 w-4" />
              {showPreview ? "Vorschau ausblenden" : "Live-Vorschau anzeigen"}
            </Button>
            <Button onClick={handleGenerate} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {loading ? "Generiere…" : "Landing-Page als ZIP herunterladen"}
            </Button>
          </div>
          {showPreview && (
            <div className="rounded border overflow-hidden bg-background">
              <iframe
                title="Landing Preview"
                srcDoc={previewSrcDoc}
                sandbox="allow-same-origin"
                className="w-full h-[700px] border-0"
              />
            </div>
          )}
          {lastFile && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Letzter Download: <span className="font-mono">{lastFile}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}