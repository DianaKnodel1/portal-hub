import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_employee/verification")({
  component: VerificationPage,
});

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { KYC_STATUS_CONFIG, type KycStatus } from "@/lib/status";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, CheckCircle2, XCircle, ArrowLeft, ArrowRight, Loader2,
  IdCard, ScanFace, Camera, ShieldCheck,
} from "lucide-react";

interface KycData {
  id: string;
  status: KycStatus;
  id_front_url: string | null;
  id_back_url: string | null;
  selfie_url: string | null;
  rejection_reason: string | null;
}

type FieldKey = "id_front_url" | "id_back_url" | "selfie_url";

const STEPS: { key: FieldKey; label: string; title: string; description: string; icon: typeof IdCard }[] = [
  {
    key: "id_front_url",
    label: "Vorderseite",
    title: "Ausweis – Vorderseite",
    description: "Lade ein gut lesbares Foto der Vorderseite deines Personalausweises hoch. Alle vier Ecken müssen sichtbar sein.",
    icon: IdCard,
  },
  {
    key: "id_back_url",
    label: "Rückseite",
    title: "Ausweis – Rückseite",
    description: "Jetzt die Rückseite. Achte darauf, dass keine Felder verdeckt sind und das Foto nicht spiegelt.",
    icon: ScanFace,
  },
  {
    key: "selfie_url",
    label: "Selfie",
    title: "Selfie / Live-Foto",
    description: "Zum Abschluss ein Selfie bei guter Beleuchtung. Halte den Ausweis nicht ins Bild – nur dein Gesicht.",
    icon: Camera,
  },
];

function VerificationPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [kyc, setKyc] = useState<KycData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<FieldKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [previews, setPreviews] = useState<Record<FieldKey, string | null>>({
    id_front_url: null,
    id_back_url: null,
    selfie_url: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadKyc = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error: dbError } = await supabase
        .from("kyc_verifications")
        .select("id, status, id_front_url, id_back_url, selfie_url, rejection_reason")
        .eq("user_id", user.id)
        .maybeSingle();

      if (dbError) throw dbError;

      let row: KycData | null = (data as KycData | null) ?? null;
      if (!row) {
        const { data: newKyc, error: insertError } = await supabase
          .from("kyc_verifications")
          .insert({ user_id: user.id })
          .select("id, status, id_front_url, id_back_url, selfie_url, rejection_reason")
          .single();
        if (insertError) throw insertError;
        row = newKyc as KycData;
      }
      setKyc(row);

      // Generate signed URLs for previews
      const next: Record<FieldKey, string | null> = { id_front_url: null, id_back_url: null, selfie_url: null };
      await Promise.all(
        (["id_front_url", "id_back_url", "selfie_url"] as FieldKey[]).map(async (k) => {
          const p = row?.[k];
          if (!p) return;
          const { data: signed } = await supabase.storage
            .from("kyc-documents")
            .createSignedUrl(p, 3600);
          if (signed?.signedUrl) next[k] = signed.signedUrl;
        }),
      );
      setPreviews(next);

      // Jump to first incomplete step
      if (row) {
        const firstMissing = STEPS.findIndex((s) => !row![s.key]);
        if (firstMissing >= 0) setStep(firstMissing);
        else setStep(STEPS.length);
      }
    } catch (err: any) {
      console.error("KYC load error:", err);
      setError(err.message || "Verifizierungsdaten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }
    loadKyc();
  }, [user, authLoading, navigate, loadKyc]);

  const uploadFile = async (field: FieldKey, file: File) => {
    if (!user || !kyc) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Datei zu groß", description: "Maximal 10 MB pro Bild.", variant: "destructive" });
      return;
    }
    setUploading(field);

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/${field}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("kyc-documents")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      toast({ title: "Upload fehlgeschlagen", description: uploadError.message, variant: "destructive" });
      setUploading(null);
      return;
    }

    const updatePayload =
      field === "id_front_url" ? { id_front_url: path } :
      field === "id_back_url"  ? { id_back_url: path } :
                                  { selfie_url: path };

    const { error: updateError } = await supabase
      .from("kyc_verifications")
      .update(updatePayload)
      .eq("user_id", user.id);

    if (updateError) {
      toast({ title: "Fehler", description: updateError.message, variant: "destructive" });
      setUploading(null);
      return;
    }

    // Local preview via objectURL (instant), then refresh signed URL
    const localUrl = URL.createObjectURL(file);
    setPreviews((p) => ({ ...p, [field]: localUrl }));
    setKyc((prev) => prev ? { ...prev, [field]: path } : prev);

    const { data: signed } = await supabase.storage
      .from("kyc-documents")
      .createSignedUrl(path, 3600);
    if (signed?.signedUrl) setPreviews((p) => ({ ...p, [field]: signed.signedUrl }));

    toast({ title: "Hochgeladen!" });
    setUploading(null);
  };

  const submitVerification = async () => {
    if (!user || !kyc) return;
    if (!kyc.id_front_url || !kyc.id_back_url || !kyc.selfie_url) {
      toast({ title: "Fehler", description: "Bitte lade alle drei Dokumente hoch.", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("kyc_verifications")
      .update({ status: "eingereicht" as KycStatus })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }

    setKyc((prev) => prev ? { ...prev, status: "eingereicht" as KycStatus } : prev);
    toast({ title: "Verifizierung eingereicht!", description: "Deine Dokumente werden geprüft." });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-destructive font-medium">Fehler beim Laden</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>Zurück zum Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const kycStatus = kyc?.status ?? "nicht_gestartet";
  const statusConfig = KYC_STATUS_CONFIG[kycStatus];
  const canUpload = kycStatus === "nicht_gestartet" || kycStatus === "abgelehnt";
  const isSubmitted = kycStatus === "eingereicht" || kycStatus === "in_pruefung";
  const isVerified = kycStatus === "verifiziert";
  const allUploaded = !!(kyc?.id_front_url && kyc?.id_back_url && kyc?.selfie_url);
  const reviewMode = step >= STEPS.length;
  const current = STEPS[Math.min(step, STEPS.length - 1)];
  const currentValue = kyc?.[current.key];
  const currentPreview = previews[current.key];
  const Icon = current.icon;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-heading font-bold">Personenverifizierung</h1>
              <p className="text-xs text-muted-foreground">KYC nach §6 GwG</p>
            </div>
          </div>
          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
        </div>
      </header>

      <main className="container py-8 max-w-3xl space-y-6">
        {/* Status banners */}
        {kycStatus === "abgelehnt" && kyc?.rejection_reason && (
          <Card className="border-destructive/50">
            <CardContent className="pt-6 flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">Verifizierung abgelehnt</p>
                <p className="text-sm text-muted-foreground mt-1">{kyc.rejection_reason}</p>
                <p className="text-sm text-foreground mt-2">Bitte lade deine Dokumente erneut hoch.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {isVerified && (
          <Card className="border-green-500/40 bg-green-500/5">
            <CardContent className="pt-6 flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-green-500" />
              <div>
                <p className="font-semibold text-foreground">Identität erfolgreich verifiziert</p>
                <p className="text-sm text-muted-foreground">Du bist freigeschaltet. Viel Erfolg!</p>
              </div>
            </CardContent>
          </Card>
        )}

        {isSubmitted && !isVerified && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-foreground font-medium">Deine Dokumente werden geprüft.</p>
              <p className="text-sm text-muted-foreground mt-1">Dies kann einige Stunden dauern. Du wirst benachrichtigt.</p>
            </CardContent>
          </Card>
        )}

        {/* Step indicator */}
        {!isVerified && !isSubmitted && (
          <div className="flex items-center justify-between gap-2">
            {STEPS.map((s, idx) => {
              const done = !!kyc?.[s.key];
              const active = idx === step && !reviewMode;
              return (
                <div key={s.key} className="flex-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => canUpload && setStep(idx)}
                    className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      active ? "bg-primary text-primary-foreground" :
                      done ? "bg-green-500/15 text-green-600 dark:text-green-400" :
                      "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                      done ? "bg-green-500 text-white" :
                      active ? "bg-primary-foreground text-primary" :
                      "bg-background"
                    }`}>
                      {done ? <CheckCircle2 className="h-3 w-3" /> : idx + 1}
                    </span>
                    {s.label}
                  </button>
                  {idx < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Step content or review */}
        {!isVerified && !isSubmitted && !reviewMode && (
          <Card>
            <CardContent className="pt-6 space-y-5">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-primary/10 p-3 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold">{current.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{current.description}</p>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-border bg-muted/30 overflow-hidden">
                {currentPreview ? (
                  <div className="relative group">
                    <img src={currentPreview} alt={current.label}
                      className="w-full max-h-80 object-contain bg-black/40" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadFile(current.key, f);
                          }}
                          disabled={uploading === current.key || !canUpload}
                        />
                        <Button variant="secondary" size="sm" asChild disabled={!canUpload}>
                          <span>{uploading === current.key ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ersetzen"}</span>
                        </Button>
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-3 py-14 cursor-pointer">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadFile(current.key, f);
                      }}
                      disabled={uploading === current.key || !canUpload}
                    />
                    <div className="rounded-full bg-background p-4">
                      {uploading === current.key
                        ? <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        : <Upload className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">Bild auswählen oder hierher ziehen</p>
                      <p className="text-xs text-muted-foreground mt-1">JPG / PNG · max. 10 MB</p>
                    </div>
                  </label>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" /> Zurück
                </Button>
                <Button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!currentValue}
                >
                  {step === STEPS.length - 1 ? "Zur Übersicht" : "Weiter"}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Review step */}
        {!isVerified && !isSubmitted && reviewMode && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Übersicht & Einreichen</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Bitte prüfe deine Uploads. Mit dem Einreichen bestätigst du, dass die Daten korrekt sind.
                </p>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {STEPS.map((s, idx) => {
                  const prev = previews[s.key];
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setStep(idx)}
                      className="text-left rounded-lg border border-border overflow-hidden hover:border-primary transition"
                    >
                      <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                        {prev
                          ? <img src={prev} alt={s.label} className="w-full h-full object-cover" />
                          : <Upload className="h-6 w-6 text-muted-foreground" />}
                      </div>
                      <div className="p-2 flex items-center justify-between">
                        <span className="text-xs font-medium">{s.label}</span>
                        {kyc?.[s.key]
                          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                          : <XCircle className="h-4 w-4 text-destructive" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(STEPS.length - 1)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Bearbeiten
                </Button>
                <Button onClick={submitVerification} disabled={!allUploaded || !canUpload}>
                  <ShieldCheck className="h-4 w-4 mr-1" />
                  Verifizierung einreichen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Deine Dokumente werden verschlüsselt übertragen und nur zur Identitätsprüfung verwendet.
        </p>
      </main>
    </div>
  );
}
