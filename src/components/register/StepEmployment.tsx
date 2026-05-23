import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Briefcase, CheckCircle2, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { de } from "date-fns/locale";

interface Props {
  employmentType: string;
  setEmploymentType: (v: string) => void;
  startDate: Date | undefined;
  setStartDate: (v: Date | undefined) => void;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
}

const OPTIONS = [
  { value: "minijob", label: "Minijob", desc: "Bis 556 € / Monat, flexibel" },
  { value: "teilzeit", label: "Teilzeit", desc: "20 Stunden / Woche" },
  { value: "vollzeit", label: "Vollzeit", desc: "40 Stunden / Woche" },
];

export default function StepEmployment({ employmentType, setEmploymentType, startDate, setStartDate, onNext, onBack, loading }: Props) {
  const minDate = addDays(startOfDay(new Date()), 7);

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Briefcase className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-heading font-bold text-foreground">Beschäftigungsart</h2>
        <p className="text-sm text-muted-foreground mt-1">Wähle die passende Vertragsart und dein Startdatum</p>
      </div>
      <div className="space-y-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setEmploymentType(opt.value)}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
              employmentType === opt.value
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border hover:border-primary/30 hover:bg-muted/50"
            )}
          >
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
              employmentType === opt.value ? "bg-primary/10" : "bg-muted"
            )}>
              <Briefcase className={cn("h-5 w-5", employmentType === opt.value ? "text-primary" : "text-muted-foreground")} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{opt.label}</p>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </div>
            {employmentType === opt.value && <CheckCircle2 className="h-5 w-5 text-primary ml-auto shrink-0" />}
          </button>
        ))}
      </div>

      {/* Start Date */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" /> Gewünschtes Startdatum
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-11", !startDate && "text-muted-foreground")}>
              <CalendarDays className="h-4 w-4 mr-2" />
              {startDate ? format(startDate, "PPP", { locale: de }) : "Startdatum wählen"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={setStartDate}
              disabled={(date) => isBefore(date, minDate)}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        <p className="text-[10px] text-muted-foreground">Mindestens 7 Tage in der Zukunft</p>
      </div>

      <Button onClick={onNext} disabled={loading || !employmentType || !startDate} className="w-full h-12 text-base font-semibold gap-2">
        {loading ? "Account wird erstellt…" : "Registrierung abschließen"}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="sm" onClick={onBack} className="w-full text-muted-foreground gap-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Zurück
      </Button>
    </div>
  );
}
