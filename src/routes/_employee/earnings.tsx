import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_employee/earnings")({
  component: EarningsPage,
});

import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { Wallet, Banknote, TrendingUp, ArrowUpRight, CheckCircle2, Clock, CircleDollarSign, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasFullAccess } from "@/lib/employee-utils";
import type { EmployeeStatus } from "@/lib/status";

interface Transaction {
  id: string; amount: number; status: string; created_at: string; assignment_id: string;
  task_assignments: { task_templates: { title: string } };
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  ausstehend:     { label: "Ausstehend",     color: "bg-status-pending text-status-pending-foreground", icon: Clock },
  genehmigt:      { label: "Genehmigt",      color: "bg-status-success text-status-success-foreground", icon: CheckCircle2 },
  ausgezahlt:     { label: "Ausgezahlt",     color: "bg-status-success text-status-success-foreground", icon: Banknote },
  gutgeschrieben: { label: "Gutgeschrieben", color: "bg-status-info text-status-info-foreground",       icon: CheckCircle2 },
};

function EarningsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessAllowed, setAccessAllowed] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    checkAndLoad();
  }, [user, authLoading]);

  const checkAndLoad = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("user_id", user!.id)
        .maybeSingle();
      const status = profile?.status as EmployeeStatus | undefined;
      if (!hasFullAccess(status)) {
        console.log("[EarningsPage] Zugriff blockiert", { user_id: user!.id, status });
        setAccessAllowed(false);
        setLoading(false);
        return;
      }
      setAccessAllowed(true);
      const { data, error: dbErr } = await supabase.from("user_transactions")
        .select("id, amount, status, created_at, assignment_id, task_assignments(task_templates(title))")
        .eq("user_id", user!.id).order("created_at", { ascending: false });
      if (dbErr) throw dbErr;
      setTransactions((data as unknown as Transaction[]) ?? []);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  if (authLoading || loading) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6 animate-fade-in">
        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-primary/10 rounded-xl animate-pulse" />
        <div className="grid gap-3 grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
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
          description="Sobald dein Profil angenommen wurde, siehst du hier deine Einnahmen."
          actionLabel="Zum Dashboard"
          onAction={() => navigate("/dashboard")}
        />
      </div>
    );
  }

  const totalEarned = transactions.reduce((s, t) => s + Number(t.amount), 0);
  const pendingAmount = transactions.filter((t) => t.status === "ausstehend" || t.status === "genehmigt").reduce((s, t) => s + Number(t.amount), 0);
  const paidAmount = transactions.filter((t) => t.status === "ausgezahlt" || t.status === "gutgeschrieben").reduce((s, t) => s + Number(t.amount), 0);

  // Group by month
  const grouped: Record<string, Transaction[]> = {};
  transactions.forEach((t) => {
    const key = new Date(t.created_at).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-heading font-bold text-foreground">Einnahmen</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Übersicht deiner Vergütungen.</p>
      </div>

      {/* Hero balance */}
      <Card className="animate-fade-in border-none shadow-lg bg-gradient-to-br from-primary via-primary to-primary/80 overflow-hidden">
        <CardContent className="pt-6 pb-6">
          <p className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wider">Gesamteinnahmen</p>
          <p className="text-3xl font-heading font-bold text-primary-foreground mt-1">{totalEarned.toFixed(2)} €</p>
          <div className="flex gap-6 mt-4">
            <div>
              <p className="text-primary-foreground/50 text-[11px] uppercase tracking-wider">Offen</p>
              <p className="text-sm font-semibold text-primary-foreground">{pendingAmount.toFixed(2)} €</p>
            </div>
            <div>
              <p className="text-primary-foreground/50 text-[11px] uppercase tracking-wider">Ausgezahlt</p>
              <p className="text-sm font-semibold text-primary-foreground">{paidAmount.toFixed(2)} €</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid gap-3 grid-cols-3 animate-fade-in">
        <Card className="hover:shadow-sm transition-all">
          <CardContent className="pt-4 pb-4 text-center">
            <CircleDollarSign className="h-5 w-5 text-primary mx-auto mb-1.5" />
            <p className="text-lg font-bold text-foreground">{transactions.length}</p>
            <p className="text-[11px] text-muted-foreground">Transaktionen</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-all">
          <CardContent className="pt-4 pb-4 text-center">
            <ArrowUpRight className="h-5 w-5 text-status-pending mx-auto mb-1.5" />
            <p className="text-lg font-bold text-foreground">{pendingAmount.toFixed(2)} €</p>
            <p className="text-[11px] text-muted-foreground">Offen</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-all">
          <CardContent className="pt-4 pb-4 text-center">
            <Banknote className="h-5 w-5 text-accent mx-auto mb-1.5" />
            <p className="text-lg font-bold text-foreground">{paidAmount.toFixed(2)} €</p>
            <p className="text-[11px] text-muted-foreground">Erhalten</p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      {transactions.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Noch keine Einnahmen"
          description="Sobald deine Aufgaben genehmigt werden, erscheinen deine Vergütungen hier."
        />
      ) : (
        <div className="space-y-6 animate-fade-in">
          {Object.entries(grouped).map(([month, txs]) => (
            <section key={month} className="space-y-2">
              <div className="flex items-center gap-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{month}</p>
                <div className="flex-1 h-px bg-border" />
                <p className="text-xs font-semibold text-foreground">
                  {txs.reduce((s, t) => s + Number(t.amount), 0).toFixed(2)} €
                </p>
              </div>
              <div className="space-y-1.5">
                {txs.map((t, idx) => {
                  const st = STATUS_MAP[t.status] ?? { label: t.status, color: "bg-muted text-muted-foreground", icon: Clock };
                  const StatusIcon = st.icon;
                  return (
                    <Card key={t.id} className="group hover:shadow-sm transition-all duration-200">
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", st.color)}>
                            <StatusIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {t.task_assignments?.task_templates?.title ?? "Aufgabe"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {new Date(t.created_at).toLocaleDateString("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-foreground">+{Number(t.amount).toFixed(2)} €</p>
                            <Badge variant="secondary" className={cn("text-[9px] mt-0.5", st.color)}>{st.label}</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="rounded-xl bg-muted/50 border border-border p-4 text-center">
        <p className="text-xs text-muted-foreground">Auszahlungen erfolgen monatlich.</p>
      </div>
    </div>
  );
}
