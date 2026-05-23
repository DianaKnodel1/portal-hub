#!/usr/bin/env bash
# =============================================================================
#  setup-server2.sh — Erst-Setup für den Portal-Server (Server 2)
# =============================================================================
#  Auf Server 2 läuft noch nichts. Dieses Skript installiert:
#    1. Bun + git + nginx
#    2. Klont das Portal-Repo nach /var/www/portal
#    3. Legt eine .env mit den self-hosted Supabase URLs an
#    4. Erstellt einen systemd-Service (portal.service), der das Portal
#       als TanStack-Start-Server auf Port 3000 laufen lässt
#    5. Konfiguriert nginx als Reverse-Proxy (Port 80 → 3000)
#
#  AUF SERVER 2 ALS ROOT AUSFÜHREN:
#    bash setup-server2.sh
# =============================================================================
set -euo pipefail

# ── CONFIG ─────────────────────────────────────────────────────────────────
REPO_URL="${REPO_URL:?REPO_URL nicht gesetzt — z.B. https://github.com/dein-user/dein-portal.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
PROJECT_DIR="${PROJECT_DIR:-/opt/apps/portal}"
# Alle Domains, die auf dieses Portal zeigen (space-separated)
PORTAL_DOMAINS="${PORTAL_DOMAINS:-mb-portal.de mb-portal.com portal.mb-portal.com portal.digital-dgigmbh.de portal.kadermarketing-agentur.de}"
# Pfad zum vorhandenen Let's-Encrypt-Cert (wird wiederverwendet)
SSL_CERT_DIR="${SSL_CERT_DIR:-/etc/letsencrypt/live/mb-portal.de}"

# self-hosted Supabase (Server 3) — für die .env
SUPABASE_URL="${SUPABASE_URL:?SUPABASE_URL nicht gesetzt — z.B. https://supabase.deine-domain.de}"
SUPABASE_PUBLISHABLE_KEY="${SUPABASE_PUBLISHABLE_KEY:?SUPABASE_PUBLISHABLE_KEY nicht gesetzt}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY nicht gesetzt}"

log() { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }
ok()  { printf "\033[1;32m  ✓ %s\033[0m\n" "$*"; }

# ── 1) System-Pakete ───────────────────────────────────────────────────────
log "1/6  System aktualisieren + Basis-Pakete installieren"
if command -v dnf >/dev/null; then
  dnf install -y git curl unzip nginx
elif command -v apt-get >/dev/null; then
  apt-get update
  apt-get install -y git curl unzip nginx ca-certificates
else
  echo "Weder dnf noch apt gefunden — manuell installieren: git curl unzip nginx"; exit 1
fi
ok "Basis-Pakete installiert"

# ── 2) Bun installieren ────────────────────────────────────────────────────
log "2/6  Bun installieren"
if ! command -v bun >/dev/null; then
  curl -fsSL https://bun.sh/install | bash
  ln -sf /root/.bun/bin/bun /usr/local/bin/bun
fi
bun --version
ok "Bun installiert"

# ── 3) Repo klonen ─────────────────────────────────────────────────────────
log "3/6  Repo klonen nach $PROJECT_DIR"
mkdir -p "$(dirname "$PROJECT_DIR")"
if [ -d "$PROJECT_DIR/.git" ]; then
  echo "  Existiert bereits — Backup + pull statt clone"
  cp -a "$PROJECT_DIR" "${PROJECT_DIR}.backup-$(date +%Y%m%d-%H%M%S)"
  cd "$PROJECT_DIR"
  git fetch origin
  git checkout "$REPO_BRANCH"
  git pull --ff-only origin "$REPO_BRANCH"
else
  git clone --branch "$REPO_BRANCH" "$REPO_URL" "$PROJECT_DIR"
  cd "$PROJECT_DIR"
fi
ok "Repo bereit"

# ── 4) .env schreiben ──────────────────────────────────────────────────────
log "4/6  .env mit self-hosted Supabase-Daten schreiben"
cat > "$PROJECT_DIR/.env" <<EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY
SUPABASE_URL=$SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
EOF
chmod 600 "$PROJECT_DIR/.env"
ok ".env angelegt"

