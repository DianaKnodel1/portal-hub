import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createEmployeeAccount } from "@/lib/admin-employees.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Check, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

type Tenant = { id: string; name: string };

type FormState = {
  email: string; password: string;
  full_name: string; phone: string; birth_date: string; birth_place: string; birth_country: string; birth_name: string; nationality: string; family_status: string;
  street: string; zip_code: string; city: string; living_since: string; previous_address: string;
  employment_type: "" | "minijob" | "teilzeit" | "vollzeit"; employment_start_date: string; current_activity: string;
  health_insurance: string; social_security_number: string; tax_number: string; iban: string;
  tenant_id: string; status: "registriert" | "angenommen"; admin_notes: string;
};

const empty: FormState = {
  email: "", password: "", full_name: "", phone: "", birth_date: "", birth_place: "", birth_country: "Deutschland", birth_name: "", nationality: "Deutsch", family_status: "",
  street: "", zip_code: "", city: "", living_since: "", previous_address: "",
  employment_type: "", employment_start_date: "", current_activity: "",
  health_insurance: "", social_security_number: "", tax_number: "", iban: "",
  tenant_id: "", status: "angenommen", admin_notes: "",
};

const steps = [
  { key: "account", label: "Account" },
  { key: "personal", label: "Persönlich" },
  { key: "address", label: "Adresse" },
  { key: "employment", label: "Beschäftigung" },
  { key: "extra", label: "Sonstiges" },
] as const;

