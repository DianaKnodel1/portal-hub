import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/assignments/$assignmentId")({
  component: AdminAssignmentDetailPage,
});

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAdminData } from "@/contexts/AdminDataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, CheckCircle2, XCircle, FileText, User, Calendar, Send,
  RotateCcw, MessageSquare, Plus, Trash2, Phone, Download,
} from "lucide-react";
import { TaskSmsMessages } from "@/components/TaskSmsMessages";
import { AssignmentIndividualData } from "@/components/AssignmentIndividualData";
import { getNextAvailableSlot } from "@/lib/slot-utils";

type AssignmentStatus = "entwurf" | "zugewiesen" | "geplant" | "in_bearbeitung" | "eingereicht" | "in_pruefung" | "genehmigt" | "abgelehnt" | "abgeschlossen" | "nachbesserung";

const STATUS_LABELS: Record<string, string> = {
  entwurf: "Entwurf", zugewiesen: "Zugewiesen", geplant: "Geplant",
  in_bearbeitung: "In Bearbeitung", eingereicht: "Eingereicht",
  in_pruefung: "In Prüfung", genehmigt: "Genehmigt", abgelehnt: "Abgelehnt",
  abgeschlossen: "Abgeschlossen", nachbesserung: "Nachbesserung",
};

const STATUS_COLORS: Record<string, string> = {
  entwurf: "bg-muted text-muted-foreground",
  zugewiesen: "bg-status-info/10 text-status-info",
  geplant: "bg-primary/10 text-primary",
  in_bearbeitung: "bg-status-pending/10 text-status-pending",
  eingereicht: "bg-status-info/10 text-status-info",
  in_pruefung: "bg-status-pending/10 text-status-pending",
  genehmigt: "bg-accent/10 text-accent",
  abgelehnt: "bg-destructive/10 text-destructive",
  abgeschlossen: "bg-accent/10 text-accent",
  nachbesserung: "bg-status-pending/10 text-status-pending",
};

interface SubmissionRow {
  id: string; assignment_id: string; notes: string | null;
  file_urls: string[] | null; submitted_at: string;
}
interface SubmissionAnswer { id: string; question_id: string; answer: string; }
interface TaskQuestion { id: string; question: string; sort_order: number; }
interface StepFeedback {
  id: string; assignment_id: string; step_number: number;
  block_id: string | null; comment: string; resolved: boolean;
}
interface TaskStepRow {
  id: string; step_number: number; title: string; description: string;
}

function AdminAssignmentDetailPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { assignments, templates, getProfileForUser, allBookings, loadData } = useAdminData();

  const assignment = assignments.find((a) => a.id === assignmentId);
  const template = assignment ? templates.find((t) => t.id === assignment.task_template_id) : null;
  const profile = assignment ? getProfileForUser(assignment.user_id) : undefined;
  const booking = assignment ? allBookings.find((b) => b.assignment_id === assignment.id) : undefined;

  const [submission, setSubmission] = useState<SubmissionRow | null>(null);
  const [answers, setAnswers] = useState<SubmissionAnswer[]>([]);
  const [questions, setQuestions] = useState<TaskQuestion[]>([]);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  
  const [smsChannels, setSmsChannels] = useState<{ id: string; phone_number: string; label: string }[]>([]);
  const [selectedSmsChannel, setSelectedSmsChannel] = useState<string>("");

  // Step feedback
  const [taskSteps, setTaskSteps] = useState<TaskStepRow[]>([]);
  const [existingFeedback, setExistingFeedback] = useState<StepFeedback[]>([]);
  const [newFeedback, setNewFeedback] = useState<{ step_number: number; block_id: string; comment: string }[]>([]);

  useEffect(() => {
    if (!assignment) return;
    loadDetails();
  }, [assignment]);

  const loadDetails = async () => {
    if (!assignment) return;
    const [subRes, qRes, stepsRes, fbRes, chRes] = await Promise.all([
      supabase.from("task_submissions").select("*").eq("assignment_id", assignment.id).order("created_at", { ascending: false }).limit(1),
      supabase.from("task_questions").select("*").eq("task_template_id", assignment.task_template_id).order("sort_order"),
      supabase.from("task_steps").select("id, step_number, title, description").eq("task_template_id", assignment.task_template_id).order("step_number"),
      supabase.from("step_feedback").select("*").eq("assignment_id", assignment.id),
      supabase.from("sms_channels").select("id, phone_number, label"),
    ]);
    setSmsChannels((chRes.data as any[]) ?? []);
    setSelectedSmsChannel((assignment as any).sms_channel_id ?? "");
    const sub = (subRes.data as unknown as SubmissionRow[])?.[0] ?? null;
    setSubmission(sub);
    setQuestions((qRes.data as TaskQuestion[]) ?? []);
    setTaskSteps((stepsRes.data as TaskStepRow[]) ?? []);
    setExistingFeedback((fbRes.data as StepFeedback[]) ?? []);
    if (sub) {
      const { data: ans } = await supabase.from("submission_answers").select("*").eq("submission_id", sub.id);
      setAnswers((ans as SubmissionAnswer[]) ?? []);
      const urls: string[] = [];
      for (const path of sub.file_urls ?? []) {
        const { data } = await supabase.storage.from("task-submissions").createSignedUrl(path, 600);
        if (data?.signedUrl) urls.push(data.signedUrl);
      }
      setFileUrls(urls);
    }
    setLoading(false);
  };

  const updateStatus = async (status: AssignmentStatus) => {
    if (!assignment || !user) return;
    const { error } = await supabase.from("task_assignments")
      .update({ status, admin_comment: comment || null } as any).eq("id", assignment.id);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }

    // Save any new feedback
    if (newFeedback.length > 0 && (status === "nachbesserung" || status === "abgelehnt")) {
      await supabase.from("step_feedback").insert(
        newFeedback.filter((f) => f.comment.trim()).map((f) => ({
          assignment_id: assignment.id,
          step_number: f.step_number,
          block_id: f.block_id || null,
          comment: f.comment,
          created_by: user.id,
        }))
      );
      setNewFeedback([]);
    }

    if (status === "genehmigt" && template && template.compensation > 0) {
      await supabase.from("user_transactions").insert({
        user_id: assignment.user_id, assignment_id: assignment.id,
        amount: template.compensation, status: "genehmigt",
      });
    }
    toast({ title: STATUS_LABELS[status] ?? status });
    loadData();
    loadDetails();
  };

  const addFeedbackRow = (stepNum: number) => {
    setNewFeedback((prev) => [...prev, { step_number: stepNum, block_id: "", comment: "" }]);
  };

  const updateFeedbackRow = (index: number, field: "comment" | "block_id", value: string) => {
    setNewFeedback((prev) => prev.map((f, i) => i === index ? { ...f, [field]: value } : f));
  };

  const removeFeedbackRow = (index: number) => {
    setNewFeedback((prev) => prev.filter((_, i) => i !== index));
  };

  if (!assignment || !template) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Zuweisung nicht gefunden.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/tasks")}>Zurück</Button>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[assignment.status] ?? "bg-muted text-muted-foreground";
  const canReview = ["eingereicht", "in_pruefung"].includes(assignment.status);

  return (
    <div className="p-5 space-y-5 max-w-4xl">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("/admin/tasks")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Zurück zu Aufgaben
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-heading font-bold text-foreground">{template.title}</h1>
          <p className="text-xs text-muted-foreground mt-1">Zuweisung vom {new Date(assignment.created_at).toLocaleDateString("de-DE")}</p>
        </div>
        <Badge variant="secondary" className={`text-xs ${statusColor}`}>
          {STATUS_LABELS[assignment.status] ?? assignment.status}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Mitarbeiter</CardTitle></CardHeader>
          <CardContent><p className="text-sm font-medium">{profile?.full_name ?? "Unbekannt"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" /> Termin</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {booking ? (
              <p className="text-sm">{booking.booking_date ? new Date(booking.booking_date).toLocaleDateString("de-DE") : "–"} {booking.booking_time ?? ""}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Kein Termin verknüpft</p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5 h-8 text-xs"
              onClick={async () => {
                const slot = await getNextAvailableSlot(assignment.user_id);
                if (!slot) {
                  toast({ title: "Kein freier Slot", description: "Aktuell sind keine freien Termine verfügbar.", variant: "destructive" });
                  return;
                }
                const { error } = await supabase.from("bookings").insert({
                  user_id: assignment.user_id,
                  assignment_id: assignment.id,
                  time_slot_id: slot.slot_id,
                  booking_date: slot.slot_date,
                  booking_time: slot.start_time,
                  admin_override: true,
                  status: "gebucht",
                } as any);
                if (error) {
                  toast({ title: "Fehler", description: error.message, variant: "destructive" });
                } else {
                  toast({ title: "Termin gebucht", description: slot.label });
                  loadData();
                }
              }}
            >
              <Calendar className="h-3.5 w-3.5" /> Nächsten freien Slot vorschlagen
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Individuelle Auftragsdaten pro Mitarbeiter-Zuweisung */}
      <AssignmentIndividualData
        assignmentId={assignment.id}
        userId={assignment.user_id}
        templateInstructions={template?.instructions ?? ""}
        initial={{
          individual_instructions: (assignment as any).individual_instructions,
          individual_phone: (assignment as any).individual_phone,
          individual_hint: (assignment as any).individual_hint,
          post_ident_pdf_url: (assignment as any).post_ident_pdf_url,
          post_ident_pdf_name: (assignment as any).post_ident_pdf_name,
        }}
        onSaved={loadData}
      />

      {/* Optionaler SMS-Kanal (technisch) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Phone className="h-4 w-4" /> SMS-Kanal (technisch)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={selectedSmsChannel}
            onChange={async (e) => {
              setSelectedSmsChannel(e.target.value);
              await supabase.from("task_assignments").update({ sms_channel_id: e.target.value || null } as any).eq("id", assignment.id);
              toast({ title: "SMS-Kanal aktualisiert" });
              loadData();
            }}
          >
            <option value="">Kein SMS-Kanal</option>
            {smsChannels.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.label} ({ch.phone_number})</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Verbindet eingehende SMS automatisch mit dieser Zuweisung.</p>
        </CardContent>
      </Card>

      {/* SMS Messages */}
      <TaskSmsMessages assignmentId={assignment.id} />

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Vorlage</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">{template.description}</p>
          <p className="text-sm font-medium text-accent">{Number(template.compensation).toFixed(2)} €</p>
        </CardContent>
      </Card>

      {/* Submission */}
      {loading ? (
        <div className="text-center text-muted-foreground animate-pulse py-4">Laden…</div>
      ) : submission ? (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Send className="h-4 w-4" /> Einreichung</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">Eingereicht am {new Date(submission.submitted_at).toLocaleString("de-DE")}</p>

            {answers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Antworten</p>
                {answers.map((a) => {
                  const q = questions.find((q) => q.id === a.question_id);
                  return (
                    <div key={a.id} className="rounded-lg bg-muted/50 border border-border p-3">
                      <p className="text-[11px] font-medium text-muted-foreground">{q?.question ?? "Frage"}</p>
                      <p className="text-sm text-foreground mt-1">{a.answer || "–"}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {submission.notes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Notizen</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{submission.notes}</p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Hochgeladene Dateien ({fileUrls.length})
              </p>
              {fileUrls.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Keine Dateien hochgeladen.</p>
              ) : (
                <div className="space-y-1.5">
                  {fileUrls.map((url, i) => {
                    const path = (submission?.file_urls ?? [])[i] ?? "";
                    const name = path.split("/").pop() ?? `Datei ${i + 1}`;
                    const isImg = /\.(png|jpe?g|gif|webp)$/i.test(name);
                    return (
                      <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          {isImg ? (
                            <img src={url} alt={name} className="h-10 w-10 rounded object-cover border border-border shrink-0" />
                          ) : (
                            <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                          )}
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-foreground hover:text-primary truncate">{name}</a>
                        </div>
                        <Button asChild size="sm" variant="outline" className="h-8 shrink-0">
                          <a href={url} target="_blank" rel="noopener noreferrer" download={name}>
                            <Download className="h-3.5 w-3.5 mr-1" /> Öffnen
                          </a>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Noch keine Einreichung vorhanden.
          </CardContent>
        </Card>
      )}

      {/* Existing feedback */}
      {existingFeedback.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Bisheriges Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {existingFeedback.map((fb) => {
              const stepLabel = taskSteps.find((s) => s.step_number === fb.step_number)?.title || `Schritt ${fb.step_number}`;
              return (
                <div key={fb.id} className={cn(
                  "rounded-lg border p-3 text-sm",
                  fb.resolved ? "bg-accent/5 border-accent/15" : "bg-status-pending/5 border-status-pending/15"
                )}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">{stepLabel}</span>
                    <Badge variant="secondary" className={cn("text-[10px]", fb.resolved ? "bg-accent/10 text-accent" : "bg-status-pending/10 text-status-pending")}>
                      {fb.resolved ? "Korrigiert" : "Offen"}
                    </Badge>
                  </div>
                  <p className="text-foreground">{fb.comment}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Review actions */}
      {canReview && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Prüfung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Allgemeiner Kommentar (optional)</label>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Feedback…" rows={2} />
            </div>

            {/* Per-step feedback */}
            {taskSteps.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Feedback pro Schritt</p>
                </div>
                {taskSteps.map((ts) => {
                  const stepFeedbacks = newFeedback.filter((f) => f.step_number === ts.step_number);
                  return (
                    <div key={ts.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">Schritt {ts.step_number}: {ts.title}</p>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addFeedbackRow(ts.step_number)}>
                          <Plus className="h-3 w-3 mr-1" /> Feedback
                        </Button>
                      </div>
                      {stepFeedbacks.map((fb) => {
                        const idx = newFeedback.indexOf(fb);
                        return (
                          <div key={idx} className="flex gap-2 pl-4">
                            <Input
                              value={fb.comment}
                              onChange={(e) => updateFeedbackRow(idx, "comment", e.target.value)}
                              placeholder="Kommentar zu diesem Schritt…"
                              className="flex-1"
                            />
                            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeFeedbackRow(idx)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button variant="destructive" size="sm" onClick={() => updateStatus("abgelehnt")}>
                <XCircle className="h-3.5 w-3.5 mr-1" /> Ablehnen
              </Button>
              <Button variant="outline" size="sm" className="border-status-pending/30 text-status-pending hover:bg-status-pending/10" onClick={() => updateStatus("nachbesserung")}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Nachbesserung
              </Button>
              <Button size="sm" onClick={() => updateStatus("genehmigt")}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Genehmigen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {assignment.status === "genehmigt" && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/5 border border-accent/15">
          <CheckCircle2 className="h-4 w-4 text-accent" />
          <p className="text-sm">Genehmigt – Vergütung von {Number(template.compensation).toFixed(2)} € wurde gutgeschrieben</p>
        </div>
      )}
      {assignment.status === "abgelehnt" && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/15">
          <XCircle className="h-4 w-4 text-destructive" />
          <p className="text-sm">Abgelehnt{assignment.admin_comment && `: ${assignment.admin_comment}`}</p>
        </div>
      )}
      {assignment.status === "nachbesserung" && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-status-pending/5 border border-status-pending/15">
          <RotateCcw className="h-4 w-4 text-status-pending" />
          <p className="text-sm">Nachbesserung angefordert{assignment.admin_comment && `: ${assignment.admin_comment}`}</p>
        </div>
      )}

      {assignment.status === "entwurf" && (
        <Button onClick={() => updateStatus("zugewiesen")} className="w-full">
          <Send className="h-4 w-4 mr-2" /> Aufgabe aktivieren (zuweisen)
        </Button>
      )}
    </div>
  );
}
