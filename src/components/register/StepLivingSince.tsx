import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Home, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  livingOver3Years: boolean | null;
  setLivingOver3Years: (v: boolean) => void;
  livingSince: string;
  setLivingSince: (v: string) => void;
  previousStreet: string;
  previousZip: string;
  previousCity: string;
  setPreviousStreet: (v: string) => void;
  setPreviousZip: (v: string) => void;
  setPreviousCity: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
}

export default function StepLivingSince({
  livingOver3Years, setLivingOver3Years,
  livingSince, setLivingSince,
  previousStreet, previousZip, previousCity,
  setPreviousStreet, setPreviousZip, setPreviousCity,
  onNext, onBack, loading,
}: Props) {
  const needsPrevious = livingOver3Years === false;
  const canSubmit =
    livingOver3Years !== null &&
    livingSince.length === 10 &&
    (!needsPrevious || (previousStreet.trim() && previousZip.trim() && previousCity.trim()));

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Home className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-heading font-bold text-foreground">Wohndauer</h2>
        <p className="text-sm text-muted-foreground mt-1">Wie lange wohnst du an deiner aktuellen Adresse?</p>
      </div>

      <div className="space-y-3">
        {[
          { value: true, label: "Über 3 Jahre", desc: "Ich wohne seit mehr als 3 Jahren hier" },
          { value: false, label: "Unter 3 Jahre", desc: "Ich bin vor weniger als 3 Jahren eingezogen" },
        ].map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => setLivingOver3Years(opt.value)}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
              livingOver3Years === opt.value
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border hover:border-primary/30 hover:bg-muted/50",
            )}
          >
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
              livingOver3Years === opt.value ? "bg-primary/10" : "bg-muted",
            )}>
              <Home className={cn("h-5 w-5", livingOver3Years === opt.value ? "text-primary" : "text-muted-foreground")} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{opt.label}</p>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </div>
            {livingOver3Years === opt.value && <CheckCircle2 className="h-5 w-5 text-primary ml-auto shrink-0" />}
          </button>
        ))}
      </div>

      {livingOver3Years !== null && (
        <div className="space-y-1.5 animate-fade-in pt-2">
          <label className="text-sm font-medium text-foreground">Wohnhaft an aktueller Adresse seit *</label>
          <Input
            type="date"
            value={livingSince}
            onChange={(e) => setLivingSince(e.target.value)}
            min="1900-01-01"
            max={new Date().toISOString().slice(0, 10)}
            className="h-11"
          />
        </div>
      )}

      {needsPrevious && (
        <div className="space-y-4 animate-fade-in pt-2">
          <p className="text-sm font-medium text-foreground">Vorherige Adresse</p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Straße & Hausnummer *</label>
            <Input value={previousStreet} onChange={(e) => setPreviousStreet(e.target.value)} placeholder="Alte Straße 5" className="h-11" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">PLZ *</label>
              <Input value={previousZip} onChange={(e) => setPreviousZip(e.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" pattern="[0-9]*" maxLength={5} placeholder="10115" className="h-11" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Stadt *</label>
              <Input value={previousCity} onChange={(e) => setPreviousCity(e.target.value)} placeholder="Berlin" className="h-11" />
            </div>
          </div>
        </div>
      )}

      <Button onClick={onNext} disabled={loading || !canSubmit} className="w-full h-12 text-base font-semibold gap-2">
        {loading ? "Speichern…" : "Weiter"}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="sm" onClick={onBack} className="w-full text-muted-foreground gap-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Zurück
      </Button>
    </div>
  );
}
