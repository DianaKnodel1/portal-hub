import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/kyc")({
  component: AdminKycPage,
});

import { useState } from "react";
import { useAdminData, type KycRow } from "@/contexts/AdminDataContext";
import { KYC_STATUS_CONFIG, type KycStatus } from "@/lib/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, Eye, CheckCircle2, XCircle } from "lucide-react";
import { TableSkeleton, PageHeaderSkeleton } from "@/components/SkeletonLoaders";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/PaginationBar";

function AdminKycPage() {
  const { kycList, setKycList, profiles, setProfiles, loading, getProfileForUser } = useAdminData();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedKyc, setSelectedKyc] = useState<KycRow | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  const viewKycDocuments = async (kyc: KycRow) => {
    setSelectedKyc(kyc); setRejectionReason(kyc.rejection_reason ?? "");
    const urls: Record<string, string> = {};
    for (const field of ["id_front_url", "id_back_url", "selfie_url"] as const) {
      const path = kyc[field];
      if (path) {
        const { data } = await supabase.storage.from("kyc-documents").createSignedUrl(path, 600);
        if (data?.signedUrl) urls[field] = data.signedUrl;
      }
    }
    setDocUrls(urls);
  };

  const updateKycStatus = async (kycId: string, userId: string, newStatus: KycStatus, reason?: string) => {
    const { error } = await supabase.from("kyc_verifications").update({
      status: newStatus, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString(), rejection_reason: reason ?? null,
    }).eq("id", kycId);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: newStatus === "verifiziert" ? "✅ Verifizierung bestätigt" : "❌ Verifizierung abgelehnt", description: newStatus === "verifiziert" ? "Die Verifizierung wurde gespeichert." : "Der Mitarbeiter wurde benachrichtigt." });
    setKycList((prev) => prev.map((k) => (k.id === kycId ? { ...k, status: newStatus, rejection_reason: reason ?? k.rejection_reason } : k)));
    setSelectedKyc(null);
  };

  const filtered = kycList.filter((k) => {
    if (filterStatus && filterStatus !== "all" && k.status !== filterStatus) return false;
    if (search) {
      const profile = getProfileForUser(k.user_id);
      if (!profile?.full_name?.toLowerCase().includes(search.toLowerCase())) return false;
    }
    return true;
  });
  const { paged, page, setPage, pageCount, rangeFrom, rangeTo, total } = usePagination(filtered, 25);

  if (loading) return <div className="p-5 space-y-4"><PageHeaderSkeleton /><TableSkeleton rows={4} cols={4} /></div>;

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-heading font-bold text-foreground">Verifizierungen</h1>
          <p className="text-xs text-muted-foreground">{kycList.length} Einträge</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Alle Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="nicht_gestartet">Nicht gestartet</SelectItem>
              <SelectItem value="eingereicht">Eingereicht</SelectItem>
              <SelectItem value="in_pruefung">In Prüfung</SelectItem>
              <SelectItem value="verifiziert">Verifiziert</SelectItem>
              <SelectItem value="abgelehnt">Abgelehnt</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-8 text-sm" />
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Mitarbeiter</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Risiko</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paged.map((kyc) => {
              const profile = getProfileForUser(kyc.user_id);
              const cfg = KYC_STATUS_CONFIG[kyc.status];
              return (
                <tr key={kyc.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{profile?.full_name ?? "Unbekannt"}</td>
                  <td className="px-4 py-3"><Badge variant="secondary" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge></td>
                  <td className="px-4 py-3">{kyc.risk_flag && <AlertTriangle className="h-4 w-4 text-status-pending" />}</td>
                  <td className="px-4 py-3">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => viewKycDocuments(kyc)}>
                      <Eye className="h-3 w-3 mr-1" /> Prüfen
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-border bg-muted/20">
          <PaginationBar page={page} pageCount={pageCount} setPage={setPage} rangeFrom={rangeFrom} rangeTo={rangeTo} total={total} />
        </div>
      </div>

      <Dialog open={!!selectedKyc} onOpenChange={() => setSelectedKyc(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">KYC-Dokumente prüfen</DialogTitle></DialogHeader>
          {selectedKyc && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                {([{ label: "Ausweis Vorderseite", key: "id_front_url" }, { label: "Ausweis Rückseite", key: "id_back_url" }, { label: "Selfie", key: "selfie_url" }] as const).map((doc) => (
                  <div key={doc.key} className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{doc.label}</p>
                    {docUrls[doc.key] ? (
                      <img src={docUrls[doc.key]} alt={doc.label} className="w-full h-36 object-cover rounded-lg border border-border" />
                    ) : (
                      <div className="w-full h-36 rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center">
                        <p className="text-[11px] text-muted-foreground">Nicht hochgeladen</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {selectedKyc.risk_flag && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-status-pending/5 border border-status-pending/15">
                  <AlertTriangle className="h-4 w-4 text-status-pending" />
                  <p className="text-sm text-foreground font-medium">Erhöhte Prüfung erforderlich</p>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Ablehnungsgrund (optional)</label>
                <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Grund für die Ablehnung…" rows={2} />
              </div>
              <DialogFooter className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={() => updateKycStatus(selectedKyc.id, selectedKyc.user_id, "abgelehnt", rejectionReason)}>
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Ablehnen
                </Button>
                <Button size="sm" onClick={() => updateKycStatus(selectedKyc.id, selectedKyc.user_id, "verifiziert")}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Verifizieren
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
