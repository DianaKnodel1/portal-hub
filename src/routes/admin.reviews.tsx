import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/reviews")({
  component: AdminReviewsPage,
});

import { useState } from "react";
import { useAdminData, type AssignmentRow, type SubmissionRow, type SubmissionAnswerRow, type TaskQuestion } from "@/contexts/AdminDataContext";
import { TASK_STATUS_CONFIG, statusBadgeClass, type TaskAssignmentStatus } from "@/lib/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { CheckCircle2, XCircle, CheckSquare, FileText, Download } from "lucide-react";
import { TableSkeleton, PageHeaderSkeleton } from "@/components/SkeletonLoaders";

function AdminReviewsPage() {
  const { assignments, templates, getProfileForUser, loading, loadData } = useAdminData();
  const { toast } = useToast();

  const [reviewAssignment, setReviewAssignment] = useState<AssignmentRow | null>(null);
  const [reviewSubmission, setReviewSubmission] = useState<SubmissionRow | null>(null);
  const [reviewAnswers, setReviewAnswers] = useState<SubmissionAnswerRow[]>([]);
  const [reviewQuestions, setReviewQuestions] = useState<TaskQuestion[]>([]);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewFileUrls, setReviewFileUrls] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState("");

  const reviewable = assignments.filter((a) => {
    const isReviewable = ["eingereicht", "in_pruefung", "genehmigt", "abgelehnt", "nachbesserung"].includes(a.status);
    if (!isReviewable) return false;
    if (filterStatus && filterStatus !== "all" && a.status !== filterStatus) return false;
    return true;
  });

  const openReview = async (assignment: AssignmentRow) => {
    setReviewAssignment(assignment); setReviewComment("");
    const [subRes, qRes] = await Promise.all([
      supabase.from("task_submissions").select("*").eq("assignment_id", assignment.id).order("submitted_at", { ascending: false }).limit(1),
      supabase.from("task_questions").select("*").eq("task_template_id", assignment.task_template_id).order("sort_order"),
    ]);
    const sub = (subRes.data as SubmissionRow[])?.[0] ?? null;
    setReviewSubmission(sub);
    setReviewQuestions((qRes.data as TaskQuestion[]) ?? []);
    if (sub) {
      const { data: ans } = await supabase.from("submission_answers").select("*").eq("submission_id", sub.id);
      setReviewAnswers((ans as SubmissionAnswerRow[]) ?? []);
      const urls: string[] = [];
      for (const path of sub.file_urls ?? []) {
        const { data } = await supabase.storage.from("task-submissions").createSignedUrl(path, 600);
        if (data?.signedUrl) urls.push(data.signedUrl);
      }
      setReviewFileUrls(urls);
    } else { setReviewAnswers([]); setReviewFileUrls([]); }
  };

  const reviewDecision = async (decision: "genehmigt" | "abgelehnt") => {
    if (!reviewAssignment) return;
    const { error } = await supabase.from("task_assignments").update({ status: decision, admin_comment: reviewComment || null }).eq("id", reviewAssignment.id);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    if (decision === "genehmigt") {
      const tpl = templates.find((t) => t.id === reviewAssignment.task_template_id);
      if (tpl && tpl.compensation > 0) {
        await supabase.from("user_transactions").insert({ user_id: reviewAssignment.user_id, assignment_id: reviewAssignment.id, amount: tpl.compensation, status: "genehmigt" });
      }
    }
    toast({ title: decision === "genehmigt" ? "✅ Auftrag genehmigt" : "❌ Auftrag abgelehnt", description: decision === "genehmigt" ? "Vergütung wurde gutgeschrieben." : "Der Mitarbeiter wurde benachrichtigt." });
    setReviewAssignment(null);
    loadData();
  };

  if (loading) return <div className="p-5 space-y-4"><PageHeaderSkeleton /><TableSkeleton rows={4} cols={4} /></div>;

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-heading font-bold text-foreground">Prüfungen</h1>
          <p className="text-xs text-muted-foreground">{reviewable.length} Einreichungen</p>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Alle Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="eingereicht">Eingereicht</SelectItem>
            <SelectItem value="in_pruefung">In Prüfung</SelectItem>
            <SelectItem value="genehmigt">Genehmigt</SelectItem>
            <SelectItem value="abgelehnt">Abgelehnt</SelectItem>
            <SelectItem value="nachbesserung">Nachbesserung</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {reviewable.length === 0 ? (
        <EmptyState icon={CheckSquare} title="Keine Einreichungen" description="Es gibt aktuell keine Einreichungen zur Prüfung." />
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Aufgabe</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Mitarbeiter</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reviewable.map((a) => {
                const tpl = templates.find((t) => t.id === a.task_template_id);
                const profile = getProfileForUser(a.user_id);
                return (
                  <tr key={a.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openReview(a)}>
                    <td className="px-4 py-3 font-medium text-foreground">{tpl?.title ?? "Aufgabe"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{profile?.full_name ?? "Unbekannt"}</td>
                    <td className="px-4 py-3">
                      {(() => { const cfg = TASK_STATUS_CONFIG[a.status as TaskAssignmentStatus]; return (
                        <Badge variant="secondary" className={statusBadgeClass(cfg?.color ?? "bg-muted text-muted-foreground")}>
                          {cfg?.label ?? a.status}
                        </Badge>
                      ); })()}
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="outline" size="sm" className="h-7 text-xs">Prüfen</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!reviewAssignment} onOpenChange={() => setReviewAssignment(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Einreichung prüfen</DialogTitle></DialogHeader>
          {reviewAssignment && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Mitarbeiter</p>
                  <p className="font-medium text-foreground">{getProfileForUser(reviewAssignment.user_id)?.full_name ?? "Unbekannt"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Aufgabe</p>
                  <p className="font-medium text-foreground">{templates.find((t) => t.id === reviewAssignment.task_template_id)?.title}</p>
                </div>
              </div>
              {reviewSubmission ? (
                <>
                  {reviewAnswers.length > 0 && (
                    <div className="space-y-2.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Antworten</p>
                      {reviewAnswers.map((a) => {
                        const q = reviewQuestions.find((q) => q.id === a.question_id);
                        return (
                          <div key={a.id} className="rounded-lg bg-muted/50 border border-border p-3">
                            <p className="text-[11px] font-medium text-muted-foreground">{q?.question ?? "Frage"}</p>
                            <p className="text-sm text-foreground mt-1">{a.answer || "–"}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {reviewSubmission.notes && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Notizen</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{reviewSubmission.notes}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Hochgeladene Dateien ({reviewFileUrls.length})
                    </p>
                    {reviewFileUrls.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Keine Dateien hochgeladen.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {reviewFileUrls.map((url, i) => {
                          const path = (reviewSubmission!.file_urls ?? [])[i] ?? "";
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
                </>
              ) : <p className="text-sm text-muted-foreground">Keine Einreichung vorhanden.</p>}

              {(reviewAssignment.status === "eingereicht" || reviewAssignment.status === "in_pruefung") && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Kommentar (optional)</label>
                    <Textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Kommentar…" rows={2} />
                  </div>
                  <DialogFooter className="flex gap-2">
                    <Button variant="destructive" size="sm" onClick={() => reviewDecision("abgelehnt")}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Ablehnen
                    </Button>
                    <Button size="sm" onClick={() => reviewDecision("genehmigt")}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Genehmigen
                    </Button>
                  </DialogFooter>
                </>
              )}
              {reviewAssignment.status === "genehmigt" && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/5 border border-accent/15">
                  <CheckCircle2 className="h-4 w-4 text-accent" /><p className="text-sm">Bereits genehmigt</p>
                </div>
              )}
              {reviewAssignment.status === "abgelehnt" && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/15">
                  <XCircle className="h-4 w-4 text-destructive" /><p className="text-sm">Abgelehnt{reviewAssignment.admin_comment && `: ${reviewAssignment.admin_comment}`}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
