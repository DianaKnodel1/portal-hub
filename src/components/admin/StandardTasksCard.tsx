import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Plus, X, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { translateDbError } from "@/lib/db-errors";

interface Tenant { id: string; name: string; }
interface Template { id: string; title: string; }
interface DefaultRow { id: string; tenant_id: string; task_template_id: string; sort_order: number; }

export function StandardTasksCard() {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [rows, setRows] = useState<DefaultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTemplate, setNewTemplate] = useState<string>("");

  useEffect(() => {
    (async () => {
      const [tRes, tplRes] = await Promise.all([
        supabase.from("tenants").select("id, name").eq("is_active", true).order("name"),
        supabase.from("task_templates").select("id, title").eq("is_active", true).order("title"),
      ]);
      const ts = (tRes.data ?? []) as Tenant[];
      setTenants(ts);
      setTemplates((tplRes.data ?? []) as Template[]);
      if (ts.length > 0) setSelectedTenant(ts[0].id);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedTenant) { setRows([]); return; }
    supabase
      .from("tenant_default_tasks" as any)
      .select("id, tenant_id, task_template_id, sort_order")
      .eq("tenant_id", selectedTenant)
      .order("sort_order")
      .then(({ data }) => setRows(((data ?? []) as unknown) as DefaultRow[]));
  }, [selectedTenant]);

  const titleOf = (id: string) => templates.find((t) => t.id === id)?.title ?? "(gelöscht)";

  const refetch = async () => {
    const { data } = await supabase
      .from("tenant_default_tasks" as any)
      .select("id, tenant_id, task_template_id, sort_order")
      .eq("tenant_id", selectedTenant)
      .order("sort_order");
    setRows(((data ?? []) as unknown) as DefaultRow[]);
  };

  const addRow = async () => {
    if (!newTemplate || !selectedTenant) return;
    setAdding(true);
    const nextOrder = (rows.at(-1)?.sort_order ?? 0) + 1;
    const { error } = await supabase
      .from("tenant_default_tasks" as any)
      .insert({ tenant_id: selectedTenant, task_template_id: newTemplate, sort_order: nextOrder });
    setAdding(false);
    if (error) {
      toast({ title: "Fehler", description: translateDbError(error.message), variant: "destructive" });
      return;
    }
    setNewTemplate("");
    await refetch();
    toast({ title: "Standard-Auftrag hinzugefügt" });
  };

  const removeRow = async (id: string) => {
    const { error } = await supabase.from("tenant_default_tasks" as any).delete().eq("id", id);
    if (error) { toast({ title: "Fehler", description: translateDbError(error.message), variant: "destructive" }); return; }
    // Reihenfolge nachsortieren
    const remaining = rows.filter((r) => r.id !== id);
    for (let i = 0; i < remaining.length; i++) {
      const target = i + 1;
      if (remaining[i].sort_order !== target) {
        await supabase.from("tenant_default_tasks" as any).update({ sort_order: target }).eq("id", remaining[i].id);
      }
    }
    await refetch();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const a = rows[index]; const b = rows[index + dir];
    if (!a || !b) return;
    // Tausch via 3-Schritte um Unique-Constraint zu vermeiden
    const tmp = 9000 + Math.floor(Math.random() * 1000);
    await supabase.from("tenant_default_tasks" as any).update({ sort_order: tmp }).eq("id", a.id);
    await supabase.from("tenant_default_tasks" as any).update({ sort_order: a.sort_order }).eq("id", b.id);
    await supabase.from("tenant_default_tasks" as any).update({ sort_order: b.sort_order }).eq("id", a.id);
    await refetch();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> Standard-Aufträge
        </CardTitle>
        <CardDescription>
          Diese Aufträge werden Mitarbeitern automatisch zugewiesen — in der gewählten Reihenfolge.
          Standard-Auftrag #1 wird bei der ersten Terminbuchung zugewiesen, #2 bei der zweiten, usw.
          Ab der nächsten Buchung weist du Aufträge individuell zu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : tenants.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine aktive Domain vorhanden.</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Domain</Label>
              <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {rows.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Noch keine Standard-Aufträge konfiguriert.</p>
              )}
              {rows.map((r, i) => (
                <div key={r.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
                  <div className="h-7 w-7 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                    #{r.sort_order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{titleOf(r.task_template_id)}</p>
                    <p className="text-[10px] text-muted-foreground">Wird bei Buchung #{r.sort_order} automatisch zugewiesen</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeRow(r.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-end gap-2 pt-2 border-t border-border">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Auftrag hinzufügen</Label>
                <Select value={newTemplate} onValueChange={setNewTemplate}>
                  <SelectTrigger><SelectValue placeholder="Auftrag wählen…" /></SelectTrigger>
                  <SelectContent>
                    {templates
                      .filter((t) => !rows.some((r) => r.task_template_id === t.id))
                      .map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" onClick={addRow} disabled={!newTemplate || adding} className="gap-1.5">
                <Plus className="h-4 w-4" /> Hinzufügen
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}