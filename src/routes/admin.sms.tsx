import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/sms")({
  component: AdminSmsPage,
});

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAssignableEmployees } from "@/lib/employee-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAdminData } from "@/contexts/AdminDataContext";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { Plus, Phone, MessageSquare, Trash2, AlertTriangle, CheckCircle2, XCircle, RefreshCw, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/PaginationBar";

interface SmsChannel {
  id: string;
  tenant_id: string | null;
  phone_number: string;
  provider: string;
  label: string;
  is_active: boolean;
  created_at: string;
  api_key: string | null;
  api_secret: string | null;
}

interface SmsMessage {
  id: string;
  channel_id: string | null;
  assignment_id: string | null;
  user_id: string | null;
  direction: string;
  from_number: string;
  to_number: string;
  body: string;
  media_url: string | null;
  status: string;
  created_at: string;
}

interface SmsAssignment {
  id: string;
  user_id: string;
  sms_channel_id: string;
  is_active: boolean;
  note: string;
  assigned_at: string;
  assigned_by: string;
}

function AdminSmsPage() {
  const { toast } = useToast();
  const { profiles, assignments, adminUserIds } = useAdminData();
  const assignableEmployees = useMemo(() => getAssignableEmployees(profiles, adminUserIds), [profiles, adminUserIds]);
  const [channels, setChannels] = useState<SmsChannel[]>([]);
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [smsAssignments, setSmsAssignments] = useState<SmsAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newProvider, setNewProvider] = useState("anosim");
  const [newApiKey, setNewApiKey] = useState("");
  const [newApiSecret, setNewApiSecret] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  // Assignment form
  const [assignUserId, setAssignUserId] = useState("");
  const [assignChannelId, setAssignChannelId] = useState("");
  const [assignNote, setAssignNote] = useState("");

  const [tab, setTab] = useState("channels");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [chRes, msgRes, asgRes] = await Promise.all([
      supabase.from("sms_channels").select("*").order("created_at", { ascending: false }),
      supabase.from("sms_messages").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("sms_assignments").select("*").order("assigned_at", { ascending: false }),
    ]);
    setChannels((chRes.data as SmsChannel[]) ?? []);
    setMessages((msgRes.data as SmsMessage[]) ?? []);
    setSmsAssignments((asgRes.data as unknown as SmsAssignment[]) ?? []);
    setLoading(false);
  };

  const createChannel = async () => {
    if (!newPhone.trim()) return;
    const { error } = await supabase.from("sms_channels").insert({
      phone_number: newPhone.trim(),
      label: newLabel.trim() || newPhone.trim(),
      provider: newProvider || "anosim",
      api_key: newApiKey.trim() || null,
      api_secret: newApiSecret.trim() || null,
    } as any);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "SMS-Kanal erstellt" });
    setShowCreate(false);
    setNewPhone(""); setNewLabel(""); setNewProvider("anosim");
    setNewApiKey(""); setNewApiSecret("");
    loadData();
  };

  const deleteChannel = async (id: string) => {
    const { error } = await supabase.from("sms_channels").delete().eq("id", id);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    loadData();
  };

  const toggleActive = async (ch: SmsChannel) => {
    const { error } = await supabase.from("sms_channels").update({ is_active: !ch.is_active }).eq("id", ch.id);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    loadData();
  };

  const createAssignment = async () => {
    if (!assignUserId || !assignChannelId) {
      toast({ title: "Fehler", description: "Bitte Mitarbeiter und Nummer auswählen.", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("sms_assignments").insert({
      user_id: assignUserId,
      sms_channel_id: assignChannelId,
      note: assignNote.trim(),
      assigned_by: user.id,
    } as any);

    if (error) {
      if (error.message.includes("duplicate") || error.message.includes("unique")) {
        toast({ title: "Fehler", description: "Diese Zuweisung existiert bereits.", variant: "destructive" });
      } else {
        toast({ title: "Fehler", description: error.message, variant: "destructive" });
      }
      return;
    }
    toast({ title: "SMS-Nummer zugewiesen" });
    setShowAssign(false);
    setAssignUserId(""); setAssignChannelId(""); setAssignNote("");
    loadData();
  };

  const toggleAssignment = async (asg: SmsAssignment) => {
    const { error } = await supabase.from("sms_assignments")
      .update({ is_active: !asg.is_active } as any)
      .eq("id", asg.id);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    loadData();
  };

  const deleteAssignment = async (id: string) => {
    const { error } = await supabase.from("sms_assignments").delete().eq("id", id);
    if (error) { toast({ title: "Fehler", description: error.message, variant: "destructive" }); return; }
    loadData();
  };

  const activeChannels = channels.filter(c => c.is_active);
  const channelsWithoutKey = channels.filter(c => !c.api_key);
  const failedMessages = messages.filter(m => m.status === "failed");

  const channelMessages = selectedChannel
    ? messages.filter((m) => m.channel_id === selectedChannel)
    : messages;
  const msgPag = usePagination(channelMessages, 25);

  const getProfileName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || userId.slice(0, 8);
  const getChannelLabel = (channelId: string) => {
    const ch = channels.find(c => c.id === channelId);
    return ch ? `${ch.label || ch.phone_number}` : channelId.slice(0, 8);
  };

  if (loading) return <div className="p-5"><div className="h-64 bg-muted/50 rounded-xl animate-pulse" /></div>;

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-heading font-bold text-foreground">SMS-System</h1>
          <p className="text-xs text-muted-foreground">
            {channels.length} Kanäle · {smsAssignments.length} Zuweisungen · {messages.length} Nachrichten
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={loadData}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Aktualisieren
          </Button>
        </div>
      </div>

      {/* Health Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <HealthCard icon={CheckCircle2} label="Aktive Kanäle" value={activeChannels.length} color="text-green-500" />
        <HealthCard icon={Users} label="Zuweisungen" value={smsAssignments.filter(a => a.is_active).length} color="text-primary" />
        <HealthCard icon={AlertTriangle} label="Ohne API Key" value={channelsWithoutKey.length} color={channelsWithoutKey.length > 0 ? "text-orange-500" : "text-muted-foreground"} />
        <HealthCard icon={XCircle} label="Fehler" value={failedMessages.length} color={failedMessages.length > 0 ? "text-destructive" : "text-muted-foreground"} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="channels">Kanäle</TabsTrigger>
          <TabsTrigger value="assignments">Zuweisungen</TabsTrigger>
          <TabsTrigger value="messages">Nachrichten</TabsTrigger>
        </TabsList>

        {/* CHANNELS TAB */}
        <TabsContent value="channels" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Kanal erstellen
            </Button>
          </div>

          {channels.length === 0 ? (
            <EmptyState icon={Phone} title="Keine SMS-Kanäle" description="Erstelle einen SMS-Kanal." actionLabel="Kanal erstellen" onAction={() => setShowCreate(true)} />
          ) : (
            <div className="border rounded-lg overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Nummer</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Label</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Provider</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">API Key</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Zuweisungen</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {channels.map((ch) => {
                    const assignCount = smsAssignments.filter(a => a.sms_channel_id === ch.id && a.is_active).length;
                    return (
                      <tr key={ch.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-foreground">{ch.phone_number}</td>
                        <td className="px-4 py-3 text-muted-foreground">{ch.label || "–"}</td>
                        <td className="px-4 py-3"><Badge variant="secondary" className="text-[10px]">{ch.provider}</Badge></td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                          {ch.api_key ? "••••" + ch.api_key.slice(-4) : <span className="text-orange-500">fehlt</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={ch.is_active ? "default" : "secondary"} className={cn("text-[10px]", ch.is_active ? "bg-green-500/15 text-green-600 border-green-500/30" : "")}>
                            {ch.is_active ? "Aktiv" : "Inaktiv"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{assignCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleActive(ch)}>
                              {ch.is_active ? "Deaktivieren" : "Aktivieren"}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => deleteChannel(ch.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ASSIGNMENTS TAB */}
        <TabsContent value="assignments" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowAssign(true)}>
              <UserPlus className="h-3.5 w-3.5 mr-1" /> Nummer zuweisen
            </Button>
          </div>

          {smsAssignments.length === 0 ? (
            <EmptyState icon={Users} title="Keine Zuweisungen" description="Weise SMS-Nummern an Mitarbeiter zu." actionLabel="Zuweisen" onAction={() => setShowAssign(true)} />
          ) : (
            <div className="border rounded-lg overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Mitarbeiter</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">SMS-Nummer</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Notiz</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Zugewiesen am</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {smsAssignments.map((asg) => (
                    <tr key={asg.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-foreground">{getProfileName(asg.user_id)}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{getChannelLabel(asg.sms_channel_id)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">{asg.note || "–"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={asg.is_active ? "default" : "secondary"} className={cn("text-[10px]", asg.is_active ? "bg-green-500/15 text-green-600" : "")}>
                          {asg.is_active ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(asg.assigned_at).toLocaleDateString("de-DE")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleAssignment(asg)}>
                            {asg.is_active ? "Deaktivieren" : "Aktivieren"}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => deleteAssignment(asg.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* MESSAGES TAB */}
        <TabsContent value="messages" className="space-y-3 mt-4">
          {channelMessages.length === 0 ? (
            <EmptyState icon={MessageSquare} title="Keine Nachrichten" description="Es wurden noch keine SMS empfangen." />
          ) : (
            <div className="border rounded-lg overflow-hidden bg-card max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Richtung</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Von</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">An</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Nachricht</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Mitarbeiter</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase">Datum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {msgPag.paged.map((msg) => {
                    const profile = msg.user_id ? profiles.find((p) => p.user_id === msg.user_id) : null;
                    return (
                      <tr key={msg.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2">
                          <Badge variant="secondary" className={cn("text-[10px]", msg.direction === "inbound" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary")}>
                            {msg.direction === "inbound" ? "↓ Eingang" : "↑ Ausgang"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{msg.from_number}</td>
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{msg.to_number}</td>
                        <td className="px-4 py-2 text-foreground max-w-[200px] truncate">{msg.body || "–"}</td>
                        <td className="px-4 py-2 text-muted-foreground">{profile?.full_name ?? "–"}</td>
                        <td className="px-4 py-2">
                          <Badge variant="secondary" className={cn("text-[10px]",
                            msg.status === "received" && "bg-green-500/10 text-green-600",
                            msg.status === "failed" && "bg-destructive/10 text-destructive",
                          )}>
                            {msg.status === "received" ? "Empfangen" : msg.status === "sent" ? "Gesendet" : msg.status === "failed" ? "Fehler" : msg.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(msg.created_at).toLocaleString("de-DE")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {channelMessages.length > 0 && (
            <PaginationBar page={msgPag.page} pageCount={msgPag.pageCount} setPage={msgPag.setPage} rangeFrom={msgPag.rangeFrom} rangeTo={msgPag.rangeTo} total={msgPag.total} />
          )}
        </TabsContent>
      </Tabs>

      {/* Create Channel Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-heading">SMS-Kanal erstellen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Telefonnummer *">
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+49..." />
            </Field>
            <Field label="Label">
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="z.B. Anosim Hauptnummer" />
            </Field>
            <Field label="Provider">
              <Select value={newProvider} onValueChange={setNewProvider}>
                <SelectTrigger><SelectValue placeholder="Provider wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="anosim">Anosim</SelectItem>
                  <SelectItem value="twilio">Twilio</SelectItem>
                  <SelectItem value="other">Andere</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="API Key">
              <Input value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)} placeholder="API Key eingeben…" type="password" />
            </Field>
            <Field label="API Secret (optional)">
              <Input value={newApiSecret} onChange={(e) => setNewApiSecret(e.target.value)} placeholder="API Secret…" type="password" />
            </Field>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            <Button size="sm" onClick={createChannel} disabled={!newPhone.trim()}>Erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Number Dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-heading">SMS-Nummer zuweisen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Mitarbeiter *">
              <Select value={assignUserId} onValueChange={setAssignUserId}>
                <SelectTrigger><SelectValue placeholder="Mitarbeiter wählen" /></SelectTrigger>
                <SelectContent>
                  {assignableEmployees.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="SMS-Nummer *">
              <Select value={assignChannelId} onValueChange={setAssignChannelId}>
                <SelectTrigger><SelectValue placeholder="Nummer wählen" /></SelectTrigger>
                <SelectContent>
                  {channels.filter(c => c.is_active).map(ch => (
                    <SelectItem key={ch.id} value={ch.id}>{ch.label || ch.phone_number} ({ch.phone_number})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Notiz (optional)">
              <Textarea value={assignNote} onChange={(e) => setAssignNote(e.target.value)} placeholder="z.B. Für 1822direkt Aufträge" rows={2} />
            </Field>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setShowAssign(false)}>Abbrechen</Button>
            <Button size="sm" onClick={createAssignment} disabled={!assignUserId || !assignChannelId}>Zuweisen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function HealthCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="border rounded-lg p-3 bg-card">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", color)} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={cn("text-xl font-bold mt-1", color)}>{value}</p>
    </div>
  );
}
