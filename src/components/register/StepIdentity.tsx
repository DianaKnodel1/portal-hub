import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Upload, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/image-compression";

interface Props {
  userId: string | null;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
}

export default function StepIdentity({ userId, onNext, onBack, loading }: Props) {
  const { toast } = useToast();
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!frontFile || !backFile || !userId) {
      toast({ title: "Fehler", description: "Bitte beide Seiten hochladen.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      // Speichern im kyc-documents Bucket, damit die Admin-Verifizierungsansicht
      // (kyc_verifications + Bucket kyc-documents) den Ausweis direkt sieht.
      // Dateinamen sanitizen (keine Leerzeichen/Sonderzeichen → sonst RLS-Fehler in Storage)
      const sanitize = (name: string) => {
        const dot = name.lastIndexOf(".");
        const ext = dot >= 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
        return `file${ext || ".png"}`;
      };
      // Bilder vor dem Upload komprimieren (max 1600px, ~82% JPEG)
      const [frontC, backC] = await Promise.all([
        compressImage(frontFile),
        compressImage(backFile),
      ]);
      const frontPath = `${userId}/${Date.now()}_front_${sanitize(frontC.name)}`;
      const backPath = `${userId}/${Date.now()}_back_${sanitize(backC.name)}`;

      const [frontRes, backRes] = await Promise.all([
        supabase.storage.from("kyc-documents").upload(frontPath, frontC),
        supabase.storage.from("kyc-documents").upload(backPath, backC),
      ]);

      if (frontRes.error || backRes.error) {
        const err = frontRes.error || backRes.error;
        console.error("[StepIdentity] Storage upload error:", err);
        const raw = err?.message || "";
        let msg = "Ausweis konnte nicht hochgeladen werden. Bitte erneut versuchen.";
        if (raw.includes("not found")) msg = "Speicher nicht verfügbar. Bitte kontaktiere den Support.";
        else if (raw.includes("row-level security") || raw.toLowerCase().includes("unauthorized")) {
          msg = "Berechtigung fehlt. Bitte lade die Seite neu und versuche es erneut.";
        } else if (raw.includes("exceeded") || raw.includes("size")) {
          msg = "Datei ist zu groß. Bitte wähle eine kleinere Datei.";
        } else if (raw) {
          msg = `Upload-Fehler: ${raw}`;
        }
        throw new Error(msg);
      }

      // KYC-Eintrag anlegen oder aktualisieren, damit Admin Vorder- und Rückseite
      // in der Verifizierung sieht und Status auf "eingereicht" setzen kann.
      const { data: existing } = await supabase
        .from("kyc_verifications")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing?.id) {
        const { error: updErr } = await supabase
          .from("kyc_verifications")
          .update({
            id_front_url: frontPath,
            id_back_url: backPath,
            status: "eingereicht" as any,
          })
          .eq("id", existing.id);
        if (updErr) throw new Error("Verifizierung konnte nicht aktualisiert werden.");
      } else {
        const { error: insErr } = await supabase.from("kyc_verifications").insert({
          user_id: userId,
          id_front_url: frontPath,
          id_back_url: backPath,
          status: "eingereicht" as any,
        });
        if (insErr) throw new Error("Verifizierung konnte nicht angelegt werden.");
      }

      // Zusätzlich als Dokumente registrieren (für die Dokumentenliste des Mitarbeiters).
      await Promise.all([
        supabase.from("documents").insert({
          uploaded_by: userId,
          user_id: userId,
          category: "identitaet" as any,
          file_url: frontPath,
          file_name: `Ausweis Vorderseite - ${frontFile.name}`,
        } as any),
        supabase.from("documents").insert({
          uploaded_by: userId,
          user_id: userId,
          category: "identitaet" as any,
          file_url: backPath,
          file_name: `Ausweis Rückseite - ${backFile.name}`,
        } as any),
      ]);

      onNext();
    } catch (err: any) {
      toast({
        title: "Upload fehlgeschlagen",
        description: err.message || "Unbekannter Fehler. Bitte erneut versuchen.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Upload className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-lg font-heading font-bold">Identität bestätigen</h2>
        <p className="text-sm text-muted-foreground">
          Bitte lade deinen Personalausweis hoch, damit wir deine Identität verifizieren können.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Personalausweis – Vorderseite *</Label>
          <div className="relative">
            <Input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFrontFile(e.target.files?.[0] || null)}
            />
            {frontFile && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent" />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Personalausweis – Rückseite *</Label>
          <div className="relative">
            <Input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setBackFile(e.target.files?.[0] || null)}
            />
            {backFile && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent" />
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Deine Daten werden sicher gespeichert und nur für die Verifizierung verwendet.
      </p>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} className="flex-1 gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Button>
        <Button
          onClick={handleUpload}
          disabled={!frontFile || !backFile || uploading}
          className="flex-1 gap-1.5"
        >
          {uploading ? "Wird hochgeladen…" : "Weiter"}
          {!uploading && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
