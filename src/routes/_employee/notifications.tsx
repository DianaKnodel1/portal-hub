import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { Bell, CheckCheck, AlertCircle, Info, FileWarning, FileCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_employee/notifications")({
  component: NotificationsPage,
});

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

function iconFor(type: string) {
  switch (type) {
    case "warning":
    case "task_rejected":
      return FileWarning;
    case "success":
    case "task_approved":
      return FileCheck2;
    case "error":
      return AlertCircle;
    default:
      return Info;
  }
}

function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  const load = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data ?? []) as Notification[]);
    setLoading(false);
  };

  const markAllRead = async () => {
    const unread = items.filter((n) => !n.read).map((n) => n.id);
    if (unread.length === 0) return;
    await supabase.from("notifications").update({ read: true } as any).in("id", unread);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5" /> Mitteilungen
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Updates zu deinen Aufträgen, Verifizierung und Vertrag.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1.5">
            <CheckCheck className="h-4 w-4" /> Alle als gelesen
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Laden…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Keine Mitteilungen"
          description="Hier siehst du Updates – z.B. wenn ein Auftrag abgelehnt oder freigegeben wurde, Termine bestätigt werden oder deine Verifizierung sich ändert."
        />
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const Icon = iconFor(n.type);
            return (
              <Card key={n.id} className={cn("border-border/60", !n.read && "border-primary/40 bg-primary/[0.03]")}>
                <CardContent className="p-4 flex gap-3">
                  <div className="shrink-0 mt-0.5">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{n.title}</h3>
                      {!n.read && <Badge variant="secondary" className="text-[10px] bg-primary/15 text-primary">neu</Badge>}
                    </div>
                    {n.message && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.message}</p>}
                    <p className="text-[11px] text-muted-foreground/70">
                      {new Date(n.created_at).toLocaleString("de-DE")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}