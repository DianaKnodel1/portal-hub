import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, CheckCircle2, CreditCard } from "lucide-react";

interface Props {
  taxNumber: string;
  socialSecurityNumber: string;
  iban: string;
  setTaxNumber: (v: string) => void;
  setSocialSecurityNumber: (v: string) => void;
  setIban: (v: string) => void;
  onSave: () => void;
  onSkip: () => void;
  onBack: () => void;
  loading: boolean;
}

export default function StepOptional({
  taxNumber, socialSecurityNumber, iban,
  setTaxNumber, setSocialSecurityNumber, setIban,
  onSave, onSkip, onBack, loading
}: Props) {
  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="h-6 w-6 text-accent" />
        </div>
        <h2 className="text-2xl font-heading font-bold text-foreground">Fast geschafft! 🎉</h2>
        <p className="text-sm text-muted-foreground mt-1">Diese Daten kannst du jetzt oder später ergänzen</p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Steuernummer</label>
          <Input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} placeholder="Optional" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Sozialversicherungsnummer</label>
          <Input value={socialSecurityNumber} onChange={(e) => setSocialSecurityNumber(e.target.value)} placeholder="Optional" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">IBAN</label>
          <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="DE..." className="h-11" />
        </div>
      </div>
      <div className="space-y-3">
        <Button onClick={onSave} disabled={loading} className="w-full h-12 text-base font-semibold gap-2">
          {loading ? "Speichern…" : "Speichern & Starten"}
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" onClick={onSkip} className="w-full text-muted-foreground">
          Überspringen – später nachreichen
        </Button>
        <Button variant="ghost" size="sm" onClick={onBack} className="w-full text-muted-foreground gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Zurück
        </Button>
      </div>
    </div>
  );
}
