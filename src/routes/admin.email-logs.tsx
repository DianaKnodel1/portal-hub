import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/email-logs")({
  component: AdminEmailLogsPage,
});

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableSkeleton, PageHeaderSkeleton } from "@/components/SkeletonLoaders";
import { EmptyState } from "@/components/EmptyState";
import { Mail, RefreshCw, RotateCcw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  type EmailLog,
  EMAIL_STATUS_COLORS,
  EMAIL_STATUS_LABELS,
  EMAIL_TYPE_LABELS,
  computeEmailStats,
} from "@/lib/email-stats";

function AdminEmailLogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [resending, setResending] = useState<string | null>(null);
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("email_send_log")
      .select("*")
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(500);
    setLogs((data as EmailLog[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const stats = useMemo(() => computeEmailStats(logs), [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!l.recipient_email.toLowerCase().includes(q) && !(l.template_name || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [logs, filterStatus, search]);

  const resendEmail = async (log: EmailLog) => {
    setResending(log.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-invitation-email", {
        body: {
          to: log.recipient_email,
          fullName: log.metadata?.full_name || log.recipient_email,
          firstName: log.metadata?.first_name,
          lastName: log.metadata?.last_name,
          registrationLink: log.metadata?.registration_link || window.location.origin,
          tenantId: log.metadata?.tenant_id,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: "E-Mail erneut gesendet" });
      loadData();
    } catch (err: any) {
      toast({ title: "Fehler beim Versand", description: err.message, variant: "destructive" });
    } finally {
      setResending(null);
    }
  };

  if (loading) return <div className="p-6 lg:p-8 space-y-5"><PageHeaderSkeleton /><TableSkeleton rows={8} cols={5} /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-5">
      {/* Hero Status Banner — sehr klar sichtbar */}
      <div className={`rounded-2xl p-5 border-2 ${
        stats.actionRequired
          ? "bg-destructive/5 border-destructive/40"
          : stats.total === 0
          ? "bg-muted/40 border-border"
          : "bg-status-success/5 border-status-success/40"
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 ${
              stats.actionRequired
                ? "bg-destructive/15"
                : stats.total === 0
                ? "bg-muted"
                : "bg-status-success/15"
            }`}>
              {stats.actionRequired ? (
                <AlertTriangle className="h-7 w-7 text-destructive" />
              ) : stats.total === 0 ? (
                <Mail className="h-7 w-7 text-muted-foreground" />
              ) : (
                <CheckCircle2 className="h-7 w-7 text-status-success" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">
                {stats.actionRequired
                  ? "Aktion erforderlich"
                  : stats.total === 0
                  ? "Noch keine E-Mails versendet"
                  : "Alles läuft sauber"}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {stats.actionRequired
                  ? `${stats.failed} E-Mail${stats.failed === 1 ? "" : "s"} konnten nicht zugestellt werden`
                  : `${stats.sent} von ${stats.total} E-Mails erfolgreich zugestellt · Erfolgsquote ${stats.successRate}%`}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 shrink-0" onClick={loadData}>
            <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-accent">{stats.sent}</p>
              <p className="text-xs text-muted-foreground">Erfolgreich gesendet</p>
            </div>
          </CardContent>
        </Card>
        <Card className={stats.failed > 0 ? "border-destructive/30" : ""}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${stats.failed > 0 ? "bg-destructive/10" : "bg-muted"}`}>
              <XCircle className={`h-5 w-5 ${stats.failed > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${stats.failed > 0 ? "text-destructive" : "text-foreground"}`}>{stats.failed}</p>
              <p className="text-xs text-muted-foreground">Fehlgeschlagen</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Gesamt</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${stats.successRate >= 95 ? "bg-accent/10" : "bg-destructive/10"}`}>
              {stats.successRate >= 95 ? (
                <CheckCircle2 className="h-5 w-5 text-accent" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              )}
            </div>
            <div>
              <p className={`text-2xl font-bold ${stats.successRate >= 95 ? "text-accent" : "text-destructive"}`}>{stats.successRate}%</p>
              <p className="text-xs text-muted-foreground">Erfolgsquote</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* (Aktion-Erforderlich-Banner ist jetzt im Hero oben integriert) */}

      {/* Filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 h-9 text-xs"><SelectValue placeholder="Alle Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="sent">✅ Gesendet</SelectItem>
            <SelectItem value="failed">❌ Fehlgeschlagen</SelectItem>
            <SelectItem value="suppressed">⚠️ Unterdrückt</SelectItem>
            <SelectItem value="bounced">🔴 Gebounced</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Empfänger suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-9 text-sm" />
      </div>

      {/* Log Table */}
      {filtered.length === 0 ? (
        <EmptyState icon={Mail} title="Keine E-Mails" description="Keine E-Mails mit diesem Filter gefunden." />
      ) : (
        <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Empfänger</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Typ</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">SMTP</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Zeitpunkt</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fehler</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.slice(0, 100).map((log) => {
                const canResend = ["failed", "dlq"].includes(log.status);
                const smtpHost = log.metadata?.smtp_host;

                return (
                  <tr key={log.id} className={`hover:bg-muted/20 transition-colors ${canResend ? "bg-destructive/[0.02]" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {log.status === "sent" ? (
                          <CheckCircle2 className="h-4 w-4 text-accent" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        <Badge variant="secondary" className={`text-[10px] ${EMAIL_STATUS_COLORS[log.status] ?? "bg-muted text-muted-foreground"}`}>
                          {EMAIL_STATUS_LABELS[log.status] ?? log.status}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground text-xs">{log.recipient_email}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-[10px]">
                        {EMAIL_TYPE_LABELS[log.template_name] ?? log.template_name}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                      {smtpHost || "–"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-xs text-destructive max-w-[200px] truncate">
                      {log.error_message || "–"}
                    </td>
                    <td className="px-3 py-3">
                      {canResend && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => resendEmail(log)} disabled={resending === log.id} title="Erneut senden">
                          <RotateCcw className={`h-3.5 w-3.5 ${resending === log.id ? "animate-spin" : ""}`} />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <div className="px-4 py-3 text-xs text-muted-foreground bg-muted/20 border-t">
              Zeige 100 von {filtered.length} Einträgen
            </div>
          )}
        </div>
      )}
    </div>
  );
}
