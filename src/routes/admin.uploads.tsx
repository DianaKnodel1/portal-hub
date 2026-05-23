import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/uploads")({
  component: AdminUploadsPage,
});

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminData } from "@/contexts/AdminDataContext";
import { useNavigate } from "@/lib/router-compat";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TASK_STATUS_CONFIG, statusBadgeClass, type TaskAssignmentStatus } from "@/lib/status";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton, PageHeaderSkeleton } from "@/components/SkeletonLoaders";
import { FileText, Image as ImageIcon, Download, Search, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchAll } from "@/lib/fetch-all";

interface SubmissionWithFiles {
  id: string;
  assignment_id: string;
  notes: string | null;
  file_urls: string[];
  submitted_at: string;
}
interface DocumentRow {
  id: string;
  user_id: string;
  category: string;
  file_url: string;
  file_name: string;
  status: string;
  notes: string | null;
  created_at: string;
}

type Row =
  | { kind: "submission"; id: string; created_at: string; user_id: string; assignment_id: string; status: string; files: { path: string; name: string }[]; bucket: "task-submissions"; notes: string | null }
  | { kind: "document"; id: string; created_at: string; user_id: string; category: string; status: string; files: { path: string; name: string }[]; bucket: "documents"; notes: string | null };

function AdminUploadsPage() {
  const { assignments, templates, getProfileForUser, loading: adminLoading } = useAdminData();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<SubmissionWithFiles[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [subs, docs] = await Promise.all([
          fetchAll<SubmissionWithFiles>(() =>
            supabase
              .from("task_submissions")
              .select("id, assignment_id, notes, file_urls, submitted_at")
              .order("submitted_at", { ascending: false }),
          ),
          fetchAll<DocumentRow>(() =>
            supabase
              .from("documents")
              .select("id, user_id, category, file_url, file_name, status, notes, created_at")
              .order("created_at", { ascending: false }),
          ),
        ]);
        if (cancel) return;
        setSubmissions(subs.filter((s) => (s.file_urls ?? []).length > 0));
        setDocuments(docs.filter((d) => !!d.file_url));
      } catch (e: any) {
        if (!cancel) toast({ title: "Fehler beim Laden", description: e?.message ?? String(e), variant: "destructive" });
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [toast]);

  const rows = useMemo<Array<{ row: Row; profileName: string; taskTitle: string; assignmentId?: string }>>(() => {
    const term = search.trim().toLowerCase();
    const subRows: Array<{ row: Row; profileName: string; taskTitle: string; assignmentId?: string }> = submissions
      .map((sub) => {
        const asg = assignments.find((a) => a.id === sub.assignment_id);
        if (!asg) return null;
        const tpl = templates.find((t) => t.id === asg.task_template_id);
        const profile = getProfileForUser(asg.user_id);
        const row: Row = {
          kind: "submission",
          id: sub.id,
          created_at: sub.submitted_at,
          user_id: asg.user_id,
          assignment_id: asg.id,
          status: asg.status,
          bucket: "task-submissions",
          files: (sub.file_urls ?? []).map((p) => ({ path: p, name: p.split("/").pop() ?? "Datei" })),
          notes: sub.notes ?? null,
        };
        return { row, profileName: profile?.full_name ?? "Unbekannt", taskTitle: tpl?.title ?? "—", assignmentId: asg.id };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);

    const docRows: Array<{ row: Row; profileName: string; taskTitle: string; assignmentId?: string }> = documents.map((d) => {
      const profile = getProfileForUser(d.user_id);
      const row: Row = {
        kind: "document",
        id: d.id,
        created_at: d.created_at,
        user_id: d.user_id,
        category: d.category,
        status: d.status,
        bucket: "documents",
        files: [{ path: d.file_url, name: d.file_name }],
        notes: d.notes,
      };
      const labelMap: Record<string, string> = { identitaet: "Identität", auftrag: "Auftrag (eigener Upload)", sonstiges: "Sonstiges" };
      return { row, profileName: profile?.full_name ?? "Unbekannt", taskTitle: labelMap[d.category] ?? d.category };
    });

    return [...subRows, ...docRows]
      .sort((a, b) => +new Date(b.row.created_at) - +new Date(a.row.created_at))
      .filter((r) => {
        if (statusFilter === "all") return true;
        return r.row.status === statusFilter;
      })
      .filter((r) => {
        if (!term) return true;
        return (
          r.profileName.toLowerCase().includes(term) ||
          r.taskTitle.toLowerCase().includes(term) ||
          r.row.id.toLowerCase().includes(term)
        );
      });
  }, [submissions, documents, assignments, templates, getProfileForUser, search, statusFilter]);

  const totalFiles = rows.reduce((acc, r) => acc + r.row.files.length, 0);

  const openFile = async (bucket: "task-submissions" | "documents", path: string) => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
    if (error || !data?.signedUrl) {
      toast({ title: "Datei nicht verfügbar", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  if (loading || adminLoading) {
    return <div className="p-5 space-y-4"><PageHeaderSkeleton /><TableSkeleton rows={4} cols={5} /></div>;
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-heading font-bold text-foreground">Upload-Übersicht</h1>
          <p className="text-xs text-muted-foreground">{rows.length} Einreichungen · {totalFiles} Dateien</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mitarbeiter, Aufgabe…" className="h-8 pl-7 text-xs w-56" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
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
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Upload} title="Noch keine Uploads" description="Sobald Mitarbeiter Dateien einreichen, erscheinen sie hier." />
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Mitarbeiter</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Quelle</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Eingereicht</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Dateien</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ row, profileName, taskTitle, assignmentId }) => {
                const cfg = row.kind === "submission" ? TASK_STATUS_CONFIG[row.status as TaskAssignmentStatus] : undefined;
                const statusLabel = cfg?.label ?? (row.kind === "document" ? (row.status === "geprueft" ? "Geprüft" : row.status === "abgelehnt" ? "Abgelehnt" : "Hochgeladen") : row.status);
                const statusColor = cfg?.color ?? (row.kind === "document" ? (row.status === "geprueft" ? "bg-status-success text-status-success-foreground" : row.status === "abgelehnt" ? "bg-destructive text-destructive-foreground" : "bg-status-pending text-status-pending-foreground") : "bg-muted text-muted-foreground");
                return (
                  <tr key={`${row.kind}-${row.id}`} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{profileName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>{taskTitle}</span>
                        {row.kind === "document" && <Badge variant="outline" className="text-[10px] h-5 px-1.5">Dokument</Badge>}
                        {row.kind === "submission" && <Badge variant="outline" className="text-[10px] h-5 px-1.5">Einreichung</Badge>}
                      </div>
                      {row.notes && (
                        <p className="text-[11px] text-muted-foreground mt-1 italic max-w-[280px] line-clamp-2" title={row.notes}>
                          💬 {row.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={statusBadgeClass(statusColor)}>{statusLabel}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                      {new Date(row.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {row.files.map((f, i) => {
                          const isImg = /\.(png|jpe?g|gif|webp)$/i.test(f.name);
                          return (
                            <button
                              key={i}
                              onClick={() => openFile(row.bucket, f.path)}
                              title={f.name}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/40 hover:bg-muted text-xs border border-border max-w-[200px]"
                            >
                              {isImg ? <ImageIcon className="h-3 w-3 shrink-0 text-primary" /> : <FileText className="h-3 w-3 shrink-0 text-primary" />}
                              <span className="truncate">{f.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {assignmentId ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate(`/admin/assignments/${assignmentId}`)}>
                          Auftrag öffnen
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate(`/admin/employees/${row.user_id}`)}>
                          Mitarbeiter öffnen
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