# ── 5) Build + systemd-Service ─────────────────────────────────────────────
log "5/6  Build + systemd-Service einrichten"
cd "$PROJECT_DIR"
bun install --frozen-lockfile
bun run build

cat > /etc/systemd/system/portal.service <<EOF
[Unit]
Description=Mitarbeiter-/Admin-Portal (TanStack Start)
After=network.target

[Service]
Type=simple
WorkingDirectory=$PROJECT_DIR
EnvironmentFile=$PROJECT_DIR/.env
ExecStart=/usr/local/bin/bun run start
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable portal.service
systemctl restart portal.service
sleep 3
systemctl status portal.service --no-pager | head -n 15
ok "Portal läuft als systemd-Service auf Port 3000"

# ── 6) nginx Reverse-Proxy ─────────────────────────────────────────────────
log "6/6  nginx Reverse-Proxy konfigurieren (alte Config wird gesichert)"

# Alte SPA-Config sichern (nicht löschen — Rollback möglich)
if [ -f /etc/nginx/conf.d/mb-portal.de.conf ]; then
  mv /etc/nginx/conf.d/mb-portal.de.conf \
     /etc/nginx/conf.d/mb-portal.de.conf.bak-$(date +%Y%m%d-%H%M%S)
fi

cat > /etc/nginx/conf.d/portal.conf <<EOF
# --- HTTP → HTTPS Redirect (alle Domains) ---
server {
  listen 80;
  listen [::]:80;
  server_name $PORTAL_DOMAINS www.mb-portal.de www.mb-portal.com;

  location /.well-known/acme-challenge/ {
    root /var/www/html;
  }

  location / {
    return 301 https://\$host\$request_uri;
  }
}

# --- www → apex Redirects ---
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name www.mb-portal.de;
  ssl_certificate $SSL_CERT_DIR/fullchain.pem;
  ssl_certificate_key $SSL_CERT_DIR/privkey.pem;
  return 301 https://mb-portal.de\$request_uri;
}
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name www.mb-portal.com;
  ssl_certificate $SSL_CERT_DIR/fullchain.pem;
  ssl_certificate_key $SSL_CERT_DIR/privkey.pem;
  return 301 https://mb-portal.com\$request_uri;
}

# --- Hauptblock: Reverse-Proxy zu Bun (Port 3000) ---
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name $PORTAL_DOMAINS;

  ssl_certificate $SSL_CERT_DIR/fullchain.pem;
  ssl_certificate_key $SSL_CERT_DIR/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;

  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;

  client_max_body_size 50M;

  # Cloudflare: echte Client-IP aus CF-Connecting-IP
  set_real_ip_from 173.245.48.0/20;
  set_real_ip_from 103.21.244.0/22;
  set_real_ip_from 103.22.200.0/22;
  set_real_ip_from 103.31.4.0/22;
  set_real_ip_from 141.101.64.0/18;
  set_real_ip_from 108.162.192.0/18;
  set_real_ip_from 190.93.240.0/20;
  set_real_ip_from 188.114.96.0/20;
  set_real_ip_from 197.234.240.0/22;
  set_real_ip_from 198.41.128.0/17;
  set_real_ip_from 162.158.0.0/15;
  set_real_ip_from 104.16.0.0/13;
  set_real_ip_from 104.24.0.0/14;
  set_real_ip_from 172.64.0.0/13;
  set_real_ip_from 131.0.72.0/22;
  real_ip_header CF-Connecting-IP;

  # Reverse-Proxy zu TanStack-Start (Bun) — KEIN root mehr, kein dist/
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 300s;
  }
}
EOF

nginx -t
systemctl enable nginx
systemctl restart nginx
ok "nginx läuft"

log "Fertig 🎉"
cat <<EOF

Nächste Schritte:
  • DNS: A-Record für $PORTAL_DOMAIN auf diesen Server zeigen lassen
  • HTTPS: certbot --nginx -d $PORTAL_DOMAIN  (Let's Encrypt)
  • Test: curl http://127.0.0.1:3000   (sollte HTML zurückgeben)

Service-Befehle:
  systemctl status portal     # Status
  systemctl restart portal    # Neustart
  journalctl -u portal -f     # Live-Logs
EOF