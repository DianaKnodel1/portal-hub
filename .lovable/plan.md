## Plan: Großes Update

### A — Onboarding-Tour (Step 6 → 7 Crash)

Schritt 7 (`calendar`) navigiert über `route: "/appointments"` neu, dabei wird der ganze Tour-State zurückgesetzt, weil `GuidedOnboarding` neu mountet. Lösung:

- Tour-State auf einen globalen Store anheben (Zustand in `localStorage` + Context) → überlebt Routenwechsel.
- `findTimeoutRef`-Polling robuster (länger als 2s, mit Logging).
- Tour bricht NIE mehr durch Navigation/Logout/Reload ab; läuft sauber von Schritt 1 bis 15.

### B — Arbeitsvertrag korrekt zuordnen

Profile haben oft kein `employment_type` (Altdaten). Lösung:

1. In `/contract` (StepContract-Pfad): wenn `profile.employment_type` fehlt, **inline-Auswahl Minijob/Teilzeit/Vollzeit** anzeigen (statt zu blocken). Wahl wird in `profiles.employment_type` persistiert und dann zum entsprechenden Tenant-Template geladen.
2. Template-Lookup bleibt wie er ist (tenant_id + employment_type + is_active → highest version) → liefert automatisch:
   - Kadermarketing-Tenant + Minijob → KM-Minijob-Vertrag
   - Digital DGI + Vollzeit → DGI-Vollzeit-Vertrag
3. Fallback-Hinweis (kein passendes Template) klar anzeigen.

### C — Erfolgsmeldung nach Abschluss

Nach Abschluss aller Schritte (KYC eingereicht ODER Personalausweis hochgeladen + Vertrag unterzeichnet) zeigt das Dashboard eine prominente Karte:

> "Deine Registrierung wird geprüft. Der Vorgang dauert i.d.R. 24 Stunden."

Bleibt sichtbar bis `profiles.status = 'angenommen'`.

### D — Admin: Mitarbeiter-Verwaltung

1. **Tenant-Spalte** in `admin.employees.index.tsx` ergänzen (mit Badge).
2. **Hart-Löschen-Button** mit Bestätigungs-Dialog ("MITARBEITER LÖSCHEN" eintippen). Ruft neue Server-Function `deleteEmployee` auf, die per `supabaseAdmin`:
   - alle abhängigen Daten löscht (cascade über DB-Constraints — wir prüfen welche Tabellen FK haben)
   - `auth.admin.deleteUser(userId)` aufruft
3. **Teamleiter-Profilbild**: Bug in `useTeamLeader` / Avatar-Component beheben — Storage-Pfad `team-leaders/<leaderId>.png` → signed URL.

### E — Chat-Verbesserungen

1. **Zeilenumbruch im Chat-Input**: `<Input>` → `<Textarea>` mit `Shift+Enter` = Newline, `Enter` = Senden. Gilt für `/_employee/chat.tsx` und `admin.chat.tsx`.
2. **Realtime aktivieren** (Migration):
   ```sql
   ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
   ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
   ```
   Nachrichten erscheinen sofort bei beiden Seiten ohne Reload.
3. **Chat-Performance**: 
   - Sidebar/Chat-Liste lädt aktuell pro Mitarbeiter `chat_messages` einzeln → durch eine Aggregations-Query ersetzen (last_message + unread_count via einer SQL-Funktion mit `lateral join`).
   - Indizes prüfen/erstellen: `chat_messages(sender_id, receiver_id, created_at desc)`.
4. **Letzter Login**: 
   - In Chat-Liste neben Mitarbeitername: "Zuletzt aktiv: vor 2h" oder "Online".
   - Quelle: `auth.users.last_sign_in_at` (über admin-Function geladen, da nicht in public).

### Technische Details

- **Migrationen** (SQL):
  - Realtime auf `chat_messages` aktivieren
  - Index `idx_chat_messages_pair_time` auf `(sender_id, receiver_id, created_at desc)`
  - SQL-Function `get_chat_thread_summaries(_admin_id uuid)` für effiziente Chat-Liste
- **Server-Functions** (`createServerFn`):
  - `deleteEmployee({ userId })` – admin-only, hart-löscht inkl. auth.
  - `getEmployeeLastSignIn({ userIds: string[] })` – Map userId → last_sign_in_at.
- **UI-Änderungen**:
  - `GuidedOnboarding` → State in `localStorage` (überlebt Mount/Unmount).
  - `/_employee/contract.tsx` → Inline-Auswahl der Beschäftigungsart.
  - `/_employee/dashboard.tsx` → "In Prüfung"-Karte.
  - `admin.employees.index.tsx` → Tenant-Spalte + Löschen-Button.
  - `/_employee/chat.tsx` + `admin.chat.tsx` → Textarea + Realtime + Last-Login.
  - `useTeamLeader` Avatar-Fix.

### Ablauf

1. Migration anlegen (Realtime + Index + RPC).
2. Backend-Functions (`deleteEmployee`, `getEmployeeLastSignIn`).
3. UI-Änderungen.
4. Build/Deploy-Anleitung am Ende.
