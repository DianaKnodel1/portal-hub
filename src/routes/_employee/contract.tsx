import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_employee/contract")({
  component: ContractPage,
});

import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, Loader2, Download } from "lucide-react";
import StepContract from "@/components/register/StepContract";
import { translateDbError } from "@/lib/db-errors";

const EMPLOYMENT_LABELS: Record<string, string> = {
  minijob: "Minijob", teilzeit: "Teilzeit", vollzeit: "Vollzeit",
};

interface Contract {
  id: string;
  generated_content: string;
  signed_name: string;
  signature_image_url: string | null;
  company_signature_url: string | null;
  signed_at: string;
  pdf_url: string | null;
  employment_type: string;
}

function ContractPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const [signing, setSigning] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [signatureName, setSignatureName] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    const loadData = async () => {
      const [{ data: contracts }, { data: profileData }] = await Promise.all([
        supabase.from("contracts").select("*").eq("user_id", user.id).order("signed_at", { ascending: false }).limit(1),
        supabase.from("profiles").select("full_name, street, zip_code, city, address, employment_type, contract_signed_at, tenant_id").eq("user_id", user.id).maybeSingle(),
      ]);
      if (contracts && contracts.length > 0) setContract(contracts[0] as unknown as Contract);
      setProfile(profileData);
      if (profileData?.full_name && !signatureName) setSignatureName(profileData.full_name);
      setLoading(false);
    };
    loadData();
  }, [user, authLoading]);

  const handleSignContract = async (contentOverride?: string, sigOverride?: string | null) => {
    if (!user || !profile) return;
    if (!agreed || !signatureName.trim()) {
      toast({ title: "Fehler", description: "Bitte stimme zu und gib deinen Namen ein.", variant: "destructive" });
      return;
    }
    if (!profile.employment_type) {
      toast({
        title: "Beschäftigungsart fehlt",
        description: "Deine Beschäftigungsart (Minijob, Teilzeit oder Vollzeit) wurde noch nicht vom Administrator festgelegt. Bitte kontaktiere uns, bevor du den Vertrag unterschreibst.",
        variant: "destructive",
      });
      return;
    }
    setSigning(true);
    try {
      const now = new Date().toISOString();

      // Signatur hochladen
      let signaturePath: string | null = null;
      if (sigOverride) {
        const blob = await fetch(sigOverride).then((r) => r.blob());
        const filePath = `${user.id}/${Date.now()}.png`;
        const { data: uploaded } = await supabase.storage
          .from("signatures")
          .upload(filePath, blob, { contentType: "image/png" });
        if (uploaded?.path) signaturePath = uploaded.path;
      }

      // Vertrag in DB
      const { data: inserted, error: insertErr } = await supabase
        .from("contracts")
        .insert({
          user_id: user.id,
          tenant_id: profile.tenant_id,
          employment_type: profile.employment_type as any,
          generated_content: contentOverride ?? "",
          signed_name: signatureName.trim(),
          signature_image_url: signaturePath,
          signed_at: now,
          metadata: { signed_from: "portal" },
        } as any)
        .select("id")
        .single();
      if (insertErr) throw insertErr;

      // PDF im Hintergrund generieren
      supabase.functions.invoke("generate-contract-pdf", { body: { contractId: inserted.id } })
        .catch((e) => console.warn("PDF-Gen:", e));

      await supabase.from("profiles").update({
        contract_signed_at: now,
        signature_url: signaturePath || `text:${signatureName.trim()}`,
      }).eq("user_id", user.id);

      toast({ title: "Vertrag unterschrieben", description: "Willkommen im Team!" });
      // Neu laden
      const { data: contracts } = await supabase.from("contracts").select("*").eq("user_id", user.id).order("signed_at", { ascending: false }).limit(1);
      if (contracts && contracts.length > 0) setContract(contracts[0] as unknown as Contract);
    } catch (err: any) {
      toast({ title: "Vertrag konnte nicht gespeichert werden", description: translateDbError(err?.message), variant: "destructive" });
    } finally {
      setSigning(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!contract) return;
    setDownloading(true);
    try {
      // 1. PDF schon vorhanden? Direkt aus documents-Bucket laden
      if (contract.pdf_url) {
        const { data: signed, error } = await supabase.storage
          .from("documents")
          .createSignedUrl(contract.pdf_url, 60 * 5);
        if (!error && signed?.signedUrl) {
          window.open(signed.signedUrl, "_blank");
          return;
        }
      }

      // 2. Fallback: PDF jetzt generieren lassen
      const { data, error } = await supabase.functions.invoke("generate-contract-pdf", {
        body: { contractId: contract.id },
      });
      if (error) throw error;
      const path = (data as any)?.pdfPath;
      if (!path) throw new Error("PDF konnte nicht erstellt werden");

      setContract({ ...contract, pdf_url: path });
      const { data: signed, error: signErr } = await supabase.storage
        .from("documents")
        .createSignedUrl(path, 60 * 5);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Signed URL fehlgeschlagen");
      window.open(signed.signedUrl, "_blank");
    } catch (err: any) {
      toast({
        title: "Download fehlgeschlagen",
        description: err?.message ?? "Bitte später erneut versuchen.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  if (authLoading || loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (contract) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <h1 className="text-xl font-heading font-bold">Dein Arbeitsvertrag</h1>
              <p className="text-xs text-muted-foreground">{EMPLOYMENT_LABELS[contract.employment_type] ?? "Vertrag"}</p>
            </div>
          </div>
          <Badge className="bg-accent/15 text-accent">Unterzeichnet</Badge>
        </div>

        <Card className="border-accent/30">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="h-5 w-5 text-accent" />
              <div>
                <p className="font-semibold text-foreground">Vertrag unterzeichnet</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(contract.signed_at).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })} um {new Date(contract.signed_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
                </p>
                <p className="text-xs text-muted-foreground">Unterschrieben als: <strong>{contract.signed_name}</strong></p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-5 max-h-96 overflow-y-auto text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap font-mono">
              {contract.generated_content}
            </div>

            {contract.signature_image_url && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">Deine Unterschrift:</p>
                <img src={contract.signature_image_url} alt="Unterschrift" className="h-16 border rounded-lg p-2 bg-card" />
              </div>
            )}

            <Button className="w-full gap-2" onClick={handleDownloadPdf} disabled={downloading}>
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloading ? "PDF wird erstellt…" : "Vertrag als PDF herunterladen"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Noch kein Vertrag → Signing-Flow direkt im Portal
  if (!contract) {
    const fullName = profile?.full_name ?? "";
    const [first, ...rest] = fullName.split(" ");
    const lastName = rest.join(" ");
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-heading font-bold">Arbeitsvertrag unterschreiben</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <StepContract
              firstName={first ?? ""}
              lastName={lastName}
              street={profile?.street ?? ""}
              zipCode={profile?.zip_code ?? ""}
              city={profile?.city ?? ""}
              employmentType={profile?.employment_type ?? "minijob"}
              startDate={undefined}
              agreed={agreed}
              setAgreed={setAgreed}
              signatureName={signatureName}
              setSignatureName={setSignatureName}
              onNext={handleSignContract}
              onBack={() => navigate("/dashboard")}
              loading={signing}
              userId={user?.id ?? null}
              tenantId={profile?.tenant_id ?? null}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
      <Card>
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <CheckCircle2 className="h-10 w-10 text-accent mx-auto" />
          <h3 className="text-lg font-heading font-bold">Vertrag unterschrieben</h3>
          <p className="text-sm text-muted-foreground">Unterschrieben am {new Date(profile.contract_signed_at).toLocaleDateString("de-DE")}</p>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>Zum Dashboard</Button>
        </CardContent>
      </Card>
    </div>
  );
}
