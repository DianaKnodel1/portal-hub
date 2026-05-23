import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/team-leader-settings")({
  component: AdminTeamLeaderSettingsPage,
});

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Save, Upload, Trash2, Loader2 } from "lucide-react";
import { useAllTenants } from "@/hooks/use-tenant";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function AdminTeamLeaderSettingsPage() {
  const { toast } = useToast();
  const { tenants, loading: tenantsLoading } = useAllTenants();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [responseTime, setResponseTime] = useState("Antwortet in wenigen Minuten");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tenants.length > 0 && !selectedTenantId) {
      setSelectedTenantId(tenants[0].id);
      loadTenantData(tenants[0]);
    }
  }, [tenants]);

  const loadTenantData = (t: any) => {
    setName(t.team_leader_name || "");
    setTitle(t.team_leader_title || "");
    setIsOnline(t.team_leader_online ?? true);
    setResponseTime(t.team_leader_response_time || "Antwortet in wenigen Minuten");
    setAvatarUrl(t.team_leader_avatar_url || null);
  };

  const onAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedTenantId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Datei zu groß", description: "Max. 5 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    const compressed = await compressImage(file, { maxDim: 512, quality: 0.9 });
    const ext = compressed.name.split(".").pop() || "jpg";
    const path = `${selectedTenantId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("team-leader-avatars")
      .upload(path, compressed, { cacheControl: "3600", upsert: true, contentType: compressed.type });
    if (upErr) {
      toast({ title: "Upload fehlgeschlagen", description: upErr.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("team-leader-avatars").getPublicUrl(path);
    setAvatarUrl(pub.publicUrl);
    setUploading(false);
    toast({ title: "Bild hochgeladen", description: "Vergiss nicht zu speichern." });
  };

  const onTenantChange = (id: string) => {
    setSelectedTenantId(id);
    const t = tenants.find((t) => t.id === id);
    if (t) loadTenantData(t);
  };

  const save = async () => {
    if (!selectedTenantId) return;
    setSaving(true);
    const { error } = await supabase
      .from("tenants")
      .update({
        team_leader_name: name.trim() || "Teamleiter",
        team_leader_title: title.trim() || "Dein Ansprechpartner",
        team_leader_online: isOnline,
        team_leader_response_time: responseTime,
        team_leader_avatar_url: avatarUrl,
      } as any)
      .eq("id", selectedTenantId);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Gespeichert", description: "Teamleiter-Profil wurde aktualisiert." });
    }
    setSaving(false);
  };

  if (tenantsLoading) {
    return (
      <div className="p-6 flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground text-sm">Laden…</div>
      </div>
    );
  }

  const initials = (name || "T").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-heading font-bold text-foreground">Teamleiter-Profil</h1>
        <p className="text-sm text-muted-foreground mt-1">Einstellungen pro Tenant.</p>
      </div>

      {tenants.length > 1 && (
        <Select value={selectedTenantId || ""} onValueChange={onTenantChange}>
          <SelectTrigger><SelectValue placeholder="Tenant wählen" /></SelectTrigger>
          <SelectContent>
            {tenants.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Vorschau</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
            <div className="relative">
              <div className="h-12 w-12 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-primary">{initials}</span>
                )}
              </div>
              {isOnline && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-accent border-2 border-card" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{name || "Teamleiter"}</p>
              <p className="text-xs text-muted-foreground">{title || "Dein Ansprechpartner"}</p>
              {isOnline ? (
                <p className="text-[10px] text-accent">Online</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">{responseTime}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="inline-flex">
              <input type="file" accept="image/*" className="hidden" onChange={onAvatarSelected} disabled={uploading} />
              <span className={`inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-md border bg-background hover:bg-muted cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {avatarUrl ? "Bild ersetzen" : "Bild hochladen"}
              </span>
            </label>
            {avatarUrl && (
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-destructive" onClick={() => setAvatarUrl(null)}>
                <Trash2 className="h-3.5 w-3.5" /> Entfernen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Anzeigename</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Merle Semin" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Titel / Rolle</Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="z.B. Teamleiterin" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="responseTime">Antwortzeit-Text</Label>
            <Input id="responseTime" value={responseTime} onChange={e => setResponseTime(e.target.value)} placeholder="z.B. Antwortet in ~5 Min." />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <Label>Online-Status anzeigen</Label>
              <p className="text-xs text-muted-foreground">Mitarbeiter sehen den grünen Punkt.</p>
            </div>
            <Switch checked={isOnline} onCheckedChange={setIsOnline} />
          </div>

          <Button onClick={save} disabled={saving} className="w-full gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Speichern…" : "Profil speichern"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
