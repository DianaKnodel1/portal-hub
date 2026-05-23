import { createFileRoute, Outlet, useNavigate as useTSNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_employee/tasks")({
  component: TasksPage,
});

import { useEffect, useState } from "react";
import { TableSkeleton } from "@/components/SkeletonLoaders";
import { useLocation, useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClipboardList, Lock, CalendarDays, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasFullAccess } from "@/lib/employee-utils";
import type { EmployeeStatus } from "@/lib/status";

interface TaskTemplate { id: string; title: string; description: string; instructions: string; compensation: number; image_url: string | null; }
interface TaskAssignment { id: string; task_template_id: string; status: string; admin_comment: string | null; created_at: string; release_at: string | null; task_templates: TaskTemplate; }

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; progress: number }> = {
  entwurf:        { label: "Entwurf",        color: "text-foreground",                    bg: "bg-muted border border-border",                            progress: 0 },
  zugewiesen:     { label: "Zugewiesen",     color: "text-status-info-foreground",        bg: "bg-status-info",                                           progress: 10 },
  geplant:        { label: "Geplant",        color: "text-status-info-foreground",        bg: "bg-status-info",                                           progress: 20 },
  in_bearbeitung: { label: "In Bearbeitung", color: "text-status-pending-foreground",     bg: "bg-status-pending",                                        progress: 50 },
  eingereicht:    { label: "Eingereicht",    color: "text-status-info-foreground",        bg: "bg-status-info",                                           progress: 75 },
  in_pruefung:    { label: "In Prüfung",     color: "text-status-pending-foreground",     bg: "bg-status-pending",                                        progress: 85 },
  genehmigt:      { label: "Genehmigt",      color: "text-status-success-foreground",     bg: "bg-status-success",                                        progress: 100 },
  abgelehnt:      { label: "Abgelehnt",      color: "text-destructive-foreground",        bg: "bg-destructive",                                           progress: 0 },
  abgeschlossen:  { label: "Abgeschlossen",  color: "text-status-success-foreground",     bg: "bg-status-success",                                        progress: 100 },
  nachbesserung:  { label: "Nachbesserung",  color: "text-status-pending-foreground",     bg: "bg-status-pending",                                        progress: 40 },
};

function TasksPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const tsNavigate = useTSNavigate();
  const location = useLocation();
  const isDetailRoute = location.pathname !== "/tasks";

  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessAllowed, setAccessAllowed] = useState(false);
  const [hasScheduledTask, setHasScheduledTask] = useState(false);
  const [nextBooking, setNextBooking] = useState<{ date: string; time: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "done" | "rejected">("active");

  useEffect(() => {
    if (authLoading || !user) return;
    checkAccessAndLoad();
  }, [user, authLoading]);

  const checkAccessAndLoad = async () => {
    try {
      const { data, error: profileErr } = await supabase
        .from("profiles")
        .select("status")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (profileErr) throw profileErr;
      const status = data?.status as EmployeeStatus | undefined;
      const allowed = hasFullAccess(status);
      if (!allowed) {
        console.log("[TasksPage] Zugriff blockiert", { user_id: user!.id, status });
        setAccessAllowed(false);
        setLoading(false);
        return;
      }
      setAccessAllowed(true);
      await loadAssignments();
    } catch (err: any) {
      setError(err.message || "Daten konnten nicht geladen werden.");
      setLoading(false);
    }
  };

  const loadAssignments = async () => {
    try {
      // RLS will automatically filter out entwurf and unreleased tasks
      const { data, error: err } = await supabase.from("task_assignments")
        .select("id, task_template_id, status, admin_comment, created_at, release_at, task_templates(id, title, description, instructions, compensation, image_url)")
        .eq("user_id", user!.id).neq("status", "entwurf").order("created_at", { ascending: false });
      if (err) throw err;
      setAssignments((data as any[]) ?? []);

      // Check for future bookings to detect scheduled tasks
      const { data: bookings } = await supabase.from("bookings")
        .select("booking_date, booking_time, assignment_id")
        .eq("user_id", user!.id)
        .neq("status", "storniert")
        .not("booking_date", "is", null)
        .order("booking_date", { ascending: true });
      
      const now = new Date();
      const futureBooking = (bookings ?? []).find((b: any) => 
        b.booking_date && new Date(`${b.booking_date}T${b.booking_time || "00:00"}`) >= now
      );
      
      if (futureBooking && (data ?? []).length === 0) {
        setHasScheduledTask(true);
        setNextBooking({ date: futureBooking.booking_date ?? "", time: futureBooking.booking_time ?? "" });
      }
    } catch (err: any) {
      setError(err.message || "Aufgaben konnten nicht geladen werden.");
    } finally { setLoading(false); }
  };

  if (authLoading || loading) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <TableSkeleton rows={4} cols={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="max-w-md w-full"><CardContent className="pt-6 text-center space-y-4">
          <p className="text-destructive font-medium">Fehler</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>Zurück</Button>
        </CardContent></Card>
      </div>
    );
  }

  if (!accessAllowed) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl mx-auto">
        <EmptyState
          icon={Lock}
          title="Du wurdest noch nicht freigeschaltet"
          description="Sobald dein Profil angenommen wurde, erhältst du hier Zugriff auf deine Aufträge."
          actionLabel="Zum Dashboard"
          onAction={() => navigate("/dashboard")}
        />
      </div>
    );
  }

  if (isDetailRoute) return <Outlet />;

  const doneTasks = assignments.filter((a) => ["genehmigt", "abgeschlossen"].includes(a.status));
  const rejectedTasks = assignments.filter((a) => a.status === "abgelehnt");
  const activeTasks = assignments.filter((a) => !["genehmigt", "abgeschlossen", "abgelehnt"].includes(a.status));

  const openAssignment = (assignmentId: string) => {
    tsNavigate({ to: "/tasks/$assignmentId", params: { assignmentId } });
  };

  const TaskRow = ({ a }: { a: TaskAssignment }) => {
    const st = STATUS_CONFIG[a.status] ?? { label: a.status, color: "text-muted-foreground", bg: "bg-muted", progress: 0 };
    const tpl = a.task_templates;
    return (
      <tr
        className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={() => openAssignment(a.id)}
      >
        <td className="py-4 px-4 w-20">
          {tpl.image_url ? (
            <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted">
              <img src={tpl.image_url} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </td>
        <td className="py-4 px-4 font-medium text-foreground text-sm">{tpl.title}</td>
        <td className="py-4 px-4 text-sm text-muted-foreground hidden md:table-cell">{tpl.title}</td>
        <td className="py-4 px-4">
          <Badge variant="secondary" className={cn("text-[10px]", st.bg, st.color)}>{st.label}</Badge>
        </td>
        <td className="py-4 px-4 text-right font-bold text-foreground text-sm tabular-nums">
          {Number(tpl.compensation).toFixed(2).replace(".", ",")} €
        </td>
        <td className="py-4 px-4 text-right w-32">
          <Button size="sm" className="h-8" onClick={(e) => { e.stopPropagation(); openAssignment(a.id); }}>
            Zum Auftrag
          </Button>
        </td>
      </tr>
    );
  };

  const TaskTable = ({ rows, emptyText }: { rows: TaskAssignment[]; emptyText: string }) => {
    if (rows.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        </div>
      );
    }
    return (
      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="py-3 px-4 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Logo</th>
                <th className="py-3 px-4 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Bezeichnung</th>
                <th className="py-3 px-4 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Auftraggeber</th>
                <th className="py-3 px-4 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Vergütung</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => <TaskRow key={a.id} a={a} />)}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-heading font-bold text-foreground">Meine Aufträge</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{assignments.length} Aufträge gesamt</p>
      </div>

      {hasScheduledTask && assignments.length === 0 && nextBooking && (
        <Card className="animate-fade-in border-none shadow-md bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 ring-1 ring-primary/15">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Timer className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-semibold text-foreground">Deine Aufgabe wird vorbereitet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Freischaltung am{" "}
                  <span className="font-medium text-foreground">
                    {new Date(nextBooking.date + "T00:00:00").toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                  {" "}um{" "}
                  <span className="font-medium text-foreground">{nextBooking.time?.slice(0, 5)} Uhr</span>.
                </p>
              </div>
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5 rounded-xl" onClick={() => navigate("/appointments")}>
                <CalendarDays className="h-4 w-4" /> Termin ansehen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {assignments.length === 0 && !hasScheduledTask ? (
        <EmptyState
          icon={ClipboardList}
          title="Keine Aufträge vorhanden"
          description="Sobald dir ein Auftrag zugewiesen wurde, erscheint er hier automatisch."
        />
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} data-tour="tasks-list">
          <TabsList>
            <TabsTrigger value="active" className="gap-2">
              Aktiv <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{activeTasks.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="done" className="gap-2">
              Abgeschlossen <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{doneTasks.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              Abgelehnt <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{rejectedTasks.length}</Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-4">
            <TaskTable rows={activeTasks} emptyText="Aktuell keine aktiven Aufträge." />
          </TabsContent>
          <TabsContent value="done" className="mt-4">
            <TaskTable rows={doneTasks} emptyText="Noch keine abgeschlossenen Aufträge." />
          </TabsContent>
          <TabsContent value="rejected" className="mt-4">
            <TaskTable rows={rejectedTasks} emptyText="Keine abgelehnten Aufträge." />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
