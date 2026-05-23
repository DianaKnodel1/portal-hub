import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useTeamLeader } from "@/hooks/use-team-leader";
import { useAiChat, AiMessage } from "@/hooks/use-ai-chat";
import { useChatNotifications } from "@/hooks/use-chat-notifications";
import { useTenant } from "@/contexts/TenantContext";
import { MessageCircle, X, Send, BadgeCheck, Minus, Bot, User, ExternalLink, Zap, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  read: boolean;
  created_at: string;
  is_ai?: boolean;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

const AUTO_OPEN_KEY = "floating_chat_auto_opened";

/* ── Unread Divider (Slack/WhatsApp-Stil) ────────────────────── */
function UnreadDivider() {
  return (
    <div className="flex items-center gap-2 my-3 animate-fade-in">
      <div className="flex-1 h-px bg-destructive/30" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-destructive/80">
        Neue Nachrichten
      </span>
      <div className="flex-1 h-px bg-destructive/30" />
    </div>
  );
}

/* ── Floating Chat Button ──────────────────────────────────── */
function ChatButton({ onClick, unread, hasNewMessage, pulse24h }: { onClick: () => void; unread: number; hasNewMessage: boolean; pulse24h: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "relative h-[60px] w-[60px] rounded-full bg-primary flex items-center justify-center transition-all duration-300",
            "hover:scale-110 active:scale-95 shadow-lg shadow-primary/25",
            unread > 0 && "animate-chat-glow",
            hasNewMessage && "animate-chat-bounce"
          )}
        >
          {/* 24h Onboarding-Pulse-Ring */}
          {pulse24h && unread === 0 && (
            <>
              <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
              <span className="absolute -inset-1 rounded-full ring-2 ring-primary/30" />
            </>
          )}
          <MessageCircle className="h-6 w-6 text-primary-foreground relative" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1.5 shadow-sm">
              {unread}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="text-xs font-medium">
        {pulse24h && unread === 0 ? "Frag deinen Teamleiter – er antwortet meist in wenigen Minuten" : "Chat öffnen"}
      </TooltipContent>
    </Tooltip>
  );
}

/* ── Mode Selector ─────────────────────────────────────────── */
function ModeSelector({
  mode,
  onSelect,
  locked,
  aiDisabled,
}: {
  mode: "ai" | "human";
  onSelect: (m: "ai" | "human") => void;
  locked: boolean;
  aiDisabled?: boolean;
}) {
  if (aiDisabled) return null;
  return (
    <div className="flex gap-1 bg-muted/60 rounded-xl p-1 mx-4 mt-3 shrink-0">
      <button
        onClick={() => !locked && onSelect("ai")}
        disabled={locked}
        title={locked ? "Du sprichst gerade mit deinem Teamleiter" : undefined}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 text-[12px] font-medium rounded-lg py-2 transition-all",
          mode === "ai" && !locked
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
          locked && "opacity-40 cursor-not-allowed hover:text-muted-foreground",
        )}
      >
        <Zap className="h-3.5 w-3.5" />
        Schnelle Antwort (KI)
      </button>
      <button
        onClick={() => onSelect("human")}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 text-[12px] font-medium rounded-lg py-2 transition-all",
          mode === "human"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <UserCheck className="h-3.5 w-3.5" />
        Persönlicher Kontakt
      </button>
    </div>
  );
}

