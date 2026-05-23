import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_employee/documents")({
  component: DocumentsPage,
});

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle2, XCircle, Clock, Plus, Image as ImageIcon, Download, ClipboardList, FolderOpen } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { replacePlaceholders, generateFallbackContract, formatGermanDate } from "@/lib/contract-utils";

const CATEGORY_LABELS: Record<string, string> = {
  identitaet: "Identität",
  auftrag: "Auftrag",
  sonstiges: "Sonstiges",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  hochgeladen: { label: "Hochgeladen", color: "bg-status-pending text-status-pending-foreground", icon: Clock },
  geprueft:    { label: "Geprüft",     color: "bg-status-success text-status-success-foreground", icon: CheckCircle2 },
  abgelehnt:   { label: "Abgelehnt",   color: "bg-destructive text-destructive-foreground",       icon: XCircle },
};

interface Doc {
  id: string;
  category: string;
  file_url: string;
  file_name: string;
  status: string;
  notes: string | null;
  created_at: string;
}

interface SubmissionFile {
  id: string;
  assignment_id: string;
  file_url: string;
  task_title: string;
  submitted_at: string;
  review_status: string | null;
}

const isImage = (name: string) => /\.(jpe?g|png|webp|gif|heic|bmp)$/i.test(name);

function DocumentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [submissionFiles, setSubmissionFiles] = useState<SubmissionFile[]>([]);
  const [contract, setContract] = useState<{ id: string; signed_at: string; generated_content: string; signature_image_url: string | null; employment_type: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [category, setCategory] = useState("sonstiges");
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    const [docsRes, subsRes, contractRes] = await Promise.all([
      supabase
        .from("documents")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("task_submissions")
        .select("id, assignment_id, file_urls, submitted_at, review_status, task_assignments!inner(user_id, task_templates(title))")
        .eq("task_assignments.user_id", user!.id)
        .order("submitted_at", { ascending: false }),
      supabase
        .from("contracts")
        .select("id, signed_at, generated_content, signature_image_url, employment_type")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setDocs((docsRes.data as any[]) ?? []);
    setContract((contractRes.data as any) ?? null);

    const flat: SubmissionFile[] = [];
    ((subsRes.data as any[]) ?? []).forEach((s) => {
      const title = s.task_assignments?.task_templates?.title ?? "Auftrag";
      (s.file_urls ?? []).forEach((url: string, idx: number) => {
        flat.push({
          id: `${s.id}-${idx}`,
          assignment_id: s.assignment_id,
          file_url: url,
          task_title: title,
          submitted_at: s.submitted_at,
          review_status: s.review_status,
        });
      });
    });
    setSubmissionFiles(flat);
    setLoading(false);
  };

  const downloadContract = async () => {
    if (!contract || !user) return;
    try {
      // 1) Vertragsinhalt: gespeicherter Text → sonst Vorlage → sonst Fallback
      let body = (contract.generated_content || "").trim();

      // Profil + Tenant + (optional) aktive Vorlage parallel laden
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, address, street, zip_code, city, employment_start_date, tenant_id, employment_type")
        .eq("user_id", user.id)
        .maybeSingle();

      const tenantId = profile?.tenant_id ?? null;
      const empType = (contract.employment_type as string) || profile?.employment_type || "minijob";

      const [tenantRes, templateRes] = await Promise.all([
        tenantId
          ? supabase.from("tenants").select("name, company_ceo_name, company_address, company_city").eq("id", tenantId).maybeSingle()
          : Promise.resolve({ data: null } as any),
        tenantId
          ? supabase
              .from("contract_templates")
              .select("content")
              .eq("tenant_id", tenantId)
              .eq("employment_type", empType as any)
              .eq("is_active", true)
              .order("version", { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);

      const fullName = profile?.full_name || "";
      const [firstName, ...rest] = fullName.split(" ");
      const lastName = rest.join(" ");
      const data = {
        firstName: firstName || "",
        lastName: lastName || "",
        address: profile?.address || profile?.street || "",
        city: [profile?.zip_code, profile?.city].filter(Boolean).join(" "),
        employmentType: empType,
        companyName: tenantRes?.data?.name || "",
        companyCeoName: tenantRes?.data?.company_ceo_name || "",
        startDate: formatGermanDate(profile?.employment_start_date),
      };

      if (!body) {
        body = templateRes?.data?.content
          ? replacePlaceholders(templateRes.data.content, data)
          : generateFallbackContract(data);
      }

      // Unterschrift auflösen (Pfad oder URL)
      let sigSrc: string | null = null;
      if (contract.signature_image_url) {
        if (/^https?:\/\//i.test(contract.signature_image_url)) {
          sigSrc = contract.signature_image_url;
        } else {
          const { data: sig } = await supabase.storage
            .from("signatures")
            .createSignedUrl(contract.signature_image_url, 300);
          sigSrc = sig?.signedUrl ?? null;
        }
      }

      const escaped = body.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Arbeitsvertrag</title>
<style>
@page{margin:18mm}
body{font-family:Georgia,serif;font-size:11pt;line-height:1.55;max-width:760px;margin:24px auto;padding:24px;color:#222}
h1{font-size:18pt;text-align:center;margin:0 0 24px}
pre{white-space:pre-wrap;font-family:Georgia,serif;font-size:11pt;margin:0}
.sig{margin-top:36px;border-top:1px solid #333;padding-top:14px}
.sig img{height:70px;display:block;margin-top:6px}
.footer{margin-top:24px;font-size:9pt;color:#666;text-align:center}
</style></head>
<body>
<h1>Arbeitsvertrag</h1>
<pre>${escaped}</pre>
<div class="sig">
  <p><strong>Datum:</strong> ${new Date(contract.signed_at).toLocaleDateString("de-DE")}</p>
  ${sigSrc ? `<p><strong>Unterschrift Arbeitnehmer:</strong></p><img src="${sigSrc}" alt="Unterschrift"/>` : ""}
</div>
<div class="footer">Dieses Dokument wurde digital unterzeichnet und ist rechtsgültig.</div>
<script>window.onload=function(){setTimeout(function(){window.print();},500);};</script>
</body></html>`;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err: any) {
      toast({ title: "Download fehlgeschlagen", description: err?.message ?? "Unbekannter Fehler", variant: "destructive" });
    }
  };

  const handleUpload = async () => {
    if (files.length === 0 || !user) return;
    setUploading(true);
    try {
      let success = 0;
      for (const f of files) {
        const compressed = await compressImage(f);
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${compressed.name}`;
        const { error: uploadErr } = await supabase.storage.from("documents").upload(path, compressed);
        if (uploadErr) throw uploadErr;

        const { error: insertErr } = await supabase.from("documents").insert({
          uploaded_by: user.id,
          user_id: user.id,
          category: category as any,
          file_url: path,
          file_name: f.name,
          notes: notes.trim() || null,
        } as any);
        if (insertErr) throw insertErr;
        success++;
      }

      toast({ title: success === 1 ? "Dokument hochgeladen" : `${success} Dokumente hochgeladen` });
      setFiles([]);
      setNotes("");
      setShowUpload(false);
      loadAll();
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const downloadDoc = async (path: string, name: string, bucket: "documents" | "task-submissions") => {
    try {
      // If a full URL was stored historically, just open it
      if (/^https?:\/\//i.test(path)) {
        window.open(path, "_blank");
        return;
      }
      // Strip accidental bucket prefix
      const clean = path.replace(new RegExp(`^${bucket}/`), "");
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(clean, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      toast({ title: "Download fehlgeschlagen", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-muted rounded" />
          <div className="h-32 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  const totalCount = docs.length + submissionFiles.length;

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">Dokumente</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Alle deine Dokumente und Auftragsdateien an einem Ort ({totalCount})
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowUpload(!showUpload)}>
          <Plus className="h-4 w-4" /> Hochladen
        </Button>
      </div>

      {showUpload && (
        <Card className="animate-fade-in">
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="identitaet">Identität</SelectItem>
                  <SelectItem value="auftrag">Auftrag</SelectItem>
                  <SelectItem value="sonstiges">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Datei</Label>
              <Input
                type="file"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              {files.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {files.length} {files.length === 1 ? "Datei" : "Dateien"} ausgewählt
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Notiz (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Kurze Beschreibung, damit das Dokument zugeordnet werden kann …"
                rows={3}
              />
            </div>
            <Button onClick={handleUpload} disabled={files.length === 0 || uploading} className="w-full gap-2">
              <Upload className="h-4 w-4" />
              {uploading ? "Wird hochgeladen…" : files.length > 1 ? `${files.length} Dokumente hochladen` : "Dokument hochladen"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Arbeitsvertrag */}
      {contract && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Arbeitsvertrag</p>
                <p className="text-[11px] text-muted-foreground">
                  Unterschrieben am {new Date(contract.signed_at).toLocaleDateString("de-DE")}
                </p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadContract}>
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="all" className="text-xs gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" /> Alle ({totalCount})
          </TabsTrigger>
          <TabsTrigger value="own" className="text-xs gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Eigene ({docs.length})
          </TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Aufträge ({submissionFiles.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-3">
          {totalCount === 0 ? (
            <EmptyState
              icon={FileText}
              title="Noch keine Dokumente"
              description="Hier siehst du alle eigenen Dokumente und Dateien aus deinen Aufträgen."
              actionLabel="Dokument hochladen"
              onAction={() => setShowUpload(true)}
            />
          ) : (
            <>
              {docs.map((doc) => (
                <DocCard key={doc.id} doc={doc} onDownload={() => downloadDoc(doc.file_url, doc.file_name, "documents")} />
              ))}
              {submissionFiles.map((s) => (
                <SubmissionCard key={s.id} sub={s} onDownload={() => downloadDoc(s.file_url, s.file_url.split("/").pop() || "Datei", "task-submissions")} />
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="own" className="mt-4 space-y-3">
          {docs.length === 0 ? (
            <EmptyState icon={FileText} title="Keine eigenen Dokumente" description="Lade dein erstes Dokument hoch." actionLabel="Hochladen" onAction={() => setShowUpload(true)} />
          ) : (
            docs.map((doc) => (
              <DocCard key={doc.id} doc={doc} onDownload={() => downloadDoc(doc.file_url, doc.file_name, "documents")} />
            ))
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4 space-y-3">
          {submissionFiles.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Keine Auftragsdateien" description="Sobald du Dateien zu Aufträgen einreichst, erscheinen sie hier." />
          ) : (
            submissionFiles.map((s) => (
              <SubmissionCard key={s.id} sub={s} onDownload={() => downloadDoc(s.file_url, s.file_url.split("/").pop() || "Datei", "task-submissions")} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DocCard({ doc, onDownload }: { doc: Doc; onDownload: () => void }) {
  const st = STATUS_CONFIG[doc.status] || STATUS_CONFIG.hochgeladen;
  const StIcon = st.icon;
  const Icon = isImage(doc.file_name) ? ImageIcon : FileText;
  return (
    <Card className="hover:border-primary/20 transition-colors">
      <CardContent className="py-4 px-5">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <Badge variant="secondary" className="text-[10px]">{CATEGORY_LABELS[doc.category]}</Badge>
              <span className="text-[10px] text-muted-foreground">
                {new Date(doc.created_at).toLocaleDateString("de-DE")}
              </span>
            </div>
            {doc.notes && <p className="text-xs text-muted-foreground mt-1">💬 {doc.notes}</p>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge className={`text-[10px] ${st.color} border-0 gap-1`}>
              <StIcon className="h-3 w-3" /> {st.label}
            </Badge>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onDownload} title="Herunterladen">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SubmissionCard({ sub, onDownload }: { sub: SubmissionFile; onDownload: () => void }) {
  const fileName = sub.file_url.split("/").pop() || "Datei";
  const Icon = isImage(fileName) ? ImageIcon : FileText;
  const reviewLabel =
    sub.review_status === "approved" ? { label: "Genehmigt", color: "bg-status-success text-status-success-foreground" } :
    sub.review_status === "rejected" ? { label: "Abgelehnt", color: "bg-destructive text-destructive-foreground" } :
                                       { label: "Eingereicht", color: "bg-status-info text-status-info-foreground" };
  return (
    <Card className="hover:border-primary/20 transition-colors">
      <CardContent className="py-4 px-5">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <Badge variant="secondary" className="text-[10px] gap-1">
                <ClipboardList className="h-2.5 w-2.5" /> {sub.task_title}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {new Date(sub.submitted_at).toLocaleDateString("de-DE")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge className={`text-[10px] ${reviewLabel.color} border-0`}>{reviewLabel.label}</Badge>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onDownload} title="Herunterladen">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
