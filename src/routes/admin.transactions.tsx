import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/transactions")({
  component: AdminTransactionsPage,
});

import { useState } from "react";
import { useAdminData } from "@/contexts/AdminDataContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { Banknote, Wallet, Download } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { TRANSACTION_STATUS_CONFIG, statusBadgeClass, type TransactionStatus } from "@/lib/status";
import { TableSkeleton, PageHeaderSkeleton } from "@/components/SkeletonLoaders";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/PaginationBar";

function AdminTransactionsPage() {
  const { allTransactions, setAllTransactions, profiles, assignments, templates, loading } = useAdminData();
  const { toast } = useToast();
  const [filterUser, setFilterUser] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  const markAsPaid = async (txId: string) => {
    const { error } = await supabase.from("user_transactions").update({ status: "ausgezahlt" }).eq("id", txId);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: "💰 Als ausgezahlt markiert", description: "Der Mitarbeiter wurde benachrichtigt." });
    setAllTransactions((prev) => prev.map((t) => (t.id === txId ? { ...t, status: "ausgezahlt" } : t)));
  };

  const filtered = allTransactions.filter((t) => {
    if (filterUser && filterUser !== "all" && t.user_id !== filterUser) return false;
    if (filterStatus && filterStatus !== "all" && t.status !== filterStatus) return false;
    if (search) {
      const profile = profiles.find((p) => p.user_id === t.user_id);
      if (!(profile?.full_name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    }
    return true;
  });
  const totalPending = filtered.filter((t) => t.status === "genehmigt").reduce((s, t) => s + Number(t.amount), 0);
  const { paged, page, setPage, pageCount, rangeFrom, rangeTo, total } = usePagination(filtered, 25);

  if (loading) return <div className="p-5 space-y-4"><PageHeaderSkeleton /><TableSkeleton rows={5} cols={6} /></div>;

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-heading font-bold text-foreground">Transaktionen</h1>
          <p className="text-xs text-muted-foreground">{allTransactions.length} Einträge</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Alle Mitarbeiter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Mitarbeiter</SelectItem>
            {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Alle Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="ausstehend">Ausstehend</SelectItem>
            <SelectItem value="genehmigt">Genehmigt</SelectItem>
            <SelectItem value="ausgezahlt">Ausgezahlt</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-8 text-sm" />
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => {
          const rows = filtered.map((tx) => {
            const profile = profiles.find((p) => p.user_id === tx.user_id);
            const assignment = assignments.find((a) => a.id === tx.assignment_id);
            const tpl = assignment ? templates.find((t) => t.id === assignment.task_template_id) : null;
            return { name: profile?.full_name ?? "?", task: tpl?.title ?? "Aufgabe", amount: Number(tx.amount).toFixed(2), status: tx.status, date: new Date(tx.created_at).toLocaleDateString("de-DE") };
          });
          exportToCsv("transaktionen.csv", rows, [
            { key: "name", label: "Mitarbeiter" }, { key: "task", label: "Aufgabe" }, { key: "amount", label: "Betrag" },
            { key: "status", label: "Status" }, { key: "date", label: "Datum" },
          ]);
        }}><Download className="h-3 w-3" /> CSV</Button>
        {totalPending > 0 && (
          <div className="ml-auto flex items-center gap-2 bg-status-pending/5 border border-status-pending/15 rounded-lg px-3 py-1.5">
            <Banknote className="h-3.5 w-3.5 text-status-pending" />
            <span className="text-xs font-medium text-foreground">Auszahlungsbereit: {totalPending.toFixed(2)} €</span>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Wallet} title="Keine Transaktionen" description="Es gibt aktuell keine Transaktionen." />
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Mitarbeiter</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Aufgabe</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Betrag</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Datum</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paged.map((tx) => {
                const profile = profiles.find((p) => p.user_id === tx.user_id);
                const assignment = assignments.find((a) => a.id === tx.assignment_id);
                const tpl = assignment ? templates.find((t) => t.id === assignment.task_template_id) : null;
                const txCfg = TRANSACTION_STATUS_CONFIG[tx.status as TransactionStatus] ?? { label: tx.status, color: "bg-muted text-muted-foreground" };
                return (
                  <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{profile?.full_name ?? "?"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{tpl?.title ?? "Aufgabe"}</td>
                    <td className="px-4 py-3 font-bold text-foreground">{Number(tx.amount).toFixed(2)} €</td>
                    <td className="px-4 py-3"><Badge variant="secondary" className={statusBadgeClass(txCfg.color)}>{txCfg.label}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(tx.created_at).toLocaleDateString("de-DE")}</td>
                    <td className="px-4 py-3">
                      {tx.status === "genehmigt" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markAsPaid(tx.id)}>
                          <Banknote className="h-3 w-3 mr-1" /> Auszahlen
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-border bg-muted/20">
            <PaginationBar page={page} pageCount={pageCount} setPage={setPage} rangeFrom={rangeFrom} rangeTo={rangeTo} total={total} />
          </div>
        </div>
      )}
    </div>
  );
}
