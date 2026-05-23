import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { SignatureCanvas } from "@/components/SignatureCanvas";
import { supabase } from "@/integrations/supabase/client";
import { replacePlaceholders, generateFallbackContract } from "@/lib/contract-utils";
import { ArrowRight, ArrowLeft, FileText, PenTool, Loader2 } from "lucide-react";

interface Props {
  firstName: string;
  lastName: string;
  street: string;
  zipCode: string;
  city: string;
  employmentType: string;
  startDate?: Date;
  agreed: boolean;
  setAgreed: (v: boolean) => void;
  signatureName: string;
  setSignatureName: (v: string) => void;
  onNext: (content?: string, signatureDataUrl?: string | null) => void;
  onBack: () => void;
  loading: boolean;
  userId: string | null;
  tenantId: string | null;
  /** Called with the generated contract content and signature data URL */
  onContractReady?: (content: string, signatureDataUrl: string | null) => void;
}

export default function StepContract({
  firstName, lastName, street, zipCode, city, employmentType, startDate,
  agreed, setAgreed, signatureName, setSignatureName,
  onNext, onBack, loading, userId, tenantId, onContractReady
}: Props) {
  const [contractContent, setContractContent] = useState<string>("");
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [tenantData, setTenantData] = useState<{ name: string; company_ceo_name: string | null; company_signature_url: string | null } | null>(null);

  const canSubmit = agreed && signatureName.trim().length > 1 && signatureDataUrl;

  useEffect(() => {
    const loadContract = async () => {
      setLoadingTemplate(true);
      let companyName = "";
      let companyCeoName = "";

      // Resolve tenant id (fallback to first active tenant for preview)
      let resolvedTenantId = tenantId;
      if (!resolvedTenantId) {
        const { data } = await (supabase.rpc as any)("get_first_active_public_tenant");
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.id) resolvedTenantId = row.id;
      }

      // Load tenant data
      if (resolvedTenantId) {
        const { data: tenant } = await (supabase.rpc as any)("get_first_active_public_tenant");
        const row = Array.isArray(tenant) ? tenant[0] : tenant;
        if (row) {
          setTenantData(row as any);
          companyName = row.name ?? "";
          companyCeoName = row.company_ceo_name ?? "";
        }
      }

      const formattedStart = startDate
        ? startDate.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "";

      const contractData = {
        firstName, lastName,
        address: `${street}, ${zipCode} ${city}`,
        city,
        employmentType,
        companyName,
        companyCeoName,
        startDate: formattedStart,
      };

      // Try to load tenant-specific template
      if (resolvedTenantId) {
        const { data: template } = await supabase
          .from("contract_templates")
          .select("content, body_html")
          .eq("tenant_id", resolvedTenantId)
          .eq("employment_type", employmentType as any)
          .eq("is_active", true)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (template) {
          const tmpl = (template as any).content || (template as any).body_html;
          if (tmpl) {
            setContractContent(replacePlaceholders(tmpl, contractData));
            setLoadingTemplate(false);
            return;
          }
        }
      }

      // Fallback: generate default contract
      setContractContent(generateFallbackContract(contractData));
      setLoadingTemplate(false);
    };

    loadContract();
  }, [tenantId, employmentType, firstName, lastName, street, zipCode, city, startDate]);

  const handleSign = () => {
    if (onContractReady) {
      onContractReady(contractContent, signatureDataUrl);
    }
    // Inhalt + Signatur direkt durchreichen, damit der Parent nicht auf State warten muss
    onNext(contractContent, signatureDataUrl);
  };

  return (
    <div className="space-y-5">
      <div className="text-center mb-4">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-heading font-bold text-foreground">Arbeitsvertrag</h2>
        <p className="text-sm text-muted-foreground mt-1">Bitte lies den Vertrag und unterschreibe digital</p>
      </div>

      {/* Contract Content */}
      {loadingTemplate ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-muted/30 p-5 max-h-64 overflow-y-auto text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap font-mono">
          {contractContent}
        </div>
      )}

      {/* Signature Section */}
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Checkbox id="agree-contract" checked={agreed} onCheckedChange={(c) => setAgreed(c === true)} />
          <label htmlFor="agree-contract" className="text-xs text-foreground leading-relaxed cursor-pointer">
            Ich habe den Vertrag vollständig gelesen und stimme allen Bedingungen zu.
          </label>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <PenTool className="h-3.5 w-3.5" /> Dein vollständiger Name als Unterschrift
          </label>
          <Input
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            placeholder={`${firstName} ${lastName}`}
            className="h-11 font-serif italic text-lg"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Unterschrift zeichnen</label>
          <SignatureCanvas
            onSignatureChange={setSignatureDataUrl}
            disabled={loading}
          />
        </div>
      </div>

      <Button
        onClick={handleSign}
        disabled={loading || !canSubmit}
        className="w-full h-12 text-base font-semibold gap-2"
      >
        {loading ? "Wird unterzeichnet…" : "Vertrag unterschreiben"}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="sm" onClick={onBack} className="w-full text-muted-foreground gap-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Zurück
      </Button>
    </div>
  );
}
