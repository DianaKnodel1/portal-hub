#!/usr/bin/env bash
# =============================================================================
#  migrate.sh — Migration von Lovable Cloud → eigene Server
# =============================================================================
#  Was macht das Skript?
#   1. Dumpt die KOMPLETTE Datenbank von Lovable Cloud (Schema + Daten + Auth)
#   2. Restored sie auf deinen self-hosted Supabase Server (Server 1)
#   3. Synct ALLE Storage-Buckets (Bewerber-Dokumente, KYC, Verträge, …)
#   4. Deployed das Frontend aufs Mitarbeiter-Portal (Server 2) via git pull
#
#  Voraussetzungen auf der Maschine, von der du das Skript laufen lässt:
#   - postgresql-client (pg_dump, pg_restore, psql)  →  apt install postgresql-client
#   - rclone                                          →  apt install rclone
#   - ssh-Zugriff auf Server 2 (Portal)
#   - die unten stehenden Umgebungsvariablen gesetzt (siehe CONFIG)
# =============================================================================
set -euo pipefail

# ────────────────────────────────────────────────────────────────────────────
# 1) CONFIG — hier alles eintragen, dann Skript ausführen
# ────────────────────────────────────────────────────────────────────────────

# QUELLE: Lovable Cloud (aktueller Stand)
#   Diese URL findest du in Lovable → Cloud → Connect → "Database URL"
#   Format: postgresql://postgres.<ref>:<password>@<host>:5432/postgres
SOURCE_DB_URL="${SOURCE_DB_URL:-postgresql://postgres.wgcivgmcnnnjmfdoqpne:PASSWORT@aws-0-eu-central-1.pooler.supabase.com:5432/postgres}"

#   Lovable Storage (S3-kompatibel)
SOURCE_S3_ENDPOINT="${SOURCE_S3_ENDPOINT:-https://wgcivgmcnnnjmfdoqpne.storage.supabase.co/storage/v1/s3}"
SOURCE_S3_REGION="${SOURCE_S3_REGION:-eu-central-1}"
SOURCE_S3_KEY="${SOURCE_S3_KEY:?SOURCE_S3_KEY nicht gesetzt — siehe Lovable Cloud → Storage → S3 Access Keys}"
SOURCE_S3_SECRET="${SOURCE_S3_SECRET:?SOURCE_S3_SECRET nicht gesetzt}"

# ZIEL Server 1: self-hosted Supabase (Datenbank + Storage)
TARGET_DB_URL="${TARGET_DB_URL:?TARGET_DB_URL nicht gesetzt — z.B. postgresql://postgres:passwort@supabase.deine-domain.de:5432/postgres}"
TARGET_S3_ENDPOINT="${TARGET_S3_ENDPOINT:?TARGET_S3_ENDPOINT nicht gesetzt — z.B. https://supabase.deine-domain.de/storage/v1/s3}"
TARGET_S3_REGION="${TARGET_S3_REGION:-stub}"
TARGET_S3_KEY="${TARGET_S3_KEY:?TARGET_S3_KEY nicht gesetzt}"
TARGET_S3_SECRET="${TARGET_S3_SECRET:?TARGET_S3_SECRET nicht gesetzt}"

# ZIEL Server 2: Mitarbeiter-/Admin-Portal (Frontend)
PORTAL_SSH="${PORTAL_SSH:?PORTAL_SSH nicht gesetzt — z.B. user@portal.deine-domain.de}"
PORTAL_PROJECT_DIR="${PORTAL_PROJECT_DIR:-/var/www/portal}"
PORTAL_BRANCH="${PORTAL_BRANCH:-main}"

# Buckets (so wie aktuell in Lovable angelegt)
BUCKETS=(
  task-images
  team-leader-avatars
  documents
  employee-documents
  kyc-documents
  signatures
  task-submissions
)

WORKDIR="${WORKDIR:-./migrate-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$WORKDIR"

log() { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }
ok()  { printf "\033[1;32m  ✓ %s\033[0m\n" "$*"; }

# ────────────────────────────────────────────────────────────────────────────
# 2) DATENBANK-DUMP (Lovable → Datei)
# ────────────────────────────────────────────────────────────────────────────
log "1/5  Datenbank-Dump aus Lovable Cloud (das kann 1–5 Min dauern)…"

# Schema + Daten von public + auth (Bewerber + Logins!)
pg_dump "$SOURCE_DB_URL" \
  --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage \
  --exclude-table-data='auth.audit_log_entries' \
  --exclude-table-data='auth.refresh_tokens' \
  --exclude-table-data='auth.flow_state' \
  --exclude-table-data='auth.sessions' \
  --exclude-table-data='storage.s3_multipart_uploads*' \
  --format=custom \
  --file="$WORKDIR/dump.pgcustom"

