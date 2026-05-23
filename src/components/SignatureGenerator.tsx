import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2, Trash2 } from "lucide-react";

const FONTS = [
  { name: "Caveat", family: "'Caveat', cursive", url: "https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap" },
  { name: "Dancing Script", family: "'Dancing Script', cursive", url: "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500;700&display=swap" },
  { name: "Great Vibes", family: "'Great Vibes', cursive", url: "https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" },
  { name: "Pacifico", family: "'Pacifico', cursive", url: "https://fonts.googleapis.com/css2?family=Pacifico&display=swap" },
  { name: "Sacramento", family: "'Sacramento', cursive", url: "https://fonts.googleapis.com/css2?family=Sacramento&display=swap" },
  { name: "Allura", family: "'Allura', cursive", url: "https://fonts.googleapis.com/css2?family=Allura&display=swap" },
];

// Inject all font links into <head> once
function ensureFontsLoaded() {
  if (typeof document === "undefined") return;
  for (const f of FONTS) {
    const id = `sigfont-${f.name.replace(/\s+/g, "-")}`;
    if (document.getElementById(id)) continue;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = f.url;
    document.head.appendChild(link);
  }
}

interface Props {
  tenantId: string;
  currentUrl?: string | null;
  onSaved?: (url: string | null) => void;
}

export function SignatureGenerator({ tenantId, currentUrl, onSaved }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [fontIdx, setFontIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { ensureFontsLoaded(); }, []);

  // Re-render canvas preview whenever name/font changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !name.trim()) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000000";
      ctx.font = `64px ${FONTS[fontIdx].family}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(name.trim(), canvas.width / 2, canvas.height / 2);
    };

    // Wait for font to load before drawing
    if ((document as any).fonts?.load) {
      (document as any).fonts.load(`64px ${FONTS[fontIdx].family}`).then(draw).catch(draw);
    } else {
      setTimeout(draw, 200);
    }
  }, [name, fontIdx]);

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !name.trim()) {
      toast({ title: "Bitte Namen eingeben", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Convert canvas to blob
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("Canvas konnte nicht exportiert werden"))), "image/png")
      );
      const path = `tenants/${tenantId}/${Date.now()}.png`;
      const { error: upErr } = await supabase.storage.from("signatures").upload(path, blob, {
        contentType: "image/png",
        upsert: true,
      });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("signatures").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const { error: dbErr } = await supabase
        .from("tenants")
        .update({ company_signature_url: publicUrl } as any)
        .eq("id", tenantId);
      if (dbErr) throw dbErr;

      toast({ title: "Unterschrift gespeichert" });
      onSaved?.(publicUrl);
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("tenants")
      .update({ company_signature_url: null } as any)
      .eq("id", tenantId);
    setSaving(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Unterschrift entfernt" });
    onSaved?.(null);
  };

  return (
    <div className="space-y-3">
      {currentUrl && (
        <Card className="p-3 flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <img src={currentUrl} alt="Aktuelle Unterschrift" className="h-12 max-w-[200px] object-contain bg-white rounded border" />
            <div>
              <p className="text-xs font-medium text-foreground">Aktuelle Unterschrift</p>
              <p className="text-[10px] text-muted-foreground">Wird auf Verträgen verwendet</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRemove} disabled={saving} className="text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3">
        <div>
          <Label className="text-xs">Name für Unterschrift</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Max Mustermann"
            className="mt-1"
            maxLength={40}
          />
        </div>

        <div>
          <Label className="text-xs mb-2 block">Schriftart wählen</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {FONTS.map((f, i) => (
              <button
                key={f.name}
                type="button"
                onClick={() => setFontIdx(i)}
                className={`p-3 rounded-lg border-2 transition-all text-center bg-white ${
                  fontIdx === i ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                }`}
                style={{ fontFamily: f.family }}
              >
                <div className="text-xl text-black truncate">{name.trim() || "Beispiel"}</div>
                <div className="text-[9px] text-muted-foreground mt-1 font-sans">{f.name}</div>
              </button>
            ))}
          </div>
        </div>

        {name.trim() && (
          <div>
            <Label className="text-xs mb-1 block">Vorschau</Label>
            <div className="border rounded-lg bg-white p-4 flex items-center justify-center">
              <canvas ref={canvasRef} width={500} height={140} className="max-w-full h-auto" />
            </div>
          </div>
        )}

        <Button onClick={handleSave} disabled={saving || !name.trim()} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Unterschrift speichern
        </Button>
      </div>
    </div>
  );
}
