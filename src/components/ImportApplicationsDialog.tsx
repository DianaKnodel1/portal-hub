import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Row = {
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string | null;
};

// Splits a CSV line by `;` honoring quoted fields.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ";" && !inQuotes) {
      out.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): { rows: Row[]; errors: string[] } {
  // Strip BOM
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], errors: ["Datei ist leer."] };

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = {
    name: header.findIndex((h) => h === "name" || h === "full_name"),
    email: header.findIndex((h) => h === "e-mail" || h === "email" || h === "mail"),
    phone: header.findIndex((h) => h === "telefon" || h === "phone"),
    status: header.findIndex((h) => h === "status"),
    date: header.findIndex((h) => h === "datum" || h === "created_at" || h === "date"),
  };

  const errors: string[] = [];
  if (idx.name === -1) errors.push("Spalte 'Name' fehlt.");
  if (idx.email === -1) errors.push("Spalte 'E-Mail' fehlt.");
  if (errors.length) return { rows: [], errors };

  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const full_name = (cols[idx.name] ?? "").trim();
    const email = (cols[idx.email] ?? "").trim();
    if (!full_name || !email) {
      errors.push(`Zeile ${i + 1}: Name oder E-Mail fehlt – übersprungen.`);
      continue;
    }
    const phone = idx.phone >= 0 ? (cols[idx.phone] ?? "").trim() || null : null;
    const status = (idx.status >= 0 ? (cols[idx.status] ?? "").trim() : "") || "neu";
    const rawDate = idx.date >= 0 ? (cols[idx.date] ?? "").trim() : "";
    let created_at: string | null = null;
    if (rawDate) {
      const d = new Date(rawDate);
      created_at = isNaN(d.getTime()) ? null : d.toISOString();
    }
    // Split full name into first/last (best effort)
    const parts = full_name.split(/\s+/);
    const first_name = parts.length > 1 ? parts.slice(0, -1).join(" ") : full_name;
    const last_name = parts.length > 1 ? parts[parts.length - 1] : null;
    rows.push({ full_name, email, phone, status, created_at, ...(first_name ? { first_name } : {}), ...(last_name ? { last_name } : {}) } as Row & { first_name?: string; last_name?: string });
  }
  return { rows, errors };
}

export function ImportApplicationsDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const reset = () => {
    setRows([]); setParseErrors([]); setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const { rows, errors } = parseCsv(text);
    setRows(rows);
    setParseErrors(errors);
  };

  const doImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      // Insert in chunks to avoid payload limits
      const chunkSize = 200;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize).map((r) => {
          const payload: Record<string, unknown> = {
            full_name: r.full_name,
            email: r.email,
            phone: r.phone,
            status: r.status || "neu",
          };
          if (r.created_at) payload.created_at = r.created_at;
          const anyR = r as Row & { first_name?: string; last_name?: string };
          if (anyR.first_name) payload.first_name = anyR.first_name;
          if (anyR.last_name) payload.last_name = anyR.last_name;
          return payload;
        });
        const { error } = await supabase.from("applications").insert(chunk as never);
        if (error) throw error;
        inserted += chunk.length;
      }
      toast({ title: "Import erfolgreich", description: `${inserted} Bewerbungen importiert.` });
      onImported();
      setOpen(false);
      reset();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      toast({ title: "Import fehlgeschlagen", description: msg, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
          <Upload className="h-3.5 w-3.5" /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bewerbungen importieren</DialogTitle>
          <DialogDescription>
            CSV-Format mit Semikolon (;) als Trenner. Spalten: <strong>Name;E-Mail;Telefon;Status;Datum</strong>.
            Pflichtfelder: Name, E-Mail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="block w-full text-sm text-foreground file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-border file:bg-muted file:text-foreground hover:file:bg-muted/80 file:cursor-pointer"
            />
            {fileName && <p className="text-xs text-muted-foreground mt-1.5">Datei: {fileName}</p>}
          </div>

          {parseErrors.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs space-y-1 max-h-32 overflow-auto">
              <div className="flex items-center gap-1.5 font-medium text-destructive">
                <AlertCircle className="h-3.5 w-3.5" /> Hinweise ({parseErrors.length})
              </div>
              {parseErrors.slice(0, 20).map((e, i) => (
                <p key={i} className="text-destructive/90">{e}</p>
              ))}
              {parseErrors.length > 20 && <p className="text-muted-foreground">… und {parseErrors.length - 20} weitere</p>}
            </div>
          )}

          {rows.length > 0 && (
            <div className="rounded-md border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />
                <span className="font-medium">{rows.length} Einträge bereit zum Import</span>
                <span className="text-muted-foreground">— Vorschau (max. 5)</span>
              </div>
              <div className="overflow-auto max-h-60">
                <table className="w-full text-xs">
                  <thead className="bg-muted/20 text-muted-foreground">
                    <tr>
                      <th className="text-left p-2 font-medium">Name</th>
                      <th className="text-left p-2 font-medium">E-Mail</th>
                      <th className="text-left p-2 font-medium">Telefon</th>
                      <th className="text-left p-2 font-medium">Status</th>
                      <th className="text-left p-2 font-medium">Datum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2">{r.full_name}</td>
                        <td className="p-2">{r.email}</td>
                        <td className="p-2">{r.phone || "—"}</td>
                        <td className="p-2">{r.status}</td>
                        <td className="p-2">{r.created_at ? new Date(r.created_at).toLocaleDateString("de-DE") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { setOpen(false); reset(); }} disabled={importing}>Abbrechen</Button>
          <Button onClick={doImport} disabled={rows.length === 0 || importing} className="gap-1.5">
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {importing ? "Importiere…" : `${rows.length} importieren`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}