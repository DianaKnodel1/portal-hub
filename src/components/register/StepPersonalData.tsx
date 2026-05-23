import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, IdCard } from "lucide-react";

interface Props {
  birthDate: string;
  birthPlace: string;
  phone: string;
  nationality: string;
  setBirthDate: (v: string) => void;
  setBirthPlace: (v: string) => void;
  setPhone: (v: string) => void;
  setNationality: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
}

export default function StepPersonalData({
  birthDate, birthPlace, phone, nationality,
  setBirthDate, setBirthPlace, setPhone, setNationality,
  onNext, onBack, loading,
}: Props) {
  const phoneDigits = phone.replace(/[^\d]/g, "");
  const phoneValid = phoneDigits.length >= 6;
  const birthYear = birthDate ? parseInt(birthDate.slice(0, 4), 10) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const birthValid = !!birthDate && birthYear >= 1900 && birthDate <= today;
  const canSubmit = birthValid && birthPlace.trim() && phoneValid && nationality.trim();

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <IdCard className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-heading font-bold text-foreground">Persönliche Daten</h2>
        <p className="text-sm text-muted-foreground mt-1">Wir benötigen ein paar Angaben zu deiner Person</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Geburtsdatum *</label>
          <Input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            min="1900-01-01"
            max={today}
            className="h-11"
          />
          {birthDate && !birthValid && (
            <p className="text-xs text-destructive">Bitte ein gültiges Geburtsdatum ab 1900 angeben.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Geburtsort *</label>
          <Input
            value={birthPlace}
            onChange={(e) => setBirthPlace(e.target.value)}
            placeholder="z. B. Berlin"
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Telefonnummer *</label>
          <Input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s()-]/g, ""))}
            placeholder="+49 170 1234567"
            className="h-11"
          />
          {phone && !phoneValid && (
            <p className="text-xs text-destructive">Bitte eine gültige Telefonnummer mit mindestens 6 Ziffern angeben.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Staatsangehörigkeit *</label>
          <Input
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            placeholder="z. B. Deutsch"
            className="h-11"
          />
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
