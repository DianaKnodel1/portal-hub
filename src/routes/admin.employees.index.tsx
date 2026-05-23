import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/employees/")({
  component: AdminEmployeesPage,
});

import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useAdminData, type EmployeeStatus } from "@/contexts/AdminDataContext";
import { STATUS_ORDER, STATUS_CONFIG, checkRiskFlag } from "@/lib/status";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Download, CheckCircle2, XCircle, Power, Shield, Mail, User, MapPin, ShieldCheck, FileSignature, CalendarDays, ClipboardList, UserPlus } from "lucide-react";
import { CreateEmployeeWizard } from "@/components/admin/CreateEmployeeWizard";
import { exportToCsv } from "@/lib/csv-export";
import { TableSkeleton, PageHeaderSkeleton } from "@/components/SkeletonLoaders";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/PaginationBar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type OnbStep = { key: string; label: string; done: boolean; icon: React.ComponentType<{ className?: string }> };

function OnboardingPill({ steps }: { steps: OnbStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  return (
    <TooltipProvider delayDuration={100}>
      <div
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border ${
          allDone
            ? "bg-emerald-500/10 border-emerald-500/30"
            : "bg-muted/40 border-border"
        }`}
      >
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <Tooltip key={s.key}>
              <TooltipTrigger asChild>
                <span
                  className={`inline-flex items-center justify-center h-4 w-4 ${
                    s.done ? "text-emerald-500" : "text-muted-foreground/40"
                  }`}
                  aria-label={`${s.label}: ${s.done ? "erledigt" : "offen"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">
                <p className="font-medium">{s.label}</p>
                <p className="text-muted-foreground">{s.done ? "Erledigt" : "Offen"}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

function AdminEmployeesPage() {
  const { profiles, setProfiles, assignments, adminUserIds, kycList, allBookings, emailConfirmedUserIds, loading, loadData } = useAdminData();
  const [tenantMap, setTenantMap] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    supabase.from("tenants").select("id, name").then(({ data }) => {
      const map: Record<string, string> = {};
      (data ?? []).forEach((t: any) => { map[t.id] = t.name; });
      setTenantMap(map);
    });
  }, []);

  const updateProfileStatus = async (e: React.MouseEvent, userId: string, newStatus: EmployeeStatus) => {
    e.stopPropagation();
    const { error } = await supabase.from("profiles").update({ status: newStatus }).eq("user_id", userId);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("activity_log").insert({
          action: newStatus === "deaktiviert" ? "mitarbeiter_deaktiviert" : "status_geaendert",
          entity_type: "profile", entity_id: userId, actor_id: user.id,
          comment: `Status → ${STATUS_CONFIG[newStatus]?.label ?? newStatus}`,
          new_status: newStatus,
        });
      }
    } catch {}

    toast({ title: "Status aktualisiert" });
    setProfiles((prev) => prev.map((p) => (p.user_id === userId ? { ...p, status: newStatus } : p)));
  };

  // Onboarding-Map pro User
  const kycByUser = new Map(kycList.map((k: any) => [k.user_id, k]));
  const bookingByUser = new Set(allBookings.map((b: any) => b.user_id));
  const assignmentByUser = new Set(assignments.map((a: any) => a.user_id));

  const computeSteps = (p: any): OnbStep[] => [
    { key: "email", label: "E-Mail bestätigt", done: emailConfirmedUserIds.has(p.user_id), icon: Mail },
    { key: "personal", label: "Persönliche Daten", done: !!(p.phone && p.address && p.birth_date), icon: User },
    { key: "address", label: "Adresse", done: !!(p.address || (p.street && p.zip_code && p.city)), icon: MapPin },
    { key: "kyc", label: "Identität (KYC)", done: kycByUser.get(p.user_id)?.status === "verifiziert", icon: ShieldCheck },
    { key: "contract", label: "Arbeitsvertrag", done: !!p.contract_signed_at, icon: FileSignature },
    { key: "appointment", label: "Termin gebucht", done: bookingByUser.has(p.user_id), icon: CalendarDays },
    { key: "task", label: "Auftrag erhalten", done: assignmentByUser.has(p.user_id), icon: ClipboardList },
  ];

  const filtered = profiles.filter((p) => {
    if (!(p.full_name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && filterStatus !== "all") {
      // Stuck-Filter
      if (filterStatus.startsWith("stuck:")) {
        const stepKey = filterStatus.slice(6);
        const steps = computeSteps(p);
        const idx = steps.findIndex((s) => s.key === stepKey);
        const firstOpen = steps.findIndex((s) => !s.done);
        return firstOpen === idx;
      }
      if (p.status !== filterStatus) return false;
    }
    return true;
  });

  const { paged, page, setPage, pageCount, rangeFrom, rangeTo, total } = usePagination(filtered, 25);



  if (loading) return <div className="p-6 lg:p-8 space-y-5"><PageHeaderSkeleton /><TableSkeleton rows={5} cols={7} /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">Mitarbeiter</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{profiles.length} Einträge</p>
        </div>
        <div className="flex gap-2 items-center">
          <Button size="sm" className="h-9 text-xs gap-1.5" onClick={() => setWizardOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Mitarbeiter anlegen
          </Button>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44 h-9 text-xs"><SelectValue placeholder="Alle Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}
              <SelectItem value="stuck:email">Hängt: E-Mail</SelectItem>
              <SelectItem value="stuck:personal">Hängt: Persönliche Daten</SelectItem>
              <SelectItem value="stuck:kyc">Hängt: KYC</SelectItem>
              <SelectItem value="stuck:contract">Hängt: Vertrag</SelectItem>
              <SelectItem value="stuck:appointment">Hängt: Termin</SelectItem>
              <SelectItem value="stuck:task">Hängt: Auftrag</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-9 text-sm" />
          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={() => exportToCsv("mitarbeiter.csv", filtered.map((p) => ({
            ...p, status_label: STATUS_CONFIG[p.status]?.label ?? p.status, contract: p.contract_signed_at ? "Ja" : "Nein",
          })), [
            { key: "full_name", label: "Name" }, { key: "address", label: "Adresse" }, { key: "status_label", label: "Status" },
            { key: "contract", label: "Vertrag" }, { key: "created_at", label: "Registriert" },
          ])}><Download className="h-3.5 w-3.5" /> CSV</Button>
        </div>
      </div>

      <CreateEmployeeWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        tenants={Object.entries(tenantMap).map(([id, name]) => ({ id, name }))}
        onCreated={() => loadData()}
      />

      <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tenant</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Onboarding</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Aufgaben</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paged.map((profile) => {
              const isRisk = checkRiskFlag(profile.living_since);
              const isAdmin = adminUserIds.has(profile.user_id);
              const userAssignments = assignments.filter(a => a.user_id === profile.user_id);
              const doneCount = userAssignments.filter(a => ["abgeschlossen", "genehmigt"].includes(a.status)).length;
              const openCount = userAssignments.filter(a => !["abgeschlossen", "genehmigt", "entwurf"].includes(a.status)).length;
              const isDeactivated = profile.status === "deaktiviert";

              return (
                <tr key={profile.id} className={`hover:bg-muted/20 transition-colors cursor-pointer group ${isDeactivated ? "opacity-50" : ""}`} onClick={() => navigate(`/admin/employees/${profile.user_id}`)}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-foreground">{profile.full_name}</p>
                          {isAdmin && (
                            <Badge variant="default" className="text-[9px] px-1.5 py-0 bg-primary/90 text-primary-foreground gap-0.5">
                              <Shield className="h-2.5 w-2.5" /> Admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{profile.birth_date ? new Date(profile.birth_date).toLocaleDateString("de-DE") : "–"}</p>
                      </div>
                      {isRisk && <AlertTriangle className="h-3.5 w-3.5 text-status-pending shrink-0" />}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs max-w-[160px] truncate">{(profile as any).tenant_id ? tenantMap[(profile as any).tenant_id] || "–" : "–"}</td>
                  <td className="px-5 py-3.5">
                    <OnboardingPill steps={computeSteps(profile)} />
                  </td>
                  <td className="px-5 py-3.5 text-xs">
                    <span className="text-accent font-medium">{doneCount}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="text-foreground">{openCount} offen</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant="secondary" className={`text-[10px] ${STATUS_CONFIG[profile.status]?.color ?? "bg-muted text-muted-foreground"}`}>
                      {STATUS_CONFIG[profile.status]?.label ?? profile.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      {profile.status === "registriert" && (
                        <>
                          <Button size="sm" variant="default" className="h-7 text-[10px] gap-1 px-2" onClick={(e) => updateProfileStatus(e, profile.user_id, "angenommen")}>
                            <CheckCircle2 className="h-3 w-3" /> Annehmen
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-[10px] gap-1 px-2" onClick={(e) => updateProfileStatus(e, profile.user_id, "abgelehnt")}>
                            <XCircle className="h-3 w-3" /> Ablehnen
                          </Button>
                        </>
                      )}
                      {profile.status === "angenommen" && !isAdmin && (
                        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 px-2 text-destructive hover:text-destructive" onClick={(e) => updateProfileStatus(e, profile.user_id, "deaktiviert")}>
                          <Power className="h-3 w-3" /> Deaktivieren
                        </Button>
                      )}
                      {(profile.status === "deaktiviert" || profile.status === "abgelehnt") && !isAdmin && (
                        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 px-2 text-accent hover:text-accent" onClick={(e) => updateProfileStatus(e, profile.user_id, "angenommen")}>
                          <Power className="h-3 w-3" /> Aktivieren
                        </Button>
                      )}
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
    </div>
  );
}
