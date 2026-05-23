import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface SmsMsg {
  id: string;
  direction: string;
  from_number: string;
  to_number: string;
  body: string;
  media_url: string | null;
  created_at: string;
}

export function TaskSmsMessages({ assignmentId }: { assignmentId: string }) {
  const [messages, setMessages] = useState<SmsMsg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMessages();
  }, [assignmentId]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from("sms_messages")
      .select("id, direction, from_number, to_number, body, media_url, created_at")
      .eq("assignment_id", assignmentId)
      .order("created_at", { ascending: true });
    setMessages((data as SmsMsg[]) ?? []);
    setLoading(false);
  };

  if (loading) return null;
  if (messages.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        SMS-Nachrichten
        <Badge variant="secondary" className="text-[10px]">{messages.length}</Badge>
      </h3>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex flex-col gap-0.5 px-3 py-2 rounded-lg text-sm max-w-[85%]",
              msg.direction === "inbound"
                ? "bg-muted/60 border border-border self-start"
                : "bg-primary/10 border border-primary/20 self-end ml-auto"
            )}
          >
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-mono">{msg.direction === "inbound" ? msg.from_number : msg.to_number}</span>
              <span>·</span>
              <span>{new Date(msg.created_at).toLocaleString("de-DE")}</span>
            </div>
            <p className="text-foreground whitespace-pre-wrap">{msg.body}</p>
            {msg.media_url && (
              <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                📎 Anhang
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
