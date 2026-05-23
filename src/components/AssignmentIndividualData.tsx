import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FileUp, Save, Trash2, Settings2, FileText, Loader2 } from "lucide-react";

export interface IndividualData {
  individual_instructions: string | null;
  individual_phone: string | null;
  individual_hint: string | null;
  post_ident_pdf_url: string | null;
  post_ident_pdf_name: string | null;
}

interface Props {
  assignmentId: string;
  userId: string;
  initial: Partial<IndividualData>;
  /** Anleitungstext aus der Auftragsvorlage – wird als Platzhalter angezeigt, wenn noch kein individueller Text gesetzt ist. */
  templateInstructions?: string;
  onSaved?: () => void;
}

export function AssignmentIndividualData({ assignmentId, userId, initial, templateInstructions, onSaved }: Props) {
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [data, setData] = useState<IndividualData>({
    individual_instructions: initial.individual_instructions ?? "",
    individual_phone: initial.individual_phone ?? "",
    individual_hint: initial.individual_hint ?? "",
    post_ident_pdf_url: initial.post_ident_pdf_url ?? null,
    post_ident_pdf_name: initial.post_ident_pdf_name ?? null,
  });

  const update = (field: keyof IndividualData, val: string) => setData((d) => ({ ...d, [field]: val }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("task_assignments").update({
      individual_instructions: data.individual_instructions || null,
      individual_phone: data.individual_phone || null,
      individual_hint: data.individual_hint || null,
    } as any).eq("id", assignmentId);
    setSaving(false);
    if (error) {
      toast({ title: "Fehler", description: "Daten konnten nicht gespeichert werden.", variant: "destructive" });
      return;
    }
    toast({ title: "Individuelle Auftragsdaten gespeichert" });
    setOpen(false);
    onSaved?.();
  };

  const prefillInstructions = () => {
    if (!templateInstructions) return;
    setData((d) => ({ ...d, individual_instructions: templateInstructions }));
  };

  const uploadPdf = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Datei zu groß", description: "Maximal 20 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    // Erste Ordner-Ebene MUSS die userId sein, damit RLS dem Mitarbeiter Lesezugriff erlaubt.
    const path = `${userId}/post-ident/${assignmentId}-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("employee-documents").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/pdf",
    });
    if (upErr) {
      setUploading(false);
      toast({ title: "Upload fehlgeschlagen", description: upErr.message, variant: "destructive" });
      return;
    }
    const { error: updErr } = await supabase.from("task_assignments").update({
      post_ident_pdf_url: path,
      post_ident_pdf_name: file.name,
    } as any).eq("id", assignmentId);
    setUploading(false);
    if (updErr) {
      toast({ title: "Fehler", description: "PDF konnte nicht zugeordnet werden.", variant: "destructive" });
      return;
    }
    setData((d) => ({ ...d, post_ident_pdf_url: path, post_ident_pdf_name: file.name }));
    toast({ title: "Post-Ident PDF hochgeladen" });
    onSaved?.();
  };

  const removePdf = async () => {
    if (!data.post_ident_pdf_url) return;
    await supabase.storage.from("employee-documents").remove([data.post_ident_pdf_url]);
    await supabase.from("task_assignments").update({
      post_ident_pdf_url: null,
      post_ident_pdf_name: null,
    } as any).eq("id", assignmentId);
    setData((d) => ({ ...d, post_ident_pdf_url: null, post_ident_pdf_name: null }));
    toast({ title: "PDF entfernt" });
    onSaved?.();
  };

  const hasAny = data.individual_instructions || data.individual_phone || data.individual_hint || data.post_ident_pdf_url;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings2 className="h-4 w-4" /> Individuelle Auftragsdaten für diesen Mitarbeiter
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(!open)}>
            {open ? "Zuklappen" : "Bearbeiten"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!open && !hasAny && (
          <p className="text-sm text-muted-foreground">
            Keine individuellen Daten hinterlegt. Klicke auf „Bearbeiten“, um den Anleitungstext anzupassen oder Telefonnummer, Hinweis bzw. Post-Ident PDF zu hinterlegen.
          </p>
        )}
        {!open && hasAny && (
          <div className="space-y-1.5 text-sm">
            {data.individual_instructions && <Row label="Anleitung (individuell)" value={truncate(data.individual_instructions, 120)} />}
            {data.individual_phone && <Row label="SMS-/Telefonnummer" value={data.individual_phone} />}
            {data.individual_hint && <Row label="Hinweistext" value={data.individual_hint} />}
            {data.post_ident_pdf_name && <Row label="Post-Ident PDF" value={data.post_ident_pdf_name} />}
          </div>
        )}
        {open && (
          <div className="space-y-3">
            <Field
              label="Anleitung für diesen Mitarbeiter"
              hint="Überschreibt die Standard-Anleitung der Auftragsvorlage. Trage hier alle Zugangsdaten, Schritte und Hinweise ein, die der Mitarbeiter sehen soll."
            >
              <Textarea
                value={data.individual_instructions ?? ""}
                onChange={(e) => update("individual_instructions", e.target.value)}
                placeholder={templateInstructions ? "Leer lassen, um die Standard-Anleitung der Vorlage zu verwenden." : "Schritt-für-Schritt Anleitung inkl. E-Mail, Passwort, Vorgangsnummer …"}
                rows={10}
              />
              {templateInstructions && !data.individual_instructions && (
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={prefillInstructions}>
                  Vorlage als Basis übernehmen
                </Button>
              )}
            </Field>

            <Field label="SMS-/Telefonnummer (Anzeige)">
              <Input value={data.individual_phone ?? ""} onChange={(e) => update("individual_phone", e.target.value)} placeholder="+49 …" />
            </Field>
            <Field label="Individueller Hinweistext">
              <Textarea
                value={data.individual_hint ?? ""}
                onChange={(e) => update("individual_hint", e.target.value)}
                placeholder="z. B. Bitte geben Sie als Nummer folgende an: +49 …"
                rows={3}
              />
            </Field>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Post-Ident PDF</label>
              {data.post_ident_pdf_url ? (
                <div className="flex items-center justify-between rounded-lg bg-muted/50 border border-border px-3 py-2">
                  <div className="flex items-center gap-2 text-sm min-w-0">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate">{data.post_ident_pdf_name ?? "PDF"}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={removePdf}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadPdf(f);
                      e.target.value = "";
                    }}
                  />
                  <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
                    {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FileUp className="h-3.5 w-3.5 mr-1" />}
                    PDF hochladen
                  </Button>
                </>
              )}
            </div>

            <Button size="sm" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Daten speichern
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {hint && <p className="text-[11px] text-muted-foreground/80">{hint}</p>}
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-muted/50 border border-border px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right break-all">{value}</span>
    </div>
  );
}
