// Übersetzt typische Postgres/Supabase-Fehler auf verständliches Deutsch
export function translateDbError(message: string | undefined | null): string {
  if (!message) return "Ein unbekannter Fehler ist aufgetreten.";
  const m = message.toLowerCase();

  // null value in column "X" of relation "Y" violates not-null constraint
  const nullMatch = message.match(/null value in column "?([^"\s]+)"?/i);
  if (nullMatch) {
    return `Pflichtfeld fehlt: „${nullMatch[1]}". Bitte vervollständige deine Daten oder kontaktiere den Administrator.`;
  }

  if (m.includes("violates foreign key")) {
    return "Verknüpfter Datensatz nicht gefunden. Bitte Seite neu laden.";
  }
  if (m.includes("violates unique") || m.includes("duplicate key")) {
    return "Dieser Eintrag existiert bereits.";
  }
  if (m.includes("violates check constraint")) {
    return "Die Eingabe entspricht nicht den Vorgaben.";
  }
  if (m.includes("permission denied") || m.includes("row-level security") || m.includes("rls")) {
    return "Keine Berechtigung für diese Aktion.";
  }
  if (m.includes("jwt") && m.includes("expired")) {
    return "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.";
  }
  if (m.includes("network") || m.includes("failed to fetch")) {
    return "Verbindungsfehler. Bitte prüfe deine Internetverbindung.";
  }
  return message;
}