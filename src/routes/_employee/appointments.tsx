import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_employee/appointments")({
  component: AppointmentsPage,
});

import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "@/lib/router-compat";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isBefore, startOfToday, addMonths, subMonths, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertTriangle, Info, XCircle, CalendarDays, Plus, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { hasFullAccess } from "@/lib/employee-utils";
import type { EmployeeStatus } from "@/lib/status";

interface Booking {
  id: string;
  user_id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  assignment_id: string | null;
  created_at: string;
  cancelled_by_role?: string | null;
  cancelled_at?: string | null;
}

const STATUS_LABELS: Record<string, { label: string; class: string; dot: string }> = {
  gebucht: { label: "Gebucht", class: "bg-primary/15 text-primary border border-primary/20 font-medium", dot: "bg-primary" },
  bestätigt: { label: "Bestätigt", class: "bg-accent text-accent-foreground border border-accent font-semibold", dot: "bg-accent-foreground" },
  abgeschlossen: { label: "Abgeschlossen", class: "bg-muted text-foreground border border-border font-medium", dot: "bg-foreground/60" },
  storniert: { label: "Storniert", class: "bg-destructive/15 text-destructive border border-destructive/20 font-medium", dot: "bg-destructive" },
};

const MAX_FUTURE_BOOKINGS = 3;
const TIME_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const h = (9 + i).toString().padStart(2, "0");
  return { value: `${h}:00`, label: `${h}:00` };
});

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function AppointmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accessAllowed, setAccessAllowed] = useState(false);

  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [showBookDialog, setShowBookDialog] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    checkAccessAndLoad();
  }, [user, authLoading]);

  const checkAccessAndLoad = async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("status")
        .eq("user_id", user!.id)
        .maybeSingle();
      const status = data?.status as EmployeeStatus | undefined;
      if (!hasFullAccess(status)) {
        console.log("[AppointmentsPage] Zugriff blockiert", { user_id: user!.id, status });
        setAccessAllowed(false);
        setLoading(false);
        return;
      }
      setAccessAllowed(true);
      await loadBookings();
    } catch (err: any) {
      setError(err.message || "Daten konnten nicht geladen werden.");
      setLoading(false);
    }
  };

  const loadBookings = async () => {
    try {
      const { data, error: err } = await supabase
        .from("bookings")
        .select("id, user_id, booking_date, booking_time, status, assignment_id, created_at, cancelled_by_role, cancelled_at")
        .eq("user_id", user!.id)
        .not("booking_date", "is", null)
        .order("booking_date", { ascending: false });
      if (err) throw err;
      setBookings((data ?? []) as Booking[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const activeFutureBookings = bookings.filter((b) => {
    if (b.status === "storniert") return false;
    return new Date(`${b.booking_date}T${b.booking_time}`) >= new Date();
  });

  const activeBookings = bookings.filter((b) => b.status !== "storniert");

  // Calendar data
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad to start on Monday
  const firstDayOfWeek = (monthStart.getDay() + 6) % 7; // 0=Mon
  const paddingBefore = Array.from({ length: firstDayOfWeek }, (_, i) => null);

  const bookingsByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    activeBookings.forEach((b) => {
      if (!map[b.booking_date]) map[b.booking_date] = [];
      map[b.booking_date].push(b);
    });
    return map;
  }, [activeBookings]);

  const today = startOfToday();

  const handleDayClick = (day: Date) => {
    if (isBefore(day, today)) return;
    setSelectedDate(day);
    setSelectedTime("");
    setShowBookDialog(true);
  };

  const [bookingSuccess, setBookingSuccess] = useState<{ date: string; time: string } | null>(null);

  const createBooking = async () => {
    // Frontend prüft NUR die Pflichtfelder – die echte Validierung liegt im DB-Trigger.
    if (!selectedDate || !selectedTime) {
      toast({ title: "Buchung nicht möglich", description: "Bitte Datum und Uhrzeit auswählen.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      console.log("[Booking] Versuche Termin zu buchen", { user_id: user!.id, date: dateStr, time: selectedTime });
      const { error: insertErr } = await supabase.from("bookings").insert({
        user_id: user!.id, booking_date: dateStr, booking_time: selectedTime, time_slot_id: null,
      } as any);
      if (insertErr) throw insertErr;
      console.log("[Booking] ✓ Termin gebucht", { date: dateStr, time: selectedTime });
      setShowBookDialog(false);
      setBookingSuccess({ date: dateStr, time: selectedTime });
      setSelectedDate(null);
      setSelectedTime("");
      await loadBookings();
    } catch (err: any) {
      console.error("[Booking] Fehler", err);
      const raw = (err?.message ?? "").toString();
      let title = "Buchung nicht möglich";
      let description: string | undefined;

      if (raw.includes("row-level security") || raw.includes("policy") || raw.includes("permission denied")) {
        title = "Du wurdest noch nicht freigeschaltet.";
      } else if (raw.includes("freigeschaltet")) {
        title = "Du wurdest noch nicht freigeschaltet.";
      } else if (raw.includes("Ungültiger Zeitslot")) {
        title = "Ungültiger Zeitslot.";
      } else if (raw.includes("24 Stunden")) {
        title = "Buchung mindestens 24 Stunden im Voraus.";
      } else if (raw.includes("09:00") || raw.includes("20:00")) {
        title = "Termine nur zwischen 09:00 und 20:00 Uhr.";
      } else if (raw.includes("Pro Tag")) {
        title = "Pro Tag ist nur ein Termin möglich.";
      } else if (raw.includes("Maximal 3")) {
        title = "Maximal 3 offene Termine erlaubt.";
      } else if (raw) {
        description = raw;
      }
      toast({ title, description, variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const cancelBooking = async (id: string) => {
    try {
      const { error } = await supabase.from("bookings").update({ status: "storniert" as any }).eq("id", id);
      if (error) throw error;
      toast({ title: "Termin storniert" });
      await loadBookings();
    } catch (err: any) { toast({ title: "Fehler", description: err.message, variant: "destructive" }); }
  };

  if (authLoading || loading) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="space-y-4 animate-fade-in">
          <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          <div className="h-[320px] bg-muted/50 rounded-xl border border-border animate-pulse" />
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
          description="Sobald dein Profil angenommen wurde, kannst du Termine buchen."
          actionLabel="Zum Dashboard"
          onAction={() => navigate("/dashboard")}
        />
      </div>
    );
  }

  const nextBooking = activeBookings.find((b) => new Date(`${b.booking_date}T${b.booking_time}`) >= new Date());

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
      {/* Booking success */}
      {bookingSuccess && (
        <Card className="animate-fade-in border-none shadow-lg bg-gradient-to-r from-accent/10 to-accent/5 ring-1 ring-accent/20">
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-accent/15 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Termin erfolgreich gebucht</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(bookingSuccess.date + "T00:00:00").toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })} um {bookingSuccess.time.slice(0, 5)} Uhr
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setBookingSuccess(null)}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── 3-Spalten-Layout: Termin buchen | Verfügbare Zeiten | Bevorstehende Termine ─── */}
      <div className="grid gap-5 lg:grid-cols-12">

        {/* LINKS — Termin buchen (Kalender + Auswahl) */}
        <Card className="lg:col-span-5 animate-fade-in" data-tour="calendar" data-tour-alt="book-btn">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-foreground" />
              <p className="font-heading font-semibold text-foreground text-sm">Termin buchen</p>
            </div>

            {/* Info-Banner */}
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-primary" />
                <p className="text-xs font-semibold text-foreground">Bitte beachten Sie:</p>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Sofern mit Ihrem Teamleiter nicht anders abgesprochen, können Sie:
              </p>
              <ul className="text-[11px] text-muted-foreground space-y-0.5 pl-2">
                <li>• maximal einen Termin für denselben Tag buchen</li>
                <li>• maximal {MAX_FUTURE_BOOKINGS} Termine im Voraus buchen</li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              Bitte wählen Sie das gewünschte Datum und die Uhrzeit für Ihren nächsten Auftrag.
            </p>

            {/* Kalender */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-primary/10 border-b border-border">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-sm font-heading font-semibold text-foreground">
                  {format(currentMonth, "MMMM yyyy", { locale: de })}
                </h2>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 px-2 pt-2">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1.5">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 px-2 pb-3 gap-y-0.5">
                {paddingBefore.map((_, i) => <div key={`pad-${i}`} />)}
                {daysInMonth.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const dayBookings = bookingsByDate[dateStr] ?? [];
                  const isPast = isBefore(day, today);
                  const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                  const isTodayDate = isToday(day);
                  const hasBookings = dayBookings.length > 0;
                  const isDayBlocked = activeFutureBookings.some((b) => b.booking_date === dateStr);

                  return (
                    <button
                      key={dateStr}
                      onClick={() => {
                        if (isPast) return;
                        setSelectedDate(day);
                      }}
                      disabled={isPast}
                      className={cn(
                        "relative h-9 rounded-md text-xs font-medium transition-all",
                        isPast && "text-muted-foreground/30 cursor-not-allowed",
                        !isPast && "hover:bg-primary/5 cursor-pointer text-foreground",
                        isTodayDate && !isSelected && "ring-1 ring-primary/40",
                        isSelected && "bg-primary text-primary-foreground hover:bg-primary",
                        isDayBlocked && !isSelected && "bg-primary/5"
                      )}
                    >
                      {day.getDate()}
                      {hasBookings && (
                        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {dayBookings.slice(0, 3).map((b) => (
                            <div key={b.id} className={cn("h-1 w-1 rounded-full", isSelected ? "bg-primary-foreground/70" : (STATUS_LABELS[b.status]?.dot ?? "bg-primary"))} />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stunde + Minute Selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Stunde</label>
                <Select value={selectedTime ? selectedTime.split(":")[0] : ""} onValueChange={(h) => {
                  const m = selectedTime ? selectedTime.split(":")[1] : "00";
                  setSelectedTime(`${h}:${m}`);
                }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="–" /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (9 + i).toString().padStart(2, "0")).map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Minute</label>
                <Select value={selectedTime ? selectedTime.split(":")[1] : ""} onValueChange={(m) => {
                  const h = selectedTime ? selectedTime.split(":")[0] : "09";
                  setSelectedTime(`${h}:${m}`);
                }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="–" /></SelectTrigger>
                  <SelectContent>
                    {["00", "15", "30", "45"].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={createBooking}
              disabled={submitting || !selectedDate || !selectedTime}
              data-tour="book-button"
              className="w-full h-10 gap-2 rounded-lg"
            >
              <CalendarDays className="h-4 w-4" />
              {submitting ? "Buchen…" : "Jetzt Termin buchen"}
            </Button>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5 pt-1">
              {Array.from({ length: MAX_FUTURE_BOOKINGS }).map((_, i) => (
                <div key={i} className={cn("h-1.5 w-4 rounded-full transition-all", i < activeFutureBookings.length ? "bg-primary" : "bg-muted")} />
              ))}
              <span className="text-[10px] font-medium text-muted-foreground ml-1">{activeFutureBookings.length}/{MAX_FUTURE_BOOKINGS}</span>
            </div>
          </CardContent>
        </Card>

        {/* MITTE — Verfügbare Terminzeiten */}
        <Card className="lg:col-span-3 animate-fade-in">
          <CardContent className="p-5 space-y-4">
            <p className="text-sm text-foreground leading-relaxed">
              Für die Zuweisung des nächsten Auftrags ist eine Terminbuchung erforderlich.
            </p>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Verfügbare Terminzeiten sind:</p>

              <div className="space-y-2.5 text-xs">
                <div>
                  <p className="text-muted-foreground">Montags, Mittwochs und Freitags:</p>
                  <p className="text-foreground font-medium tabular-nums">11:30 bis 13:30</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Dienstags:</p>
                  <p className="text-foreground font-medium tabular-nums">11:30 bis 13:30</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Donnerstag:</p>
                  <p className="text-foreground font-medium tabular-nums">11:30 bis 13:30, 17:00</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Samstags und Sonntags:</p>
                  <p className="text-foreground font-medium tabular-nums">11:00; 14:00 bis 17:00</p>
                </div>
              </div>

              <div className="flex items-start gap-2 pt-2 border-t border-border">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Mindestens 24 Stunden Vorlauf · ein Termin pro Tag · max. {MAX_FUTURE_BOOKINGS} offene Termine.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RECHTS — Bevorstehende Termine */}
        <Card className="lg:col-span-4 animate-fade-in">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-foreground" />
              <p className="font-heading font-semibold text-foreground text-sm">Bevorstehende Termine</p>
            </div>

            {activeFutureBookings.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-10">
                Keine bevorstehenden Termine gefunden
              </div>
            ) : (
              <div className="space-y-2">
                {activeFutureBookings.map((b) => {
                  const dateLabel = new Date(b.booking_date + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
                  const canCancel = (b.status === "gebucht" || b.status === "bestätigt");
                  return (
                    <div key={b.id} className="flex items-center justify-between rounded-lg border border-emerald-600/30 bg-emerald-600/5 px-3 py-2">
                      <span className="text-sm font-medium text-foreground tabular-nums">
                        {dateLabel} {b.booking_time.slice(0, 5)}
                      </span>
                      {canCancel && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cancelBooking(b.id)}
                          className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border border-destructive/30 rounded-md"
                        >
                          Absagen
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Past bookings (kompakt) */}
            {activeBookings.filter((b) => new Date(`${b.booking_date}T${b.booking_time}`) < new Date()).length > 0 && (
              <div className="pt-3 border-t border-border space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Vergangen</p>
                {activeBookings.filter((b) => new Date(`${b.booking_date}T${b.booking_time}`) < new Date()).slice(0, 3).map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/30">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {new Date(b.booking_date + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })} {b.booking_time.slice(0, 5)}
                    </span>
                    <Badge variant="secondary" className={cn("text-[9px]", STATUS_LABELS[b.status]?.class)}>
                      {STATUS_LABELS[b.status]?.label}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Stornierte Termine */}
            {bookings.filter((b) => b.status === "storniert").length > 0 && (
              <div className="pt-3 border-t border-border space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Storniert</p>
                {bookings.filter((b) => b.status === "storniert").slice(0, 5).map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-md bg-destructive/5 border border-destructive/15">
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {new Date(b.booking_date + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })} {b.booking_time.slice(0, 5)}
                    </span>
                    <Badge variant="secondary" className="text-[9px] bg-destructive/10 text-destructive border-destructive/20">
                      {b.cancelled_by_role === "admin" ? "Vom Teamleiter abgesagt" : b.cancelled_by_role === "employee" ? "Von dir storniert" : "Storniert"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog bleibt verfügbar als Fallback (wird vom neuen Inline-Flow nicht mehr geöffnet) */}
      <Dialog open={showBookDialog} onOpenChange={setShowBookDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">
              Termin am {selectedDate ? format(selectedDate, "d. MMMM", { locale: de }) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Uhrzeit wählen</label>
              <div className="grid grid-cols-4 gap-2">
                {TIME_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setSelectedTime(t.value)}
                    className={cn(
                      "h-9 rounded-lg text-xs font-medium transition-all border",
                      selectedTime === t.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:border-primary/30 hover:bg-primary/5"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createBooking} disabled={submitting || !selectedTime} className="w-full h-10 gap-2">
              <Plus className="h-4 w-4" />
              {submitting ? "Buchen…" : "Termin buchen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

