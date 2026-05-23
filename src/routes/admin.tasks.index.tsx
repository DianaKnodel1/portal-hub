import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/tasks/")({
  component: AdminTasksPage,
});

import { useState, useRef } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useAdminData, type TaskTemplate, type TaskQuestion } from "@/contexts/AdminDataContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EmptyState } from "@/components/EmptyState";
import { Plus, Trash2, ClipboardList, Pencil, Layers, Copy, Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function AdminTasksPage() {
  const { templates, loading, loadData } = useAdminData();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [editTemplate, setEditTemplate] = useState<TaskTemplate | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formInstructions, setFormInstructions] = useState("");
  const [formCompensation, setFormCompensation] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formQuestions, setFormQuestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const uploadImage = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Datei zu groß", description: "Max. 5 MB.", variant: "destructive" });
      return;
    }
    setUploadingImage(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user?.id ?? "anon"}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("task-images")
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (error) {
      toast({ title: "Upload fehlgeschlagen", description: error.message, variant: "destructive" });
      setUploadingImage(false);
      return;
    }
    const { data: pub } = supabase.storage.from("task-images").getPublicUrl(path);
    setFormImageUrl(pub.publicUrl);
    setUploadingImage(false);
    toast({ title: "Bild hochgeladen" });
  };


  const resetForm = () => {
    setFormTitle(""); setFormDesc(""); setFormInstructions(""); setFormCompensation(""); setFormImageUrl(""); setFormQuestions([]);
  };

  const openEdit = async (tpl: TaskTemplate) => {
    setEditTemplate(tpl);
    setFormTitle(tpl.title);
    setFormDesc(tpl.description);
    setFormInstructions(tpl.instructions);
    setFormCompensation(String(tpl.compensation));
    setFormImageUrl((tpl as any).image_url ?? "");
    const { data } = await supabase.from("task_questions").select("*").eq("task_template_id", tpl.id).order("sort_order");
    setFormQuestions((data as TaskQuestion[] ?? []).map((q) => q.question));
  };

  const saveTemplate = async () => {
    if (!formTitle.trim()) { toast({ title: "Titel erforderlich", variant: "destructive" }); return; }
    setSaving(true);
    if (editTemplate) {
      const { error } = await supabase.from("task_templates").update({
        title: formTitle.trim(), description: formDesc, instructions: formInstructions,
        compensation: parseFloat(formCompensation) || 0, image_url: formImageUrl || null,
      }).eq("id", editTemplate.id);
      if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); setSaving(false); return; }
      await supabase.from("task_questions").delete().eq("task_template_id", editTemplate.id);
      const validQ = formQuestions.filter(Boolean);
      if (validQ.length > 0) {
        await supabase.from("task_questions").insert(validQ.map((q, i) => ({ task_template_id: editTemplate.id, question: q, sort_order: i })));
      }
      toast({ title: "Aufgabe aktualisiert" });
      setEditTemplate(null);
    } else {
      const { data: tpl, error } = await supabase.from("task_templates").insert({
        title: formTitle.trim(), description: formDesc, instructions: formInstructions,
        compensation: parseFloat(formCompensation) || 0, created_by: user!.id, image_url: formImageUrl || null,
      }).select("id").single();
      if (error || !tpl) { toast({ title: "Fehler", description: error?.message, variant: "destructive" }); setSaving(false); return; }
      const validQ = formQuestions.filter(Boolean);
      if (validQ.length > 0) {
        await supabase.from("task_questions").insert(validQ.map((q, i) => ({ task_template_id: tpl.id, question: q, sort_order: i })));
      }
      toast({ title: "Aufgabe erstellt" });
      setShowCreate(false);
    }
    resetForm(); setSaving(false); loadData();
  };

  const duplicateTemplate = async (tpl: TaskTemplate) => {
    const { data, error } = await supabase.from("task_templates").insert({
      title: `${tpl.title} (Kopie)`, description: tpl.description, instructions: tpl.instructions,
      compensation: tpl.compensation, created_by: user!.id, image_url: (tpl as any).image_url || null,
      is_published: false, version: 1,
    }).select("id").single();
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    if (data) {
      const { data: steps } = await supabase.from("task_steps").select("*").eq("task_template_id", tpl.id).order("step_number");
      if (steps && steps.length > 0) {
        await supabase.from("task_steps").insert(
          steps.map((s: any) => ({ task_template_id: data.id, step_number: s.step_number, title: s.title, description: s.description, content_blocks: s.content_blocks, button_label: s.button_label, is_required: s.is_required }))
        );
      }
      const { data: qs } = await supabase.from("task_questions").select("*").eq("task_template_id", tpl.id).order("sort_order");
      if (qs && qs.length > 0) {
        await supabase.from("task_questions").insert(qs.map((q: any) => ({ task_template_id: data.id, question: q.question, sort_order: q.sort_order })));
      }
    }
    toast({ title: "Vorlage dupliziert" });
    loadData();
  };

  const deleteTemplate = async (tpl: TaskTemplate) => {
    const { count } = await supabase
      .from("task_assignments")
      .select("id", { count: "exact", head: true })
      .eq("task_template_id", tpl.id);
    const inUse = count ?? 0;
    const msg = inUse > 0
      ? `Diese Vorlage ist ${inUse}× zugewiesen. Sie wird nur deaktiviert (Soft-Delete), damit laufende Aufträge nicht brechen. Fortfahren?`
      : `Vorlage "${tpl.title}" wirklich endgültig löschen?`;
    if (!confirm(msg)) return;

    if (inUse > 0) {
      const { error } = await supabase.from("task_templates").update({ is_active: false, is_published: false }).eq("id", tpl.id);
      if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Vorlage deaktiviert", description: `${inUse} laufende Zuweisung(en) bleiben unberührt.` });
    } else {
      await supabase.from("task_steps").delete().eq("task_template_id", tpl.id);
      await supabase.from("task_questions").delete().eq("task_template_id", tpl.id);
      const { error } = await supabase.from("task_templates").delete().eq("id", tpl.id);
      if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Vorlage gelöscht" });
    }
    loadData();
  };

  if (loading) return <div className="p-5 space-y-4"><div className="h-6 w-32 bg-muted rounded animate-pulse" /><div className="h-64 bg-muted/50 rounded-xl border animate-pulse" /></div>;

  const filtered = templates.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));
  const isFormOpen = showCreate || !!editTemplate;

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-heading font-bold text-foreground">Aufgaben-Vorlagen</h1>
          <p className="text-xs text-muted-foreground">{templates.length} Vorlagen</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-8 text-sm" />
          <Button size="sm" variant="outline" onClick={() => navigate("/admin/tasks/builder/new")}><Layers className="h-3.5 w-3.5 mr-1" /> Builder</Button>
          <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }}><Plus className="h-3.5 w-3.5 mr-1" /> Schnell</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Keine Aufgaben" description="Erstelle eine neue Aufgabenvorlage." actionLabel="Aufgabe erstellen" onAction={() => { resetForm(); setShowCreate(true); }} />
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Titel</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Vergütung</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((tpl) => (
                <tr key={tpl.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{tpl.title}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{tpl.description}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium">{Number(tpl.compensation).toFixed(2)} €</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className={cn("text-[10px] font-medium border", tpl.is_active ? "bg-status-success/15 text-status-success border-status-success/30" : "bg-muted text-muted-foreground border-border")}>
                      {tpl.is_active ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate(`/admin/tasks/builder/${tpl.id}`)}>
                        <Layers className="h-3 w-3 mr-1" /> Builder
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(tpl)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => duplicateTemplate(tpl)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => deleteTemplate(tpl)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(o) => { if (!o) { setShowCreate(false); setEditTemplate(null); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">{editTemplate ? "Aufgabe bearbeiten" : "Neue Aufgabe erstellen"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Titel *</label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Aufgabentitel" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Beschreibung</label>
              <Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Was soll gemacht werden?" rows={3} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Anleitung</label>
              <Textarea value={formInstructions} onChange={(e) => setFormInstructions(e.target.value)} placeholder="Schritt für Schritt…" rows={4} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Vergütung (€)</label>
              <Input type="number" value={formCompensation} onChange={(e) => setFormCompensation(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Bild (optional)</label>
              <div className="flex gap-2">
                <Input value={formImageUrl} onChange={(e) => setFormImageUrl(e.target.value)} placeholder="https://… oder hochladen" />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage(f);
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" disabled={uploadingImage} onClick={() => imageInputRef.current?.click()}>
                  {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                </Button>
              </div>
              {formImageUrl && (
                <div className="flex items-center gap-2 mt-2">
                  <img src={formImageUrl} alt="" className="h-12 w-12 rounded object-cover border border-border" />
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => setFormImageUrl("")}>
                    <Trash2 className="h-3 w-3 mr-1" /> Entfernen
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Fragebogen (optional)</label>
              {formQuestions.map((q, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={q} onChange={(e) => { const nq = [...formQuestions]; nq[i] = e.target.value; setFormQuestions(nq); }} placeholder={`Frage ${i + 1}`} />
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setFormQuestions(formQuestions.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setFormQuestions([...formQuestions, ""])}><Plus className="h-3.5 w-3.5 mr-1" /> Frage</Button>
            </div>
          </div>
          <DialogFooter><Button onClick={saveTemplate} disabled={saving} size="sm">{saving ? "Speichern…" : "Speichern"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
