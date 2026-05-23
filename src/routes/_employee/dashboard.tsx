import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_employee/dashboard")({
  component: DashboardPage,
});

import { useEffect, useState } from "react";
import { DashboardSkeleton } from "@/components/SkeletonLoaders";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { type EmployeeStatus, type KycStatus, type OnboardingStatus } from "@/lib/status";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  FileText, GraduationCap, ClipboardList, CalendarDays,
  Wallet, ArrowRight, CheckCircle2, Clock,
  Lock, Circle, Timer, PartyPopper, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNextStep } from "@/hooks/use-next-step";
import { useToast } from "@/hooks/use-toast";

interface Transaction {
  id: string;
  amount: number;
  status: "ausstehend" | "genehmigt" | "gutgeschrieben" | "ausgezahlt" | string;
  created_at: string;
  assignment_id: string | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  gutgeschrieben: { label: "Gutgeschrieben", cls: "bg-accent/10 text-accent" },
  ausgezahlt: { label: "Ausgezahlt", cls: "bg-accent/10 text-accent" },
  genehmigt: { label: "Genehmigt", cls: "bg-status-info/10 text-status-info" },
  ausstehend: { label: "Ausstehend", cls: "bg-status-pending/10 text-status-pending" },
};

interface Profile {
  full_name: string;
  status: EmployeeStatus;
  contract_signed_at: string | null;
  onboarding_status: OnboardingStatus;
  team_leader_id: string | null;
  created_at: string;
  address: string | null;
  birth_date: string | null;
  street: string | null;
  zip_code: string | null;
  city: string | null;
  employment_type: string | null;
}

