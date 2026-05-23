import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/employees/$userId")({
  component: AdminEmployeeDetailPage,
});

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "@/lib/router-compat";
import { useAdminData, type EmployeeStatus, type KycRow } from "@/contexts/AdminDataContext";
import {
  STATUS_CONFIG, STATUS_ORDER, KYC_STATUS_CONFIG,
  ONBOARDING_STATUS_CONFIG, TASK_STATUS_CONFIG,
  TRANSACTION_STATUS_CONFIG,
  type KycStatus, type TaskAssignmentStatus, type TransactionStatus,
} from "@/lib/status";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft, User, ShieldCheck, FileText, ClipboardList, Wallet,
  AlertTriangle, CheckCircle2, XCircle, Plus, Trash2, StickyNote,
  Download, Eye, KeyRound, Loader2, Mail, Shield, Pencil, X, Check,
  MessageSquare, Phone, Power, FolderOpen, History,
} from "lucide-react";

interface ActivityLogEntry {
  id: string;
  action: string;
  actor_id: string;
  comment: string | null;
  old_status: string | null;
  new_status: string | null;
  created_at: string;
}

interface AdminNote {
  id: string;
  content: string;
  created_by: string;
  created_at: string;
}

function AdminEmployeeDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const {
    profiles, setProfiles, kycList, setKycList,
    assignments, templates, allTransactions, applications, adminUserIds, loading,
  } = useAdminData();

  const isAdminProfile = userId ? adminUserIds.has(userId) : false;

  const profile = profiles.find((p) => p.user_id === userId);
  const kyc = kycList.find((k) => k.user_id === userId);
  const userAssignments = assignments.filter((a) => a.user_id === userId);
  const userTransactions = allTransactions.filter((t) => t.user_id === userId);
  const totalEarnings = userTransactions.reduce((s, t) => s + Number(t.amount), 0);

  // Find linked application for email/phone
  const application = applications.find((a) => a.id === (profile as any)?.application_id);

  // Auth contact fallback (email + phone from auth.users)
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authPhone, setAuthPhone] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    (supabase.rpc as any)("admin_get_user_contact", { _user_id: userId })
      .then(({ data }: { data: Array<{ email: string | null; phone: string | null }> | null }) => {
        if (data && data[0]) {
          setAuthEmail(data[0].email ?? null);
          setAuthPhone(data[0].phone ?? null);
        }
      });
  }, [userId]);

  // Admin notes
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Documents
  const [documents, setDocuments] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // KYC docs
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [docsLoaded, setDocsLoaded] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(kyc?.rejection_reason ?? "");

  // Contract
  const [contractData, setContractData] = useState<any>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

  // Activity log
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});

  const loadActivityLog = useCallback(async () => {
    if (!userId) return;
    setActivityLoading(true);
    const { data } = await supabase
      .from("activity_log")
      .select("*")
      .eq("entity_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    const entries = (data as ActivityLogEntry[]) ?? [];
    setActivityLog(entries);

    const actorIds = Array.from(new Set(entries.map((e) => e.actor_id).filter(Boolean)));
    if (actorIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", actorIds);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { map[p.user_id] = p.full_name; });
      setActorNames(map);
    }
    setActivityLoading(false);
  }, [userId]);

  // Load notes
  const loadNotes = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("admin_notes")
      .select("*")
      .eq("profile_user_id", userId)
      .order("created_at", { ascending: false });
    setNotes((data as AdminNote[]) ?? []);
  }, [userId]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  // Load contract
  useEffect(() => {
    if (!userId) return;
    supabase.from("contracts").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) setContractData(data[0]); });
  }, [userId]);

  // Load signature (handle both storage path and full URL)
  useEffect(() => {
    const sig = (profile as any)?.signature_url;
    if (!sig) return;
    if (sig.startsWith("text:")) return;
    if (sig.startsWith("http")) { setSignatureUrl(sig); return; }
    // storage path → signed URL
    const path = sig.includes("/object/") ? sig.split("/signatures/")[1] : sig;
    supabase.storage.from("signatures").createSignedUrl(path, 3600)
      .then(({ data }) => { if (data?.signedUrl) setSignatureUrl(data.signedUrl); });
  }, [profile]);

  // Download contract as text file
  const downloadContract = () => {
    if (!contractData) return;
    const blob = new Blob([contractData.generated_content || ""], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Arbeitsvertrag_${profile?.full_name || "Mitarbeiter"}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const updateStatus = async (newStatus: EmployeeStatus) => {
    if (!userId) return;
    const { error } = await supabase.from("profiles").update({ status: newStatus }).eq("user_id", userId);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Status aktualisiert" });
    setProfiles((prev) => prev.map((p) => (p.user_id === userId ? { ...p, status: newStatus } : p)));
  };

  const addNote = async () => {
    if (!userId || !user || !newNote.trim()) return;
    setSavingNote(true);
    const { error } = await supabase.from("admin_notes").insert({
      profile_user_id: userId, content: newNote.trim(), created_by: user.id,
    });
    if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
    else { setNewNote(""); await loadNotes(); toast({ title: "Notiz gespeichert" }); }
    setSavingNote(false);
  };

  const deleteNote = async (noteId: string) => {
    const { error } = await supabase.from("admin_notes").delete().eq("id", noteId);
    if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
    else { await loadNotes(); toast({ title: "Notiz gelöscht" }); }
  };

  const updateNote = async (noteId: string) => {
    if (!editingContent.trim()) return;
    setSavingNote(true);
    const { error } = await supabase.from("admin_notes").update({ content: editingContent.trim() }).eq("id", noteId);
    if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
    else { setEditingNoteId(null); setEditingContent(""); await loadNotes(); toast({ title: "Notiz aktualisiert" }); }
    setSavingNote(false);
  };

  const loadKycDocs = async () => {
    if (!kyc || docsLoaded) return;
    const urls: Record<string, string> = {};
    for (const field of ["id_front_url", "id_back_url", "selfie_url"] as const) {
      const path = kyc[field];
      if (path) {
        const { data } = await supabase.storage.from("kyc-documents").createSignedUrl(path, 600);
        if (data?.signedUrl) urls[field] = data.signedUrl;
      }
    }
    setDocUrls(urls);
    setDocsLoaded(true);
  };

  const updateKycStatus = async (newStatus: KycStatus, reason?: string) => {
    if (!kyc || !userId) return;
    const { error } = await supabase.from("kyc_verifications").update({
      status: newStatus, reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(), rejection_reason: reason ?? null,
    }).eq("id", kyc.id);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: `KYC ${newStatus === "verifiziert" ? "genehmigt" : newStatus === "abgelehnt" ? "abgelehnt" : "aktualisiert"}` });
    setKycList((prev) => prev.map((k) => (k.id === kyc.id ? { ...k, status: newStatus, rejection_reason: reason ?? k.rejection_reason } : k)));
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Laden…</div>;
  if (!profile) return (
    <div className="p-5">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/employees")}><ArrowLeft className="h-4 w-4 mr-1" /> Zurück</Button>
      <p className="text-sm text-muted-foreground mt-4">Mitarbeiter nicht gefunden.</p>
    </div>
  );

  const kycCfg = kyc ? KYC_STATUS_CONFIG[kyc.status] : null;
  const statusCfg = STATUS_CONFIG[profile.status];

  // Derive first/last name
  const firstName = application?.first_name || profile.full_name.split(" ")[0] || "—";
  const lastName = application?.last_name || profile.full_name.split(" ").slice(1).join(" ") || "—";
  const email = application?.email || authEmail || "—";
  const phone = (profile as any).phone || application?.phone || authPhone || "—";
  const birthDate = profile.birth_date || (application?.birth_date ?? null);
  const birthPlace = (profile as any).birth_place || application?.birth_place || "—";
  const nationality = (profile as any).nationality || application?.nationality || "—";

  return (
    <div className="p-5 space-y-5">
      {/* Back + Header */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/employees")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Zurück
      </Button>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-heading font-bold text-foreground">{profile.full_name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {isAdminProfile && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-primary/90 text-primary-foreground gap-0.5">
                  <Shield className="h-2.5 w-2.5" /> Administrator
                </Badge>
              )}
              <Badge variant="secondary" className={`text-[10px] ${statusCfg.color}`}>{statusCfg.label}</Badge>
              <span className="text-[11px] text-muted-foreground">seit {new Date(profile.created_at).toLocaleDateString("de-DE")}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={profile.status} onValueChange={(val) => updateStatus(val as EmployeeStatus)}>
            <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_ORDER.map((s) => (<SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>))}</SelectContent>
          </Select>
          <PasswordResetButton email={email} />
          {!isAdminProfile && (
            <DeleteEmployeeButton userId={userId!} fullName={profile.full_name} onDeleted={() => navigate("/admin/employees")} />
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="personal"><User className="h-3.5 w-3.5 mr-1" /> Daten</TabsTrigger>
          <TabsTrigger value="kyc" onClick={loadKycDocs}><ShieldCheck className="h-3.5 w-3.5 mr-1" /> Verifizierung</TabsTrigger>
          <TabsTrigger value="contract"><FileText className="h-3.5 w-3.5 mr-1" /> Vertrag</TabsTrigger>
          <TabsTrigger value="documents"><FolderOpen className="h-3.5 w-3.5 mr-1" /> Dokumente</TabsTrigger>
          <TabsTrigger value="tasks"><ClipboardList className="h-3.5 w-3.5 mr-1" /> Aufgaben</TabsTrigger>
          <TabsTrigger value="sms"><MessageSquare className="h-3.5 w-3.5 mr-1" /> SMS</TabsTrigger>
          <TabsTrigger value="earnings"><Wallet className="h-3.5 w-3.5 mr-1" /> Einnahmen</TabsTrigger>
          <TabsTrigger value="notes"><StickyNote className="h-3.5 w-3.5 mr-1" /> Notizen</TabsTrigger>
          <TabsTrigger value="history" onClick={loadActivityLog}><History className="h-3.5 w-3.5 mr-1" /> Verlauf</TabsTrigger>
        </TabsList>

        {/* ───── A) Persönliche Daten ───── */}
        <TabsContent value="personal">
          <Card>
            <CardContent className="pt-5 pb-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Persönliche Daten</p>
              <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                <InfoRow label="Vorname" value={firstName} />
                <InfoRow label="Nachname" value={lastName} />
                <InfoRow label="E-Mail" value={email} />
                <InfoRow label="Telefon" value={phone} />
                <InfoRow label="Straße" value={(profile as any).street || "—"} />
                <InfoRow label="PLZ" value={(profile as any).zip_code || "—"} />
                <InfoRow label="Stadt" value={(profile as any).city || "—"} />
                <InfoRow label="Geburtsdatum" value={birthDate ? new Date(birthDate).toLocaleDateString("de-DE") : "—"} />
                <InfoRow label="Geburtsort" value={birthPlace} />
                <InfoRow label="Staatsangehörigkeit" value={nationality} />
              <InfoRow label="Wohnhaft seit" value={profile.living_since ? new Date(profile.living_since).toLocaleDateString("de-DE") : "—"} />
              {(profile as any).previous_address && (
                <InfoRow label="Vorherige Adresse" value={(profile as any).previous_address} />
              )}
              <EmploymentTypeRow
                userId={userId!}
                value={(profile as any).employment_type ?? null}
                onChange={(v) => setProfiles((prev) => prev.map((p) => (p.user_id === userId ? ({ ...p, employment_type: v } as any) : p)))}
              />
                <InfoRow label="Steuer-Nr." value={(profile as any).tax_number || "—"} />
                <InfoRow label="SV-Nr." value={(profile as any).social_security_number || "—"} />
                <InfoRow label="IBAN" value={(profile as any).iban || "—"} />
              </div>
              {profile.living_since && new Date(profile.living_since) > new Date(new Date().setFullYear(new Date().getFullYear() - 3)) && (
                <div className="flex items-center gap-1.5 text-status-pending mt-4">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-medium">Wohnhaft seit weniger als 3 Jahren — erhöhte Prüfung</span>
                </div>
              )}
              {/* Teamleiter */}
              <div className="mt-5 pt-4 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Teamleiter</p>
                <TeamLeaderSelect
                  currentLeaderId={(profile as any).team_leader_id}
                  userId={userId!}
                  onUpdate={(newId) => setProfiles((prev) => prev.map((p) => (p.user_id === userId ? { ...p, team_leader_id: newId } as any : p)))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── B) Verifizierung / KYC ───── */}
        <TabsContent value="kyc">
          <Card>
            <CardContent className="pt-5 pb-5 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">KYC-Dokumente</p>
                {kycCfg && <Badge variant="secondary" className={`text-[10px] ${kycCfg.color}`}>{kycCfg.label}</Badge>}
              </div>

              {!kyc ? (
                <p className="text-sm text-muted-foreground">Noch keine Verifizierung gestartet.</p>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {([
                      { label: "Ausweis Vorderseite", key: "id_front_url" as const },
                      { label: "Ausweis Rückseite", key: "id_back_url" as const },
                      { label: "Selfie", key: "selfie_url" as const },
                    ]).map((doc) => (
                      <div key={doc.key} className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">{doc.label}</p>
                        {docUrls[doc.key] ? (
                          <a href={docUrls[doc.key]} target="_blank" rel="noopener noreferrer" className="block">
                            <img src={docUrls[doc.key]} alt={doc.label} className="w-full h-40 object-cover rounded-lg border border-border hover:opacity-90 transition-opacity cursor-pointer" />
                          </a>
                        ) : kyc[doc.key] ? (
                          <div className="w-full h-40 rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center animate-pulse">
                            <p className="text-[11px] text-muted-foreground">Wird geladen…</p>
                          </div>
                        ) : (
                          <div className="w-full h-40 rounded-lg border border-dashed border-destructive/30 bg-destructive/5 flex items-center justify-center">
                            <p className="text-[11px] text-destructive">Nicht hochgeladen</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {kyc.risk_flag && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-status-pending/5 border border-status-pending/15">
                      <AlertTriangle className="h-4 w-4 text-status-pending" />
                      <p className="text-sm text-foreground font-medium">Erhöhte Prüfung erforderlich</p>
                    </div>
                  )}

                  {kyc.rejection_reason && (
                    <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/15">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Ablehnungsgrund</p>
                      <p className="text-sm text-foreground">{kyc.rejection_reason}</p>
                    </div>
                  )}

                  {kyc.status !== "verifiziert" && (
                    <div className="space-y-3 pt-3 border-t border-border">
                      <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Ablehnungsgrund (optional)…" rows={2} />
                      <div className="flex gap-2">
                        <Button variant="destructive" size="sm" onClick={() => updateKycStatus("abgelehnt", rejectionReason)}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Ablehnen
                        </Button>
                        <Button size="sm" onClick={() => updateKycStatus("verifiziert")}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Verifizieren
                        </Button>
                      </div>
                    </div>
                  )}

                  {kyc.status === "verifiziert" && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/5 border border-accent/15">
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                      <span className="text-sm text-foreground">Verifizierung abgeschlossen</span>
                      {kyc.reviewed_at && <span className="text-xs text-muted-foreground ml-auto">{new Date(kyc.reviewed_at).toLocaleDateString("de-DE")}</span>}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── C) Vertrag & Onboarding ───── */}
        <TabsContent value="contract">
          <Card>
            <CardContent className="pt-5 pb-5 space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vertrag & Onboarding</p>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoRow label="Vertragsstatus" value={profile.contract_signed_at ? "Unterschrieben" : "Offen"} />
                {profile.contract_signed_at && (
                  <InfoRow label="Unterschrieben am" value={new Date(profile.contract_signed_at).toLocaleDateString("de-DE")} />
                )}
                <InfoRow label="Onboarding" value={ONBOARDING_STATUS_CONFIG[profile.onboarding_status].label} />
              </div>


              {/* Contract PDF / Content */}
              {contractData ? (
                <div className="pt-3 border-t border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Vertragsdokument</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={downloadContract}>
                        <Download className="h-3 w-3" /> Herunterladen (.txt)
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={async () => {
                        try {
                          let path = contractData.pdf_url as string | null;
                          if (!path) {
                            const { data, error } = await supabase.functions.invoke("generate-contract-pdf", { body: { contractId: contractData.id } });
                            if (error) throw error;
                            path = (data as any)?.pdfPath;
                            if (!path) throw new Error("PDF konnte nicht erstellt werden");
                            setContractData({ ...contractData, pdf_url: path });
                          }
                          const { data: signed, error: sErr } = await supabase.storage.from("documents").createSignedUrl(path, 300);
                          if (sErr || !signed?.signedUrl) throw sErr ?? new Error("Signed URL fehlgeschlagen");
                          window.open(signed.signedUrl, "_blank");
                        } catch (err: any) {
                          toast({ title: "PDF-Download fehlgeschlagen", description: err?.message ?? "Bitte erneut versuchen.", variant: "destructive" });
                        }
                      }}>
                        <Download className="h-3 w-3" /> PDF
                      </Button>
                    </div>
                  </div>
                  {contractData.generated_content && (
                    <div className="max-h-64 overflow-y-auto border border-border rounded-lg p-4 bg-muted/20 text-xs leading-relaxed whitespace-pre-wrap font-mono">
                      {contractData.generated_content}
                    </div>
                  )}
                  {signatureUrl && (
                    <div className="pt-2">
                      <p className="text-xs text-muted-foreground mb-1">Mitarbeiter-Unterschrift</p>
                      <img src={signatureUrl} alt="Unterschrift" className="h-20 border border-border rounded bg-card p-2" />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Noch kein Vertrag vorhanden.</p>
              )}

              {!profile.contract_signed_at && (
                <div className="flex items-center gap-1.5 text-status-pending">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-medium">Vertrag noch nicht unterschrieben</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── C2) Dokumente ───── */}
        <TabsContent value="documents">
          <DocumentsTab userId={userId!} />
        </TabsContent>

        {/* ───── D) Aufgaben ───── */}
        <TabsContent value="tasks">
          <Card>
            <CardContent className="pt-5 pb-5">
              {(() => {
                const DONE = new Set(["abgeschlossen", "genehmigt", "abgelehnt"]);
                const active = userAssignments.filter((a) => !DONE.has(a.status));
                const past = userAssignments.filter((a) => DONE.has(a.status));
                const renderRow = (a: typeof userAssignments[number]) => {
                  const tpl = templates.find((t) => t.id === a.task_template_id);
                  const sCfg = TASK_STATUS_CONFIG[a.status as TaskAssignmentStatus];
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between py-2.5 border-b border-border last:border-0 hover:bg-muted/20 -mx-2 px-2 rounded cursor-pointer"
                      onClick={() => navigate(`/admin/assignments/${a.id}`)}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-foreground truncate">{tpl?.title ?? "Aufgabe"}</span>
                          {tpl && <span className="text-xs text-muted-foreground">{Number(tpl.compensation).toFixed(2)} €</span>}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Zugewiesen: {new Date(a.created_at).toLocaleDateString("de-DE")}
                        </p>
                      </div>
                      <Badge variant="secondary" className={`text-[10px] ${sCfg?.color ?? ""}`}>
                        {sCfg?.label ?? a.status}
                      </Badge>
                    </div>
                  );
                };
                return (
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Aktive Aufträge ({active.length})
                      </p>
                      {active.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Keine aktiven Aufträge.</p>
                      ) : (
                        <div>{active.map(renderRow)}</div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Vergangene Aufträge ({past.length})
                      </p>
                      {past.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Noch keine abgeschlossenen Aufträge.</p>
                      ) : (
                        <div className="opacity-80">{past.map(renderRow)}</div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── D2) SMS ───── */}
        <TabsContent value="sms">
          <SmsTab userId={userId!} />
        </TabsContent>

        <TabsContent value="earnings">
          <Card>
            <CardContent className="pt-5 pb-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Einnahmen</p>
              <p className="text-2xl font-bold font-heading text-foreground">{totalEarnings.toFixed(2)} €</p>
              {userTransactions.length > 0 && (
                <div className="space-y-1.5 mt-4">
                  {userTransactions.map((t) => {
                    const tCfg = TRANSACTION_STATUS_CONFIG[t.status as TransactionStatus];
                    return (
                      <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-xs">
                        <span className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString("de-DE")}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className={`text-[10px] ${tCfg?.color ?? ""}`}>{tCfg?.label ?? t.status}</Badge>
                          <span className="font-medium text-foreground">{Number(t.amount).toFixed(2)} €</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── F) Notizen (Historie) ───── */}
        <TabsContent value="notes">
          <Card>
            <CardContent className="pt-5 pb-5 space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Interne Notizen</p>

              {/* Add note */}
              <div className="space-y-2">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Neue Notiz hinzufügen…"
                  rows={3}
                />
                <Button size="sm" onClick={addNote} disabled={savingNote || !newNote.trim()}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> {savingNote ? "Speichern…" : "Notiz hinzufügen"}
                </Button>
              </div>

              {/* Note list */}
              {notes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Noch keine Notizen vorhanden.</p>
              ) : (
                <div className="space-y-2 pt-2 border-t border-border">
                  {notes.map((note) => (
                    <div key={note.id} className="p-3 rounded-lg bg-muted/30 border border-border">
                      {editingNoteId === note.id ? (
                        <div className="space-y-2">
                          <Textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} rows={3} />
                          <div className="flex gap-1.5">
                            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => updateNote(note.id)} disabled={savingNote}>
                              <Check className="h-3 w-3" /> Speichern
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setEditingNoteId(null)}>
                              <X className="h-3 w-3" /> Abbrechen
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {new Date(note.created_at).toLocaleDateString("de-DE")} — {new Date(note.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <div className="flex gap-0.5 shrink-0">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => { setEditingNoteId(note.id); setEditingContent(note.content); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteNote(note.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── Verlauf / Audit-Log ───── */}
        <TabsContent value="history">
          <Card>
            <CardContent className="pt-5 pb-5 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Verlauf</p>
              {activityLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lade Verlauf…
                </div>
              ) : activityLog.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">Keine Aktivitäten vorhanden.</p>
              ) : (
                <ol className="relative border-l border-border pl-5 space-y-3">
                  {activityLog.map((entry) => (
                    <li key={entry.id} className="relative">
                      <span className="absolute -left-[26px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                      <div className="text-xs">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-medium text-foreground">{entry.action.replace(/_/g, " ")}</span>
                          <span className="text-muted-foreground">
                            {new Date(entry.created_at).toLocaleString("de-DE")}
                          </span>
                        </div>
                        {entry.comment && (
                          <p className="text-muted-foreground mt-0.5">{entry.comment}</p>
                        )}
                        {(entry.old_status || entry.new_status) && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {entry.old_status ?? "–"} → <span className="text-foreground">{entry.new_status ?? "–"}</span>
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          von {actorNames[entry.actor_id] || (entry.actor_id === userId ? profile?.full_name ?? "Mitarbeiter" : "System")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start text-xs py-1">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground font-medium text-right ml-4 break-words">{value}</span>
    </div>
  );
}

function EmploymentTypeRow({ userId, value, onChange }: { userId: string; value: string | null; onChange: (v: string) => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const save = async (val: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ employment_type: val as any } as any)
      .eq("user_id", userId);
    setSaving(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    onChange(val);
    toast({ title: "Beschäftigungsart aktualisiert" });
  };

  return (
    <div className="flex justify-between items-center text-xs py-1 gap-3">
      <span className="text-muted-foreground shrink-0">Beschäftigungsart</span>
      <Select value={value ?? ""} onValueChange={save} disabled={saving}>
        <SelectTrigger className="h-7 text-xs w-[140px]">
          <SelectValue placeholder="Nicht gesetzt" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="minijob">Minijob</SelectItem>
          <SelectItem value="teilzeit">Teilzeit</SelectItem>
          <SelectItem value="vollzeit">Vollzeit</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function TeamLeaderSelect({ currentLeaderId, userId, onUpdate }: { currentLeaderId: string | null; userId: string; onUpdate: (id: string | null) => void }) {
  const { toast } = useToast();
  const { profiles } = useAdminData();
  const [leaderId, setLeaderId] = useState(currentLeaderId ?? "none");
  const [saving, setSaving] = useState(false);

  const candidates = profiles.filter((p) => p.user_id !== userId);

  const save = async (val: string) => {
    setLeaderId(val);
    setSaving(true);
    const newId = val === "none" ? null : val;
    const { error } = await supabase.from("profiles").update({ team_leader_id: newId } as any).eq("user_id", userId);
    if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
    else { toast({ title: "Teamleiter aktualisiert" }); onUpdate(newId); }
    setSaving(false);
  };

  return (
    <Select value={leaderId} onValueChange={save} disabled={saving}>
      <SelectTrigger className="h-8 text-xs w-64"><SelectValue placeholder="Teamleiter wählen" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Kein Teamleiter</SelectItem>
        {candidates.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function PasswordResetButton({ email }: { email: string }) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const sendReset = async () => {
    if (!email || email === "—") {
      toast({ title: "Fehler", description: "Keine E-Mail-Adresse hinterlegt.", variant: "destructive" });
      return;
    }
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Reset-Mail gesendet", description: `An ${email}` });
    }
  };

  return (
    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={sendReset} disabled={sending}>
      {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <KeyRound className="h-3 w-3" />}
      Passwort zurücksetzen
    </Button>
  );
}

function DeleteEmployeeButton({ userId, fullName, onDeleted }: { userId: string; fullName: string; onDeleted: () => void }) {
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    // Set status to deaktiviert (logical delete)
    const { error } = await supabase.from("profiles").update({ status: "deaktiviert" as any }).eq("user_id", userId);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      setDeleting(false);
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("activity_log").insert({
          action: "mitarbeiter_geloescht", entity_type: "profile", entity_id: userId,
          actor_id: user.id, comment: `Mitarbeiter ${fullName} gelöscht/deaktiviert.`,
          new_status: "deaktiviert",
        });
      }
    } catch {}
    toast({ title: "Mitarbeiter deaktiviert", description: `${fullName} wurde deaktiviert.` });
    setDeleting(false);
    setConfirming(false);
    onDeleted();
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-destructive">Wirklich löschen?</span>
        <Button variant="destructive" size="sm" className="h-7 text-[10px] gap-1" onClick={handleDelete} disabled={deleting}>
          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Ja, löschen
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setConfirming(false)}>Abbrechen</Button>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive" onClick={() => setConfirming(true)}>
      <Trash2 className="h-3 w-3" /> Löschen
    </Button>
  );
}

function SmsTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [assignRes, channelRes, msgRes] = await Promise.all([
        supabase.from("sms_assignments").select("*").eq("user_id", userId),
        supabase.from("sms_channels").select("id, phone_number, label, is_active, provider"),
        supabase.from("sms_messages").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      ]);
      setAssignments(assignRes.data ?? []);
      setChannels(channelRes.data ?? []);
      setMessages(msgRes.data ?? []);
      setLoading(false);
    };
    load();
  }, [userId]);

  const assignedChannelIds = new Set(assignments.filter((a) => a.is_active).map((a) => a.sms_channel_id));

  const assignChannel = async (channelId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("sms_assignments").insert({
      user_id: userId, sms_channel_id: channelId, assigned_by: user.id, is_active: true,
    });
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: "SMS-Nummer zugewiesen" });
    setAssignments((prev) => [...prev, { user_id: userId, sms_channel_id: channelId, is_active: true }]);
  };

  const removeAssignment = async (channelId: string) => {
    const { error } = await supabase.from("sms_assignments").update({ is_active: false })
      .eq("user_id", userId).eq("sms_channel_id", channelId);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Zuweisung entfernt" });
    setAssignments((prev) => prev.map((a) => a.sms_channel_id === channelId ? { ...a, is_active: false } : a));
  };

  if (loading) return <div className="p-4 text-sm text-muted-foreground animate-pulse">Laden…</div>;

  return (
    <Card>
      <CardContent className="pt-5 pb-5 space-y-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">SMS-Nummern</p>

        {/* Assigned channels */}
        {channels.filter((c) => assignedChannelIds.has(c.id)).length > 0 ? (
          <div className="space-y-2">
            {channels.filter((c) => assignedChannelIds.has(c.id)).map((ch) => (
              <div key={ch.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/5 border border-accent/15">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-accent" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{ch.phone_number}</p>
                    <p className="text-[10px] text-muted-foreground">{ch.label || ch.provider}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => removeAssignment(ch.id)}>
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Entfernen
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Keine SMS-Nummer zugewiesen.</p>
        )}

        {/* Available channels to assign */}
        {channels.filter((c) => c.is_active && !assignedChannelIds.has(c.id)).length > 0 && (
          <div className="pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Verfügbare Nummern</p>
            <div className="flex flex-wrap gap-2">
              {channels.filter((c) => c.is_active && !assignedChannelIds.has(c.id)).map((ch) => (
                <Button key={ch.id} variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => assignChannel(ch.id)}>
                  <Plus className="h-3 w-3" /> {ch.phone_number}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Recent messages */}
        {messages.length > 0 && (
          <div className="pt-3 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Letzte SMS ({messages.length})</p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {messages.map((m) => (
                <div key={m.id} className="flex items-start justify-between py-2 border-b border-border last:border-0 text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground truncate">{m.body}</p>
                    <p className="text-[10px] text-muted-foreground">{m.from_number} → {m.to_number}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                    {new Date(m.created_at).toLocaleDateString("de-DE")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Documents Tab Component
function DocumentsTab({ userId }: { userId: string }) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [taskSubmissions, setTaskSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDocuments();
  }, [userId]);

  const loadDocuments = async () => {
    setLoading(true);
    // Load regular documents
    const { data: docs } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    
    // Get user's assignment IDs first
    const { data: userAssignmentsData } = await supabase
      .from("task_assignments")
      .select("id")
      .eq("user_id", userId);
    
    const assignmentIds = userAssignmentsData?.map(a => a.id) || [];
    
    // Load task submissions with files
    let submissions: any[] = [];
    if (assignmentIds.length > 0) {
      const { data: subs } = await supabase
        .from("task_submissions")
        .select("*, task_assignments!inner(task_template_id, task_templates!inner(title))")
        .in("assignment_id", assignmentIds)
        .order("submitted_at", { ascending: false });
      submissions = subs || [];
    }
    
    setDocuments(docs ?? []);
    setTaskSubmissions(submissions);
    setLoading(false);
  };

  const getSignedUrl = async (path: string, bucket: string) => {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
    return data?.signedUrl;
  };

  const downloadFile = async (path: string, bucket: string, fileName: string) => {
    const url = await getSignedUrl(path, bucket);
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
    }
  };

  const allDocs = [
    ...(documents.map(d => ({ ...d, type: "document", sortDate: d.created_at }))),
    ...(taskSubmissions.flatMap(s => 
      (s.file_urls || []).map((url: string, idx: number) => ({
        id: `${s.id}-${idx}`,
        file_name: `Aufgabe: ${s.task_assignments?.task_templates?.title || "Unbekannt"} #${idx + 1}`,
        file_url: url,
        category: "auftrag",
        created_at: s.submitted_at,
        type: "submission",
        sortDate: s.submitted_at,
        notes: s.notes,
      }))
    ))
  ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-5 pb-5">
          <p className="text-sm text-muted-foreground animate-pulse">Lade Dokumente…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Alle Dokumente ({allDocs.length})</p>
        </div>
        
        {allDocs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Dokumente vorhanden.</p>
        ) : (
          <div className="space-y-2">
            {allDocs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {doc.category === "identitaet" ? "Identität" : 
                       doc.category === "auftrag" ? "Auftrag" : "Sonstiges"} • {new Date(doc.created_at).toLocaleDateString("de-DE")}
                    </p>
                    {doc.notes && <p className="text-[11px] text-muted-foreground mt-1 italic">{doc.notes}</p>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs gap-1"
                    onClick={() => window.open(doc.file_url, "_blank")}
                  >
                    <Eye className="h-3.5 w-3.5" /> Ansehen
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