/* ── Status Banner ─────────────────────────────────────────── */
function StatusBanner({ mode, leaderName, leaderOnline, escalated, justResolved }: { mode: "ai" | "human"; leaderName: string; leaderOnline: boolean; escalated: boolean; justResolved: boolean }) {
  if (mode === "ai") {
    if (justResolved) {
      return (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-accent/15 border border-accent/30 flex items-center gap-2 shrink-0 animate-fade-in">
          <Zap className="h-3.5 w-3.5 text-accent-foreground shrink-0" />
          <p className="text-[11px] text-foreground leading-tight">
            <span className="font-semibold">KI wieder verfügbar</span> – dein Anliegen wurde abgeschlossen.
          </p>
        </div>
      );
    }
    return (
      <div className="mx-4 mt-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/10 flex items-center gap-2 shrink-0">
        <Zap className="h-3 w-3 text-primary shrink-0" />
        <p className="text-[11px] text-foreground/80 leading-tight">
          Modus: <span className="font-medium">Schnelle Antworten (KI)</span>
        </p>
      </div>
    );
  }
  // Persönlicher Kontakt – nach Eskalation visuell deutlicher
  return (
    <div className={cn(
      "mx-4 mt-2 px-3 py-2 rounded-lg flex items-center gap-2 shrink-0 border",
      escalated
        ? "bg-accent/15 border-accent/30 shadow-sm"
        : "bg-accent/10 border-accent/20"
    )}>
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {leaderOnline && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 animate-ping" />
        )}
        <span className={cn(
          "relative inline-flex h-2.5 w-2.5 rounded-full",
          leaderOnline ? "bg-accent" : "bg-muted-foreground/50"
        )} />
      </span>
      <UserCheck className="h-3.5 w-3.5 text-accent-foreground shrink-0" />
      <p className="text-[11px] text-foreground/90 leading-tight flex-1">
        {escalated ? (
          <><span className="font-semibold">Teamleiter verbunden</span> – du sprichst jetzt mit <span className="font-medium">{leaderName}</span></>
        ) : (
          <>Persönlicher Kontakt aktiv – <span className="font-medium">{leaderName}</span></>
        )}
      </p>
    </div>
  );
}

