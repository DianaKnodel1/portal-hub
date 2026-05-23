import { createFileRoute } from "@tanstack/react-router";
import { fetchAll } from "@/lib/fetch-all";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton, PageHeaderSkeleton } from "@/components/SkeletonLoaders";
import { useToast } from "@/hooks/use-toast";
import { Mailbox, Plus, Trash2, ImageIcon, ExternalLink } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAdminData } from "@/contexts/AdminDataContext";
import { getAllEmployees } from "@/lib/employee-utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/post")({
  component: AdminPostPage,
});

interface PostEntry {
  id: string;
  vorgangsnummer: string;
  user_id: string | null;
  account: string;
  original_coupon: string;
  coupon_image_url: string | null;
  status: string;
  last_checked_at: string | null;
  created_at: string;
}

const STATUS_OPTIONS = ["eingegangen", "in_pruefung", "freigegeben", "abgelehnt"];

function statusColor(s: string) {
  switch (s) {
    case "freigegeben": return "bg-status-success text-status-success-foreground";
    case "abgelehnt": return "bg-destructive text-destructive-foreground";
    case "in_pruefung": return "bg-status-warning text-status-warning-foreground";
    default: return "bg-status-info text-status-info-foreground";
  }
}

function AdminPostPage() {
  const { profiles, adminUserIds } = useAdminData();
  const { toast } = useToast();
  const [entries, setEntries] = useState<PostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    vorgangsnummer: "",
    user_id: "",
    account: "",
    original_coupon: "",
    status: "eingegangen",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const employees = getAllEmployees(profiles, adminUserIds);
  const profileById = new Map(profiles.map((p) => [p.user_id, p]));

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAll<any>(() =>
        supabase.from("post_entries" as any).select("*").order("created_at", { ascending: false }),
      );
      setEntries(data);
    } catch (e: any) {
      toast({ title: "Fehler beim Laden", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /** Schlägt fortlaufende Vorgangsnummer im Format POST-YYYY-NNNN vor (basierend auf aktueller Anzahl). */
  const nextVorgangsnummer = () => {
    const year = new Date().getFullYear();
    const yearEntries = entries.filter((e) => e.vorgangsnummer.startsWith(`POST-${year}-`));
    const maxNum = yearEntries.reduce((max, e) => {
      const n = parseInt(e.vorgangsnummer.split("-")[2] ?? "0", 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    return `POST-${year}-${String(maxNum + 1).padStart(4, "0")}`;
  };

  const resetForm = () => {
    setForm({ vorgangsnummer: nextVorgangsnummer(), user_id: "", account: "", original_coupon: "", status: "eingegangen" });
    setImageFile(null);
  };

  const handleCreate = async () => {
    if (!form.vorgangsnummer.trim()) {
      toast({ title: "Vorgangsnummer erforderlich", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        const compressed = await compressImage(imageFile);
        const path = `post/${Date.now()}-${compressed.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(path, compressed, {
          contentType: compressed.type, upsert: false,
        });
        if (upErr) throw upErr;
        imageUrl = path;
      }
      const { error } = await supabase.from("post_entries" as any).insert({
        vorgangsnummer: form.vorgangsnummer.trim(),
        user_id: form.user_id || null,
        account: form.account,
        original_coupon: form.original_coupon,
        coupon_image_url: imageUrl,
        status: form.status,
      });
      if (error) throw error;
      toast({ title: "Eintrag angelegt" });
      setOpen(false);
      resetForm();
      load();
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkChecked = async (id: string) => {
    const { error } = await supabase.from("post_entries" as any)
      .update({ last_checked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
    else { toast({ title: "Als geprüft markiert" }); load(); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("post_entries" as any).delete().eq("id", id);
    if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
    else { toast({ title: "Gelöscht" }); load(); }
  };

  const openImage = async (path: string) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (loading) {
    return <div className="p-6 lg:p-8 space-y-5"><PageHeaderSkeleton /><TableSkeleton rows={5} cols={8} /></div>;
  }

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const emp = e.user_id ? profileById.get(e.user_id)?.full_name?.toLowerCase() ?? "" : "";
    return e.vorgangsnummer.toLowerCase().includes(q)
      || e.account.toLowerCase().includes(q)
      || e.original_coupon.toLowerCase().includes(q)
      || emp.includes(q);
  });

  return (
    <div className="p-6 lg:p-8 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-heading font-bold text-foreground">Post</h1>
            <Badge variant="outline" className="text-[10px] bg-status-warning/10 text-status-warning border-status-warning/30">
              Im Aufbau
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{entries.length} Einträge · Vorgangsnummern werden automatisch vergeben</p>
        </div>
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs h-9 text-sm"
          />
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setForm((f) => ({ ...f, vorgangsnummer: nextVorgangsnummer() })); else resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Neuer Eintrag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neuer Post-Eintrag</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Vorgangsnummer *</Label>
                  <Input
                    value={form.vorgangsnummer}
                    onChange={(e) => setForm({ ...form, vorgangsnummer: e.target.value })}
                    placeholder="POST-2026-0001"
                    className="font-mono text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">Automatisch vorgeschlagen – bei Bedarf überschreibbar.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Mitarbeiter</Label>
                  <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Mitarbeiter wählen…" /></SelectTrigger>
                    <SelectContent>
                      {employees.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Account</Label>
                  <Input value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Orig. Coupon</Label>
                  <Input value={form.original_coupon} onChange={(e) => setForm({ ...form, original_coupon: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Coupon Image</Label>
                  <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
                <Button onClick={handleCreate} disabled={saving}>{saving ? "Speichern…" : "Anlegen"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Mailbox} title="Keine Post-Einträge" description="Lege den ersten Eintrag an." />
      ) : (
        <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Vorgangsnummer","Mitarbeiter","Account","Orig. Coupon","Coupon Image","Status","Erstellt","Letzter Check","Aktionen"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((e) => {
                const emp = e.user_id ? profileById.get(e.user_id) : null;
                return (
                  <tr key={e.id} className="hover:bg-muted/20 group">
                    <td className="px-4 py-3 font-mono text-xs">{e.vorgangsnummer}</td>
                    <td className="px-4 py-3 text-foreground">{emp?.full_name || <span className="text-muted-foreground">–</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.account || "–"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{e.original_coupon || "–"}</td>
                    <td className="px-4 py-3">
                      {e.coupon_image_url ? (
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openImage(e.coupon_image_url!)}>
                          <ImageIcon className="h-3.5 w-3.5" /> Ansehen <ExternalLink className="h-3 w-3" />
                        </Button>
                      ) : <span className="text-muted-foreground text-xs">–</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={`text-[10px] ${statusColor(e.status)}`}>{e.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("de-DE")}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {e.last_checked_at ? new Date(e.last_checked_at).toLocaleString("de-DE") : "–"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1.5 items-center">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleMarkChecked(e.id)}>
                          Geprüft
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
                              <AlertDialogDescription>Vorgang {e.vorgangsnummer} wird unwiderruflich gelöscht.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDelete(e.id)}
                              >Löschen</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
