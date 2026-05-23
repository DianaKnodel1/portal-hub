// ── Central status definitions ──
// ALL status labels, colors, and icons live here. Import from this file only.

export type EmployeeStatus =
  | "registriert"
  | "angenommen"
  | "abgelehnt"
  | "deaktiviert";

export type KycStatus =
  | "nicht_gestartet"
  | "eingereicht"
  | "in_pruefung"
  | "verifiziert"
  | "abgelehnt";

export type OnboardingStatus =
  | "nicht_gestartet"
  | "in_bearbeitung"
  | "abgeschlossen";

export type TaskAssignmentStatus =
  | "entwurf"
  | "zugewiesen"
  | "geplant"
  | "in_bearbeitung"
  | "eingereicht"
  | "in_pruefung"
  | "genehmigt"
  | "abgelehnt"
  | "nachbesserung"
  | "abgeschlossen";

export type TransactionStatus =
  | "ausstehend"
  | "gutgeschrieben"
  | "genehmigt"
  | "ausgezahlt";

// ── Shared config shape ──
interface StatusEntry { label: string; color: string; }

// ── KYC ──
export const KYC_STATUS_CONFIG: Record<KycStatus, StatusEntry> = {
  nicht_gestartet: { label: "Nicht gestartet", color: "bg-muted text-foreground border border-border" },
  eingereicht:     { label: "Eingereicht",     color: "bg-status-info text-status-info-foreground" },
  in_pruefung:     { label: "In Prüfung",      color: "bg-status-pending text-status-pending-foreground" },
  verifiziert:     { label: "Verifiziert",     color: "bg-status-success text-status-success-foreground" },
  abgelehnt:       { label: "Abgelehnt",       color: "bg-destructive text-destructive-foreground" },
};

// ── Onboarding ──
export const ONBOARDING_STATUS_CONFIG: Record<OnboardingStatus, StatusEntry> = {
  nicht_gestartet: { label: "Nicht gestartet", color: "bg-muted text-foreground border border-border" },
  in_bearbeitung:  { label: "In Bearbeitung",  color: "bg-status-pending text-status-pending-foreground" },
  abgeschlossen:   { label: "Abgeschlossen",   color: "bg-status-success text-status-success-foreground" },
};

// ── Employee status ──
export const STATUS_CONFIG: Record<EmployeeStatus, StatusEntry & { step: number; hint: string }> = {
  registriert: { label: "Registriert", step: 1, color: "bg-status-info text-status-info-foreground", hint: "Dein Konto wurde registriert." },
  angenommen:  { label: "Angenommen",  step: 2, color: "bg-status-success text-status-success-foreground", hint: "Du bist freigeschaltet." },
  abgelehnt:   { label: "Abgelehnt",   step: 0, color: "bg-destructive text-destructive-foreground", hint: "Dein Konto wurde abgelehnt." },
  deaktiviert: { label: "Deaktiviert", step: 0, color: "bg-status-neutral text-status-neutral-foreground", hint: "Dein Zugang wurde deaktiviert." },
};

export const STATUS_ORDER: EmployeeStatus[] = [
  "registriert", "angenommen", "abgelehnt", "deaktiviert",
];

// ── Task assignment ──
export const TASK_STATUS_CONFIG: Record<TaskAssignmentStatus, StatusEntry> = {
  entwurf:        { label: "Entwurf",        color: "bg-muted text-foreground border border-border" },
  zugewiesen:     { label: "Zugewiesen",     color: "bg-status-info text-status-info-foreground" },
  geplant:        { label: "Geplant",        color: "bg-status-info text-status-info-foreground" },
  in_bearbeitung: { label: "In Bearbeitung", color: "bg-status-pending text-status-pending-foreground" },
  eingereicht:    { label: "Eingereicht",    color: "bg-status-info text-status-info-foreground" },
  in_pruefung:    { label: "In Prüfung",     color: "bg-status-pending text-status-pending-foreground" },
  genehmigt:      { label: "Genehmigt",      color: "bg-status-success text-status-success-foreground" },
  abgelehnt:      { label: "Abgelehnt",      color: "bg-destructive text-destructive-foreground" },
  nachbesserung:  { label: "Nachbesserung",  color: "bg-status-pending text-status-pending-foreground" },
  abgeschlossen:  { label: "Abgeschlossen",  color: "bg-status-success text-status-success-foreground" },
};

// ── Transaction ──
export const TRANSACTION_STATUS_CONFIG: Record<TransactionStatus, StatusEntry> = {
  ausstehend:     { label: "Ausstehend",     color: "bg-status-pending text-status-pending-foreground" },
  gutgeschrieben: { label: "Gutgeschrieben", color: "bg-status-info text-status-info-foreground" },
  genehmigt:      { label: "Genehmigt",      color: "bg-status-success text-status-success-foreground" },
  ausgezahlt:     { label: "Ausgezahlt",     color: "bg-status-success text-status-success-foreground" },
};

// ── Helper: renders a consistent Badge className ──
export function statusBadgeClass(color: string): string {
  return `text-[10px] font-semibold px-2 py-0.5 ${color}`;
}

// ── Utilities ──
export function isKycRequired(employeeStatus: EmployeeStatus): boolean {
  return employeeStatus === "registriert";
}

export function checkRiskFlag(livingSince: string | null): boolean {
  if (!livingSince) return false;
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  return new Date(livingSince) > threeYearsAgo;
}
