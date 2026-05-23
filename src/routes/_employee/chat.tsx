import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_employee/chat")({
  component: ChatPage,
});

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, MessageCircle, ShieldCheck, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeamLeader } from "@/hooks/use-team-leader";
import { extractChatActions } from "@/hooks/use-next-step";
import { ChatActionButtons } from "@/components/ChatActionButtons";

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  read: boolean;
  created_at: string;
}

const SYSTEM_PREFIXES = ["✅", "🎓", "📋", "💰", "⚠️", "🎉", "📅", "Willkommen", "Hallo", "✍️"];

function isSystemMessage(msg: ChatMessage, leaderId: string) {
  return msg.sender_id === leaderId && SYSTEM_PREFIXES.some((p) => msg.message.startsWith(p));
}

// Interne KI-/Eskalations-Nachrichten sind reine Admin-Infos und werden im Mitarbeiter-Chat ausgeblendet.
function isInternalAdminNote(msg: ChatMessage) {
  return (
    msg.message.startsWith("🤖 KI-Eskalation") ||
    msg.message.startsWith("🤖 KI Eskalation") ||
    msg.message.startsWith("[ESCALATE]")
  );
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function formatDateSeparator(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Heute";
  if (d.toDateString() === yesterday.toDateString()) return "Gestern";
  return d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
}

function ChatPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [teamLeaderId, setTeamLeaderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { leader, initials: leaderInitials, lastActiveText } = useTeamLeader();
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    loadData();
  }, [user, authLoading]);

  const loadData = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles").select("team_leader_id").eq("user_id", user!.id).maybeSingle();
      const leaderId = profile?.team_leader_id;
      setTeamLeaderId(leaderId ?? null);
      if (leaderId) {
        const { data: msgs } = await supabase
          .from("chat_messages")
          .select("*")
          .or(`and(sender_id.eq.${user!.id},receiver_id.eq.${leaderId}),and(sender_id.eq.${leaderId},receiver_id.eq.${user!.id})`)
          .order("created_at", { ascending: true });
        const visible = ((msgs ?? []) as ChatMessage[]).filter((m) => !isInternalAdminNote(m));
        setMessages(visible);
        await supabase
          .from("chat_messages")
          .update({ read: true } as any)
          .eq("receiver_id", user!.id)
          .eq("sender_id", leaderId)
          .eq("read", false);
      }
    } catch (err: any) {
      console.error("Chat load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !teamLeaderId) return;
    const channel = supabase
      .channel("chat-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const msg = payload.new as ChatMessage;
        if (
          (msg.sender_id === user.id && msg.receiver_id === teamLeaderId) ||
          (msg.sender_id === teamLeaderId && msg.receiver_id === user.id)
        ) {
          // Interne Admin-/KI-Eskalations-Nachrichten im Mitarbeiter-Chat ausblenden
          if (isInternalAdminNote(msg)) return;
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, teamLeaderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !teamLeaderId || !user) return;
    setSending(true);
    const { error } = await supabase.from("chat_messages").insert({
      sender_id: user.id, receiver_id: teamLeaderId, message: newMessage.trim(),
    } as any);
    if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
    setNewMessage("");
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (authLoading || loading) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        <div className="border-b border-border bg-card px-5 py-3 flex items-center gap-3 shrink-0">
          <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-3 w-16 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1" />
      </div>
    );
  }

  if (!teamLeaderId) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-heading font-bold">Chat</h1>
        </div>
        <Card>
          <CardContent className="pt-6 text-center space-y-3">
            <MessageCircle className="h-10 w-10 text-muted-foreground/30 mx-auto" />
            <p className="text-sm font-medium text-foreground">Dein Ansprechpartner wird dir in Kürze zugewiesen.</p>
            <p className="text-xs text-muted-foreground">Du wirst benachrichtigt, sobald dein Teamleiter bereit ist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="border-b border-border bg-card px-5 py-3 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="relative">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">{leaderInitials}</span>
          </div>
          {leader.is_online && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-accent border-2 border-card" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-foreground">{leader.name}</p>
            <BadgeCheck className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-[10px] text-muted-foreground">{lastActiveText}{!leader.is_online && ` · ${leader.response_time}`}</p>
        </div>
        <Badge variant="secondary" className="text-[10px] bg-accent/10 text-accent gap-1">
          <ShieldCheck className="h-3 w-3" />
          Verifiziert
        </Badge>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
        {messages.length === 0 && !isTyping && (
          <div className="text-center py-12 px-6">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/10 ring-4 ring-primary/5">
              <span className="text-2xl font-bold text-primary">{leaderInitials}</span>
            </div>
            <p className="text-lg font-heading font-bold text-foreground">{leader.name}</p>
            <p className="text-xs text-muted-foreground mt-1">{leader.title || "Dein persönlicher Ansprechpartner"}</p>
            {leader.is_online && (
              <Badge variant="secondary" className="mt-2 text-[10px] bg-accent/10 text-accent gap-1 px-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent inline-block animate-pulse" />
                Online
              </Badge>
            )}
            <div className="mt-6 mx-auto max-w-[260px] bg-muted/50 border border-border rounded-2xl px-4 py-3">
              <p className="text-sm text-foreground/80">👋 Hallo! Ich bin für dich da – bei Fragen, Problemen oder wenn du Hilfe brauchst. Schreib mir einfach!</p>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-4">
              {leader.is_online ? "Antwort in wenigen Minuten" : leader.response_time}
            </p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isMine = msg.sender_id === user!.id;
          const isSys = isSystemMessage(msg, teamLeaderId);
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const showDateSep = !prevMsg || new Date(prevMsg.created_at).toDateString() !== new Date(msg.created_at).toDateString();
          const sameSenderAsPrev = prevMsg && prevMsg.sender_id === msg.sender_id &&
            !showDateSep &&
            (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) < 120000;

          // Extract action buttons for system/leader messages
          const chatActions = !isMine ? extractChatActions(msg.message) : [];

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {formatDateSeparator(msg.created_at)}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}

              {isSys ? (
                <div className="flex justify-center my-3">
                  <div className="bg-gradient-to-r from-muted/80 to-muted/50 border border-border rounded-2xl px-5 py-3 max-w-[85%]">
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                    {chatActions.length > 0 && (
                      <ChatActionButtons actions={chatActions} />
                    )}
                    <p className="text-[9px] text-muted-foreground/60 mt-2 text-center">
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className={cn("flex items-end gap-2", isMine ? "justify-end" : "justify-start", sameSenderAsPrev ? "mt-0.5" : "mt-3")}>
                  {!isMine && (
                    <div className={cn("h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 mb-1", sameSenderAsPrev && "invisible")}>
                      <span className="text-[10px] font-bold text-primary">{leaderInitials}</span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[70%] px-4 py-2.5 text-sm transition-all",
                      isMine
                        ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md shadow-sm shadow-primary/20"
                        : "bg-card border border-border text-foreground rounded-2xl rounded-bl-md shadow-sm"
                    )}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                    {!isMine && chatActions.length > 0 && (
                      <ChatActionButtons actions={chatActions} />
                    )}
                    <p className={cn("text-[10px] mt-1", isMine ? "text-primary-foreground/50" : "text-muted-foreground/60")}>
                      {formatTime(msg.created_at)}
                      {isMine && msg.read && " · Gelesen"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-end gap-2 mt-3 animate-fade-in">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 mb-1">
              <span className="text-[10px] font-bold text-primary">{leaderInitials}</span>
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card px-5 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nachricht schreiben…"
            className="flex-1 rounded-xl border-border/60 focus-visible:ring-primary/30"
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className="h-10 w-10 rounded-xl transition-all hover:scale-105 active:scale-95"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
