import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/activity")({
  component: AdminActivityLogPage,
});

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminData } from "@/contexts/AdminDataContext";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { History } from "lucide-react";

interface LogEntry {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_status: string | null;
  new_status: string | null;
  comment: string | null;
  created_at: string;
}

const ENTITY_LABELS: Record<string, string> = {
  kyc: "Verifizierung", assignment: "Aufgabe", profile: "Mitarbeiter",
  booking: "Termin", transaction: "Transaktion", application: "Bewerbung",
};

function AdminActivityLogPage() {
  const { profiles } = useAdminData();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(200);
      setLogs((data as LogEntry[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Laden…</div>;

  const filtered = logs.filter((l) => {
    if (filterType && filterType !== "all" && l.entity_type !== filterType) return false;
    if (search) {
      const actor = profiles.find((p) => p.user_id === l.actor_id);
      const text = `${actor?.full_name ?? ""} ${l.action} ${l.comment ?? ""}`.toLowerCase();
      if (!text.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-heading font-bold text-foreground">Aktivitätsprotokoll</h1>
          <p className="text-xs text-muted-foreground">{logs.length} Einträge</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Alle Typen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Typen</SelectItem>
              {Object.entries(ENTITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-8 text-sm" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={History} title="Keine Einträge" description="Noch keine Aktivitäten protokolliert." />
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Zeitpunkt</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Akteur</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Aktion</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Bereich</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Kommentar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((log) => {
                const actor = profiles.find((p) => p.user_id === log.actor_id);
                return (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground text-xs">{actor?.full_name ?? "System"}</td>
                    <td className="px-4 py-3 text-foreground text-xs">{log.action}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-[10px]">{ENTITY_LABELS[log.entity_type] ?? log.entity_type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {log.old_status && log.new_status ? (
                        <span className="text-muted-foreground">{log.old_status} → <span className="font-medium text-foreground">{log.new_status}</span></span>
                      ) : log.new_status ? (
                        <span className="font-medium text-foreground">{log.new_status}</span>
                      ) : "–"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">{log.comment || "–"}</td>
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
