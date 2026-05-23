// ── Shared email log types, status config ──

export interface EmailLog {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  metadata: any;
  created_at: string;
}

export const EMAIL_STATUS_COLORS: Record<string, string> = {
  sent: "bg-accent text-accent-foreground border border-accent font-semibold",
  failed: "bg-destructive text-destructive-foreground border border-destructive font-semibold",
  dlq: "bg-destructive text-destructive-foreground border border-destructive font-semibold",
  bounced: "bg-destructive text-destructive-foreground border border-destructive font-semibold",
  complained: "bg-status-pending/20 text-status-pending border border-status-pending/30 font-medium",
  suppressed: "bg-status-pending/20 text-status-pending border border-status-pending/30 font-medium",
};

export const EMAIL_STATUS_LABELS: Record<string, string> = {
  sent: "Gesendet",
  failed: "Fehlgeschlagen",
  dlq: "Endgültig fehlgeschlagen",
  bounced: "Gebounced",
  complained: "Beschwerde",
  suppressed: "Unterdrückt",
};

export const EMAIL_TYPE_LABELS: Record<string, string> = {
  invitation: "Einladung",
  test_email: "Test",
  auth_emails: "Auth / Reset",
  "contact-confirmation": "Kontakt",
  auth_recovery: "Passwort-Reset",
  auth_signup: "Bestätigung",
  auth_confirmation: "Bestätigung",
  auth_invite: "Einladung",
  auth_magiclink: "Magic Link",
};

export interface EmailStats {
  total: number;
  sent: number;
  failed: number;
  bounced: number;
  suppressed: number;
  successRate: number;
  actionRequired: boolean;
}

/**
 * Compute email stats from logs. Each log = 1 email (no deduplication needed).
 * Only counts final statuses (sent, failed, etc.) - no pending.
 */
export function computeEmailStats(logs: EmailLog[]): EmailStats {
  // Filter out any stale pending entries (should not exist with new logic)
  const finalLogs = logs.filter(l => l.status !== "pending");
  const total = finalLogs.length;
  const sent = finalLogs.filter(l => l.status === "sent").length;
  const failed = finalLogs.filter(l => ["failed", "dlq"].includes(l.status)).length;
  const bounced = finalLogs.filter(l => l.status === "bounced").length;
  const suppressed = finalLogs.filter(l => l.status === "suppressed").length;
  const successRate = total > 0 ? Math.round((sent / total) * 100) : 100;

  return {
    total,
    sent,
    failed,
    bounced,
    suppressed,
    actionRequired: failed > 0 || bounced > 0,
    successRate,
  };
}
