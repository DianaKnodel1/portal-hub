import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/chat")({
  component: AdminChatPage,
});

import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useChatNotifications } from "@/hooks/use-chat-notifications";
import { Send, Bot, UserCheck, Search, MessageCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLastSignIns } from "@/lib/last-sign-ins.functions";
import { useSearchParams } from "@/lib/router-compat";

interface Conversation {
  user_id: string;
  full_name: string;
  status: string;
  escalated_at: string | null;
  unread: number;
  lastMessage?: string;
  lastAt?: string;
  lastSignInAt?: string | null;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  read: boolean;
  created_at: string;
  is_ai?: boolean;
}

function AdminChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterTab] = useState<"all" | "escalated" | "open">("all");
  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Browser-Notification + Sound + Tab-Title-Blink
  const totalUnread = useMemo(
    () => conversations.reduce((s, c) => s + (c.unread || 0), 0),
    [conversations]
  );
  const { trigger: notifyChat, requestPermission } = useChatNotifications({
    unread: totalUnread,
    enabled: true,
  });
  useEffect(() => { requestPermission(); }, [requestPermission]);

  // Optional: ?user=<id> aus URL übernehmen (Deep-Link aus Mitarbeiter-Detail)
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const u = searchParams.get("user");
    if (u) setSelectedUserId(u);
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    loadConversations();
  }, [user]);

  const loadConversations = async () => {
    // 1 Query statt N*2: alle Nachrichten in/aus Admin-Postfach holen und client-seitig aggregieren.
    const [profilesRes, convsRes, msgsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name"),
      supabase.from("chat_conversations").select("user_id, status, escalated_at"),
      supabase
        .from("chat_messages")
        .select("sender_id, receiver_id, message, read, created_at")
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

    const profiles = profilesRes.data ?? [];
    if (!profiles.length) { setLoading(false); return; }
    const profileMap = new Map(profiles.map((p: any) => [p.user_id, p.full_name as string]));
    const convMap = new Map((convsRes.data ?? []).map((c: any) => [c.user_id, c]));

    type Agg = { lastMessage: string; lastAt: string; unread: number };
    const agg = new Map<string, Agg>();
    for (const m of (msgsRes.data ?? []) as any[]) {
      const partnerId = m.sender_id === user!.id ? m.receiver_id : m.sender_id;
      if (!profileMap.has(partnerId)) continue;
      let entry = agg.get(partnerId);
      if (!entry) {
        // Erste Nachricht (neueste, da DESC sortiert) → lastMessage
        entry = { lastMessage: m.message, lastAt: m.created_at, unread: 0 };
        agg.set(partnerId, entry);
      }
      if (m.sender_id === partnerId && !m.read) entry.unread += 1;
    }

    const list: Conversation[] = [];
    for (const [partnerId, a] of agg) {
      const conv = convMap.get(partnerId);
      list.push({
        user_id: partnerId,
        full_name: profileMap.get(partnerId) ?? "Mitarbeiter",
        status: conv?.status ?? "direct",
        escalated_at: conv?.escalated_at ?? null,
        unread: a.unread,
        lastMessage: a.lastMessage,
        lastAt: a.lastAt,
      });
    }

    list.sort((a, b) => {
      if (a.status === "escalated" && b.status !== "escalated") return -1;
      if (a.status !== "escalated" && b.status === "escalated") return 1;
      if (a.unread && !b.unread) return -1;
      if (!a.unread && b.unread) return 1;
      return (b.lastAt ?? "").localeCompare(a.lastAt ?? "");
    });

    setConversations(list);
    setLoading(false);

    // Letzten Login pro Mitarbeiter nachladen (Admin-RPC)
    if (list.length > 0) {
      try {
        const map = await getLastSignIns({ data: { user_ids: list.map((c) => c.user_id) } });
        setConversations((prev) => prev.map((c) => ({ ...c, lastSignInAt: map[c.user_id] ?? null })));
      } catch (e) {
        console.warn("Last sign-ins konnten nicht geladen werden:", e);
      }
    }
  };

  const formatLastActive = (ts?: string | null) => {
    if (!ts) return "Noch nie eingeloggt";
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 2) return "Gerade aktiv";
    if (m < 60) return `Aktiv vor ${m} Min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Aktiv vor ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `Aktiv vor ${d} Tagen`;
    return `Aktiv am ${new Date(ts).toLocaleDateString("de-DE")}`;
  };

  const selectConversation = async (userId: string) => {
    setSelectedUserId(userId);
    const { data: msgs } = await supabase
      .from("chat_messages").select("*")
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${user!.id}),and(sender_id.eq.${user!.id},receiver_id.eq.${userId})`)
      .order("created_at", { ascending: true });
    setMessages((msgs ?? []) as ChatMessage[]);

    await supabase
      .from("chat_messages").update({ read: true } as any)
      .eq("sender_id", userId).eq("receiver_id", user!.id).eq("read", false);

    setConversations((prev) => prev.map((c) => c.user_id === userId ? { ...c, unread: 0 } : c));
  };

  const takeOver = async (userId: string) => {
    await supabase
      .from("chat_conversations")
      .update({ status: "human", updated_at: new Date().toISOString() } as any)
      .eq("user_id", userId);
    setConversations((prev) => prev.map((c) => c.user_id === userId ? { ...c, status: "human" } : c));
    toast({ title: "Chat übernommen" });
  };

  const resolveChat = async (userId: string) => {
    await supabase
      .from("chat_conversations")
      .update({ status: "resolved", updated_at: new Date().toISOString() } as any)
      .eq("user_id", userId);
    setConversations((prev) => prev.map((c) => c.user_id === userId ? { ...c, status: "resolved" } : c));
    toast({ title: "Chat als gelöst markiert" });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUserId || !user) return;
    setSending(true);
    await supabase.from("chat_messages").insert({
      sender_id: user.id, receiver_id: selectedUserId, message: newMessage.trim(),
    } as any);
    setNewMessage("");
    setSending(false);
  };

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("admin-chat-unified")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, async (payload) => {
        const msg = payload.new as ChatMessage;
        if (msg.receiver_id !== user.id && msg.sender_id !== user.id) return;

        // Nachricht zum offenen Chat hinzufügen
        if (selectedUserId && (
          (msg.sender_id === selectedUserId && msg.receiver_id === user.id) ||
          (msg.sender_id === user.id && msg.receiver_id === selectedUserId)
        )) {
          setMessages((prev) => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
          if (msg.sender_id === selectedUserId) {
            await supabase.from("chat_messages").update({ read: true } as any).eq("id", msg.id);
          }
        }

        // Conversation-Liste live aktualisieren
        if (msg.sender_id !== user.id) {
          const partnerId = msg.sender_id;
          setConversations((prev) => {
            const existing = prev.find(c => c.user_id === partnerId);
            if (existing) {
              return prev.map((c) =>
                c.user_id === partnerId
                  ? { ...c, unread: c.user_id === selectedUserId ? 0 : c.unread + 1, lastMessage: msg.message, lastAt: msg.created_at }
                  : c
              );
            }
            // Neuer Chat → Profil nachladen und einfügen
            return prev;
          });

          // Neuer Mitarbeiter-Chat: Profil + Conversation laden und einfügen
          const exists = conversations.some(c => c.user_id === partnerId);
          let partnerName = exists ? (conversations.find(c => c.user_id === partnerId)?.full_name ?? "Mitarbeiter") : "Mitarbeiter";
          if (!exists) {
            const { data: prof } = await supabase
              .from("profiles").select("user_id, full_name").eq("user_id", partnerId).maybeSingle();
            const { data: conv } = await supabase
              .from("chat_conversations").select("status, escalated_at").eq("user_id", partnerId).maybeSingle();
            if (prof) {
              partnerName = prof.full_name;
              setConversations((prev) => prev.some(c => c.user_id === partnerId) ? prev : [{
                user_id: prof.user_id,
                full_name: prof.full_name,
                status: conv?.status ?? "direct",
                escalated_at: conv?.escalated_at ?? null,
                unread: 1,
                lastMessage: msg.message,
                lastAt: msg.created_at,
              }, ...prev]);
            }
          }

          // Browser-Notification + Ping (nur wenn nicht der gerade offene Chat)
          if (partnerId !== selectedUserId) {
            notifyChat({ body: msg.message, senderName: partnerName });
          }
        } else {
          // Eigene Nachricht → lastMessage in Liste updaten
          setConversations((prev) => prev.map((c) =>
            c.user_id === msg.receiver_id
              ? { ...c, lastMessage: msg.message, lastAt: msg.created_at }
              : c
          ));
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_conversations" }, (payload) => {
        const conv = payload.new as { user_id: string; status: string; escalated_at: string | null };
        setConversations((prev) => prev.map((c) =>
          c.user_id === conv.user_id ? { ...c, status: conv.status, escalated_at: conv.escalated_at } : c
        ));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedUserId, conversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Typing-Indicator: Channel pro selectedUserId (spiegelbild zu FloatingChat)
  useEffect(() => {
    if (!user || !selectedUserId) {
      setPartnerTyping(false);
      return;
    }
    const channelName = `typing-${[user.id, selectedUserId].sort().join("-")}`;
    const channel = supabase.channel(channelName, { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.userId === selectedUserId) {
          setPartnerTyping(true);
          if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = window.setTimeout(() => setPartnerTyping(false), 3000);
        }
      })
      .subscribe();
    typingChannelRef.current = channel;
    return () => {
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
      setPartnerTyping(false);
    };
  }, [user, selectedUserId]);

  const broadcastTyping = () => {
    if (!typingChannelRef.current || !user) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    typingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user.id },
    });
  };


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const filteredConversations = conversations.filter((c) => {
    if (!c.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterTab === "escalated") return c.status === "escalated";
    if (filterTab === "open") return c.status !== "resolved";
    return true;
  });

  const selectedConv = conversations.find((c) => c.user_id === selectedUserId);
  const selectedName = selectedConv?.full_name ?? "";
  const selectedInitials = selectedName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  

  const statusBadge = (status: string) => {
    switch (status) {
      case "ai": return <Badge variant="secondary" className="text-[10px]"><Bot className="h-3 w-3 mr-1" />KI</Badge>;
      case "escalated": return <Badge variant="destructive" className="text-[10px]">Eskaliert</Badge>;
      case "human": return <Badge className="text-[10px] bg-accent text-accent-foreground"><UserCheck className="h-3 w-3 mr-1" />Admin</Badge>;
      case "resolved": return <Badge variant="secondary" className="text-[10px] bg-accent/10 text-accent"><CheckCircle2 className="h-3 w-3 mr-1" />Gelöst</Badge>;
      default: return null;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-pulse text-muted-foreground">Laden…</div></div>;
  }

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Conversation list */}
      <div className="w-80 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-3 border-b border-border space-y-2">
          <h2 className="text-sm font-semibold">Chat</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen…" className="pl-9 h-9 text-sm" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Keine Chats</p>
          )}
          {filteredConversations.map((conv) => {
            const initials = conv.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
            return (
              <button
                key={conv.user_id}
                onClick={() => selectConversation(conv.user_id)}
                className={cn(
                  "w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors border-b border-border/50",
                  selectedUserId === conv.user_id && "bg-primary/5 border-l-2 border-l-primary",
                  conv.status === "escalated" && "bg-destructive/[0.02]"
                )}
              >
                <div className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
                  conv.status === "escalated" ? "bg-destructive/10" : "bg-primary/10"
                )}>
                  <span className={cn("text-xs font-bold", conv.status === "escalated" ? "text-destructive" : "text-primary")}>{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{conv.full_name}</p>
                    {statusBadge(conv.status)}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{formatLastActive(conv.lastSignInAt)}</p>
                  {conv.lastMessage && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage}</p>
                  )}
                </div>
                {conv.unread > 0 && (
                  <Badge variant="default" className="h-5 min-w-[20px] px-1.5 text-[10px]">{conv.unread}</Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {!selectedUserId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Wähle einen Chat aus.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b border-border bg-card px-5 py-3 flex items-center gap-3 shrink-0">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{selectedInitials}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{selectedName}</p>
                  {selectedConv && statusBadge(selectedConv.status)}
                </div>
                {partnerTyping && (
                  <p className="text-[11px] text-primary flex items-center gap-1.5 mt-0.5">
                    <span className="flex gap-0.5">
                      <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                    schreibt …
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {selectedConv?.status === "escalated" && (
                  <Button size="sm" onClick={() => takeOver(selectedUserId!)} className="text-xs">
                    <UserCheck className="h-3.5 w-3.5 mr-1" /> Übernehmen
                  </Button>
                )}
                {selectedConv && selectedConv.status !== "resolved" && (
                  <Button size="sm" variant="outline" onClick={() => resolveChat(selectedUserId!)} className="text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Gelöst
                  </Button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messages.map((msg) => {
                const isMine = msg.sender_id === user!.id;
                const isAi = msg.is_ai;
                return (
                  <div key={msg.id} className={cn("flex items-end gap-2", isMine ? "justify-end" : "justify-start")}>
                    {!isMine && (
                      <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0 mb-1",
                        isAi ? "bg-accent/20" : "bg-primary/10"
                      )}>
                        {isAi ? <Bot className="h-3.5 w-3.5 text-accent-foreground" /> : (
                          <span className="text-[10px] font-bold text-primary">{selectedInitials}</span>
                        )}
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm",
                      isMine
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : isAi
                          ? "bg-accent/10 text-foreground rounded-bl-md border border-accent/20"
                          : "bg-muted text-foreground rounded-bl-md"
                    )}>
                      <p className="whitespace-pre-wrap">{msg.message}</p>
                      <p className={cn("text-[10px] mt-1", isMine ? "text-primary-foreground/60" : "text-muted-foreground")}>
                        {new Date(msg.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                        {isAi && " · 🤖 KI"}
                        {isMine && " · 👤 Admin"}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border bg-card px-5 py-3 shrink-0">
              <div className="flex items-end gap-2">
                <Textarea
                  value={newMessage}
                  onChange={(e) => { setNewMessage(e.target.value); broadcastTyping(); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Nachricht schreiben… (Shift + Enter = neue Zeile)"
                  rows={1}
                  className="flex-1 min-h-[40px] max-h-32 resize-none py-2"
                />
                <Button size="icon" onClick={sendMessage} disabled={!newMessage.trim() || sending} className="shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
