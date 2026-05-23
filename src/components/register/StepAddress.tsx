import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, MapPin } from "lucide-react";

interface Props {
  street: string;
  zipCode: string;
  city: string;
  setStreet: (v: string) => void;
  setZipCode: (v: string) => void;
  setCity: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
}

export default function StepAddress({ street, zipCode, city, setStreet, setZipCode, setCity, onNext, onBack, loading }: Props) {
  const zipValid = /^\d{4,5}$/.test(zipCode);
  const canSubmit = street.trim() && zipValid && city.trim();
  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <MapPin className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-heading font-bold text-foreground">Deine Adresse</h2>
        <p className="text-sm text-muted-foreground mt-1">Für deinen Vertrag und die Abrechnung</p>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Straße & Hausnummer *</label>
        <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Musterstraße 1" className="h-11" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">PLZ *</label>
          <Input
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
            maxLength={5}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="10115"
            className="h-11"
          />
          {zipCode && !zipValid && (
            <p className="text-xs text-destructive">Nur Zahlen.</p>
          )}
        </div>
        <div className="col-span-2 space-y-1.5">
          <label className="text-sm font-medium text-foreground">Stadt *</label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Berlin" className="h-11" />
        </div>
      </div>
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
