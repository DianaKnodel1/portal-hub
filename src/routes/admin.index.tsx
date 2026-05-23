import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboardPage,
});

import { useAdminData } from "@/contexts/AdminDataContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminDashboardSkeleton } from "@/components/SkeletonLoaders";
import {
  ArrowRight, FileText, ShieldCheck, CalendarDays, Mail, CheckCircle2, XCircle, AlertTriangle, ClipboardList,
} from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeEmailStats, type EmailLog } from "@/lib/email-stats";

function EmailMonitorWidget() {
  const [stats, setStats] = useState<{ sent: number; failed: number; total: number; successRate: number; actionRequired: boolean } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("email_send_log")
      .select("id, message_id, template_name, recipient_email, status, error_message, metadata, created_at")
      .neq("status", "pending")
      .gte("created_at", since)
      .then(({ data }) => {
        if (!data || data.length === 0) {
          setStats({ sent: 0, failed: 0, total: 0, successRate: 100, actionRequired: false });
          return;
        }
        const computed = computeEmailStats(data as EmailLog[]);
        setStats({ sent: computed.sent, failed: computed.failed, total: computed.total, successRate: computed.successRate, actionRequired: computed.actionRequired });
      });
  }, []);

  if (!stats) return null;

  return (
    <Card className={stats.actionRequired ? "border-destructive/30 bg-destructive/[0.02]" : ""}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${stats.actionRequired ? "bg-destructive/10" : "bg-accent/10"}`}>
              <Mail className={`h-4 w-4 ${stats.actionRequired ? "text-destructive" : "text-accent"}`} />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">E-Mail System</p>
              <p className="text-[10px] text-muted-foreground">Letzte 24 Stunden</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate("/admin/email-logs")}>
            Details <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40">
            <div className="flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{stats.sent}</p>
            </div>
            <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 font-medium">Gesendet</p>
          </div>
          <div className={`text-center p-3 rounded-lg border ${stats.failed > 0 ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40" : "bg-muted/60 border-border"}`}>
            <div className="flex items-center justify-center gap-1">
              {stats.failed > 0 ? <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" /> : null}
              <p className={`text-lg font-bold ${stats.failed > 0 ? "text-rose-700 dark:text-rose-300" : "text-foreground"}`}>{stats.failed}</p>
            </div>
            <p className={`text-[10px] font-medium ${stats.failed > 0 ? "text-rose-700/80 dark:text-rose-300/80" : "text-muted-foreground"}`}>Fehler</p>
          </div>
          <div className={`text-center p-3 rounded-lg border ${stats.successRate >= 95 ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40" : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40"}`}>
            <p className={`text-lg font-bold ${stats.successRate >= 95 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>{stats.successRate}%</p>
            <p className={`text-[10px] font-medium ${stats.successRate >= 95 ? "text-emerald-700/80 dark:text-emerald-300/80" : "text-rose-700/80 dark:text-rose-300/80"}`}>Erfolg</p>
          </div>
        </div>

        {stats.actionRequired && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-900/50">
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <p className="text-xs font-medium text-rose-700 dark:text-rose-300">
              {stats.failed} E-Mail(s) fehlgeschlagen – bitte prüfen
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdminDashboardPage() {
  const { profiles, applications, assignments, allBookings, kycList, loading } = useAdminData();
  const navigate = useNavigate();

  if (loading) return <AdminDashboardSkeleton />;

  const newApplications = applications.filter((a) => a.status === "neu" || a.status === "eingegangen").length;
  const pendingKyc = kycList.filter((k) => k.status === "eingereicht" || k.status === "in_pruefung").length;
  const pendingReviews = assignments.filter((a) => a.status === "eingereicht" || a.status === "in_pruefung").length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayBookings = allBookings.filter((b) => (b as any).booking_date === todayStr).length;
  const activeEmployees = profiles.filter((p) => p.status === "angenommen").length;

  const actionCards = [
    { label: "Neue Bewerbungen", value: newApplications, icon: FileText, path: "/admin/applications", highlight: newApplications > 0 },
    { label: "Offene Verifizierung", value: pendingKyc, icon: ShieldCheck, path: "/admin/kyc", highlight: pendingKyc > 0 },
    { label: "Aufgaben zur Prüfung", value: pendingReviews, icon: ClipboardList, path: "/admin/reviews", highlight: pendingReviews > 0 },
    { label: "Termine heute", value: todayBookings, icon: CalendarDays, path: "/admin/appointments", highlight: todayBookings > 0 },
    { label: "Mitarbeiter angenommen", value: activeEmployees, icon: FileText, path: "/admin/employees", highlight: false },
    { label: "Mitarbeiter gesamt", value: profiles.length, icon: FileText, path: "/admin/employees", highlight: false },
  ];

  return (
    <div className="p-5 space-y-6">
      <div>
        <h1 className="text-lg font-heading font-bold text-foreground">Übersicht</h1>
        <p className="text-xs text-muted-foreground">Was jetzt zu tun ist</p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        {actionCards.map((c) => (
          <Card
            key={c.label}
            className={`group cursor-pointer hover:border-primary/20 transition-colors ${c.highlight ? "border-destructive/30 bg-destructive/[0.02]" : ""}`}
            onClick={() => navigate(c.path)}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${c.highlight ? "bg-destructive/10" : "bg-muted"}`}>
                  <c.icon className={`h-4 w-4 ${c.highlight ? "text-destructive" : "text-muted-foreground"}`} />
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
              </div>
              <p className={`text-xl font-bold font-heading ${c.highlight && c.value > 0 ? "text-destructive" : "text-foreground"}`}>{c.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <EmailMonitorWidget />
    </div>
  );
}