function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [kyc, setKyc] = useState<{ status: KycStatus } | null>(null);
  const [nextBookingDate, setNextBookingDate] = useState<string | null>(null);
  const [nextBookingTime, setNextBookingTime] = useState<string | null>(null);
  const [futureBookings, setFutureBookings] = useState<Array<{ id: string; booking_date: string; booking_time: string; status: string }>>([]);
  const [balance, setBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduledTask, setScheduledTask] = useState<{ releaseAt: string } | null>(null);
  const navigate = useNavigate();

  const nextStepResult = useNextStep({
    kycStatus: kyc?.status ?? "nicht_gestartet",
    hasPersonalData: !!(profile?.address && profile?.birth_date),
    contractSigned: !!profile?.contract_signed_at,
    onboardingDone: profile?.onboarding_status === "abgeschlossen",
    hasAppointment: !!nextBookingDate,
    hasOpenTasks: taskCount > 0,
    hasScheduledTask: !!scheduledTask,
  });

  useEffect(() => {
    if (authLoading || !user) return;
    const load = async () => {
      try {
        const [profileRes, kycRes, bookingsRes, txRes, assignRes, completedRes] = await Promise.all([
          supabase.from("profiles").select("full_name, status, contract_signed_at, onboarding_status, team_leader_id, created_at, address, birth_date, street, zip_code, city, employment_type").eq("user_id", user.id).maybeSingle(),
          supabase.from("kyc_verifications").select("status").eq("user_id", user.id).maybeSingle(),
          supabase.from("bookings").select("id, booking_date, booking_time, status").eq("user_id", user.id).neq("status", "storniert").not("booking_date", "is", null).order("booking_date", { ascending: true }),
          supabase.from("user_transactions").select("id, amount, status, created_at, assignment_id").eq("user_id", user.id).order("created_at", { ascending: false }),
          supabase.from("task_assignments").select("id").eq("user_id", user.id).in("status", ["zugewiesen", "in_bearbeitung"]),
          supabase.from("task_assignments").select("id").eq("user_id", user.id).in("status", ["genehmigt", "abgeschlossen"]),
        ]);
        if (profileRes.error) throw profileRes.error;
        setProfile(profileRes.data as Profile | null);
        setKyc(kycRes.data as { status: KycStatus } | null);

        const now = new Date();
        const future = (bookingsRes.data ?? []).filter((b: any) =>
          b.booking_date && new Date(`${b.booking_date}T${b.booking_time || "00:00"}`) >= now
        ) as Array<{ id: string; booking_date: string; booking_time: string; status: string }>;
        setFutureBookings(future);
        if (future.length > 0) {
          setNextBookingDate(future[0].booking_date);
          setNextBookingTime(future[0].booking_time);
        }
        if (future.length > 0 && !assignRes.data?.length) {
          setScheduledTask({ releaseAt: `${future[0].booking_date}T${future[0].booking_time || "00:00"}` });
        }

        const txData = (txRes.data ?? []) as Transaction[];
        setBalance(txData.filter((t) => t.status === "gutgeschrieben" || t.status === "ausgezahlt").reduce((s, t) => s + Number(t.amount), 0));
        setPendingBalance(txData.filter((t) => t.status === "ausstehend" || t.status === "genehmigt").reduce((s, t) => s + Number(t.amount), 0));
        setRecentTx(txData.slice(0, 5));
        setTaskCount(assignRes.data?.length ?? 0);
        setCompletedTasks(completedRes.data?.length ?? 0);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, authLoading]);

  const handleCancelBooking = async (id: string) => {
    const { error: cancelErr } = await supabase.from("bookings").update({ status: "storniert" as any }).eq("id", id);
    if (cancelErr) {
      toast({ title: "Stornierung fehlgeschlagen", description: cancelErr.message, variant: "destructive" });
      return;
    }
    setFutureBookings((prev) => prev.filter((b) => b.id !== id));
    toast({ title: "Termin storniert" });
  };

  if (authLoading || loading) return <DashboardSkeleton />;
  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="max-w-md w-full"><CardContent className="pt-6 text-center space-y-4">
          <p className="text-destructive font-medium">Fehler beim Laden</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>Erneut versuchen</Button>
        </CardContent></Card>
      </div>
    );
  }

  const firstName = profile?.full_name?.split(" ")[0] || "Mitarbeiter";
  const contractSigned = !!profile?.contract_signed_at;
  const onboardingDone = profile?.onboarding_status === "abgeschlossen";
  const hasAppointment = !!nextBookingDate;
  const isDeactivated = profile?.status === "deaktiviert";
  const fullyActive = profile?.status === "angenommen";
  const canBookAppointments = profile?.status === "angenommen";
  const nextStep = nextStepResult;

  const checklistItems = [
    { id: "contract", label: "Vertrag unterschreiben", icon: FileText, done: contractSigned, path: "/contract", enabled: true },
    { id: "onboarding", label: "Einführung abschließen", icon: GraduationCap, done: onboardingDone, path: "/onboarding", enabled: contractSigned },
    { id: "appointment", label: "Ersten Termin buchen", icon: CalendarDays, done: hasAppointment, path: "/appointments", enabled: onboardingDone && canBookAppointments },
  ];
  const completedChecklist = checklistItems.filter((i) => i.done).length;
  const checklistProgress = (completedChecklist / checklistItems.length) * 100;
  const nextChecklistItem = checklistItems.find((i) => !i.done && i.enabled);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Guten Morgen";
    if (h < 18) return "Guten Tag";
    return "Guten Abend";
  };

  const formatCountdown = (releaseAt: string) => {
    const diff = new Date(releaseAt).getTime() - Date.now();
    if (diff <= 0) return "Wird freigeschaltet…";
    const hours = Math.floor(diff / 3600000);
    if (hours > 24) return `in ${Math.floor(hours / 24)} Tagen`;
    if (hours > 0) return `in ${hours}h`;
    return `in ${Math.floor(diff / 60000)} Min`;
  };

  return (
    <div className={cn(
      "p-6 lg:p-8 mx-auto space-y-6",
      fullyActive ? "max-w-7xl" : "max-w-3xl"
    )}>

      {/* Greeting */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-heading font-bold text-foreground">{greeting()}, {firstName} 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {fullyActive ? "Hier ist dein Überblick." : "Schließe die nächsten Schritte ab, um loszulegen."}
        </p>
      </div>

      {/* Grüne Guthaben-Bar — nur im Onboarding/Übergang sichtbar (im Active-Layout sitzt sie in der linken Spalte) */}
      {!fullyActive && !isDeactivated && (
        <button
          onClick={() => navigate("/earnings")}
          data-tour="balance"
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-md px-5 py-3.5 flex items-center justify-between text-white"
        >
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            <span className="text-sm font-semibold">Ihr Guthaben:</span>
          </div>
          <span className="text-lg font-heading font-bold tabular-nums">
            {balance.toFixed(2).replace(".", ",")} €
          </span>
        </button>
      )}
      {/* Deactivated */}
      {isDeactivated && (
        <Card className="animate-fade-in border-destructive/20 bg-destructive/5">
          <CardContent className="py-8 text-center space-y-2">
            <Lock className="h-8 w-8 text-destructive mx-auto" />
            <h2 className="text-lg font-heading font-bold text-foreground">Zugang deaktiviert</h2>
            <p className="text-sm text-muted-foreground">Bitte kontaktiere deinen Ansprechpartner.</p>
          </CardContent>
        </Card>
      )}

      {/* Scheduled task countdown */}
      {scheduledTask && !taskCount && (
        <Card className="animate-fade-in border-primary/15 bg-primary/5">
          <CardContent className="py-4 px-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Timer className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Aufgabe wird vorbereitet</p>
                <p className="text-xs text-muted-foreground">Freischaltung {formatCountdown(scheduledTask.releaseAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ONBOARDING VIEW ── */}
      {!fullyActive && !isDeactivated && (
        <>
          {/* Next step CTA */}
          {nextChecklistItem && (
            <Card className="animate-fade-in overflow-hidden border-none shadow-xl bg-gradient-to-br from-primary via-primary to-primary/80">
              <CardContent className="py-7 px-6">
                <p className="text-xs text-primary-foreground/60 uppercase tracking-wider font-medium mb-2">Nächster Schritt</p>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-primary-foreground/15 flex items-center justify-center shrink-0">
                    <nextChecklistItem.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <p className="font-heading font-bold text-lg text-primary-foreground flex-1">{nextChecklistItem.label}</p>
                </div>
                <Button
                  onClick={() => navigate(nextChecklistItem.path)}
                  className="w-full mt-5 gap-2 h-11 text-sm font-semibold bg-primary-foreground text-primary hover:bg-primary-foreground/90 rounded-xl"
                >
                  Jetzt erledigen <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Progress */}
          <Card className="animate-fade-in">
            <CardContent className="py-5 px-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-foreground">
                  {completedChecklist === checklistItems.length ? "Alles erledigt! 🎉" : `Noch ${checklistItems.length - completedChecklist} Schritte`}
                </p>
                <span className="text-sm font-bold text-primary">{completedChecklist}/{checklistItems.length}</span>
              </div>
              <Progress value={checklistProgress} className="h-2" />
            </CardContent>
          </Card>

          {/* Checklist */}
          <Card className="animate-fade-in" data-tour="checklist">
            <CardContent className="py-4 px-6 space-y-0.5">
              {checklistItems.map((item) => {
                const isNext = item === nextChecklistItem;
                return (
                  <button
                    key={item.id}
                    onClick={() => item.enabled && !item.done ? navigate(item.path) : undefined}
                    disabled={!item.enabled || item.done}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left transition-all",
                      item.done && "opacity-50",
                      item.enabled && !item.done && "hover:bg-primary/5 cursor-pointer",
                      !item.enabled && "opacity-30 cursor-not-allowed",
                      isNext && "bg-primary/5 ring-1 ring-primary/15",
                    )}
                  >
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                      item.done ? "bg-accent/10" : isNext ? "bg-primary/10" : "bg-muted"
                    )}>
                      {item.done ? <CheckCircle2 className="h-4 w-4 text-accent" /> :
                       !item.enabled ? <Lock className="h-4 w-4 text-muted-foreground/40" /> :
                       <Circle className="h-4 w-4 text-muted-foreground/30" />}
                    </div>
                    <span className={cn("text-sm font-medium flex-1", item.done ? "line-through text-muted-foreground" : "text-foreground")}>{item.label}</span>
                    {isNext && <ArrowRight className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── ACTIVE DASHBOARD ── */}
      {fullyActive && (
        <>
          {/* Next step (compact, oben) */}
          {nextStep && (
            <Card className="animate-fade-in overflow-hidden border-none shadow-xl bg-gradient-to-br from-primary via-primary to-primary/80">
              <CardContent className="py-5 px-6">
                <div className="flex items-center gap-4">
                  <div className="h-11 w-11 rounded-2xl bg-primary-foreground/15 flex items-center justify-center shrink-0">
                    <nextStep.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-primary-foreground/60 uppercase tracking-wider font-medium">Nächster Schritt</p>
                    <p className="font-heading font-bold text-base text-primary-foreground mt-0.5">{nextStep.label}</p>
                  </div>
                  <Button onClick={() => navigate(nextStep.path)} size="sm"
                    className="gap-1.5 bg-primary-foreground text-primary hover:bg-primary-foreground/90 shrink-0 rounded-xl shadow-md">
                    {nextStep.cta} <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Top-Row: 2-Spalten — Guthaben+To-Do (links) | Bevorstehende Termine (rechts) ─── */}
          <div className="grid gap-5 lg:grid-cols-5 animate-fade-in">

            {/* LINKS — 3/5: Guthaben-Bar + To-Do-List */}
            <div className="lg:col-span-3 space-y-5">

              {/* Grüne Guthaben-Bar */}
              <button
                onClick={() => navigate("/earnings")}
                data-tour="balance"
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-md px-5 py-3.5 flex items-center justify-between text-white"
              >
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  <span className="text-sm font-semibold">Ihr Guthaben:</span>
                </div>
                <span className="text-lg font-heading font-bold tabular-nums">
                  € {balance.toFixed(2).replace(".", ",")}
                </span>
              </button>

              {/* To-Do-List Card */}
              <Card data-tour="tasks-list">
                <CardContent className="py-4 px-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-foreground" />
                    <p className="font-heading font-semibold text-foreground text-sm">Ihre To-Do List</p>
                  </div>

                  {taskCount > 0 ? (
                    <>
                      <button
                        onClick={() => navigate("/tasks")}
                        className="w-full text-left rounded-lg bg-primary/10 hover:bg-primary/15 border border-primary/20 px-4 py-3 transition-colors"
                      >
                        <p className="text-sm text-foreground">
                          Sie haben unerledigte Aufträge. Klicken Sie auf einen Punkt in der Liste, um direkt zum entsprechenden Auftrag zu gelangen.
                        </p>
                        <p className="text-xs font-medium text-primary mt-2 flex items-center justify-end gap-1">
                          Zur Auftragsübersicht <ArrowRight className="h-3 w-3" />
                        </p>
                      </button>
                    </>
                  ) : scheduledTask ? (
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                      <p className="text-sm text-foreground">
                        Aufgabe wird vorbereitet. Freischaltung {formatCountdown(scheduledTask.releaseAt)}.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 text-center">
                      <p className="text-sm text-muted-foreground">Keine offenen Aufträge. Buche einen Termin, um den nächsten Auftrag zu erhalten.</p>
                      <Button size="sm" variant="link" className="mt-1 h-auto p-0 text-primary" onClick={() => navigate("/appointments")}>
                        Zur Terminbuchung <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* RECHTS — 2/5: Bevorstehende Termine */}
            <Card className="lg:col-span-2" data-tour="next-appointment">
              <CardContent className="py-4 px-5">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="h-4 w-4 text-foreground" />
                  <p className="font-heading font-semibold text-foreground text-sm">Bevorstehende Termine</p>
                </div>

                {futureBookings.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-6">
                    Keine bevorstehenden Termine gefunden
                  </div>
                ) : (
                  <div className="space-y-2">
                    {futureBookings.slice(0, 4).map((b) => {
                      const dateLabel = new Date(b.booking_date + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
                      return (
                        <div key={b.id} className="flex items-center justify-between rounded-lg border border-emerald-600/30 bg-emerald-600/5 px-3 py-2">
                          <span className="text-sm font-medium text-foreground tabular-nums">
                            {dateLabel} {b.booking_time?.slice(0, 5)}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCancelBooking(b.id)}
                            className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border border-destructive/30 rounded-md"
                          >
                            Absagen
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ─── Full-width Transaktions-Tabelle ─── */}
          <Card className="animate-fade-in" data-tour="transactions">
            <CardContent className="p-0">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
                <TrendingUp className="h-4 w-4 text-foreground" />
                <p className="font-heading font-semibold text-foreground text-sm">Transaktionen</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left bg-muted/30 text-muted-foreground border-b border-border">
                      <th className="px-5 py-2.5 text-xs font-medium">Lfd. Nr.</th>
                      <th className="px-5 py-2.5 text-xs font-medium">Datum</th>
                      <th className="px-5 py-2.5 text-xs font-medium">Transaktionsnummer</th>
                      <th className="px-5 py-2.5 text-xs font-medium">Buchungsschlüssel</th>
                      <th className="px-5 py-2.5 text-xs font-medium text-right">Betrag in EUR</th>
                      <th className="px-5 py-2.5 text-xs font-medium">Buchungsstatus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTx.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">
                          Keine Transaktionen gefunden
                        </td>
                      </tr>
                    ) : (
                      recentTx.map((tx, idx) => {
                        const meta = STATUS_LABEL[tx.status] ?? { label: tx.status, cls: "bg-muted text-muted-foreground" };
                        const date = new Date(tx.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
                        const txNr = `#TR${tx.id.replace(/-/g, "").slice(0, 7).toUpperCase()}`;
                        return (
                          <tr key={tx.id} className="border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors">
                            <td className="px-5 py-3 text-foreground tabular-nums">{1000 + idx + 1}</td>
                            <td className="px-5 py-3 text-foreground tabular-nums">{date}</td>
                            <td className="px-5 py-3 text-foreground font-mono text-xs">{txNr}</td>
                            <td className="px-5 py-3 text-muted-foreground">Auftrag: Gutschrift</td>
                            <td className="px-5 py-3 text-right text-foreground tabular-nums font-medium">{Number(tx.amount).toFixed(2).replace(".", ",")}</td>
                            <td className="px-5 py-3">
                              <span className={cn("text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded", meta.cls)}>
                                {meta.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {recentTx.length > 0 && (
                <div className="px-5 py-2.5 border-t border-border flex justify-end">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/earnings")}>
                    Alle Transaktionen <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