export function CreateEmployeeWizard({
  open, onOpenChange, tenants, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; tenants: Tenant[]; onCreated: () => void }) {
  const { toast } = useToast();
  const create = useServerFn(createEmployeeAccount);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<FormState>(empty);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const reset = () => { setStep(0); setF(empty); };

  const canNext = () => {
    if (step === 0) return f.email.includes("@") && f.password.length >= 8 && f.full_name.trim().length > 1;
    return true;
  };

  const submit = async () => {
    setBusy(true);
    try {
      await create({
        data: {
          email: f.email.trim(),
          password: f.password,
          full_name: f.full_name.trim(),
          phone: f.phone || null,
          birth_date: f.birth_date || null,
          birth_place: f.birth_place || null,
          birth_country: f.birth_country || null,
          birth_name: f.birth_name || null,
          nationality: f.nationality || null,
          family_status: f.family_status || null,
          street: f.street || null,
          zip_code: f.zip_code || null,
          city: f.city || null,
          living_since: f.living_since || null,
          previous_address: f.previous_address || null,
          employment_type: f.employment_type || null,
          employment_start_date: f.employment_start_date || null,
          current_activity: f.current_activity || null,
          health_insurance: f.health_insurance || null,
          social_security_number: f.social_security_number || null,
          tax_number: f.tax_number || null,
          iban: f.iban || null,
          tenant_id: f.tenant_id || null,
          status: f.status,
          admin_notes: f.admin_notes || null,
        },
      });
      toast({ title: "Mitarbeiter angelegt", description: `${f.full_name} kann sich jetzt einloggen.` });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast({ title: "Fehler", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Mitarbeiter anlegen
          </DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 py-2">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2 flex-1">
              <button
                type="button"
                onClick={() => setStep(i)}
                className={cn(
                  "flex items-center gap-2 text-xs font-medium px-2 py-1 rounded-md transition-colors",
                  i === step ? "bg-primary text-primary-foreground" : i < step ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <span className={cn("h-5 w-5 rounded-full grid place-items-center text-[10px] border",
                  i === step ? "bg-primary-foreground text-primary border-transparent" : i < step ? "bg-emerald-500 text-white border-transparent" : "border-border")}>
                  {i < step ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < steps.length - 1 && <div className="flex-1 h-px bg-border" />}
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-2">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vollständiger Name *" className="col-span-2">
                <Input value={f.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Max Mustermann" />
              </Field>
              <Field label="E-Mail *">
                <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="max@example.com" />
              </Field>
              <Field label="Passwort * (min. 8)">
                <Input type="text" value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="Initiales Passwort" />
              </Field>
              <Field label="Telefon">
                <Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+49 …" />
              </Field>
              <Field label="Tenant / Domain">
                <Select value={f.tenant_id} onValueChange={(v) => set("tenant_id", v)}>
                  <SelectTrigger><SelectValue placeholder="– keiner –" /></SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status nach Anlage">
                <Select value={f.status} onValueChange={(v) => set("status", v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="angenommen">Angenommen (voller Zugriff)</SelectItem>
                    <SelectItem value="registriert">Registriert (wartet auf Freigabe)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <p className="col-span-2 text-[11px] text-muted-foreground">E-Mail wird vorbestätigt. Mitarbeiter kann sich sofort mit dieser E-Mail + Passwort einloggen.</p>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Geburtsdatum"><Input type="date" value={f.birth_date} onChange={(e) => set("birth_date", e.target.value)} /></Field>
              <Field label="Geburtsname"><Input value={f.birth_name} onChange={(e) => set("birth_name", e.target.value)} /></Field>
              <Field label="Geburtsort"><Input value={f.birth_place} onChange={(e) => set("birth_place", e.target.value)} /></Field>
              <Field label="Geburtsland"><Input value={f.birth_country} onChange={(e) => set("birth_country", e.target.value)} /></Field>
              <Field label="Staatsangehörigkeit"><Input value={f.nationality} onChange={(e) => set("nationality", e.target.value)} /></Field>
              <Field label="Familienstand">
                <Select value={f.family_status} onValueChange={(v) => set("family_status", v)}>
                  <SelectTrigger><SelectValue placeholder="– wählen –" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ledig">Ledig</SelectItem>
                    <SelectItem value="verheiratet">Verheiratet</SelectItem>
                    <SelectItem value="geschieden">Geschieden</SelectItem>
                    <SelectItem value="verwitwet">Verwitwet</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Straße & Hausnummer" className="col-span-2"><Input value={f.street} onChange={(e) => set("street", e.target.value)} /></Field>
              <Field label="PLZ"><Input value={f.zip_code} onChange={(e) => set("zip_code", e.target.value)} /></Field>
              <Field label="Stadt"><Input value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>
              <Field label="Wohnhaft seit (Datum)"><Input type="date" value={f.living_since} onChange={(e) => set("living_since", e.target.value)} /></Field>
              <Field label="Vorherige Adresse (falls < 2 Jahre)" className="col-span-2">
                <Textarea rows={2} value={f.previous_address} onChange={(e) => set("previous_address", e.target.value)} />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Beschäftigungsart">
                <Select value={f.employment_type} onValueChange={(v) => set("employment_type", v as any)}>
                  <SelectTrigger><SelectValue placeholder="– wählen –" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minijob">Minijob</SelectItem>
                    <SelectItem value="teilzeit">Teilzeit</SelectItem>
                    <SelectItem value="vollzeit">Vollzeit</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Eintrittsdatum"><Input type="date" value={f.employment_start_date} onChange={(e) => set("employment_start_date", e.target.value)} /></Field>
              <Field label="Aktuelle Tätigkeit" className="col-span-2"><Input value={f.current_activity} onChange={(e) => set("current_activity", e.target.value)} placeholder="z.B. Student, Angestellt …" /></Field>
              <Field label="Krankenkasse"><Input value={f.health_insurance} onChange={(e) => set("health_insurance", e.target.value)} /></Field>
              <Field label="Sozialversicherungsnr."><Input value={f.social_security_number} onChange={(e) => set("social_security_number", e.target.value)} /></Field>
              <Field label="Steuer-ID"><Input value={f.tax_number} onChange={(e) => set("tax_number", e.target.value)} /></Field>
              <Field label="IBAN"><Input value={f.iban} onChange={(e) => set("iban", e.target.value)} /></Field>
            </div>
          )}

          {step === 4 && (
            <div className="grid grid-cols-1 gap-3">
              <Field label="Interne Admin-Notizen">
                <Textarea rows={5} value={f.admin_notes} onChange={(e) => set("admin_notes", e.target.value)} placeholder="Nur für Admins sichtbar" />
              </Field>
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Zusammenfassung</p>
                <p>{f.full_name || "–"} · {f.email || "–"} · {f.employment_type || "Beschäftigung offen"}</p>
                <p>{[f.street, f.zip_code, f.city].filter(Boolean).join(", ") || "Adresse offen"}</p>
                <p>Status: <strong>{f.status}</strong></p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2 pt-3">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Zurück
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext() || busy}>
              Weiter <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={busy}>
              {busy ? "Erstelle…" : "Mitarbeiter anlegen"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}