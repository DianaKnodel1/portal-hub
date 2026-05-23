import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_employee/sms")({
  component: SmsPage,
});

import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/SkeletonLoaders";
import { Phone, MessageSquare, Lock, RefreshCw } from "lucide-react";
import { hasFullAccess } from "@/lib/employee-utils";
import type { EmployeeStatus } from "@/lib/status";
import { useToast } from "@/hooks/use-toast";

interface AssignedChannel {
  assignment_id: string;
  is_active: boolean;
  note: string;
  assigned_at: string;
  channel: {
    id: string;
    label: string;
    phone_number: string;
    provider: string;
    is_active: boolean;
  };
}

interface SmsMessage {
  id: string;
  from_number: string;
  to_number: string;
  body: string;
  direction: string;
  status: string;
  created_at: string;
}

function SmsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [accessAllowed, setAccessAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assignedChannels, setAssignedChannels] = useState<AssignedChannel[]>([]);
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    init();
  }, [user, authLoading]);

  const init = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles").select("status").eq("user_id", user!.id).maybeSingle();
      const allowed = hasFullAccess(profile?.status as EmployeeStatus | undefined);
      setAccessAllowed(allowed);
      if (allowed) await loadData();
    } catch {
      setError("SMS-Nummer konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setError(null);

      const { data: asg, error: asgError } = await (supabase as any).rpc("get_my_sms_assignments");
      if (asgError) throw asgError;

      const merged: AssignedChannel[] = ((asg ?? []) as any[]).map((row) => ({
        assignment_id: row.assignment_id,
        is_active: row.is_active,
        note: row.note ?? "",
        assigned_at: row.assigned_at,
        channel: {
          id: row.channel_id,
          label: row.label,
          phone_number: row.phone_number,
          provider: row.provider,
          is_active: row.channel_is_active,
        },
      }));

      setAssignedChannels(merged);

      const { data: msgs, error: msgError } = await supabase
        .from("sms_messages")
        .select("id, from_number, to_number, body, direction, status, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (msgError) throw msgError;
      setMessages((msgs as SmsMessage[]) ?? []);
    } catch (err) {
      console.error("[SmsPage] Laden fehlgeschlagen", err);
      setAssignedChannels([]);
      setMessages([]);
      setError("SMS-Nummer konnte nicht geladen werden.");
      throw err;
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
      toast({ title: "Aktualisiert" });
    } finally {
      setRefreshing(false);
    }
  };

  if (authLoading || loading) {
    return <div className="p-6 lg:p-8 max-w-4xl mx-auto"><TableSkeleton rows={3} cols={3} /></div>;
  }

  if (!accessAllowed) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl mx-auto">
        <EmptyState
          icon={Lock}
          title="Du wurdest noch nicht freigeschaltet"
          description="Sobald dein Profil angenommen wurde, siehst du hier deine zugewiesene SMS-Nummer."
          actionLabel="Zum Dashboard"
          onAction={() => navigate("/dashboard")}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl mx-auto">
        <EmptyState
          icon={MessageSquare}
          title="SMS-Nummer konnte nicht geladen werden"
          description="Bitte versuche es erneut oder kontaktiere deinen Ansprechpartner."
          actionLabel="Erneut laden"
          onAction={refresh}
        />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">SMS</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {assignedChannels.length === 0
              ? "Keine Nummer zugewiesen"
              : `${assignedChannels.length} ${assignedChannels.length === 1 ? "Nummer" : "Nummern"} zugewiesen`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
          Aktualisieren
        </Button>
      </div>

      {assignedChannels.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="Keine SMS-Nummer zugewiesen"
          description="Sobald dir eine Nummer zugewiesen wurde, siehst du sie hier."
        />
      ) : (
        <>
          {/* Zugewiesene Nummern */}
          <div className="grid gap-3 sm:grid-cols-2">
            {assignedChannels.map((a) => (
              <Card key={a.assignment_id} className="border-border/60">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-mono text-base font-semibold text-foreground truncate">
                        {a.channel.phone_number}
                      </p>
                      {a.channel.label && (
                        <p className="text-xs text-muted-foreground truncate">{a.channel.label}</p>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        a.channel.is_active && a.is_active
                          ? "bg-accent/15 text-accent text-[10px]"
                          : "bg-muted text-muted-foreground text-[10px]"
                      }
                    >
                      {a.channel.is_active && a.is_active ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </div>
                  {a.note && (
                    <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">
                      {a.note}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* SMS-Verlauf */}
          <Card>
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Letzte Nachrichten</h2>
              </div>
              {messages.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Noch keine Nachrichten empfangen.
                </div>
              ) : (
                <div className="divide-y divide-border max-h-[420px] overflow-auto">
                  {messages.map((m) => (
                    <div key={m.id} className="px-4 py-3 hover:bg-muted/30">
                      <div className="flex items-center justify-between mb-1">
                        <Badge
                          variant="secondary"
                          className={
                            m.direction === "inbound"
                              ? "bg-accent/10 text-accent text-[10px]"
                              : "bg-primary/10 text-primary text-[10px]"
                          }
                        >
                          {m.direction === "inbound" ? "↓ Eingang" : "↑ Ausgang"}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(m.created_at).toLocaleString("de-DE")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        {m.direction === "inbound" ? `Von ${m.from_number}` : `An ${m.to_number}`}
                      </p>
                      <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">
                        {m.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
