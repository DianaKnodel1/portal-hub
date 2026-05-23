import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/contracts")({
  component: AdminContractsPage,
});

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAllTenants } from "@/hooks/use-tenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/PaginationBar";
import { Plus, Pencil, Copy, FileText, Info } from "lucide-react";

const EMPLOYMENT_LABELS: Record<string, string> = {
  minijob: "Minijob", teilzeit: "Teilzeit", vollzeit: "Vollzeit",
};

const PLACEHOLDERS = [
  "{{first_name}}", "{{last_name}}", "{{address}}", "{{city}}",
  "{{employment_type}}", "{{company_name}}", "{{company_ceo_name}}", "{{date}}",
];

interface Template {
  id: string;
  tenant_id: string;
  employment_type: string;
  title: string;
  body_html: string;
  content: string;
  version: number;
  is_active: boolean;
  created_at: string;
}

function AdminContractsPage() {
  const { tenants } = useAllTenants();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTenant, setFilterTenant] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);

  // Form state
  const [formTenant, setFormTenant] = useState("");
  const [formType, setFormType] = useState("minijob");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formActive, setFormActive] = useState(true);

  const loadTemplates = async () => {
    const { data } = await supabase
      .from("contract_templates")
      .select("*")
      .order("created_at", { ascending: false });
    setTemplates((data as Template[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadTemplates(); }, []);

  const resetForm = () => {
    setEditing(null);
    setFormTenant(tenants[0]?.id ?? "");
    setFormType("minijob");
    setFormTitle("");
    setFormContent(DEFAULT_CONTRACT_TEMPLATE);
    setFormActive(true);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (t: Template) => {
    setEditing(t);
    setFormTenant(t.tenant_id);
    setFormType(t.employment_type);
    setFormTitle(t.title);
    setFormContent(t.content || t.body_html);
    setFormActive(t.is_active);
    setDialogOpen(true);
  };

  const handleDuplicate = async (t: Template) => {
    await supabase.from("contract_templates").insert({
      tenant_id: t.tenant_id,
      employment_type: t.employment_type as any,
      title: `${t.title} (Kopie)`,
      body_html: t.body_html,
      content: t.content,
      version: 1,
      is_active: false,
    });
    toast({ title: "Dupliziert" });
    loadTemplates();
  };

  const handleSave = async () => {
    if (!formTenant || !formTitle.trim() || !formContent.trim()) {
      toast({ title: "Fehler", description: "Bitte alle Felder ausfüllen.", variant: "destructive" });
      return;
    }
    if (editing) {
      await supabase.from("contract_templates").update({
        title: formTitle.trim(),
        content: formContent,
        body_html: formContent,
        employment_type: formType as any,
        is_active: formActive,
        version: editing.version + 1,
      }).eq("id", editing.id);
      toast({ title: "Template aktualisiert" });
    } else {
      await supabase.from("contract_templates").insert({
        tenant_id: formTenant,
        employment_type: formType as any,
        title: formTitle.trim(),
        content: formContent,
        body_html: formContent,
        is_active: formActive,
      });
      toast({ title: "Template erstellt" });
    }
    setDialogOpen(false);
    loadTemplates();
  };

  const toggleActive = async (t: Template) => {
    await supabase.from("contract_templates").update({ is_active: !t.is_active }).eq("id", t.id);
    loadTemplates();
  };

  const filtered = templates.filter((t) => {
    if (filterTenant !== "all" && t.tenant_id !== filterTenant) return false;
    if (filterType !== "all" && t.employment_type !== filterType) return false;
    return true;
  });

  const { paged, page, setPage, pageCount, rangeFrom, rangeTo, total } = usePagination(filtered, 25);

  const getTenantName = (id: string) => tenants.find((t) => t.id === id)?.name ?? "–";

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Vertrags-Templates</h1>
          <p className="text-sm text-muted-foreground">Vorlagen für automatische Vertragsgenerierung</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Neues Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterTenant} onValueChange={setFilterTenant}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Alle Tenants" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Tenants</SelectItem>
            {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Alle Typen" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {Object.entries(EMPLOYMENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Placeholder Info */}
      <Card className="border-dashed">
        <CardContent className="py-3 px-4 flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Verfügbare Platzhalter: {PLACEHOLDERS.map((p) => <code key={p} className="bg-muted px-1 py-0.5 rounded text-[10px] mx-0.5">{p}</code>)}
          </p>
        </CardContent>
      </Card>

      {/* Templates List */}
      {loading ? (
        <p className="text-muted-foreground text-sm">Laden…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Noch keine Templates vorhanden.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {paged.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4 px-5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-foreground truncate">{t.title}</p>
                    <Badge variant={t.is_active ? "default" : "secondary"} className="text-[10px]">
                      {t.is_active ? "Aktiv" : "Inaktiv"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">v{t.version}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getTenantName(t.tenant_id)} · {EMPLOYMENT_LABELS[t.employment_type] ?? t.employment_type}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDuplicate(t)}><Copy className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <PaginationBar page={page} pageCount={pageCount} setPage={setPage} rangeFrom={rangeFrom} rangeTo={rangeTo} total={total} />
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Template bearbeiten" : "Neues Template erstellen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tenant</label>
                <Select value={formTenant} onValueChange={setFormTenant} disabled={!!editing}>
                  <SelectTrigger><SelectValue placeholder="Tenant wählen" /></SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Beschäftigungsart</label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EMPLOYMENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Titel</label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="z.B. Minijob-Vertrag 2026" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Vertragstext (mit Platzhaltern)</label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={16}
                className="font-mono text-xs"
                placeholder="Vertragstext hier eingeben…"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formActive} onCheckedChange={setFormActive} />
              <label className="text-sm">Aktiv</label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button onClick={handleSave}>{editing ? "Speichern" : "Erstellen"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const DEFAULT_CONTRACT_TEMPLATE = `ARBEITSVERTRAG

Zwischen
{{company_name}}
vertreten durch {{company_ceo_name}}
(nachfolgend „Arbeitgeber")

und

{{first_name}} {{last_name}}
{{address}}, {{city}}
(nachfolgend „Arbeitnehmer")

wird folgender Vertrag geschlossen:

§ 1 – Beginn und Art der Tätigkeit
Das Arbeitsverhältnis als {{employment_type}} beginnt mit der digitalen Unterzeichnung dieses Vertrags.

§ 2 – Tätigkeit
Der Arbeitnehmer wird als Servicemitarbeiter eingesetzt.

§ 3 – Arbeitszeit
Die Arbeitszeit richtet sich nach der vereinbarten Beschäftigungsart ({{employment_type}}).

§ 4 – Vergütung
Die Vergütung erfolgt gemäß den geltenden Vereinbarungen.

§ 5 – Kündigung
Das Arbeitsverhältnis kann von beiden Seiten mit einer Frist von 14 Tagen gekündigt werden.

§ 6 – Vertraulichkeit
Der Arbeitnehmer verpflichtet sich zur Verschwiegenheit über betriebliche Angelegenheiten.

§ 7 – Schlussbestimmungen
Änderungen und Ergänzungen dieses Vertrags bedürfen der Schriftform.

Datum: {{date}}`;