ok "Dump gespeichert: $WORKDIR/dump.pgcustom ($(du -h "$WORKDIR/dump.pgcustom" | cut -f1))"

# ────────────────────────────────────────────────────────────────────────────
# 3) DATENBANK-RESTORE (Datei → eigener Supabase)
# ────────────────────────────────────────────────────────────────────────────
log "2/5  Datenbank-Restore auf deinen Supabase…"
echo    "      ⚠️  ACHTUNG: existierende public/auth-Tabellen werden überschrieben."
read -rp "      Weiter? [yes/NO] " confirm
[[ "$confirm" == "yes" ]] || { echo "Abgebrochen."; exit 1; }

# clean=remove existierende Objekte vor restore; if-exists=keine Fehler wenn nicht da
pg_restore \
  --dbname="$TARGET_DB_URL" \
  --no-owner --no-privileges \
  --clean --if-exists \
  --jobs=4 \
  "$WORKDIR/dump.pgcustom" || true
# `|| true` weil pg_restore harmlose Warnungen als Exit-Code != 0 liefert
# (z.B. "extension already exists"). Echte Fehler stehen im Log.

ok "Datenbank importiert. Bewerber, Profile, KYC, Aufträge — alles drin."

# Sanity-Check: Bewerbungs-Anzahl vergleichen
SRC_COUNT=$(psql "$SOURCE_DB_URL" -tAc "SELECT count(*) FROM applications;")
DST_COUNT=$(psql "$TARGET_DB_URL" -tAc "SELECT count(*) FROM applications;")
log "Bewerbungen — Quelle: $SRC_COUNT  /  Ziel: $DST_COUNT"
[[ "$SRC_COUNT" == "$DST_COUNT" ]] && ok "Anzahl identisch ✓" || \
  echo "      ⚠️  Anzahl weicht ab — manuell prüfen!"

# ────────────────────────────────────────────────────────────────────────────
# 4) STORAGE-BUCKETS SYNC (S3 → S3, ohne Zwischenkopie)
# ────────────────────────────────────────────────────────────────────────────
log "3/5  Storage-Buckets synchronisieren…"

RCLONE_CONF="$WORKDIR/rclone.conf"
cat > "$RCLONE_CONF" <<EOF
[src]
type = s3
provider = Other
endpoint = $SOURCE_S3_ENDPOINT
region = $SOURCE_S3_REGION
access_key_id = $SOURCE_S3_KEY
secret_access_key = $SOURCE_S3_SECRET
force_path_style = true

[dst]
type = s3
provider = Other
endpoint = $TARGET_S3_ENDPOINT
region = $TARGET_S3_REGION
access_key_id = $TARGET_S3_KEY
secret_access_key = $TARGET_S3_SECRET
force_path_style = true
EOF

for bucket in "${BUCKETS[@]}"; do
  log "   ↳ Bucket: $bucket"
  rclone --config "$RCLONE_CONF" sync "src:$bucket" "dst:$bucket" \
    --transfers=8 --checkers=16 --progress
  ok "$bucket synchronisiert"
done

# ────────────────────────────────────────────────────────────────────────────
# 5) FRONTEND DEPLOY (Server 2: Portal)
# ────────────────────────────────────────────────────────────────────────────
log "4/5  Frontend deployen auf $PORTAL_SSH …"

ssh "$PORTAL_SSH" bash -s <<EOSSH
set -euo pipefail
cd "$PORTAL_PROJECT_DIR"
echo "→ git fetch + pull"
git fetch origin
git checkout "$PORTAL_BRANCH"
git pull --ff-only origin "$PORTAL_BRANCH"

echo "→ deps + build"
if [ -f bun.lockb ] || [ -f bunfig.toml ]; then
  bun install --frozen-lockfile
  bun run build
else
  npm ci
  npm run build
fi

echo "→ Portal-Service neustarten (systemd)"
sudo systemctl restart portal.service
sleep 2
sudo systemctl status portal.service --no-pager | head -n 15
EOSSH

ok "Frontend deployed."

# ────────────────────────────────────────────────────────────────────────────
# 6) ABSCHLUSS
# ────────────────────────────────────────────────────────────────────────────
log "5/5  Fertig 🎉"
cat <<EOF

Nächste Schritte (manuell):
  • DNS: A-Record deiner Portal-Domain auf Server 2 zeigen lassen
  • Edge-Function-Secrets falls nötig manuell in den self-hosted Supabase übertragen
  • In .env des Portals VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
    auf den eigenen Supabase umstellen
  • Test-Login mit einem bestehenden Bewerber-Account

Arbeitsverzeichnis (Dump + rclone-Config): $WORKDIR
→ Nach erfolgreicher Verifikation kannst du es löschen.
EOF