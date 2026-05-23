import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/tasks/builder/$templateId")({
  component: AdminTemplateBuilderPage,
});

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft, Plus, Trash2, GripVertical, Save, Eye, ChevronDown, ChevronUp,
  FileText, ClipboardList, PlayCircle, HelpCircle, PartyPopper, CheckCircle2,
  Loader2, Copy, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type ContentBlock, type BlockType, type TaskStep,
  BLOCK_TYPE_LABELS, BLOCK_TYPE_ICONS, createBlock, createStep,
} from "@/lib/task-blocks";
import { TaskStepPreview } from "@/components/TaskStepPreview";

interface TemplateData {
  id: string; title: string; description: string;
  instructions: string; compensation: number; image_url: string | null;
}

function AdminTemplateBuilderPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});

  // Template basic fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [compensation, setCompensation] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    loadTemplate();
  }, [templateId]);

  const loadTemplate = async () => {
    if (!templateId || templateId === "new") {
      setLoading(false);
      return;
    }
    try {
      const [tplRes, stepsRes] = await Promise.all([
        supabase.from("task_templates").select("*").eq("id", templateId).single(),
        supabase.from("task_steps").select("*").eq("task_template_id", templateId).order("step_number"),
      ]);
      if (tplRes.error) throw tplRes.error;
      const t = tplRes.data as any;
      setTemplate(t);
      setTitle(t.title);
      setDescription(t.description);
      setInstructions(t.instructions);
      setCompensation(String(t.compensation));
      setImageUrl(t.image_url || "");

      const loadedSteps = ((stepsRes.data ?? []) as any[]).map((s) => ({
        ...s,
        content_blocks: Array.isArray(s.content_blocks) ? s.content_blocks : [],
      })) as TaskStep[];
      setSteps(loadedSteps);
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveAll = async () => {
    if (!title.trim()) {
      toast({ title: "Titel erforderlich", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let tplId = templateId;

      if (!templateId || templateId === "new") {
        // Create new template
        const { data, error } = await supabase.from("task_templates").insert({
          title: title.trim(), description, instructions,
          compensation: parseFloat(compensation) || 0,
          created_by: user!.id, image_url: imageUrl || null,
        }).select("id").single();
        if (error) throw error;
        tplId = data.id;
      } else {
        // Update template
        const { error } = await supabase.from("task_templates").update({
          title: title.trim(), description, instructions,
          compensation: parseFloat(compensation) || 0,
          image_url: imageUrl || null,
        }).eq("id", templateId);
        if (error) throw error;
      }

      // Delete existing steps and re-insert
      if (templateId && templateId !== "new") {
        await supabase.from("task_steps").delete().eq("task_template_id", templateId);
      }

      if (steps.length > 0) {
        const stepsToInsert = steps.map((s, i) => ({
          task_template_id: tplId!,
          step_number: i + 1,
          title: s.title,
          description: s.description,
          content_blocks: JSON.parse(JSON.stringify(s.content_blocks)),
          is_required: s.is_required,
          button_label: s.button_label,
        }));
        const { error } = await supabase.from("task_steps").insert(stepsToInsert as any);
        if (error) throw error;
      }

      toast({ title: "Vorlage gespeichert ✅" });
      if (templateId === "new") {
        navigate(`/admin/tasks/builder/${tplId}`, { replace: true });
      }
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addStep = () => {
    const newStep: TaskStep = {
      ...createStep(templateId || "", steps.length + 1),
      id: crypto.randomUUID(),
    } as TaskStep;
    setSteps([...steps, newStep]);
    setActiveStep(steps.length);
  };

  const removeStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx));
    if (activeStep >= idx && activeStep > 0) setActiveStep(activeStep - 1);
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= steps.length) return;
    const newSteps = [...steps];
    [newSteps[idx], newSteps[newIdx]] = [newSteps[newIdx], newSteps[idx]];
    setSteps(newSteps);
    setActiveStep(newIdx);
  };

  const updateStep = (idx: number, patch: Partial<TaskStep>) => {
    setSteps(steps.map((s, i) => i === idx ? { ...s, ...patch } : s));
  };

  const addBlock = (stepIdx: number, type: BlockType) => {
    const block = createBlock(type);
    const step = steps[stepIdx];
    updateStep(stepIdx, { content_blocks: [...step.content_blocks, block] });
    setExpandedBlocks({ ...expandedBlocks, [block.id]: true });
  };

  const updateBlock = (stepIdx: number, blockIdx: number, patch: Partial<ContentBlock>) => {
    const step = steps[stepIdx];
    const blocks = step.content_blocks.map((b, i) => i === blockIdx ? { ...b, ...patch } : b);
    updateStep(stepIdx, { content_blocks: blocks });
  };

  const removeBlock = (stepIdx: number, blockIdx: number) => {
    const step = steps[stepIdx];
    updateStep(stepIdx, { content_blocks: step.content_blocks.filter((_, i) => i !== blockIdx) });
  };

  const moveBlock = (stepIdx: number, blockIdx: number, dir: -1 | 1) => {
    const step = steps[stepIdx];
    const newIdx = blockIdx + dir;
    if (newIdx < 0 || newIdx >= step.content_blocks.length) return;
    const blocks = [...step.content_blocks];
    [blocks[blockIdx], blocks[newIdx]] = [blocks[newIdx], blocks[blockIdx]];
    updateStep(stepIdx, { content_blocks: blocks });
  };

  const duplicateTemplate = async () => {
    if (!templateId || templateId === "new") return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from("task_templates").insert({
        title: `${title} (Kopie)`, description, instructions,
        compensation: parseFloat(compensation) || 0,
        created_by: user!.id, image_url: imageUrl || null,
      }).select("id").single();
      if (error) throw error;

      if (steps.length > 0) {
        const stepsToInsert = steps.map((s, i) => ({
          task_template_id: data.id,
          step_number: i + 1, title: s.title, description: s.description,
          content_blocks: JSON.parse(JSON.stringify(s.content_blocks)), is_required: s.is_required, button_label: s.button_label,
        }));
        await supabase.from("task_steps").insert(stepsToInsert as any);
      }

      toast({ title: "Vorlage dupliziert ✅" });
      navigate(`/admin/tasks/builder/${data.id}`);
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentStep = steps[activeStep];
  const blockTypes: BlockType[] = ["text", "info", "hint", "warning", "success", "image", "qr", "input", "question", "yes_no", "upload", "checkpoint"];

  if (showPreview) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Zurück zum Editor
            </Button>
            <Badge variant="secondary" className="text-xs">Vorschau</Badge>
          </div>
        </div>
        <TaskStepPreview
          templateTitle={title}
          templateDescription={description}
          compensation={parseFloat(compensation) || 0}
          imageUrl={imageUrl || null}
          steps={steps}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      {/* Left: Step list */}
      <aside className="w-64 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("/admin/tasks")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Zurück
          </Button>
          <h2 className="text-sm font-heading font-bold text-foreground truncate">{title || "Neue Vorlage"}</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">{steps.length} Schritte</p>
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Template settings tab */}
          <button
            onClick={() => setActiveStep(-1)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-all",
              activeStep === -1 ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted",
            )}
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">Grunddaten</span>
          </button>

          {steps.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveStep(i)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-all group",
                activeStep === i ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted",
              )}
            >
              <div className={cn(
                "h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0",
                activeStep === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}>
                {i + 1}
              </div>
              <span className="truncate flex-1">{s.title || `Schritt ${i + 1}`}</span>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); moveStep(i, -1); }} className="p-0.5 hover:text-primary" title="Nach oben"><ChevronUp className="h-3 w-3" /></button>
                <button onClick={(e) => { e.stopPropagation(); moveStep(i, 1); }} className="p-0.5 hover:text-primary" title="Nach unten"><ChevronDown className="h-3 w-3" /></button>
              </div>
            </button>
          ))}

          <Button variant="outline" size="sm" className="w-full mt-2 text-xs" onClick={addStep}>
            <Plus className="h-3 w-3 mr-1" /> Schritt hinzufügen
          </Button>
        </div>

        {/* Actions */}
        <div className="p-3 border-t border-border space-y-2">
          <Button size="sm" className="w-full gap-1" onClick={saveAll} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Speichern
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setShowPreview(true)}>
              <Eye className="h-3 w-3 mr-1" /> Vorschau
            </Button>
            {templateId && templateId !== "new" && (
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={duplicateTemplate} disabled={saving}>
                <Copy className="h-3 w-3 mr-1" /> Duplizieren
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Right: Editor */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-3xl">
        {/* Template basic settings */}
        {activeStep === -1 && (
          <div className="space-y-5 animate-fade-in">
            <h2 className="text-lg font-heading font-bold text-foreground">Grunddaten der Vorlage</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Titel *</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Aufgabentitel" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Beschreibung</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Was soll gemacht werden?" rows={3} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Anleitung</label>
                <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Schritt-für-Schritt Anleitung…" rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Vergütung (€)</label>
                  <Input type="number" value={compensation} onChange={(e) => setCompensation(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Bild-URL (optional)</label>
                  <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
                </div>
              </div>
              {imageUrl && <img src={imageUrl} alt="Preview" className="h-32 w-full object-cover rounded-xl border border-border" />}
            </div>
          </div>
        )}

        {/* Step editor */}
        {activeStep >= 0 && currentStep && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-heading font-bold text-foreground">
                  Schritt {activeStep + 1}
                </h2>
                <p className="text-xs text-muted-foreground">{currentStep.content_blocks.length} Inhaltsblöcke</p>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeStep(activeStep)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Entfernen
              </Button>
            </div>

            {/* Step meta */}
            <Card className="border-none shadow-sm">
              <CardContent className="pt-5 pb-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Schritt-Titel</label>
                  <Input
                    value={currentStep.title}
                    onChange={(e) => updateStep(activeStep, { title: e.target.value })}
                    placeholder="z.B. Vorbereitung"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Beschreibung</label>
                  <Textarea
                    value={currentStep.description}
                    onChange={(e) => updateStep(activeStep, { description: e.target.value })}
                    placeholder="Was passiert in diesem Schritt?"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Button-Text</label>
                    <Input
                      value={currentStep.button_label}
                      onChange={(e) => updateStep(activeStep, { button_label: e.target.value })}
                      placeholder="Weiter"
                    />
                  </div>
                  <div className="flex items-end gap-2 pb-0.5">
                    <Switch
                      checked={currentStep.is_required}
                      onCheckedChange={(v) => updateStep(activeStep, { is_required: v })}
                    />
                    <label className="text-xs text-muted-foreground">Pflichtschritt</label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Content blocks */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Inhaltsblöcke</p>

              {currentStep.content_blocks.map((block, bi) => {
                const isExpanded = expandedBlocks[block.id] !== false;
                return (
                  <Card key={block.id} className="border shadow-sm">
                    <div
                      className="flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedBlocks({ ...expandedBlocks, [block.id]: !isExpanded })}
                    >
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                      <span className="text-sm shrink-0">{BLOCK_TYPE_ICONS[block.type]}</span>
                      <span className="text-sm font-medium text-foreground flex-1 truncate">
                        {BLOCK_TYPE_LABELS[block.type]}
                        {block.content && <span className="text-muted-foreground font-normal ml-2 text-xs">– {block.content.slice(0, 40)}</span>}
                      </span>
                      {block.required && <Badge variant="secondary" className="text-[9px] h-4">Pflicht</Badge>}
                      <div className="flex gap-0.5">
                        <button onClick={(e) => { e.stopPropagation(); moveBlock(activeStep, bi, -1); }} className="p-1 hover:text-primary"><ChevronUp className="h-3 w-3" /></button>
                        <button onClick={(e) => { e.stopPropagation(); moveBlock(activeStep, bi, 1); }} className="p-1 hover:text-primary"><ChevronDown className="h-3 w-3" /></button>
                        <button onClick={(e) => { e.stopPropagation(); removeBlock(activeStep, bi); }} className="p-1 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                    {isExpanded && (
                      <CardContent className="pt-0 pb-4 px-4 space-y-3 border-t border-border">
                        {/* Content field for text-based blocks */}
                        {["text", "info", "hint", "warning", "success", "checkpoint"].includes(block.type) && (
                          <div className="space-y-1.5 mt-3">
                            <label className="text-xs text-muted-foreground">Inhalt</label>
                            <Textarea
                              value={block.content}
                              onChange={(e) => updateBlock(activeStep, bi, { content: e.target.value })}
                              placeholder="Text eingeben…"
                              rows={3}
                            />
                          </div>
                        )}

                        {/* Label for input/question blocks */}
                        {["question", "yes_no", "input"].includes(block.type) && (
                          <>
                            <div className="space-y-1.5 mt-3">
                              <label className="text-xs text-muted-foreground">Frage / Label</label>
                              <Input
                                value={block.label || ""}
                                onChange={(e) => updateBlock(activeStep, bi, { label: e.target.value })}
                                placeholder="z.B. Wie war die Qualität?"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs text-muted-foreground">Platzhalter</label>
                              <Input
                                value={block.placeholder || ""}
                                onChange={(e) => updateBlock(activeStep, bi, { placeholder: e.target.value })}
                                placeholder="Antwort eingeben…"
                              />
                            </div>
                          </>
                        )}

                        {/* Image URL */}
                        {block.type === "image" && (
                          <div className="space-y-1.5 mt-3">
                            <label className="text-xs text-muted-foreground">Bild-URL</label>
                            <Input
                              value={block.imageUrl || ""}
                              onChange={(e) => updateBlock(activeStep, bi, { imageUrl: e.target.value })}
                              placeholder="https://…"
                            />
                            {block.imageUrl && <img src={block.imageUrl} alt="" className="h-24 rounded-lg object-cover border border-border" />}
                          </div>
                        )}

                        {/* QR code URL + optional label */}
                        {block.type === "qr" && (
                          <div className="space-y-2 mt-3">
                            <div className="space-y-1.5">
                              <label className="text-xs text-muted-foreground">Beschriftung (optional)</label>
                              <Input
                                value={block.label || ""}
                                onChange={(e) => updateBlock(activeStep, bi, { label: e.target.value })}
                                placeholder="z.B. Scanne diesen QR-Code"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs text-muted-foreground">Ziel-URL / Inhalt</label>
                              <Input
                                value={block.content}
                                onChange={(e) => updateBlock(activeStep, bi, { content: e.target.value })}
                                placeholder="https://…"
                              />
                            </div>
                          </div>
                        )}

                        {/* Upload label */}
                        {block.type === "upload" && (
                          <div className="space-y-1.5 mt-3">
                            <label className="text-xs text-muted-foreground">Upload-Beschreibung</label>
                            <Input
                              value={block.content}
                              onChange={(e) => updateBlock(activeStep, bi, { content: e.target.value })}
                              placeholder="z.B. Lade ein Foto des Ergebnisses hoch"
                            />
                          </div>
                        )}

                        {/* Required toggle */}
                        {["upload", "question", "yes_no", "input", "checkpoint"].includes(block.type) && (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={block.required ?? false}
                              onCheckedChange={(v) => updateBlock(activeStep, bi, { required: v })}
                            />
                            <label className="text-xs text-muted-foreground">Pflichtfeld</label>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}

              {/* Add block buttons */}
              <div className="pt-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Block hinzufügen</p>
                <div className="flex flex-wrap gap-1.5">
                  {blockTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => addBlock(activeStep, type)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted hover:border-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <span>{BLOCK_TYPE_ICONS[type]}</span>
                      {BLOCK_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeStep >= 0 && !currentStep && (
          <div className="text-center py-12 text-muted-foreground">
            <p>Kein Schritt ausgewählt.</p>
          </div>
        )}
      </div>
    </div>
  );
}
