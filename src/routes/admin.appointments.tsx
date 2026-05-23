import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/appointments")({
  component: AdminAppointmentsPage,
});

import { useState, useMemo } from "react";
import { useAdminData } from "@/contexts/AdminDataContext";
import { getAssignableEmployees } from "@/lib/employee-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { CalendarDays, Trash2, LinkIcon, Plus, CalendarIcon, Clock, Zap, Settings2, ShieldCheck } from "lucide-react";
import { format, startOfToday, isSameDay } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AssignmentIndividualData } from "@/components/AssignmentIndividualData";

const BOOKING_STATUSES = [
  { value: "gebucht", label: "Gebucht", class: "bg-primary/15 text-primary border border-primary/20 font-medium" },
  { value: "bestätigt", label: "Bestätigt", class: "bg-accent text-accent-foreground border border-accent font-semibold" },
  { value: "abgeschlossen", label: "Abgeschlossen", class: "bg-muted text-foreground border border-border font-medium" },
  { value: "storniert", label: "Storniert", class: "bg-destructive/15 text-destructive border border-destructive/20 font-medium" },
];

// Admin darf rund um die Uhr buchen (00:00 – 23:30)
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return { value: `${h}:${m}`, label: `${h}:${m} Uhr` };
});

function AdminAppointmentsPage() {
  const { allBookings, profiles, templates, assignments, adminUserIds, loading, loadData } = useAdminData();
  const assignableEmployees = useMemo(() => getAssignableEmployees(profiles, adminUserIds), [profiles, adminUserIds]);
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState("alle");
  const [assignBookingId, setAssignBookingId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [createUserId, setCreateUserId] = useState("");
  const [createDate, setCreateDate] = useState<Date>();
  const [createTime, setCreateTime] = useState("");
  const [createTemplateId, setCreateTemplateId] = useState<string>("none");
  const [creating, setCreating] = useState(false);

  // Individuelle Auftragsdaten – Dialog
  const [individualAssignmentId, setIndividualAssignmentId] = useState<string | null>(null);
  const [individualUserId, setIndividualUserId] = useState<string | null>(null);

  const updateBookingStatus = async (bookingId: string, status: string) => {
    const { error } = await supabase.from("bookings").update({ status: status as any }).eq("id", bookingId);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Status → ${BOOKING_STATUSES.find(s => s.value === status)?.label}` });
    loadData();
  };

  const deleteBooking = async (bookingId: string) => {
    const { error } = await supabase.from("bookings").delete().eq("id", bookingId);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Buchung gelöscht" });
    loadData();
  };

  const assignTask = async () => {
    if (!assignBookingId || !selectedAssignmentId) return;
    const booking = allBookings.find((b) => b.id === assignBookingId);
    if (!booking) return;

    // selectedAssignmentId is actually a template_id – we always create a fresh assignment
    // tied to this booking & employee. release_at = booking time so the task unlocks then.
    const releaseAt = booking.booking_date && booking.booking_time
      ? new Date(`${booking.booking_date}T${booking.booking_time}`).toISOString()
      : null;

    const { data: newAssignment, error: createErr } = await supabase
      .from("task_assignments")
      .insert({
        user_id: booking.user_id,
        task_template_id: selectedAssignmentId,
        status: "zugewiesen" as any,
        release_at: releaseAt,
      })
      .select("id")
      .single();
    if (createErr || !newAssignment) {
      toast({ title: "Fehler", description: createErr?.message ?? "Auftrag konnte nicht erstellt werden.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("bookings").update({ assignment_id: newAssignment.id }).eq("id", assignBookingId);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Auftrag zugewiesen", description: "Bitte jetzt individuelle Daten für diesen Mitarbeiter pflegen." });
    setAssignBookingId(null); setSelectedAssignmentId("");
    // Direkt den Individuell-Bearbeiten-Dialog öffnen
    setIndividualAssignmentId(newAssignment.id);
    setIndividualUserId(booking.user_id);
    loadData();
  };

  const createBooking = async () => {
    if (!createUserId || !createDate || !createTime) {
      toast({ title: "Alle Felder ausfüllen", variant: "destructive" }); return;
    }
    setCreating(true);
    const dateStr = format(createDate, "yyyy-MM-dd");

    // Optional Auftrag erstellen, damit beim Termin direkt Nummer/Daten gepflegt werden können
    let newAssignmentId: string | null = null;
    if (createTemplateId && createTemplateId !== "none") {
      const releaseAt = new Date(`${dateStr}T${createTime}`).toISOString();
      const { data: asg, error: asgErr } = await supabase
        .from("task_assignments")
        .insert({
          user_id: createUserId,
          task_template_id: createTemplateId,
          status: "zugewiesen" as any,
          release_at: releaseAt,
        })
        .select("id")
        .single();
      if (asgErr) {
        toast({ title: "Fehler", description: asgErr.message, variant: "destructive" });
        setCreating(false);
        return;
      }
      newAssignmentId = asg?.id ?? null;
    }

    const { error } = await supabase.from("bookings").insert({
      user_id: createUserId,
      booking_date: dateStr,
      booking_time: createTime,
      status: "gebucht" as any,
      admin_override: true,
      assignment_id: newAssignmentId,
    } as any);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); setCreating(false); return; }
    toast({ title: "Termin erstellt", description: "Der Termin ist manuell freigeschaltet." });

    const assignedUserId = createUserId;
    setShowCreate(false); setCreateUserId(""); setCreateDate(undefined); setCreateTime(""); setCreateTemplateId("none");
    setCreating(false);
    loadData();

    // Wenn Auftrag direkt erstellt wurde → Individual-Dialog (inkl. SMS-Nummer) öffnen
    if (newAssignmentId) {
      setIndividualAssignmentId(newAssignmentId);
      setIndividualUserId(assignedUserId);
    }
  };

  const toggleAdminOverride = async (bookingId: string, current: boolean) => {
    const booking = allBookings.find((b) => b.id === bookingId);
    const { error } = await supabase
      .from("bookings")
      .update({ admin_override: !current } as any)
      .eq("id", bookingId);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }

    // Beim manuellen Freischalten auch den verknüpften Auftrag sofort sichtbar machen
    if (!current && booking?.assignment_id) {
      await supabase
        .from("task_assignments")
        .update({ release_at: new Date().toISOString() } as any)
        .eq("id", booking.assignment_id);
    }

    toast({
      title: !current ? "Termin manuell freigeschaltet" : "Manuelle Freischaltung entfernt",
    });
    loadData();
  };

  if (loading) return <div className="p-5 space-y-4"><div className="h-6 w-32 bg-muted rounded animate-pulse" /><div className="h-64 bg-muted/50 rounded-xl border animate-pulse" /></div>;

  const enrichedBookings = allBookings
    .filter((b) => b.booking_date && b.booking_time)
    .map((b) => {
      const profile = profiles.find((p) => p.user_id === b.user_id);
      const assignment = b.assignment_id ? assignments.find((a) => a.id === b.assignment_id) : null;
      const template = assignment ? templates.find((t) => t.id === assignment.task_template_id) : null;
      const releaseAt = assignment && (assignment as any).release_at ? new Date((assignment as any).release_at) : null;
      const isReleased = releaseAt ? releaseAt <= new Date() : true;
      return { ...b, profile, assignment, template, releaseAt, isReleased };
    })
    .filter((b) => filterStatus === "alle" || b.status === filterStatus)
    .sort((a, b) => {
      const da = new Date(`${a.booking_date}T${a.booking_time}`);
      const db = new Date(`${b.booking_date}T${b.booking_time}`);
      return db.getTime() - da.getTime();
    });

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-heading font-bold text-foreground">Termine</h1>
          <p className="text-xs text-muted-foreground">{allBookings.length} Buchungen</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Status</SelectItem>
              {BOOKING_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Termin erstellen</Button>
        </div>
      </div>

      {enrichedBookings.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Keine Buchungen" description={filterStatus !== "alle" ? "Kein Eintrag für diesen Filter." : "Noch keine Terminbuchungen vorhanden."} />
      ) : (
        <div className="border rounded-lg overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Mitarbeiter</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Datum</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Uhrzeit</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Auftrag</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Freischaltung</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {enrichedBookings.map((b) => {
                const statusInfo = BOOKING_STATUSES.find((s) => s.value === b.status) ?? BOOKING_STATUSES[0];
                return (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{b.profile?.full_name ?? "Unbekannt"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(b.booking_date + "T00:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" })}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{b.booking_time?.slice(0, 5)} Uhr</td>
                    <td className="px-4 py-3">
                      <Select value={b.status} onValueChange={(val) => updateBookingStatus(b.id, val)}>
                        <SelectTrigger className="h-7 w-[130px] text-xs border-0 bg-transparent p-0">
                          <Badge variant="secondary" className={`text-[10px] ${statusInfo.class}`}>{statusInfo.label}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {BOOKING_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      {b.template ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-foreground">{b.template.title}</span>
                          {b.assignment && (
                            <button
                              onClick={() => {
                                setIndividualAssignmentId(b.assignment!.id);
                                setIndividualUserId(b.user_id);
                              }}
                              className="text-[10px] text-primary hover:underline flex items-center gap-1"
                              title="Individuelle Daten / PDF für diesen Mitarbeiter"
                            >
                              <Settings2 className="h-3 w-3" /> Individuell
                            </button>
                          )}
                        </div>
                      ) : b.assignment ? (
                        <button
                          onClick={() => {
                            setIndividualAssignmentId(b.assignment!.id);
                            setIndividualUserId(b.user_id);
                          }}
                          className="text-[10px] text-primary hover:underline flex items-center gap-1"
                        >
                          <Settings2 className="h-3 w-3" /> Individuell bearbeiten
                        </button>
                      ) : (
                        <button onClick={() => { setAssignBookingId(b.id); setSelectedAssignmentId(""); }} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                          <LinkIcon className="h-3 w-3" /> Zuweisen
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(b as any).admin_override ? (
                        <Badge variant="secondary" className="text-[10px] bg-status-success text-status-success-foreground">
                          <ShieldCheck className="h-3 w-3 mr-0.5" /> Admin freigeschaltet
                        </Badge>
                      ) : b.releaseAt ? (
                        <div className="flex items-center gap-1.5">
                          {b.isReleased ? (
                            <Badge variant="secondary" className="text-[10px] bg-status-success text-status-success-foreground">
                              <Zap className="h-3 w-3 mr-0.5" /> Freigegeben
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] bg-status-pending text-status-pending-foreground">
                              <Clock className="h-3 w-3 mr-0.5" />
                              Noch gesperrt · {b.releaseAt.toLocaleDateString("de-DE", { day: "numeric", month: "short" })} {b.releaseAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] bg-muted text-foreground border border-border">
                          Noch nicht freigegeben
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!(b as any).admin_override && !b.isReleased && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[10px] text-foreground hover:bg-muted"
                            onClick={() => toggleAdminOverride(b.id, false)}
                            title="Termin manuell freischalten"
                          >
                            <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                            Freischalten
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteBooking(b.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Booking Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Termin manuell erstellen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Mitarbeiter</label>
              <Select value={createUserId} onValueChange={setCreateUserId}>
                <SelectTrigger><SelectValue placeholder="Mitarbeiter wählen…" /></SelectTrigger>
                <SelectContent>
                  {assignableEmployees.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Datum</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal h-9 text-sm">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {createDate ? format(createDate, "PPP", { locale: de }) : "Datum wählen…"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={createDate}
                    onSelect={(d) => { setCreateDate(d); setCreateTime(""); }}
                    disabled={(date) => date < startOfToday()}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Uhrzeit (Admin: rund um die Uhr)</label>
              <Select value={createTime} onValueChange={setCreateTime}>
                <SelectTrigger><SelectValue placeholder="Uhrzeit wählen…" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {(() => {
                    const isToday = createDate && isSameDay(createDate, new Date());
                    const now = new Date();
                    const nowMins = now.getHours() * 60 + now.getMinutes();
                    return TIME_OPTIONS.filter((t) => {
                      if (!isToday) return true;
                      const [h, m] = t.value.split(":").map(Number);
                      return h * 60 + m > nowMins;
                    }).map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>);
                  })()}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Auftrag (optional)</label>
              <Select value={createTemplateId} onValueChange={setCreateTemplateId}>
                <SelectTrigger><SelectValue placeholder="Kein Auftrag" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Auftrag</SelectItem>
                  {templates.filter((t) => t.is_active).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Bei Auswahl öffnet sich nach dem Erstellen direkt der Dialog für individuelle Daten & SMS-Nummer.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" onClick={createBooking} disabled={creating || !createUserId || !createDate || !createTime}>
              {creating ? "Erstellen…" : "Termin erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Task Dialog */}
      <Dialog open={!!assignBookingId} onOpenChange={(o) => { if (!o) setAssignBookingId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Auftrag zuweisen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {(() => {
              const booking = allBookings.find((b) => b.id === assignBookingId);
              if (!booking) return null;
              const activeTemplates = templates.filter((t) => t.is_active);
              if (activeTemplates.length === 0) {
                return <p className="text-sm text-muted-foreground">Keine aktiven Auftragsvorlagen vorhanden. Bitte zuerst eine Vorlage anlegen.</p>;
              }
              return (
                <>
                  <p className="text-xs text-muted-foreground">
                    Wähle eine Auftragsvorlage. Der Auftrag wird dem Mitarbeiter zugewiesen und mit diesem Termin verknüpft.
                  </p>
                  <Select value={selectedAssignmentId} onValueChange={setSelectedAssignmentId}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Auftragsvorlage wählen…" /></SelectTrigger>
                    <SelectContent>
                      {activeTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              );
            })()}
          </div>
          <DialogFooter>
            <Button size="sm" disabled={!selectedAssignmentId} onClick={assignTask}>Zuweisen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Individuelle Auftragsdaten pro Mitarbeiter / Zuweisung */}
      <Dialog
        open={!!individualAssignmentId}
        onOpenChange={(o) => {
          if (!o) {
            setIndividualAssignmentId(null);
            setIndividualUserId(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Individuelle Auftragsdaten</DialogTitle>
          </DialogHeader>
          {individualAssignmentId && individualUserId && (() => {
            const asg = assignments.find((a) => a.id === individualAssignmentId);
            const tpl = asg ? templates.find((t) => t.id === asg.task_template_id) : null;
            return (
              <AssignmentIndividualData
                assignmentId={individualAssignmentId}
                userId={individualUserId}
                templateInstructions={tpl?.instructions ?? ""}
                initial={{
                  individual_instructions: (asg as any)?.individual_instructions ?? "",
                  individual_phone: (asg as any)?.individual_phone ?? "",
                  individual_hint: (asg as any)?.individual_hint ?? "",
                  post_ident_pdf_url: (asg as any)?.post_ident_pdf_url ?? null,
                  post_ident_pdf_name: (asg as any)?.post_ident_pdf_name ?? null,
                }}
                onSaved={loadData}
              />
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
