// Übersetzt Supabase Auth Fehlermeldungen auf Deutsch
export function translateAuthError(message: string | undefined | null): string {
  if (!message) return "Ein unbekannter Fehler ist aufgetreten.";
  const m = message.toLowerCase();

  if (m.includes("password is known to be weak") || m.includes("pwned") || m.includes("compromised")) {
    return "Dieses Passwort gilt als unsicher. Bitte wähle ein anderes (mindestens 6 Zeichen).";
  }
  if (m.includes("password should be at least") || m.includes("at least 6")) {
    return "Das Passwort muss mindestens 6 Zeichen lang sein.";
  }
  if (m.includes("password") && m.includes("weak")) {
    return "Das Passwort ist zu schwach. Bitte wähle ein stärkeres Passwort.";
  }
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already")) {
    return "Diese E-Mail-Adresse ist bereits registriert.";
  }
  if (m.includes("invalid login credentials") || m.includes("invalid_credentials")) {
    return "E-Mail oder Passwort falsch.";
  }
  if (m.includes("email not confirmed")) {
    return "Bitte bestätige zuerst deine E-Mail-Adresse.";
  }
  if (m.includes("valid email") || m.includes("invalid email")) {
    return "Bitte gib eine gültige E-Mail-Adresse ein.";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Zu viele Versuche. Bitte warte kurz und versuche es erneut.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Verbindungsfehler. Bitte prüfe deine Internetverbindung.";
  }
  if (m.includes("token") && m.includes("expired")) {
    return "Der Link ist abgelaufen. Bitte fordere einen neuen an.";
  }
  if (m.includes("user not found")) {
    return "Kein Konto mit dieser E-Mail-Adresse gefunden.";
  }
  // Fallback: Originalmessage
  return message;
}
