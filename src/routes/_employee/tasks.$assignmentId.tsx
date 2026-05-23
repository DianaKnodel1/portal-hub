import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_employee/tasks/$assignmentId")({
  component: TaskWizardPage,
});

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Send, Info, AlertTriangle,
  Lightbulb, PlayCircle, ClipboardList, FileText, HelpCircle, PartyPopper,
  Loader2, CalendarDays, Lock, Upload, RotateCcw, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import { type TaskStep, type ContentBlock } from "@/lib/task-blocks";
import { TaskSmsMessages } from "@/components/TaskSmsMessages";
import { AssignmentIndividualDataView } from "@/components/AssignmentIndividualDataView";

interface TaskTemplate {
  id: string; title: string; description: string;
  instructions: string; compensation: number; image_url: string | null;
}
interface TaskQuestion { id: string; question: string; sort_order: number; }
interface IndividualAssignmentData {
  individual_phone: string | null;
  individual_hint: string | null;
  post_ident_pdf_url: string | null;
  post_ident_pdf_name: string | null;
}
interface TaskAssignment {
  id: string; task_template_id: string; status: string;
  admin_comment: string | null; task_templates: TaskTemplate;
  individual_instructions?: string | null;
  individual_phone?: string | null;
  individual_hint?: string | null;
  post_ident_pdf_url?: string | null;
  post_ident_pdf_name?: string | null;
}

