import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy, Download, FileText, Phone, Info, Loader2 } from "lucide-react";

interface Props {
  data: {
    individual_phone: string | null;
    individual_hint: string | null;
    post_ident_pdf_url: string | null;
    post_ident_pdf_name: string | null;
  };
}

export function AssignmentIndividualDataView({ data }: Props) {
  const { toast } = useToast();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setPdfUrl(null);
    if (!data.post_ident_pdf_url) return;
    setPdfLoading(true);
    (async () => {
      const { data: signed, error } = await supabase.storage
        .from("employee-documents")
        .createSignedUrl(data.post_ident_pdf_url!, 3600);
      if (!active) return;
      if (error) {
        toast({ title: "PDF konnte nicht geladen werden", description: error.message, variant: "destructive" });
      }
      setPdfUrl(signed?.signedUrl ?? null);
      setPdfLoading(false);
    })();
    return () => { active = false; };
  }, [data.post_ident_pdf_url, toast]);

  const hasAny = data.individual_phone || data.individual_hint || data.post_ident_pdf_url;
  if (!hasAny) return null;

  const copy = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    toast({ title: `${label} kopiert` });
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2 text-primary">
          <Info className="h-4 w-4" /> Deine individuellen Auftragsdaten
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.individual_hint && (
          <div className="rounded-lg bg-background border border-border p-3 text-sm whitespace-pre-wrap">
            {data.individual_hint}
          </div>
        )}
        {data.individual_phone && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-background border border-border p-3">
            <div className="flex items-center gap-2 min-w-0">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground">SMS-/Telefonnummer</p>
                <p className="text-sm font-mono text-foreground truncate">{data.individual_phone}</p>
              </div>
            </div>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => copy(data.individual_phone!, "Telefonnummer")}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {data.post_ident_pdf_url && (
          <div className="flex items-center justify-between rounded-lg bg-background border border-border p-3">
            <div className="flex items-center gap-2 text-sm min-w-0">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{data.post_ident_pdf_name ?? "Post-Ident PDF"}</span>
            </div>
            {pdfUrl ? (
              <Button asChild size="sm" className="h-8">
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download={data.post_ident_pdf_name ?? "post-ident.pdf"}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Download
                </a>
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                {pdfLoading && <Loader2 className="h-3 w-3 animate-spin" />} Lade…
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
