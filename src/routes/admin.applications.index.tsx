import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/applications/")({
  component: AdminApplicationsPage,
});

import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useAdminData } from "@/contexts/AdminDataContext";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/EmptyState";
import { FileText, Download, Trash2, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { exportToCsv } from "@/lib/csv-export";
import { TableSkeleton, PageHeaderSkeleton } from "@/components/SkeletonLoaders";
import { ImportApplicationsDialog } from "@/components/ImportApplicationsDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/PaginationBar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function AdminApplicationsPage() {
  const { applications, loading, loadData } = useAdminData();
  const [tenantMap, setTenantMap] = useState<Record<string, { name: string; domain: string }>>({});
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    supabase.from("tenants").select("id, name, domain").then(({ data }) => {
      const map: Record<string, { name: string; domain: string }> = {};
      (data ?? []).forEach((t: any) => { map[t.id] = { name: t.name, domain: t.domain }; });
      setTenantMap(map);
    });
  }, []);

  const acceptApplication = async (app: typeof applications[0], e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(app.id);
    try {
      const { error: updateError } = await supabase.from("applications").update({ status: "akzeptiert" }).eq("id", app.id);
      if (updateError) throw updateError;

      // Send invitation email
      const tenant = app.tenant_id ? tenantMap[app.tenant_id] : null;
      const portalLink = tenant?.domain
        ? `https://portal.${tenant.domain}/register`
        : `${window.location.origin}/register`;

      const { error: emailError } = await supabase.functions.invoke("send-invitation-email", {
        body: {
          to: app.email, fullName: app.full_name, firstName: app.first_name,
          lastName: app.last_name, registrationLink: portalLink, tenantId: app.tenant_id,
        },
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("activity_log").insert({
          action: "bewerbung_akzeptiert", entity_type: "application", entity_id: app.id,
          actor_id: user.id, comment: `Bewerbung von ${app.full_name} akzeptiert.`,
          old_status: app.status, new_status: "akzeptiert",
        });
      }

      toast({
        title: emailError ? "Akzeptiert – E-Mail fehlgeschlagen" : "Bewerbung akzeptiert",
        description: emailError ? "Portal-Link konnte nicht gesendet werden." : "Willkommensmail wurde gesendet.",
        variant: emailError ? "destructive" : "default",
      });
      loadData();
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const rejectApplication = async (app: typeof applications[0], e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(app.id);
    try {
      const { error } = await supabase.from("applications").update({ status: "abgelehnt" }).eq("id", app.id);
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("activity_log").insert({
          action: "bewerbung_abgelehnt", entity_type: "application", entity_id: app.id,
          actor_id: user.id, comment: `Bewerbung von ${app.full_name} abgelehnt.`,
          old_status: app.status, new_status: "abgelehnt",
        });
      }
      toast({ title: "Bewerbung abgelehnt" });
      loadData();
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const deleteApplication = async (id: string, name: string) => {
    setDeleting(id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("activity_log").insert({
          action: "bewerbung_geloescht", entity_type: "application", entity_id: id,
          actor_id: user.id, comment: `Bewerbung von ${name} gelöscht.`,
        });
      }
      const { error } = await supabase.from("applications").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Bewerbung gelöscht" });
      loadData();
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  // ─── Bulk-Aktionen ───
  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleSelectAllPage = (ids: string[], allSelected: boolean) => {
    setSelected((s) => {
      const n = new Set(s);
      if (allSelected) ids.forEach((id) => n.delete(id));
      else ids.forEach((id) => n.add(id));
      return n;
    });
  };
  const bulkUpdate = async (newStatus: "akzeptiert" | "abgelehnt") => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selected);
      const { error } = await supabase.from("applications").update({ status: newStatus }).in("id", ids);
      if (error) throw error;
      toast({ title: `${ids.length} Bewerbungen ${newStatus === "akzeptiert" ? "angenommen" : "abgelehnt"}` });
      setSelected(new Set());
      loadData();
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };
  const bulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selected);
      const { error } = await supabase.from("applications").delete().in("id", ids);
      if (error) throw error;
      toast({ title: `${ids.length} Bewerbungen gelöscht` });
      setSelected(new Set());
      loadData();
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  const filtered = applications.filter((a) =>
    (a.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (a.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const { paged, page, setPage, pageCount, rangeFrom, rangeTo, total } = usePagination(filtered, 25);

  if (loading) return <div className="p-6 lg:p-8 space-y-5"><PageHeaderSkeleton /><TableSkeleton rows={5} cols={5} /></div>;


  const statusColor = (status: string) => {
    if (status === "akzeptiert") return "bg-status-success text-status-success-foreground";
    if (status === "abgelehnt")  return "bg-destructive text-destructive-foreground";
    return "bg-status-info text-status-info-foreground";
  };

  const statusLabel = (status: string) => {
    if (status === "akzeptiert") return "Akzeptiert";
    if (status === "abgelehnt") return "Abgelehnt";
    if (status === "neu" || status === "eingegangen") return "Neu";
    return status;
  };

  return (
    <div className="p-6 lg:p-8 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">Bewerbungen</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{applications.length} Einträge</p>
        </div>
        <div className="flex gap-2 items-center">
          <Input placeholder="Suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-9 text-sm" />
          <ImportApplicationsDialog onImported={loadData} />
          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={() => exportToCsv("bewerbungen.csv", filtered, [
            { key: "full_name", label: "Name" }, { key: "email", label: "E-Mail" }, { key: "phone", label: "Telefon" },
            { key: "status", label: "Status" }, { key: "created_at", label: "Datum" },
          ])}><Download className="h-3.5 w-3.5" /> CSV</Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
          <p className="text-sm text-foreground">
            <strong>{selected.size}</strong> ausgewählt
          </p>
          <div className="flex gap-2">
            <Button size="sm" className="h-8 text-xs gap-1 bg-accent text-accent-foreground hover:bg-accent/90" disabled={bulkLoading} onClick={() => bulkUpdate("akzeptiert")}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Annehmen
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground" disabled={bulkLoading} onClick={() => bulkUpdate("abgelehnt")}>
              <XCircle className="h-3.5 w-3.5" /> Ablehnen
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-destructive hover:bg-destructive/10" disabled={bulkLoading}>
                  <Trash2 className="h-3.5 w-3.5" /> Löschen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{selected.size} Bewerbungen löschen?</AlertDialogTitle>
                  <AlertDialogDescription>Dies kann nicht rückgängig gemacht werden.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={bulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Endgültig löschen</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSelected(new Set())}>Abwählen</Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Keine Bewerbungen" description="Es liegen aktuell keine Bewerbungen vor." />
      ) : (
        <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-3 w-10">
                  <Checkbox
                    checked={paged.length > 0 && paged.every((a) => selected.has(a.id))}
                    onCheckedChange={() => toggleSelectAllPage(paged.map((a) => a.id), paged.every((a) => selected.has(a.id)))}
                  />
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">E-Mail</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Telefon</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tenant</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Datum</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paged.map((app) => {
                const isNew = app.status === "neu" || app.status === "eingegangen";
                const isLoading = actionLoading === app.id;
                const isSelected = selected.has(app.id);
                return (
                  <tr key={app.id} className={`hover:bg-muted/20 transition-colors cursor-pointer group ${isSelected ? "bg-primary/5" : ""}`} onClick={() => navigate(`/admin/applications/${app.id}`)}>
                    <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(app.id)} />
                    </td>
                    <td className="px-5 py-3.5 font-medium text-foreground">
                      {app.first_name && app.last_name ? `${app.first_name} ${app.last_name}` : app.full_name}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{app.email}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{app.phone || "–"}</td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">{app.tenant_id ? tenantMap[app.tenant_id]?.name || "–" : "–"}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant="secondary" className={`text-[10px] ${statusColor(app.status)}`}>{statusLabel(app.status)}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs">{new Date(app.created_at).toLocaleDateString("de-DE")}</td>
                    <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1.5 items-center">
                        {isNew && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              className="h-8 text-xs gap-1 bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm"
                              onClick={(e) => acceptApplication(app, e)}
                              disabled={isLoading}
                            >
                              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Annehmen
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
                              onClick={(e) => rejectApplication(app, e)}
                              disabled={isLoading}
                            >
                              <XCircle className="h-3.5 w-3.5" /> Ablehnen
                            </Button>
                          </>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Bewerbung löschen?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Die Bewerbung von <strong>{app.full_name}</strong> wird unwiderruflich gelöscht.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteApplication(app.id, app.full_name)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {deleting === app.id ? "Löschen…" : "Endgültig löschen"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
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
