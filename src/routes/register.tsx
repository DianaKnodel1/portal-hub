import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { translateAuthError } from "@/lib/auth-errors";
import WizardProgress from "@/components/register/WizardProgress";
import StepAccount from "@/components/register/StepAccount";
import StepPersonalData from "@/components/register/StepPersonalData";
import StepAddress from "@/components/register/StepAddress";
import StepLivingSince from "@/components/register/StepLivingSince";
import StepEmployment from "@/components/register/StepEmployment";
import StepContract from "@/components/register/StepContract";
import StepIdentity from "@/components/register/StepIdentity";
import StepOptional from "@/components/register/StepOptional";

const STORAGE_KEY = "onboarding_wizard_step";
const STORAGE_USER = "onboarding_user_id";
const STORAGE_TENANT = "onboarding_tenant_id";
const STORAGE_EMAIL = "onboarding_email";

const STORAGE_DRAFT = "onboarding_wizard_draft";

const ss = {
  getItem: (k: string) => (typeof window !== "undefined" ? window.sessionStorage.getItem(k) : null),
  setItem: (k: string, v: string) => { if (typeof window !== "undefined") window.sessionStorage.setItem(k, v); },
  removeItem: (k: string) => { if (typeof window !== "undefined") window.sessionStorage.removeItem(k); },
};

const ls = {
  getItem: (k: string) => (typeof window !== "undefined" ? window.localStorage.getItem(k) : null),
  setItem: (k: string, v: string) => { if (typeof window !== "undefined") window.localStorage.setItem(k, v); },
  removeItem: (k: string) => { if (typeof window !== "undefined") window.localStorage.removeItem(k); },
};

function RegisterPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // SSR-safe: start with neutral defaults, hydrate from sessionStorage on the client.
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  // Step 1 — Account
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  // Hydrate persisted wizard state once on client (avoids SSR hydration mismatch).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedUser = ss.getItem(STORAGE_USER);
    const savedEmail = ss.getItem(STORAGE_EMAIL);
    const savedStep = ss.getItem(STORAGE_KEY);
    if (savedUser) setUserId(savedUser);
    if (savedEmail) setEmail(savedEmail);
    if (savedUser && savedStep) setStep(parseInt(savedStep, 10) || 0);
  }, []);
  const [password, setPassword] = useState("");

  // Step 2 — Personal data
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");

  // Step 3 — Address
  const [street, setStreet] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");

  // Step 4 — Living since
  const [livingOver3Years, setLivingOver3Years] = useState<boolean | null>(null);
  const [livingSince, setLivingSince] = useState("");
  const [previousStreet, setPreviousStreet] = useState("");
  const [previousZip, setPreviousZip] = useState("");
  const [previousCity, setPreviousCity] = useState("");

  // Step 5 — Employment
  const [employmentType, setEmploymentType] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);

  // Step 6 — Contract
  const [agreed, setAgreed] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [contractContent, setContractContent] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = ss.getItem(STORAGE_TENANT);
    if (saved) setTenantId(saved);
  }, []);

  // Auto-set tenant from domain context or fallback for preview/localhost
  useEffect(() => {
    if (tenant && !tenantId) {
      setTenantId(tenant.id);
    } else if (!tenant && !tenantId) {
      (supabase.rpc as any)("get_first_active_public_tenant").then(({ data }: any) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.id) setTenantId(row.id);
      });
    }
  }, [tenant, tenantId]);

  // Prefill E-Mail + Tenant aus Invitation-Token (Landing-Page → /register?token=…)
  useEffect(() => {
    if (!token || userId) return;
    (async () => {
      const { data } = await (supabase.rpc as any)("validate_invitation_token", { _token: token });
      const inv = Array.isArray(data) ? data[0] : data;
      if (inv && !inv.used) {
        if (inv.email && !email) setEmail(inv.email);
        if (inv.tenant_id) setTenantId(inv.tenant_id);
      }
    })();
  }, [token]);

  // Step 8 — Optional
  const [taxNumber, setTaxNumber] = useState("");
  const [socialSecurityNumber, setSocialSecurityNumber] = useState("");
  const [iban, setIban] = useState("");

  // Persist
  useEffect(() => { ss.setItem(STORAGE_KEY, String(step)); }, [step]);
  useEffect(() => { if (userId) ss.setItem(STORAGE_USER, userId); }, [userId]);
  useEffect(() => { if (tenantId) ss.setItem(STORAGE_TENANT, tenantId); }, [tenantId]);

  // ─── Autosave: alle Formularfelder live in localStorage (überlebt Tab-/Browser-Close) ───
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = ls.getItem(STORAGE_DRAFT);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.firstName) setFirstName(d.firstName);
      if (d.lastName) setLastName(d.lastName);
      if (d.email && !email) setEmail(d.email);
      if (d.birthDate) setBirthDate(d.birthDate);
      if (d.birthPlace) setBirthPlace(d.birthPlace);
      if (d.phone) setPhone(d.phone);
      if (d.nationality) setNationality(d.nationality);
      if (d.street) setStreet(d.street);
      if (d.zipCode) setZipCode(d.zipCode);
      if (d.city) setCity(d.city);
      if (typeof d.livingOver3Years === "boolean") setLivingOver3Years(d.livingOver3Years);
      if (d.livingSince) setLivingSince(d.livingSince);
      if (d.previousStreet) setPreviousStreet(d.previousStreet);
      if (d.previousZip) setPreviousZip(d.previousZip);
      if (d.previousCity) setPreviousCity(d.previousCity);
      if (d.employmentType) setEmploymentType(d.employmentType);
      if (d.startDate) setStartDate(new Date(d.startDate));
      if (d.signatureName) setSignatureName(d.signatureName);
      if (d.taxNumber) setTaxNumber(d.taxNumber);
      if (d.socialSecurityNumber) setSocialSecurityNumber(d.socialSecurityNumber);
      if (d.iban) setIban(d.iban);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const draft = {
      firstName, lastName, email, birthDate, birthPlace, phone, nationality,
      street, zipCode, city, livingOver3Years, livingSince,
      previousStreet, previousZip, previousCity,
      employmentType, startDate: startDate ? startDate.toISOString() : null,
      signatureName, taxNumber, socialSecurityNumber, iban,
    };
    ls.setItem(STORAGE_DRAFT, JSON.stringify(draft));
  }, [
    firstName, lastName, email, birthDate, birthPlace, phone, nationality,
    street, zipCode, city, livingOver3Years, livingSince,
    previousStreet, previousZip, previousCity,
    employmentType, startDate, signatureName, taxNumber, socialSecurityNumber, iban,
  ]);

  /** Resets all wizard state — called when user finishes or aborts a previous attempt. */
  const resetWizard = () => {
    ss.removeItem(STORAGE_KEY);
    ss.removeItem(STORAGE_USER);
    ss.removeItem(STORAGE_EMAIL);
    ls.removeItem(STORAGE_DRAFT);
    setUserId(null);
    setStep(0);
  };

  const handleNextFromAccount = async () => {
    const trimmedEmail = email.trim();
    if (!firstName.trim() || !lastName.trim() || !trimmedEmail || password.length < 6) {
      toast({ title: "Fehler", description: "Bitte alle Felder korrekt ausfüllen (Passwort min. 6 Zeichen).", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast({ title: "Ungültige E-Mail", description: "Bitte gib eine gültige E-Mail-Adresse ein.", variant: "destructive" });
      return;
    }
    setStep(1);
  };

  const handleSavePersonal = async () => {
    if (!birthDate || !birthPlace.trim() || !phone.trim() || !nationality.trim()) {
      toast({ title: "Fehler", description: "Bitte alle Pflichtfelder ausfüllen.", variant: "destructive" });
      return;
    }
    setStep(2);
  };

  const handleSaveAddress = async () => {
    if (!street.trim() || !zipCode.trim() || !city.trim()) {
      toast({ title: "Fehler", description: "Bitte alle Pflichtfelder ausfüllen.", variant: "destructive" });
      return;
    }
    setStep(3);
  };

  const handleSaveLivingSince = async () => {
    if (livingOver3Years === null || !livingSince) {
      toast({ title: "Fehler", description: "Bitte Auswahl treffen und Datum angeben.", variant: "destructive" });
      return;
    }
    if (!livingOver3Years && (!previousStreet.trim() || !previousZip.trim() || !previousCity.trim())) {
      toast({ title: "Fehler", description: "Bitte vorherige Adresse vollständig angeben.", variant: "destructive" });
      return;
    }
    setStep(4);
  };

  /**
   * Finaler Submit: Account & Profil werden ERST jetzt angelegt – nach allen 5 Schritten.
   * Vorher wird nichts in der DB erzeugt → keine halbfertigen Karteileichen.
   */
  const handleFinalSubmit = async () => {
    if (!employmentType) {
      toast({ title: "Fehler", description: "Bitte wähle einen Anstellungs-Typ.", variant: "destructive" });
      return;
    }
    if (!startDate) {
      toast({ title: "Fehler", description: "Bitte wähle ein Startdatum.", variant: "destructive" });
      return;
    }
    if (!tenantId) {
      toast({ title: "Fehler", description: "Tenant konnte nicht ermittelt werden. Bitte lade die Seite neu.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const trimmedEmail = email.trim();

      // 1. Account anlegen
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
      });

      if (signUpErr) {
        toast({ title: "Registrierung fehlgeschlagen", description: translateAuthError(signUpErr.message), variant: "destructive" });
        return;
      }

      const newUserId = signUpData.user?.id;
      if (!newUserId) {
        toast({ title: "Fehler", description: "Account konnte nicht erstellt werden.", variant: "destructive" });
        return;
      }
      setUserId(newUserId);
      ss.setItem(STORAGE_EMAIL, trimmedEmail);

      // 2. Invitation-Token konsumieren (falls vorhanden)
      let invTenantId = tenantId;
      let invApplicationId: string | null = null;
      if (token) {
        const { data: invRows } = await (supabase.rpc as any)("validate_invitation_token", { _token: token });
        const inv = Array.isArray(invRows) ? invRows[0] : invRows;
        if (inv) {
          await (supabase.rpc as any)("consume_invitation_token", { _token: token });
          if (inv.tenant_id) invTenantId = inv.tenant_id;
          if (inv.application_id) invApplicationId = inv.application_id;
        }
      }

      // 3. Profile mit ALLEN gesammelten Daten in einem Rutsch befüllen
      // (Profile-Zeile wurde durch handle_new_user-Trigger bereits angelegt.)
      const address = `${street.trim()}, ${zipCode.trim()} ${city.trim()}`;
      const prevAddr = !livingOver3Years
        ? `${previousStreet.trim()}, ${previousZip.trim()} ${previousCity.trim()}`
        : null;

      const profileUpdates: any = {
        full_name: fullName,
        tenant_id: invTenantId,
        onboarding_status: "in_bearbeitung",
        // Persönlich
        birth_date: birthDate,
        birth_place: birthPlace.trim(),
        nationality: nationality.trim(),
        phone: phone.trim(),
        // Adresse
        street: street.trim(),
        zip_code: zipCode.trim(),
        city: city.trim(),
        address,
        // Wohnsitz
        living_since: livingSince,
        previous_address: prevAddr,
        // Beschäftigung
        employment_type: employmentType,
        employment_start_date: startDate.toISOString().slice(0, 10),
      };
      if (invApplicationId) profileUpdates.application_id = invApplicationId;

      await supabase.from("profiles").update(profileUpdates).eq("user_id", newUserId);

      // Telefon zusätzlich auf auth.users (für spätere SMS-Verifizierung)
      await supabase.auth.updateUser({ phone: phone.trim() }).catch(() => {});

      // 4. Erfolg → E-Mail-Bestätigung erforderlich, Wizard-State leeren
      setStep(99);
      ls.removeItem(STORAGE_DRAFT);
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message ?? "Unbekannter Fehler", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Legacy-Handler (aktuell ungenutzt, da Vertrag/Ausweis/Optional ins Portal verschoben).
  const handleSignContract = async (_c?: string, _s?: string | null) => {};
  const handleSaveOptional = async () => {};
  const handleSkipOptional = async () => { resetWizard(); navigate("/login"); };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/50 p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.03),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--primary)/0.02),transparent_50%)]" />

      <Card className="w-full max-w-lg animate-fade-in shadow-2xl border-0 bg-card/95 backdrop-blur-sm relative">
        <CardContent className="pt-8 pb-8 px-8">
          <WizardProgress step={step} />

          {step === 0 && (
            <StepAccount
              firstName={firstName} lastName={lastName} email={email} password={password}
              setFirstName={setFirstName} setLastName={setLastName} setEmail={setEmail} setPassword={setPassword}
              onNext={handleNextFromAccount} loading={loading}
            />
          )}
          {step === 1 && (
            <StepPersonalData
              birthDate={birthDate} birthPlace={birthPlace} phone={phone} nationality={nationality}
              setBirthDate={setBirthDate} setBirthPlace={setBirthPlace} setPhone={setPhone} setNationality={setNationality}
              onNext={handleSavePersonal} onBack={() => setStep(0)} loading={loading}
            />
          )}
          {step === 2 && (
            <StepAddress
              street={street} zipCode={zipCode} city={city}
              setStreet={setStreet} setZipCode={setZipCode} setCity={setCity}
              onNext={handleSaveAddress} onBack={() => setStep(1)} loading={loading}
            />
          )}
          {step === 3 && (
            <StepLivingSince
              livingOver3Years={livingOver3Years} setLivingOver3Years={setLivingOver3Years}
              livingSince={livingSince} setLivingSince={setLivingSince}
              previousStreet={previousStreet} previousZip={previousZip} previousCity={previousCity}
              setPreviousStreet={setPreviousStreet} setPreviousZip={setPreviousZip} setPreviousCity={setPreviousCity}
              onNext={handleSaveLivingSince} onBack={() => setStep(2)} loading={loading}
            />
          )}
          {step === 4 && (
            <StepEmployment
              employmentType={employmentType} setEmploymentType={setEmploymentType}
              startDate={startDate} setStartDate={setStartDate}
              onNext={handleFinalSubmit} onBack={() => setStep(3)} loading={loading}
            />
          )}
          {step === 99 && (
            <div className="space-y-5 text-center py-4">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
                <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-heading font-bold text-foreground">Fast geschafft!</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Wir haben dir eine E-Mail an <strong className="text-foreground">{email}</strong> gesendet.
                  Bitte bestätige sie und logge dich anschließend ein.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-left text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground">Nächste Schritte im Mitarbeiter-Portal:</p>
                <ul className="space-y-1.5 list-disc list-inside">
                  <li>Arbeitsvertrag digital unterschreiben</li>
                  <li>Personalausweis hochladen (Verifizierung)</li>
                  <li>Steuer-ID, Sozialversicherungs­nummer & IBAN ergänzen</li>
                </ul>
                <p className="pt-2">Dein Teamleiter begleitet dich dabei per Chat.</p>
              </div>
              <button
                onClick={() => { resetWizard(); navigate("/login"); }}
                className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
              >
                Zum Login
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