function InfoBox({ variant, title, children }: { variant: "info" | "hint" | "warning" | "success"; title?: string; children: React.ReactNode }) {
  const config = {
    info: { bg: "bg-blue-600/90 dark:bg-blue-700/40", border: "border-blue-500/60", icon: Info, iconColor: "text-blue-50 dark:text-blue-300", titleColor: "text-blue-50 dark:text-blue-200", bodyColor: "text-blue-50/95 dark:text-blue-100" },
    hint: { bg: "bg-orange-600/90 dark:bg-orange-700/35", border: "border-orange-500/60", icon: Lightbulb, iconColor: "text-orange-50 dark:text-orange-300", titleColor: "text-orange-50 dark:text-orange-200", bodyColor: "text-orange-50/95 dark:text-orange-100" },
    warning: { bg: "bg-orange-600/90 dark:bg-orange-700/30", border: "border-orange-500/60", icon: AlertTriangle, iconColor: "text-orange-50 dark:text-orange-300", titleColor: "text-orange-50 dark:text-orange-200", bodyColor: "text-orange-50/95 dark:text-orange-100" },
    success: { bg: "bg-emerald-600/90 dark:bg-emerald-700/30", border: "border-emerald-500/60", icon: CheckCircle2, iconColor: "text-emerald-50 dark:text-emerald-300", titleColor: "text-emerald-50 dark:text-emerald-200", bodyColor: "text-emerald-50/95 dark:text-emerald-100" },
  };
  const c = config[variant];
  const Icon = c.icon;
  return (
    <div className={cn("rounded-xl border overflow-hidden", c.border)}>
      {title && (
        <div className={cn("flex items-center gap-2 px-4 py-2.5", c.bg)}>
          <Icon className={cn("h-4 w-4 shrink-0", c.iconColor)} />
          <p className={cn("text-sm font-semibold", c.titleColor)}>{title}</p>
        </div>
      )}
      <div className={cn("p-4 text-sm", c.bg, c.bodyColor, !title && "flex items-start gap-3")}>
        {!title && <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", c.iconColor)} />}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

function DynamicBlockRenderer({
  block, blockData, onDataChange,
}: {
  block: ContentBlock;
  blockData: Record<string, any>;
  onDataChange: (blockId: string, value: any) => void;
}) {
  switch (block.type) {
    case "text":
      return <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{block.content}</p>;
    case "info":
      return <InfoBox variant="info" title={(block as any).label}><p className="whitespace-pre-wrap">{block.content}</p></InfoBox>;
    case "hint":
      return <InfoBox variant="hint" title={(block as any).label || "Vorgegebene Angaben"}><p className="whitespace-pre-wrap">{block.content}</p></InfoBox>;
    case "warning":
      return <InfoBox variant="warning" title={(block as any).label || "Wichtig"}><p className="whitespace-pre-wrap">{block.content}</p></InfoBox>;
    case "success":
      return <InfoBox variant="success" title={(block as any).label}><p className="whitespace-pre-wrap">{block.content}</p></InfoBox>;
    case "checkpoint":
      return <InfoBox variant="success" title="Kontrollpunkt erreicht"><p>{block.content}</p></InfoBox>;
    case "image":
      return block.imageUrl ? (
        <div className="rounded-xl overflow-hidden border border-border">
          <img src={block.imageUrl} alt="" className="w-full h-48 object-cover" />
        </div>
      ) : null;
    case "qr": {
      const url = block.content?.trim();
      if (!url) return null;
      return (
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col items-center gap-3">
          {(block as any).label && (
            <p className="text-sm font-semibold text-foreground">{(block as any).label}</p>
          )}
          <div className="bg-white p-3 rounded-lg">
            <QRCodeSVG value={url} size={160} level="M" />
          </div>
          <p className="text-xs text-muted-foreground break-all text-center max-w-xs">{url}</p>
        </div>
      );
    }
    case "input":
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            {block.label || "Eingabe"} {block.required && <span className="text-destructive">*</span>}
          </label>
          <Input
            value={blockData[block.id] || ""}
            onChange={(e) => onDataChange(block.id, e.target.value)}
            placeholder={block.placeholder || "Antwort eingeben…"}
          />
        </div>
      );
    case "question":
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            {block.label || "Frage"} {block.required && <span className="text-destructive">*</span>}
          </label>
          <Textarea
            value={blockData[block.id] || ""}
            onChange={(e) => onDataChange(block.id, e.target.value)}
            placeholder={block.placeholder || "Antwort eingeben…"}
            rows={2}
          />
        </div>
      );
    case "yes_no":
      return (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {block.label || "Frage"} {block.required && <span className="text-destructive">*</span>}
          </label>
          <div className="flex gap-3">
            <Button
              variant={blockData[block.id] === "ja" ? "default" : "outline"}
              size="sm"
              onClick={() => onDataChange(block.id, "ja")}
            >Ja</Button>
            <Button
              variant={blockData[block.id] === "nein" ? "default" : "outline"}
              size="sm"
              onClick={() => onDataChange(block.id, "nein")}
            >Nein</Button>
          </div>
        </div>
      );
    case "upload":
      return (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            {block.content || "Datei hochladen"} {block.required && <span className="text-destructive">*</span>}
          </label>
          <Input
            type="file"
            multiple
            onChange={(e) => onDataChange(block.id, Array.from(e.target.files ?? []))}
          />
          {blockData[block.id]?.length > 0 && (
            <p className="text-xs text-muted-foreground">{blockData[block.id].length} Datei(en) ausgewählt</p>
          )}
        </div>
      );
    default:
      return null;
  }
}

function TaskWizardPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [assignment, setAssignment] = useState<TaskAssignment | null>(null);
  const [questions, setQuestions] = useState<TaskQuestion[]>([]);
  const [dynamicSteps, setDynamicSteps] = useState<TaskStep[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [blockData, setBlockData] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasBooking, setHasBooking] = useState(false);
  const [step, setStep] = useState(0);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [stepFeedback, setStepFeedback] = useState<{ id: string; step_number: number; block_id: string | null; comment: string; resolved: boolean }[]>([]);

  useEffect(() => {
    if (authLoading || !user || !assignmentId) return;
    loadData();
  }, [user, authLoading, assignmentId]);

  const loadData = async () => {
    try {
      const assignRes = await supabase.from("task_assignments")
        .select("id, task_template_id, status, admin_comment, individual_instructions, individual_phone, individual_hint, post_ident_pdf_url, post_ident_pdf_name, task_templates(id, title, description, instructions, compensation, image_url)")
        .eq("id", assignmentId!).eq("user_id", user!.id).single();
      if (assignRes.error) throw assignRes.error;
      const a = assignRes.data as any as TaskAssignment;
      setAssignment(a);

      const [bookingRes, stepsRes, questionsRes, progressRes, feedbackRes] = await Promise.all([
        // Auch Termine ohne explizite assignment_id-Bindung zählen (z.B. vom Admin manuell erstellt).
        supabase.from("bookings").select("id, status, assignment_id").eq("user_id", user!.id).neq("status", "storniert"),
        supabase.from("task_steps").select("*").eq("task_template_id", a.task_template_id).order("step_number"),
        supabase.from("task_questions").select("*").eq("task_template_id", a.task_template_id).order("sort_order"),
        supabase.from("task_progress").select("*").eq("assignment_id", assignmentId!).maybeSingle(),
        supabase.from("step_feedback").select("*").eq("assignment_id", assignmentId!),
      ]);
      setStepFeedback((feedbackRes.data as any[]) ?? []);

      const allBookings = (bookingRes.data ?? []) as any[];
      const matchesAssignment = allBookings.some((b) => b.assignment_id === assignmentId);
      const generic = allBookings.some((b) => !b.assignment_id);
      setHasBooking(matchesAssignment || generic);
      const loadedSteps = ((stepsRes.data ?? []) as any[]).map((s) => ({
        ...s,
        content_blocks: Array.isArray(s.content_blocks) ? s.content_blocks : [],
      })) as TaskStep[];
      setDynamicSteps(loadedSteps);
      setQuestions((questionsRes.data as TaskQuestion[]) ?? []);

      // Restore saved progress
      const saved = progressRes.data as any;
      if (saved) {
        setProgressId(saved.id);
        setStep(saved.current_step ?? 0);
        const savedAnswers = (saved.answers as any) ?? {};
        if (savedAnswers.blockData) setBlockData(savedAnswers.blockData);
        if (savedAnswers.answers) setAnswers(savedAnswers.answers);
        if (savedAnswers.notes) setNotes(savedAnswers.notes);
      } else if (a.status === "in_bearbeitung" || a.status === "abgelehnt" || a.status === "nachbesserung") {
        setStep(1);
      }
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
      navigate("/tasks");
    } finally {
      setLoading(false);
    }
  };

  const startTask = async () => {
    if (!assignment || !hasBooking) return;
    if (["zugewiesen", "geplant", "nachbesserung"].includes(assignment.status)) {
      await supabase.from("task_assignments").update({ status: "in_bearbeitung" }).eq("id", assignment.id);
      setAssignment({ ...assignment, status: "in_bearbeitung" });
    }
    setStep(1);
  };

  const handleBlockDataChange = (blockId: string, value: any) => {
    setBlockData((prev) => ({ ...prev, [blockId]: value }));
  };

  // Save progress to DB (debounced on step change)
  const saveProgress = async (currentStep: number) => {
    if (!assignment || !user) return;
    const completedSteps = Array.from({ length: currentStep }, (_, i) => i);
    const progressData = {
      assignment_id: assignment.id,
      user_id: user.id,
      current_step: currentStep,
      completed_steps: completedSteps,
      answers: { blockData, answers, notes },
    };
    if (progressId) {
      await supabase.from("task_progress").update(progressData).eq("id", progressId);
    } else {
      const { data } = await supabase.from("task_progress").insert(progressData as any).select("id").single();
      if (data) setProgressId(data.id);
    }
  };

  // Check if current step's required blocks are filled
  const isStepComplete = (stepIdx: number): boolean => {
    if (stepIdx === 0) return true; // Intro always completable
    const dynStep = dynamicSteps[stepIdx - 1];
    if (!dynStep) return true;
    for (const block of dynStep.content_blocks) {
      if (!block.required) continue;
      const val = blockData[block.id];
      if (block.type === "upload" && (!val || val.length === 0)) return false;
      if (["input", "question", "yes_no"].includes(block.type) && (!val || !String(val).trim())) return false;
    }
    return true;
  };

  const submitTask = async () => {
    if (!assignment || !user) return;
    setSubmitting(true);
    try {
      // Collect all files from block data + files state
      const allFiles: File[] = [...files];
      Object.values(blockData).forEach((val) => {
        if (Array.isArray(val) && val[0] instanceof File) allFiles.push(...val);
      });

      const fileUrls: string[] = [];
      for (const raw of allFiles) {
        const file = await compressImage(raw);
        const path = `${user.id}/${assignment.id}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from("task-submissions").upload(path, file);
        if (!error) fileUrls.push(path);
      }

      // Combine answers from legacy questions + dynamic block data
      const combinedNotes = [
        notes,
        ...Object.entries(blockData)
          .filter(([_, v]) => typeof v === "string" && v.trim())
          .map(([k, v]) => `${k}: ${v}`),
      ].filter(Boolean).join("\n\n");

      const { data: submission, error: subError } = await supabase.from("task_submissions")
        .insert({ assignment_id: assignment.id, notes: combinedNotes, file_urls: fileUrls } as any).select("id").single();
      if (subError) throw subError;

      if (submission && questions.length > 0) {
        const answerRows = questions.map((q) => ({
          submission_id: submission.id, question_id: q.id, answer: answers[q.id] || "",
        }));
        await supabase.from("submission_answers").insert(answerRows);
      }

      await supabase.from("task_assignments").update({ status: "eingereicht" }).eq("id", assignment.id);
      
      // Mark all feedback as resolved on re-submission
      if (unresolvedFeedback.length > 0) {
        await supabase.from("step_feedback").update({ resolved: true })
          .eq("assignment_id", assignment.id).eq("resolved", false);
      }

      // Only create transaction if not already exists for this assignment
      const { data: existingTx } = await supabase.from("user_transactions")
        .select("id").eq("assignment_id", assignment.id).limit(1);
      if (!existingTx || existingTx.length === 0) {
        await supabase.from("user_transactions").insert({
          user_id: user.id, assignment_id: assignment.id,
          amount: Number(assignment.task_templates.compensation), status: "ausstehend",
        } as any);
      }

      setStep(totalSteps - 1);
      setAssignment({ ...assignment, status: "eingereicht" });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-lg bg-primary/20 animate-pulse" />
      </div>
    );
  }

  if (!assignment) return null;

  const tpl = assignment.task_templates;
  const hasDynamicSteps = dynamicSteps.length > 0;

  // Build wizard steps: Intro + dynamic steps (or legacy fallback) + Submit + Completion
  const wizardStepLabels: { label: string; icon: any }[] = [
    { label: "Einführung", icon: FileText },
  ];

  if (hasDynamicSteps) {
    dynamicSteps.forEach((ds) => {
      wizardStepLabels.push({ label: ds.title || "Schritt", icon: ClipboardList });
    });
  } else {
    wizardStepLabels.push(
      { label: "Vorbereitung", icon: ClipboardList },
      { label: "Durchführung", icon: PlayCircle },
    );
  }

  // Fragebogen step (if legacy questions exist or dynamic steps have interactive blocks)
  const hasLegacyQuestions = questions.length > 0;
  if (hasLegacyQuestions && !hasDynamicSteps) {
    wizardStepLabels.push({ label: "Fragebogen", icon: HelpCircle });
  }

  // Submit step
  wizardStepLabels.push({ label: "Einreichung", icon: Send });
  // Completion step
  wizardStepLabels.push({ label: "Abschluss", icon: PartyPopper });

  const totalSteps = wizardStepLabels.length;
  const progress = ((step + 1) / totalSteps) * 100;
  const completionStepIdx = totalSteps - 1;
  const submitStepIdx = totalSteps - 2;
  const isFinished = ["eingereicht", "in_pruefung", "genehmigt"].includes(assignment.status);
  const isRejected = assignment.status === "abgelehnt";
  const needsRevision = assignment.status === "nachbesserung";
  const unresolvedFeedback = stepFeedback.filter((f) => !f.resolved);
  const feedbackForStep = (stepNum: number) => unresolvedFeedback.filter((f) => f.step_number === stepNum);
  const stepHasFeedback = (stepNum: number) => feedbackForStep(stepNum).length > 0;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      {/* Main content (left) */}
      <div className="flex-1 flex flex-col overflow-auto min-w-0 order-1">
        {/* Mobile header */}
        <div className="lg:hidden border-b border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/tasks")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Zurück
            </Button>
            <Badge variant="secondary" className="text-xs">Schritt {step + 1}/{totalSteps}</Badge>
          </div>
          <Progress value={progress} className="h-1" />
        </div>


        <div className="flex-1 p-6 lg:p-8 max-w-3xl mx-auto w-full space-y-6">
          {/* Step 0: Einführung */}
          {step === 0 && (
            <div className="space-y-6 animate-fade-in">
              {tpl.image_url && (
                <div className="h-48 rounded-2xl overflow-hidden bg-muted">
                  <img src={tpl.image_url} alt={tpl.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-heading font-bold text-foreground">{tpl.title}</h1>
                <p className="text-muted-foreground mt-2">{tpl.description}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoBox variant="hint" title="Vergütung">
                  <p className="font-bold text-2xl">{Number(tpl.compensation).toFixed(2).replace(".", ",")} €</p>
                </InfoBox>
                <InfoBox variant="hint">
                  <p className="font-medium">So funktioniert's</p>
                  <p className="text-muted-foreground mt-1">Folge den Schritten und reiche dein Ergebnis ein.</p>
                </InfoBox>
              </div>

              {(isRejected || needsRevision) && (
                <InfoBox variant="warning">
                  <p className="font-medium">
                    {needsRevision ? "Nachbesserung erforderlich 🔄" : "Deine letzte Einreichung wurde abgelehnt"}
                  </p>
                  {assignment.admin_comment && <p className="text-muted-foreground mt-1">{assignment.admin_comment}</p>}
                  {unresolvedFeedback.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium">Zu korrigieren:</p>
                      {unresolvedFeedback.map((fb) => (
                        <p key={fb.id} className="text-xs text-muted-foreground">• Schritt {fb.step_number}: {fb.comment}</p>
                      ))}
                    </div>
                  )}
                </InfoBox>
              )}

              {isFinished && (
                <InfoBox variant="success">
                  <p className="font-medium">
                    {assignment.status === "genehmigt" ? "Auftrag genehmigt! 🎉" : "Einreichung wird geprüft"}
                  </p>
                </InfoBox>
              )}

              {!hasBooking && (
                <div className="space-y-3">
                  <InfoBox variant="warning">
                    <p className="font-medium">Termin erforderlich</p>
                    <p className="text-muted-foreground mt-1">Du musst zuerst einen Termin buchen.</p>
                  </InfoBox>
                  <Button variant="outline" className="w-full" onClick={() => navigate("/appointments")}>
                    <CalendarDays className="h-4 w-4 mr-2" /> Termin buchen
                  </Button>
                </div>
              )}

              {/* Individuelle Auftragsdaten für diesen Mitarbeiter */}
              <AssignmentIndividualDataView data={{
                individual_phone: assignment.individual_phone ?? null,
                individual_hint: assignment.individual_hint ?? null,
                post_ident_pdf_url: assignment.post_ident_pdf_url ?? null,
                post_ident_pdf_name: assignment.post_ident_pdf_name ?? null,
              }} />

              {/* SMS Messages for this assignment */}
              {assignmentId && <TaskSmsMessages assignmentId={assignmentId} />}
            </div>
          )}

          {/* Dynamic steps (1 to N) */}
          {hasDynamicSteps && step >= 1 && step <= dynamicSteps.length && (() => {
            const dynStep = dynamicSteps[step - 1];
            if (!dynStep) return null;
            return (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h2 className="text-xl font-heading font-bold text-foreground">{dynStep.title}</h2>
                  {dynStep.description && <p className="text-muted-foreground mt-1">{dynStep.description}</p>}
                </div>

                {/* Show step feedback if exists */}
                {feedbackForStep(step).length > 0 && (
                  <div className="space-y-2">
                    {feedbackForStep(step).map((fb) => (
                      <div key={fb.id} className="flex items-start gap-3 p-4 rounded-xl border bg-status-pending/5 border-status-pending/15">
                        <MessageSquare className="h-4 w-4 shrink-0 mt-0.5 text-status-pending" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-status-pending">Feedback vom Teamleiter</p>
                          <p className="text-sm text-foreground mt-1">{fb.comment}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Auto-start task on first dynamic step */}
                {step === 1 && (assignment.status === "zugewiesen" || assignment.status === "geplant") && hasBooking && (
                  <Button onClick={startTask} className="w-full h-11 gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]">
                    <PlayCircle className="h-4 w-4" /> Aufgabe jetzt starten
                  </Button>
                )}

                {dynStep.content_blocks.map((block) => (
                  <DynamicBlockRenderer
                    key={block.id}
                    block={block}
                    blockData={blockData}
                    onDataChange={handleBlockDataChange}
                  />
                ))}
              </div>
            );
          })()}

          {/* Legacy fallback steps (no dynamic steps) */}
          {!hasDynamicSteps && step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-heading font-bold text-foreground">Vorbereitung</h2>
                <p className="text-muted-foreground mt-1">Lies die Anleitung sorgfältig durch.</p>
              </div>
              {(assignment.individual_instructions || tpl.instructions) ? (
                <Card className="border-none shadow-md">
                  <CardContent className="pt-5 pb-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Anleitung</p>
                    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{assignment.individual_instructions || tpl.instructions}</div>
                  </CardContent>
                </Card>
              ) : (
                <InfoBox variant="info"><p>Keine spezielle Anleitung. Du kannst direkt starten.</p></InfoBox>
              )}
              {!hasBooking && (
                <InfoBox variant="warning"><p className="font-medium">Termin erforderlich</p></InfoBox>
              )}
            </div>
          )}

          {!hasDynamicSteps && step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-heading font-bold text-foreground">Durchführung</h2>
                <p className="text-muted-foreground mt-1">Folge der Anleitung Schritt für Schritt. Notiere offene Fragen direkt im Chat mit deinem Teamleiter.</p>
              </div>
              {(assignment.status === "zugewiesen" || assignment.status === "geplant") && hasBooking && (
                <Button onClick={startTask} className="w-full h-11 gap-2">
                  <PlayCircle className="h-4 w-4" /> Aufgabe jetzt starten
                </Button>
              )}
              {(assignment.status === "in_bearbeitung" || isRejected || needsRevision) && (
                <>
                  <InfoBox variant="success">
                    <p className="font-medium">Aufgabe ist gestartet</p>
                    <p className="mt-1 opacity-90">Arbeite die nachfolgenden Punkte ab. Sobald du fertig bist, gehe auf „Weiter" und reiche deine Ergebnisse ein.</p>
                  </InfoBox>
                  {(assignment.individual_instructions || tpl.instructions) && (
                    <Card className="border-none shadow-md">
                      <CardContent className="pt-5 pb-5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Anleitung</p>
                        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{assignment.individual_instructions || tpl.instructions}</div>
                      </CardContent>
                    </Card>
                  )}
                  <AssignmentIndividualDataView data={{
                    individual_phone: assignment.individual_phone ?? null,
                    individual_hint: assignment.individual_hint ?? null,
                    post_ident_pdf_url: assignment.post_ident_pdf_url ?? null,
                    post_ident_pdf_name: assignment.post_ident_pdf_name ?? null,
                  }} />
                  {assignmentId && <TaskSmsMessages assignmentId={assignmentId} />}
                </>
              )}
            </div>
          )}

          {/* Legacy fragebogen step */}
          {!hasDynamicSteps && hasLegacyQuestions && step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-heading font-bold text-foreground">Fragebogen</h2>
              </div>
              <Card className="border-none shadow-md">
                <CardContent className="pt-5 pb-5 space-y-4">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">{idx + 1}. {q.question}</label>
                      <Textarea
                        value={answers[q.id] ?? ""}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Deine Antwort…"
                        rows={2}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Submit step */}
          {step === submitStepIdx && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-heading font-bold text-foreground">Einreichung</h2>
                <p className="text-muted-foreground mt-1">Überprüfe deine Eingaben und reiche den Auftrag ein.</p>
              </div>

              <Card className="border-none shadow-md">
                <CardContent className="pt-5 pb-5 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Notizen <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Zusätzliche Hinweise…" rows={3} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Weitere Dateien <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <Input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
                    {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} Datei(en)</p>}
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={submitTask}
                disabled={submitting}
                className="w-full h-12 gap-2 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Wird eingereicht…</>
                ) : (
                  <><Send className="h-4 w-4" /> Auftrag einreichen</>
                )}
              </Button>
            </div>
          )}

          {/* Completion step */}
          {step === completionStepIdx && (
            <div className="space-y-6 animate-fade-in text-center py-8">
              <div className="h-20 w-20 rounded-3xl bg-accent/10 flex items-center justify-center mx-auto">
                <PartyPopper className="h-10 w-10 text-accent" />
              </div>
              <h2 className="text-2xl font-heading font-bold text-foreground">Auftrag eingereicht! 🎉</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Dein Auftrag wird jetzt geprüft. Die Vergütung von <strong className="text-foreground">{Number(tpl.compensation).toFixed(2).replace(".", ",")} €</strong> wird
                nach Genehmigung gutgeschrieben.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                <Button onClick={() => navigate("/tasks")} className="gap-2">
                  <ClipboardList className="h-4 w-4" /> Zu meinen Aufträgen
                </Button>
                <Button variant="outline" onClick={() => navigate("/dashboard")}>Zum Dashboard</Button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom navigation */}
        {step < completionStepIdx && (
          <div className="border-t border-border bg-card px-6 py-4 shrink-0">
            <div className="max-w-3xl mx-auto flex justify-between items-center">
              <Button
                variant="outline"
                onClick={() => { const ns = Math.max(0, step - 1); setStep(ns); saveProgress(ns); }}
                disabled={step === 0}
                className="gap-1"
              >
                <ArrowLeft className="h-4 w-4" /> Zurück
              </Button>
              <div className="hidden sm:flex items-center gap-1.5">
                {wizardStepLabels.map((_, i) => (
                  <div key={i} className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === step ? "w-6 bg-primary" : i < step ? "w-3 bg-accent" : "w-3 bg-muted",
                  )} />
                ))}
              </div>
              {step < submitStepIdx ? (
                <Button
                  onClick={() => {
                    if (step === 0 && !hasBooking) return;
                    if (hasDynamicSteps && step === 1 && (assignment.status === "zugewiesen" || assignment.status === "geplant") && hasBooking) {
                      startTask();
                    }
                    if (!isStepComplete(step)) {
                      toast({ title: "Bitte fülle alle Pflichtfelder aus", variant: "destructive" });
                      return;
                    }
                    const ns = step + 1; setStep(ns); saveProgress(ns);
                  }}
                  disabled={step === 0 && !hasBooking}
                  className="gap-1"
                >
                  {hasDynamicSteps && dynamicSteps[step - 1]?.button_label
                    ? dynamicSteps[step - 1].button_label
                    : "Weiter"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <div />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar — Fortschritt & Status */}
      <aside className="hidden lg:flex w-72 border-l border-border bg-card flex-col shrink-0 order-2">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-heading font-bold text-foreground">Fortschritt & Status</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Auftrag</p>
              {tpl.image_url ? (
                <div className="h-12 w-12 rounded-xl overflow-hidden bg-muted">
                  <img src={tpl.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex flex-col items-center text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Fortschritt</p>
              <div className="h-12 w-12 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-xs font-bold text-primary">
                {step + 1}/{totalSteps}
              </div>
            </div>
            <div className="flex flex-col items-center text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Vergütung</p>
              <div className="h-12 w-12 rounded-full bg-emerald-500 border-2 border-emerald-600 flex items-center justify-center text-[11px] font-bold text-white leading-tight shadow-sm">
                €{Number(tpl.compensation).toFixed(0)}
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {wizardStepLabels.map((s, i) => {
            const StepIcon = s.icon;
            const isDone = i < step || (i === completionStepIdx && isFinished);
            const isCurrent = i === step;
            const isLocked = i > step && !isFinished && !needsRevision;
            const hasFb = i >= 1 && i <= dynamicSteps.length && stepHasFeedback(i);
            return (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                  isCurrent && "bg-primary/10",
                  (needsRevision && hasFb) && "cursor-pointer hover:bg-status-pending/10",
                )}
                onClick={() => { if (needsRevision && hasFb) setStep(i); }}
              >
                <div className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5",
                  isCurrent && "bg-primary text-primary-foreground",
                  isDone && !hasFb && "bg-accent text-accent-foreground",
                  hasFb && "bg-status-pending/20 text-status-pending",
                  isLocked && "bg-muted text-muted-foreground/40",
                  !isCurrent && !isDone && !isLocked && !hasFb && "bg-muted text-muted-foreground",
                )}>
                  {hasFb ? <RotateCcw className="h-3.5 w-3.5" /> :
                   isDone ? <CheckCircle2 className="h-4 w-4" /> : <StepIcon className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-medium truncate",
                    isCurrent && "text-primary",
                    isDone && !hasFb && "text-accent",
                    hasFb && "text-status-pending",
                    isLocked && "text-muted-foreground/40",
                  )}>{s.label}</p>
                  <p className="text-[11px] text-muted-foreground">Schritt {i}</p>
                </div>
                {hasFb && <span className="text-[10px] text-status-pending font-medium">{feedbackForStep(i).length}</span>}
              </div>
            );
          })}
        </div>
        <div className="p-4 border-t border-border">
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground mt-1.5 text-center">{Math.round(progress)}% abgeschlossen</p>
        </div>
      </aside>
    </div>
  );
}
