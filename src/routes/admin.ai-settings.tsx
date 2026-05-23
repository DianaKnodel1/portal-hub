import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/ai-settings")({
  component: AdminAiSettingsPage,
});

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bot, Save, Plus, Trash2, Key } from "lucide-react";

interface FaqEntry { q: string; a: string; }

interface TenantAiSettings {
  id: string;
  name: string;
  ai_enabled: boolean;
  ai_system_prompt: string | null;
  ai_escalation_keywords: string[] | null;
  ai_model: string | null;
  ai_language_style: string | null;
  ai_fallback_text: string | null;
  whatsapp_number: string | null;
  ai_faq_entries: FaqEntry[] | null;
}

const MODELS = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (schnell)" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (balanced)" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (stark)" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini (balanced)" },
  { value: "openai/gpt-5", label: "GPT-5 (stark)" },
];

const STYLES = [
  { value: "freundlich", label: "Freundlich" },
  { value: "professionell", label: "Professionell" },
  { value: "locker", label: "Locker / Casual" },
  { value: "motivierend", label: "Motivierend" },
];

function AdminAiSettingsPage() {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<TenantAiSettings[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [escalationKeywords, setEscalationKeywords] = useState("");
  const [model, setModel] = useState("google/gemini-3-flash-preview");
  const [languageStyle, setLanguageStyle] = useState("freundlich");
  const [fallbackText, setFallbackText] = useState("");
  const [whatsappFallback, setWhatsappFallback] = useState("");
  const [faqEntries, setFaqEntries] = useState<FaqEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Globaler OpenAI Key (system_settings)
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiKeyMasked, setOpenaiKeyMasked] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState(false);

  useEffect(() => { loadTenants(); loadSystemKey(); }, []);

  const loadSystemKey = async () => {
    const { data } = await supabase.from("system_settings").select("openai_api_key").eq("id", 1).maybeSingle();
    const key = data?.openai_api_key;
    if (key && key.length > 8) {
      setOpenaiKeyMasked(`••••••••${key.slice(-4)}`);
    } else {
      setOpenaiKeyMasked(null);
    }
  };

  const saveSystemKey = async () => {
    if (!openaiKey.trim()) {
      toast({ title: "Fehler", description: "Bitte API Key eingeben.", variant: "destructive" });
      return;
    }
    setSavingKey(true);
    const { error } = await supabase.from("system_settings").update({ openai_api_key: openaiKey.trim() }).eq("id", 1);
    setSavingKey(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "OpenAI Key gespeichert" });
      setOpenaiKey("");
      loadSystemKey();
    }
  };

  const loadTenants = async () => {
    const { data } = await supabase.from("tenants").select("id, name, ai_enabled, ai_system_prompt, ai_escalation_keywords, ai_model, ai_language_style, ai_fallback_text, whatsapp_number, ai_faq_entries") as any;
    const list = (data ?? []) as TenantAiSettings[];
    setTenants(list);
    if (list.length > 0 && !selectedId) {
      setSelectedId(list[0].id);
      applyTenant(list[0]);
    }
    setLoading(false);
  };

  const applyTenant = (t: TenantAiSettings) => {
    setAiEnabled(t.ai_enabled);
    setSystemPrompt(t.ai_system_prompt ?? "");
    setEscalationKeywords((t.ai_escalation_keywords ?? []).join(", "));
    setModel(t.ai_model ?? "google/gemini-3-flash-preview");
    setLanguageStyle(t.ai_language_style ?? "freundlich");
    setFallbackText(t.ai_fallback_text ?? "");
    setWhatsappFallback(t.whatsapp_number ?? "");
    setFaqEntries((t.ai_faq_entries as FaqEntry[]) ?? []);
  };

  const onSelectTenant = (id: string) => {
    setSelectedId(id);
    const t = tenants.find(x => x.id === id);
    if (t) applyTenant(t);
  };

  const addFaq = () => setFaqEntries([...faqEntries, { q: "", a: "" }]);
  const removeFaq = (i: number) => setFaqEntries(faqEntries.filter((_, idx) => idx !== i));
  const updateFaq = (i: number, field: "q" | "a", val: string) =>
    setFaqEntries(faqEntries.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const save = async () => {
    if (!selectedId) return;
    setSaving(true);
    const keywords = escalationKeywords.split(",").map(k => k.trim()).filter(Boolean);
    const cleanFaq = faqEntries.filter(e => e.q.trim() && e.a.trim());
    const { error } = await supabase.from("tenants").update({
      ai_enabled: aiEnabled,
      ai_system_prompt: systemPrompt || null,
      ai_escalation_keywords: keywords,
      ai_model: model,
      ai_language_style: languageStyle,
      ai_fallback_text: fallbackText || null,
      whatsapp_number: whatsappFallback || null,
      ai_faq_entries: cleanFaq,
    } as any).eq("id", selectedId);
    setSaving(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "AI-Einstellungen gespeichert" });
      loadTenants();
    }
  };

  if (loading) return <div className="p-5"><div className="h-64 bg-muted/50 rounded-xl animate-pulse" /></div>;

  return (
    <div className="p-5 space-y-4 max-w-2xl">
      <div>
        <h1 className="text-lg font-heading font-bold text-foreground flex items-center gap-2">
          <Bot className="h-5 w-5" /> AI-Einstellungen
        </h1>
        <p className="text-xs text-muted-foreground">KI-Chat-Verhalten pro Tenant konfigurieren</p>
      </div>

      {/* Globaler OpenAI Key */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Key className="h-4 w-4" /> OpenAI API Key (global)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Wird systemweit für alle KI-Funktionen verwendet (Mitarbeiter-Chat & FAQ-Bot).
            Kein Deploy nötig nach Änderung.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Aktueller Key:</span>
            {openaiKeyMasked ? (
              <code className="text-xs px-2 py-1 rounded bg-muted text-foreground">{openaiKeyMasked}</code>
            ) : (
              <span className="text-xs text-destructive">Nicht gesetzt</span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-proj-..."
              className="text-xs h-8"
              autoComplete="off"
            />
            <Button onClick={saveSystemKey} disabled={savingKey || !openaiKey} size="sm" className="h-8">
              <Save className="h-3.5 w-3.5 mr-1" /> {savingKey ? "Speichern…" : "Speichern"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {tenants.length > 1 && (
        <Select value={selectedId} onValueChange={onSelectTenant}>
          <SelectTrigger className="max-w-xs"><SelectValue placeholder="Tenant wählen" /></SelectTrigger>
          <SelectContent>
            {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-heading">Allgemein</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">AI aktiviert</p>
              <p className="text-xs text-muted-foreground">Gilt für Landing Page und Portal</p>
            </div>
            <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Modell</label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODELS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Sprachstil</label>
              <Select value={languageStyle} onValueChange={setLanguageStyle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STYLES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FAQ Knowledge Base */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-heading">Standardantworten / FAQ</CardTitle>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addFaq}>
              <Plus className="h-3 w-3" /> Hinzufügen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[10px] text-muted-foreground">
            Vordefinierte Frage-Antwort-Paare. Die KI nutzt diese Antworten bevorzugt und erfindet nichts.
          </p>
          {faqEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Noch keine Standardantworten hinterlegt.</p>
          ) : (
            faqEntries.map((entry, i) => (
              <div key={i} className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Input
                      value={entry.q}
                      onChange={(e) => updateFaq(i, "q", e.target.value)}
                      placeholder="Frage, z.B. 'Wie viel verdiene ich?'"
                      className="text-xs h-8"
                    />
                    <Textarea
                      value={entry.a}
                      onChange={(e) => updateFaq(i, "a", e.target.value)}
                      placeholder="Antwort…"
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeFaq(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-heading">Prompts & Eskalation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">System-Prompt (optional)</label>
            <Textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder="Optionaler System-Prompt für das KI-Verhalten…"
              rows={4}
            />
            <p className="text-[10px] text-muted-foreground">Leer = Standard-Prompt mit FAQ-Integration.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Eskalations-Keywords</label>
            <Input
              value={escalationKeywords}
              onChange={e => setEscalationKeywords(e.target.value)}
              placeholder="hilfe, problem, geht nicht, verstehe nicht, seriös, vertraue nicht"
            />
            <p className="text-[10px] text-muted-foreground">Kommagetrennt. Bei diesen Wörtern eskaliert die KI sofort an den Teamleiter.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Fallback-Text (wenn AI deaktiviert)</label>
            <Textarea
              value={fallbackText}
              onChange={e => setFallbackText(e.target.value)}
              placeholder="Der KI-Assistent ist gerade nicht verfügbar…"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">WhatsApp-Fallback-Nummer</label>
            <Input
              value={whatsappFallback}
              onChange={e => setWhatsappFallback(e.target.value)}
              placeholder="+49..."
            />
            <p className="text-[10px] text-muted-foreground">Wird bei Eskalation und auf der Landing Page angezeigt.</p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} size="sm">
        <Save className="h-3.5 w-3.5 mr-1" /> {saving ? "Speichern…" : "Speichern"}
      </Button>
    </div>
  );
}