/* ── Handover Card (visueller Übergang nach Eskalation) ────── */
function HandoverCard({ leaderName, leaderInitials, leaderOnline }: { leaderName: string; leaderInitials: string; leaderOnline: boolean }) {
  return (
    <div className="my-2 mx-1 rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 via-accent/5 to-transparent p-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ring-2 ring-accent/30">
            <span className="text-sm font-bold text-primary">{leaderInitials}</span>
          </div>
          <span className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card",
            leaderOnline ? "bg-accent animate-pulse" : "bg-muted-foreground/50"
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5 text-accent-foreground shrink-0" />
            <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Teamleiter übernommen</p>
          </div>
          <p className="text-sm font-semibold text-foreground mt-0.5 truncate">{leaderName}</p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
            {leaderOnline ? "Ist jetzt im Chat – antwortet gleich persönlich." : "Antwortet, sobald wieder online."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Main FloatingChat Component ───────────────────────────── */
export function FloatingChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { tenant } = useTenant();
  const { leader, initials: leaderInitials } = useTeamLeader();
  const { messages: aiMessages, isStreaming, escalated, send: sendAi, setEscalated } = useAiChat();

  const [open, setOpen] = useState(false);
  const [humanMessages, setHumanMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [teamLeaderId, setTeamLeaderId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [mode, setMode] = useState<"ai" | "human">("ai");
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [justResolved, setJustResolved] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const [leaderTyping, setLeaderTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const isOnChatPage = location.pathname === "/chat";

  // Wenn Admin KI-Chat deaktiviert hat → automatisch in den persönlichen Modus
  useEffect(() => {
    if (tenant?.ai_enabled === false && mode === "ai") {
      setMode("human");
    }
  }, [tenant?.ai_enabled, mode]);

  // 24h Onboarding-Pulse-Logic
  const pulse24h = (() => {
    if (!createdAt) return false;
    const ageMs = Date.now() - new Date(createdAt).getTime();
    return ageMs < 24 * 60 * 60 * 1000;
  })();

  // Browser-Notification + Sound + Tab-Title-Blink
  const { trigger: triggerNotification, requestPermission } = useChatNotifications({
    unread,
    enabled: loaded && !!teamLeaderId,
  });

  // Permission anfordern, sobald Chat das erste Mal geöffnet wird (User-Gesture)
  useEffect(() => {
    if (open) requestPermission();
  }, [open, requestPermission]);



  // Init
  useEffect(() => {
    if (!user) return;
    const init = async () => {
      const { data: profile } = await supabase
        .from("profiles").select("team_leader_id, status, tenant_id, created_at").eq("user_id", user.id).maybeSingle();
      if (profile?.created_at) setCreatedAt(profile.created_at as string);
      if (!profile) { setLoaded(true); return; }
      setTeamLeaderId(profile?.team_leader_id ?? null);

      if (profile.tenant_id) {
        const { data: tenant } = await supabase
          .from("tenants_public").select("whatsapp_number").eq("id", profile.tenant_id).maybeSingle();
        if (tenant?.whatsapp_number) setWhatsappNumber(tenant.whatsapp_number as string);
      }

      if (profile?.team_leader_id) {
        const { data: unreadMsgs } = await supabase
          .from("chat_messages")
          .select("id")
          .eq("receiver_id", user.id)
          .eq("sender_id", profile.team_leader_id)
          .eq("read", false);
        setUnread(unreadMsgs?.length ?? 0);
      }

      const { data: conv } = await supabase
        .from("chat_conversations")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (conv && (conv.status === "escalated" || conv.status === "human")) {
        setMode("human");
        setEscalated(true);
      }

      setLoaded(true);
    };
    init();
  }, [user]);

  // Auto-open on first visit
  useEffect(() => {
    if (!loaded || isOnChatPage) return;
    const alreadyOpened = sessionStorage.getItem(AUTO_OPEN_KEY);
    if (!alreadyOpened) {
      const timer = setTimeout(() => {
        setOpen(true);
        sessionStorage.setItem(AUTO_OPEN_KEY, "1");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [loaded, isOnChatPage]);

  // When escalated, switch to human mode and notify employee + leader
  useEffect(() => {
    if (!escalated || !user) return;
    setMode("human");

    const escalate = async () => {
      const { data: existing } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase.from("chat_conversations").update({
          status: "escalated",
          escalated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any).eq("id", existing.id);
      } else {
        await supabase.from("chat_conversations").insert({
          user_id: user.id,
          status: "escalated",
          escalated_at: new Date().toISOString(),
        } as any);
      }

      if (teamLeaderId) {
        // 1) Sichtbare Übergangsnachricht für den Mitarbeiter
        await supabase.from("chat_messages").insert({
          sender_id: teamLeaderId,
          receiver_id: user.id,
          message: `Ich verbinde dich jetzt mit ${leader.name}. Deine Nachricht wurde weitergeleitet – du bekommst gleich eine persönliche Antwort.`,
          is_ai: true,
        } as any);

        // 2) Interner Admin-Hinweis mit Chatverlauf (im Mitarbeiter-Portal ausgeblendet)
        const lastAiMsgs = aiMessages.slice(-4);
        const context = lastAiMsgs.map(m => `${m.role === "user" ? "Mitarbeiter" : "KI"}: ${m.content}`).join("\n");
        await supabase.from("chat_messages").insert({
          sender_id: user.id,
          receiver_id: teamLeaderId,
          message: `🤖 KI-Eskalation – Chatverlauf:\n\n${context}`,
          is_ai: true,
        } as any);
      }
    };
    escalate();
  }, [escalated, user, teamLeaderId]);

  // Handle mode switch to "human" — check if leader is offline
  const handleModeSelect = async (newMode: "ai" | "human") => {
    setMode(newMode);

    if (newMode === "human" && !leader.is_online && teamLeaderId && user) {
      // Send auto-response when offline
      const offlineMsg = whatsappNumber
        ? `Aktuell ist kein Teamleiter erreichbar. Ich melde mich, sobald ich verfügbar bin. Alternativ kannst du uns per WhatsApp kontaktieren: wa.me/${whatsappNumber}`
        : `Aktuell ist kein Teamleiter erreichbar. Ich melde mich, sobald ich verfügbar bin.`;

      await supabase.from("chat_messages").insert({
        sender_id: teamLeaderId,
        receiver_id: user.id,
        message: offlineMsg,
        is_ai: true,
      } as any);

      // Ensure conversation exists
      const { data: existing } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!existing) {
        await supabase.from("chat_conversations").insert({
          user_id: user.id,
          status: "human",
        } as any);
      } else {
        await supabase.from("chat_conversations").update({
          status: "human",
          updated_at: new Date().toISOString(),
        } as any).eq("id", existing.id);
      }
    }
  };

  // Load human messages when in human mode
  useEffect(() => {
    if (mode !== "human" || !open || !user || !teamLeaderId) return;
    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${teamLeaderId}),and(sender_id.eq.${teamLeaderId},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true });
      // Interne KI-/Eskalations-Nachrichten sind nur Admin-Info und werden im Mitarbeiter-Portal nicht angezeigt
      const visible = ((data ?? []) as ChatMessage[]).filter(
        (m) =>
          !m.message.startsWith("🤖 KI-Eskalation") &&
          !m.message.startsWith("🤖 KI Eskalation") &&
          !m.message.startsWith("[ESCALATE]")
      );
      // Erste ungelesene Nachricht vom Teamleiter merken → Trennlinie
      const firstUnread = visible.find(
        (m) => m.sender_id === teamLeaderId && !m.read
      );
      setFirstUnreadId(firstUnread?.id ?? null);
      setHumanMessages(visible);
      await supabase
        .from("chat_messages")
        .update({ read: true } as any)
        .eq("receiver_id", user.id)
        .eq("sender_id", teamLeaderId)
        .eq("read", false);
      setUnread(0);
    };
    load();
  }, [mode, open, user, teamLeaderId]);

  // Realtime for human messages
  useEffect(() => {
    if (!user || !teamLeaderId) return;
    const channel = supabase
      .channel("floating-chat-hybrid")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const msg = payload.new as ChatMessage;
        const relevant =
          (msg.sender_id === user.id && msg.receiver_id === teamLeaderId) ||
          (msg.sender_id === teamLeaderId && msg.receiver_id === user.id);
        if (!relevant) return;

        // Interne Admin-Nachrichten (KI-Eskalation) im Mitarbeiter-Portal nicht anzeigen
        const isInternal =
          msg.message.startsWith("🤖 KI-Eskalation") ||
          msg.message.startsWith("🤖 KI Eskalation") ||
          msg.message.startsWith("[ESCALATE]");
        if (isInternal) return;

        if (open && mode === "human") {
          setHumanMessages((prev) => [...prev, msg]);
          if (msg.sender_id === teamLeaderId) {
            supabase.from("chat_messages").update({ read: true } as any).eq("id", msg.id).then();
            // Notify (z.B. wenn Tab im Hintergrund)
            triggerNotification({
              senderName: leader.name || "Teamleiter",
              body: msg.message.slice(0, 140),
              icon: tenant?.logo_url || undefined,
            });
          }
        } else if (msg.sender_id === teamLeaderId) {
          setUnread((p) => p + 1);
          setHasNewMessage(true);
          setMode("human");
          // Chat automatisch öffnen, wenn der Teamleiter schreibt
          setOpen(true);
          setTimeout(() => setHasNewMessage(false), 1600);
          triggerNotification({
            senderName: leader.name || "Teamleiter",
            body: msg.message.slice(0, 140),
            icon: tenant?.logo_url || undefined,
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, teamLeaderId, open, mode, triggerNotification, leader.name, tenant?.logo_url]);

  // Typing-Indicator via Realtime Presence
  useEffect(() => {
    if (!user || !teamLeaderId) return;
    const channelName = `typing-${[user.id, teamLeaderId].sort().join("-")}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.userId === teamLeaderId) {
          setLeaderTyping(true);
          if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = window.setTimeout(() => setLeaderTyping(false), 3000);
        }
      })
      .subscribe();
    typingChannelRef.current = channel;
    return () => {
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [user, teamLeaderId]);

  // Broadcast typing while user types
  const lastTypingSentRef = useRef(0);
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

  // Realtime: chat_conversations status (Admin → "resolved" gibt KI wieder frei)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("floating-chat-conv-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_conversations", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const conv = payload.new as { status: string };
          if (conv.status === "resolved") {
            setEscalated(false);
            setMode("ai");
            setJustResolved(true);
            setTimeout(() => setJustResolved(false), 8000);
          } else if (conv.status === "escalated" || conv.status === "human") {
            setMode("human");
            if (conv.status === "escalated") setEscalated(true);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages, humanMessages, isStreaming]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return;
    const text = newMessage.trim();
    setNewMessage("");

    if (mode === "ai" && !escalated) {
      await sendAi(text);
    } else if (teamLeaderId) {
      setSending(true);
      await supabase.from("chat_messages").insert({
        sender_id: user.id,
        receiver_id: teamLeaderId,
        message: text,
      } as any);
      setSending(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (isOnChatPage || !loaded || !teamLeaderId) return null;

  return (
    <>
      {!open && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3" data-tour="chat">
          <ChatButton onClick={() => setOpen(true)} unread={unread} hasNewMessage={hasNewMessage} pulse24h={pulse24h} />
        </div>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[580px] max-h-[calc(100vh-4rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex items-center gap-3 bg-gradient-to-r from-card to-muted/30 shrink-0">
            <div className="relative">
              <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-2 ring-primary/10">
                {mode === "ai" ? (
                  <Bot className="h-5 w-5 text-primary" />
                ) : (
                  <span className="text-sm font-bold text-primary">{leaderInitials}</span>
                )}
              </div>
              <span className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card",
                mode === "ai" ? "bg-accent animate-pulse" : leader.is_online ? "bg-accent animate-pulse" : "bg-muted-foreground/40"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-foreground truncate">
                  {mode === "ai" ? "KI-Assistent" : leader.name}
                </p>
                <BadgeCheck className="h-4 w-4 text-primary shrink-0" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {mode === "ai" ? (
                  <span className="text-accent font-medium">Immer verfügbar</span>
                ) : leader.is_online ? (
                  <span>Wir antworten üblicherweise innerhalb weniger Minuten</span>
                ) : (
                  <span>We will be back as soon as possible</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                <Minus className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Mode Selector */}
          <ModeSelector mode={mode} onSelect={handleModeSelect} locked={escalated} aiDisabled={tenant?.ai_enabled === false} />
          <StatusBanner mode={mode} leaderName={leader.name} leaderOnline={!!leader.is_online} escalated={escalated} justResolved={justResolved} />

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {mode === "ai" ? (
              <>
                {aiMessages.length === 0 && !isStreaming && (
                  <div className="text-center py-6">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-3 ring-4 ring-primary/5">
                      <Bot className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">Hi 👋 Wie können wir dir helfen?</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      Du kannst hier schnelle Antworten von unserer KI bekommen oder oben zum persönlichen Kontakt wechseln.
                    </p>
                    <div className="mt-3 space-y-2 max-w-[280px] mx-auto">
                      {["Wie funktioniert das Portal?", "Was muss ich als nächstes tun?", "Wie viel verdiene ich?"].map((q) => (
                        <button
                          key={q}
                          onClick={() => sendAi(q)}
                          className="w-full text-left text-[12px] bg-muted/60 border border-border rounded-xl px-3 py-2 hover:bg-muted transition-colors text-foreground/80"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {aiMessages.map((msg, idx) => (
                  <div key={idx} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "assistant" && (
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 mr-2 mt-1">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}
                    <div className="flex flex-col">
                      {msg.role === "assistant" && (
                        <span className="text-[9px] text-primary/60 mb-0.5 ml-1 font-medium">🤖 KI-Assistent</span>
                      )}
                      <div
                        className={cn(
                          "max-w-[78%] px-4 py-2.5 text-[13px] leading-relaxed",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm shadow-sm"
                            : "bg-muted/80 border border-border text-foreground rounded-2xl rounded-bl-sm"
                        )}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm prose-p:my-1 prose-ul:my-1 prose-li:my-0 max-w-none text-foreground text-[13px]">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {/* Visueller Übergang nach Eskalation */}
                {escalated && (
                  <HandoverCard
                    leaderName={leader.name}
                    leaderInitials={leaderInitials}
                    leaderOnline={!!leader.is_online}
                  />
                )}

                {/* Human mode messages */}
                {humanMessages.length === 0 && !escalated && (
                  <div className="text-center py-6">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-3">
                      <span className="text-sm font-bold text-primary">{leaderInitials}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{leader.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      {leader.is_online 
                        ? "Schreib uns – wir antworten dir so schnell wie möglich." 
                        : "Hinterlasse eine Nachricht und wir melden uns, sobald wir wieder erreichbar sind."}
                    </p>
                    {!leader.is_online && whatsappNumber && (
                      <a
                        href={`https://wa.me/${whatsappNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-[#25D366] text-white text-[12px] font-medium px-4 py-2 rounded-xl hover:bg-[#20bd5a] transition-colors mt-3"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Per WhatsApp schreiben
                      </a>
                    )}
                  </div>
                )}

                {humanMessages.map((msg) => {
                  const isMine = msg.sender_id === user!.id;
                  const isSystem = msg.is_ai;
                  const showUnreadDivider = msg.id === firstUnreadId;

                  if (isSystem) {
                    return (
                      <div key={msg.id}>
                        {showUnreadDivider && <UnreadDivider />}
                        <div className="flex justify-center">
                          <div className="max-w-[85%] px-3 py-1.5 text-[11px] text-muted-foreground bg-muted/40 rounded-lg text-center leading-relaxed">
                            {msg.message}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id}>
                      {showUnreadDivider && <UnreadDivider />}
                      <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                        {!isMine && (
                          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 mr-2 mt-1">
                            <span className="text-[9px] font-bold text-primary">{leaderInitials}</span>
                          </div>
                        )}
                        <div className="flex flex-col">
                          {!isMine && (
                            <span className="text-[9px] text-muted-foreground mb-0.5 ml-1">
                              👤 {leader.name} · Teamleiter
                            </span>
                          )}
                          <div
                            className={cn(
                              "max-w-[78%] px-4 py-2.5 text-[13px] leading-relaxed",
                              isMine
                                ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm shadow-sm"
                                : "bg-muted/80 border border-border text-foreground rounded-2xl rounded-bl-sm"
                            )}
                          >
                            <p className="whitespace-pre-wrap">{msg.message}</p>
                            <p className={cn("text-[9px] mt-1", isMine ? "text-primary-foreground/40" : "text-muted-foreground/40")}>
                              {formatTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Typing-Indicator: Teamleiter tippt */}
                {leaderTyping && (
                  <div className="flex items-end gap-2 animate-fade-in">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-primary">{leaderInitials}</span>
                    </div>
                    <div className="bg-muted/80 border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground mr-1">{leader.name} tippt</span>
                        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Streaming indicator */}
            {isStreaming && (
              <div className="flex items-end gap-2 animate-fade-in">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-muted/80 border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground mr-1">schreibt</span>
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border px-4 py-3 flex items-center gap-2 shrink-0 bg-card">
            <Input
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                if (mode === "human") broadcastTyping();
              }}
              onKeyDown={handleKey}
              placeholder={mode === "ai" ? "Frag die KI etwas…" : "Nachricht an Teamleiter…"}
              className="flex-1 h-10 rounded-xl text-sm border-border/60 focus-visible:ring-primary/20"
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending || isStreaming}
              className="h-10 w-10 rounded-xl transition-all hover:scale-105 active:scale-95"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
