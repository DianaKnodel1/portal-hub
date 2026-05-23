import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_employee/personal-data")({
  component: PersonalDataPage,
});

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, CheckCircle2, User, MapPin, Calendar, CreditCard, Briefcase, AlertCircle } from "lucide-react";

// Top-Länder mit Flaggen (Auswahl + Free-Text via "Anderes Land")
const COUNTRIES = [
  { code: "DE", name: "Deutschland", flag: "🇩🇪" },
  { code: "AT", name: "Österreich", flag: "🇦🇹" },
  { code: "CH", name: "Schweiz", flag: "🇨🇭" },
  { code: "TR", name: "Türkei", flag: "🇹🇷" },
  { code: "PL", name: "Polen", flag: "🇵🇱" },
  { code: "IT", name: "Italien", flag: "🇮🇹" },
  { code: "ES", name: "Spanien", flag: "🇪🇸" },
  { code: "FR", name: "Frankreich", flag: "🇫🇷" },
  { code: "RO", name: "Rumänien", flag: "🇷🇴" },
  { code: "RU", name: "Russland", flag: "🇷🇺" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦" },
  { code: "GR", name: "Griechenland", flag: "🇬🇷" },
  { code: "HR", name: "Kroatien", flag: "🇭🇷" },
  { code: "RS", name: "Serbien", flag: "🇷🇸" },
  { code: "BA", name: "Bosnien & Herzegowina", flag: "🇧🇦" },
  { code: "US", name: "USA", flag: "🇺🇸" },
  { code: "GB", name: "Vereinigtes Königreich", flag: "🇬🇧" },
];

const FAMILY_STATUS = [
  "Ledig",
  "Verheiratet",
  "Geschieden",
  "Verwitwet",
  "In eingetragener Lebenspartnerschaft",
];

const CURRENT_ACTIVITY = [
  "Angestellt",
  "Selbstständig",
  "Student/in",
  "Schüler/in",
  "Auszubildende/r",
  "Arbeitssuchend",
  "Rentner/in",
  "Hausfrau / Hausmann",
  "Sonstiges",
];

const HEALTH_INSURANCES = [
  "AOK",
  "Techniker Krankenkasse (TK)",
  "Barmer",
  "DAK-Gesundheit",
  "IKK",
  "BKK",
  "KKH",
  "HEK",
  "hkk",
  "Knappschaft",
  "Private Krankenversicherung",
  "Andere",
];

type ProfileRow = {
  full_name?: string | null;
  birth_name?: string | null;
  family_status?: string | null;
  birth_date?: string | null;
  birth_place?: string | null;
  birth_country?: string | null;
  nationality?: string | null;
  street?: string | null;
  zip_code?: string | null;
  city?: string | null;
  address?: string | null;
  living_since?: string | null;
  previous_address?: string | null;
  iban?: string | null;
  tax_number?: string | null;
  social_security_number?: string | null;
  health_insurance?: string | null;
  current_activity?: string | null;
  phone?: string | null;
};

function CountrySelect({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const isPreset = COUNTRIES.some(c => c.name === value);
  const [custom, setCustom] = useState(!isPreset && value !== "");
  return (
    <div className="space-y-2">
      <Select
        value={custom ? "__other__" : (value || undefined)}
        onValueChange={(v) => {
          if (v === "__other__") { setCustom(true); onChange(""); }
          else { setCustom(false); onChange(v); }
        }}
      >
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {COUNTRIES.map(c => (
            <SelectItem key={c.code} value={c.name}>
              <span className="mr-2">{c.flag}</span>{c.name}
            </SelectItem>
          ))}
          <SelectItem value="__other__">Anderes Land…</SelectItem>
        </SelectContent>
      </Select>
      {custom && (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Land eingeben" />
      )}
    </div>
  );
}

function formatIban(raw: string) {
  const clean = raw.replace(/\s+/g, "").toUpperCase().slice(0, 34);
  return clean.replace(/(.{4})/g, "$1 ").trim();
}

function PersonalDataPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Persönlich
  const [fullName, setFullName] = useState("");
  const [birthName, setBirthName] = useState("");
  const [familyStatus, setFamilyStatus] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [birthCountry, setBirthCountry] = useState("");
  const [nationality, setNationality] = useState("");
  const [phone, setPhone] = useState("");

  // Adresse
  const [street, setStreet] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [livingSince, setLivingSince] = useState("");
  const [previousAddress, setPreviousAddress] = useState("");

  // Banken / Steuer / KK
  const [iban, setIban] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [svNumber, setSvNumber] = useState("");
  const [healthInsurance, setHealthInsurance] = useState("");
  const [currentActivity, setCurrentActivity] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    loadProfile();
  }, [user, authLoading]);

  const livingLessThan3Years = useMemo(() => {
    if (!livingSince) return false;
    const since = new Date(livingSince + "T00:00:00");
    const threshold = new Date(); threshold.setFullYear(threshold.getFullYear() - 3);
    return since > threshold;
  }, [livingSince]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, birth_name, family_status, birth_date, birth_place, birth_country, nationality, phone, street, zip_code, city, address, living_since, previous_address, iban, tax_number, social_security_number, health_insurance, current_activity")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      const d = (data ?? {}) as ProfileRow;
      setFullName(d.full_name ?? "");
      setBirthName(d.birth_name ?? "");
      setFamilyStatus(d.family_status ?? "");
      setBirthDate(d.birth_date ?? "");
      setBirthPlace(d.birth_place ?? "");
      setBirthCountry(d.birth_country ?? "");
      setNationality(d.nationality ?? "");
      setPhone(d.phone ?? "");
      setStreet(d.street ?? "");
      setZip(d.zip_code ?? "");
      setCity(d.city ?? "");
      setLivingSince(d.living_since ?? "");
      setPreviousAddress(d.previous_address ?? "");
      setIban(d.iban ? formatIban(d.iban) : "");
      setTaxNumber(d.tax_number ?? "");
      setSvNumber(d.social_security_number ?? "");
      setHealthInsurance(d.health_insurance ?? "");
      setCurrentActivity(d.current_activity ?? "");

      const isComplete = !!(d.full_name && d.birth_date && d.birth_place && d.nationality && d.street && d.zip_code && d.city && d.iban && d.tax_number && d.social_security_number && d.health_insurance && d.current_activity);
      setCompleted(isComplete);
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const requiredFilled = !!(fullName.trim() && birthDate && birthPlace.trim() && nationality.trim() && street.trim() && zip.trim() && city.trim() && iban.trim() && taxNumber.trim() && svNumber.trim() && healthInsurance && currentActivity);

  const handleSave = async () => {
    if (!user) return;
    if (!requiredFilled) {
      toast({ title: "Felder ausfüllen", description: "Bitte fülle alle Pflichtfelder aus.", variant: "destructive" });
      return;
    }
    if (livingLessThan3Years && !previousAddress.trim()) {
      toast({ title: "Frühere Adresse erforderlich", description: "Bei weniger als 3 Jahren am aktuellen Wohnort musst du deine vorherige Adresse angeben.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const ibanClean = iban.replace(/\s+/g, "").toUpperCase();
      const composed = `${street.trim()}, ${zip.trim()} ${city.trim()}`;
      const { error } = await supabase.from("profiles").update({
        full_name: fullName.trim(),
        birth_name: birthName.trim() || null,
        family_status: familyStatus || null,
        birth_date: birthDate,
        birth_place: birthPlace.trim(),
        birth_country: birthCountry.trim() || null,
        nationality: nationality.trim(),
        phone: phone.trim() || null,
        street: street.trim(),
        zip_code: zip.trim(),
        city: city.trim(),
        address: composed,
        living_since: livingSince || null,
        previous_address: livingLessThan3Years ? previousAddress.trim() : null,
        iban: ibanClean,
        tax_number: taxNumber.trim(),
        social_security_number: svNumber.trim(),
        health_insurance: healthInsurance,
        current_activity: currentActivity,
      }).eq("user_id", user.id);
      if (error) throw error;
      setCompleted(true);
      toast({ title: "✅ Daten gespeichert!", description: "Alle Angaben wurden übernommen." });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-lg bg-primary/20 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-heading font-bold">Persönliche Daten</h1>
        </div>
        <Badge className={completed ? "bg-accent/15 text-accent" : "bg-status-pending/15 text-status-pending"}>
          {completed ? "Vollständig" : "Ausstehend"}
        </Badge>
      </div>

      {completed && (
        <Card className="border-accent/20 animate-fade-in">
          <CardContent className="pt-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-accent" />
              <div>
                <p className="font-semibold text-foreground">Daten vollständig</p>
                <p className="text-xs text-muted-foreground mt-0.5">Du kannst sie unten jederzeit aktualisieren.</p>
              </div>
            </div>
            <Button size="sm" onClick={() => navigate("/dashboard")}>
              Zum Dashboard <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Block 1: Persönlich */}
      <Card className="animate-fade-in">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Persönliche Angaben</CardTitle>
          </div>
          <CardDescription>Diese Angaben werden für deinen Arbeitsvertrag benötigt.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vollständiger Name *">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Max Mustermann" />
            </Field>
            <Field label="Geburtsname" hint="(falls abweichend)">
              <Input value={birthName} onChange={(e) => setBirthName(e.target.value)} placeholder="Geburtsname" />
            </Field>
            <Field label="Geburtsdatum *">
              <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </Field>
            <Field label="Familienstand">
              <Select value={familyStatus || undefined} onValueChange={setFamilyStatus}>
                <SelectTrigger><SelectValue placeholder="Bitte wählen" /></SelectTrigger>
                <SelectContent>
                  {FAMILY_STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Geburtsort *">
              <Input value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} placeholder="Stadt" />
            </Field>
            <Field label="Geburtsland">
              <CountrySelect value={birthCountry} onChange={setBirthCountry} placeholder="Land wählen" />
            </Field>
            <Field label="Staatsangehörigkeit *">
              <CountrySelect value={nationality} onChange={setNationality} placeholder="Staatsangehörigkeit wählen" />
            </Field>
            <Field label="Telefon">
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+49 …" />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Block 2: Adresse */}
      <Card className="animate-fade-in">
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Aktuelle Anschrift</CardTitle>
          </div>
          <CardDescription>Wohnadresse in Deutschland.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Straße und Hausnummer *">
            <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Musterstraße 12" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <Field label="PLZ *">
              <Input value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" pattern="[0-9]*" placeholder="10115" maxLength={5} />
            </Field>
            <Field label="Stadt *">
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Berlin" />
            </Field>
          </div>
          <Field label="Wohnhaft seit" icon={<Calendar className="h-3.5 w-3.5 text-muted-foreground" />}>
            <Input type="date" value={livingSince} onChange={(e) => setLivingSince(e.target.value)} />
          </Field>
          {livingLessThan3Years && (
            <div className="rounded-xl border border-status-pending/30 bg-status-pending/5 p-4 space-y-3 animate-fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-status-pending mt-0.5 flex-shrink-0" />
                <div className="text-xs text-foreground">
                  <p className="font-medium mb-0.5">Weniger als 3 Jahre an dieser Adresse</p>
                  <p className="text-muted-foreground">Banken benötigen deine vorherige Adresse für die Verifizierung.</p>
                </div>
              </div>
              <Field label="Vorherige Adresse *">
                <Input value={previousAddress} onChange={(e) => setPreviousAddress(e.target.value)} placeholder="Straße, PLZ, Ort" />
              </Field>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Block 3: Bank / Steuer / KK */}
      <Card className="animate-fade-in">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Bank & Sozialversicherung</CardTitle>
          </div>
          <CardDescription>Für deine Gehaltsabrechnung und Lohnsteuer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="IBAN *">
            <Input value={iban} onChange={(e) => setIban(formatIban(e.target.value))} placeholder="DE00 0000 0000 0000 0000 00" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Steuer-ID *" hint="11-stellig">
              <Input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 11))} placeholder="12345678901" />
            </Field>
            <Field label="Sozialversicherungsnummer *">
              <Input value={svNumber} onChange={(e) => setSvNumber(e.target.value.slice(0, 20))} placeholder="12 345678 A 901" />
            </Field>
          </div>
          <Field label="Krankenkasse *">
            <Select value={healthInsurance || undefined} onValueChange={setHealthInsurance}>
              <SelectTrigger><SelectValue placeholder="Krankenkasse wählen" /></SelectTrigger>
              <SelectContent>
                {HEALTH_INSURANCES.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      {/* Block 4: Tätigkeit */}
      <Card className="animate-fade-in">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Aktuelle Tätigkeit</CardTitle>
          </div>
          <CardDescription>Was machst du aktuell hauptberuflich?</CardDescription>
        </CardHeader>
        <CardContent>
          <Field label="Tätigkeit *">
            <Select value={currentActivity || undefined} onValueChange={setCurrentActivity}>
              <SelectTrigger><SelectValue placeholder="Bitte wählen" /></SelectTrigger>
              <SelectContent>
                {CURRENT_ACTIVITY.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10">
        <Card className="border-primary/30 shadow-elegant">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="text-xs text-muted-foreground">
              {requiredFilled ? "Alle Pflichtfelder ausgefüllt" : "Bitte alle mit * markierten Felder ausfüllen"}
            </div>
            <Button onClick={handleSave} disabled={saving || !requiredFilled} className="h-11 px-6">
              {saving ? "Speichern…" : completed ? "Aktualisieren" : "Daten speichern"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, hint, icon, children }: { label: string; hint?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
        {icon}
        {label}
        {hint && <span className="text-muted-foreground font-normal text-xs">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
