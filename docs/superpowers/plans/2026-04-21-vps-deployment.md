# TrackMyContainer VPS Deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-04-21-vps-deployment-design.md`

**Goal:** Migrate TrackMyContainer from cloud Supabase to a self-hosted deployment on VPS `37.60.232.123` serving `https://trackmycontainer.info`.

**Architecture:** Docker Compose on a single Ubuntu 24.04 VPS. Nginx Proxy Manager terminates TLS and routes two hostnames — apex to the Next.js app, `supabase.` subdomain (Basic-Auth gated) to Kong. Full Supabase stack (Postgres + GoTrue + PostgREST + Realtime + Storage + Kong + Studio + Meta) runs in its own compose project. App + BullMQ worker run in a second compose project. Code is deployed via `git clone` from `MaysaHjazi/TrackMyContainer` using a read-only deploy key.

**Tech Stack:** Docker Engine + Compose v2, Nginx Proxy Manager, `supabase/docker` reference stack, Postgres 15, Node.js 20 (Next.js 15 + BullMQ worker), Ubuntu 24.04 LTS, Let's Encrypt, UFW, Upstash Redis (unchanged), Resend (unchanged).

---

## File Structure (new files in repo)

| Path | Purpose |
|------|---------|
| `.gitignore` | Exclude secrets, build output, deps |
| `Dockerfile` | Production image for Next.js app |
| `Dockerfile.worker` | Production image for BullMQ worker |
| `docker-compose.prod.yml` | Orchestrates app + worker on VPS |
| `.dockerignore` | Exclude dev artifacts from build context |
| `docs/DEPLOYMENT.md` | Runbook: deploy update, restart, restore, logs |
| `scripts/tmc-backup.sh` | Daily pg_dump backup script (installed to VPS) |
| `scripts/dump-cloud.sh` | One-time dump script for Phase 3 migration |

Reused (already in repo):
- `src/backend/worker/index.ts` — worker entrypoint
- `src/backend/worker/processors/*` — worker job processors
- `prisma/schema.prisma` — Prisma schema
- `package.json` — dependencies + scripts

---

## Credentials reference (use these verbatim)

- VPS: `root@37.60.232.123` / password `maryamtalal55555`
- GitHub: `https://github.com/MaysaHjazi/TrackMyContainer.git`
- Cloud Supabase DB (for dump): `postgresql://postgres.jtsosbbfqipomejqcmim:Maysa0541231995@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres` (use **port 5432, not 6543** — pg_dump hates pgbouncer)
- Resend: `re_3DhGcenq_8jWDF4mtQHsv6oQABax8o7yU`
- Studio Basic Auth: user `admin` / password `M0541231995`

---

# Phase 1 — VPS Foundation

Output at end of phase: a locked-down Ubuntu host running Docker + Nginx Proxy Manager, reachable on ports 80/443/22 only, with swap and auto-security-updates configured.

## Task 1: Verify SSH and record baseline

**Files:** none (shell commands only)

- [ ] **Step 1: Open SSH session**

Run from local machine:
```bash
python -c "
import paramiko
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('37.60.232.123', username='root', password='maryamtalal55555', timeout=15)
_, out, _ = c.exec_command('lsb_release -d; uname -r; free -h; df -h /; nproc')
print(out.read().decode())
c.close()
"
```

Expected output contains:
```
Ubuntu 24.04
```
and non-zero values for memory, disk, cores.

- [ ] **Step 2: Set a proper hostname**

```bash
ssh root@37.60.232.123 "hostnamectl set-hostname tmc-prod && hostname"
```
Expected output: `tmc-prod`

- [ ] **Step 3: Update apt index**

```bash
ssh root@37.60.232.123 "apt-get update && apt-get -y upgrade"
```
Expected: no errors, "0 upgraded" OR a list of upgraded packages, ends with `done`.

## Task 2: Create swap file and non-root user

- [ ] **Step 1: Create 4 GB swap**

```bash
ssh root@37.60.232.123 << 'EOF'
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -h
EOF
```
Expected last-line output: `Swap:          4.0Gi        0B       4.0Gi`

- [ ] **Step 2: Create deploy user `tmc` with sudo**

```bash
ssh root@37.60.232.123 << 'EOF'
adduser --disabled-password --gecos "" tmc
usermod -aG sudo tmc
mkdir -p /home/tmc/.ssh && chmod 700 /home/tmc/.ssh
cp /root/.ssh/authorized_keys /home/tmc/.ssh/ 2>/dev/null || touch /home/tmc/.ssh/authorized_keys
chmod 600 /home/tmc/.ssh/authorized_keys
chown -R tmc:tmc /home/tmc/.ssh
echo "tmc ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/tmc
chmod 0440 /etc/sudoers.d/tmc
id tmc
EOF
```
Expected: `uid=1000(tmc) gid=1000(tmc) groups=1000(tmc),27(sudo)`

## Task 3: Configure UFW firewall

- [ ] **Step 1: Install UFW and set defaults**

```bash
ssh root@37.60.232.123 << 'EOF'
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
yes | ufw enable
ufw status verbose
EOF
```

Expected output last lines:
```
Status: active
...
22/tcp                     ALLOW IN    Anywhere
80/tcp                     ALLOW IN    Anywhere
443/tcp                    ALLOW IN    Anywhere
```

## Task 4: Install Docker Engine and Compose

- [ ] **Step 1: Run Docker official convenience script**

```bash
ssh root@37.60.232.123 << 'EOF'
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
usermod -aG docker tmc
docker --version
docker compose version
EOF
```

Expected:
```
Docker version 27.x.x, build ...
Docker Compose version v2.x.x
```

- [ ] **Step 2: Verify docker daemon responds**

```bash
ssh root@37.60.232.123 "docker run --rm hello-world | head -5"
```
Expected output contains: `Hello from Docker!`

## Task 5: Create shared Docker network

- [ ] **Step 1: Create the `tmc-net` network**

```bash
ssh root@37.60.232.123 "docker network create tmc-net && docker network ls | grep tmc-net"
```
Expected last line: `xxxxxxxx   tmc-net   bridge    local`

## Task 6: Deploy Nginx Proxy Manager

**Files (on VPS):** `/opt/npm/docker-compose.yml`

- [ ] **Step 1: Create NPM compose file**

```bash
ssh root@37.60.232.123 << 'EOF'
mkdir -p /opt/npm
cat > /opt/npm/docker-compose.yml << 'YML'
services:
  npm:
    image: jc21/nginx-proxy-manager:2.11.3
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "127.0.0.1:81:81"   # admin UI: localhost only, SSH-tunnel to access
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
    networks:
      - tmc-net
networks:
  tmc-net:
    external: true
YML
cd /opt/npm && docker compose up -d
sleep 10
docker compose ps
EOF
```

Expected: one row with `Up` or `running` status for service `npm`.

- [ ] **Step 2: Verify NPM admin UI responds locally on VPS**

```bash
ssh root@37.60.232.123 "curl -sI http://127.0.0.1:81 | head -3"
```
Expected: `HTTP/1.1 200 OK` (first few lines).

- [ ] **Step 3: Open SSH tunnel from local to NPM admin**

Run in a **separate local terminal window** (keep open while configuring NPM):
```bash
ssh -L 8181:127.0.0.1:81 root@37.60.232.123
```

- [ ] **Step 4: Log in to NPM UI**

In browser open `http://localhost:8181` — default credentials:
- Email: `admin@example.com`
- Password: `changeme`

NPM prompts to change these immediately. Set:
- Name: `Maysa Hjazi`
- Email: `maysahjazi32@gmail.com`
- Password: `M0541231995`

Expected: admin dashboard loads after change.

## Task 7: Enable unattended-upgrades

- [ ] **Step 1: Install and configure**

```bash
ssh root@37.60.232.123 << 'EOF'
apt-get install -y unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
systemctl enable --now unattended-upgrades
systemctl status unattended-upgrades --no-pager | head -5
EOF
```
Expected: line with `Active: active (running)` or `active (exited)`.

## Phase 1 Verification

- [ ] SSH works: `ssh root@37.60.232.123 hostname` returns `tmc-prod`
- [ ] Swap active: `ssh root@37.60.232.123 "free -h | grep Swap"` shows 4.0 Gi
- [ ] UFW active: `ssh root@37.60.232.123 "ufw status | head -2"` shows `Status: active`
- [ ] Docker works: `ssh root@37.60.232.123 "docker ps"` runs without error
- [ ] NPM running: `ssh root@37.60.232.123 "docker ps | grep proxy-manager"` shows Up
- [ ] NPM UI accessible via tunnel at `http://localhost:8181` with `admin@example.com` already replaced by new credentials

---

# Phase 2 — Self-Hosted Supabase

Output at end of phase: Supabase stack running on VPS, Studio reachable at `https://supabase.trackmycontainer.info` (Basic-Auth gated), REST API working on same host.

## Task 8: Clone Supabase reference compose

- [ ] **Step 1: Fetch the official compose files**

```bash
ssh root@37.60.232.123 << 'EOF'
apt-get install -y git jq
mkdir -p /opt/supabase && cd /opt/supabase
git clone --depth 1 https://github.com/supabase/supabase.git src-upstream
cp -r src-upstream/docker/* .
cp src-upstream/docker/.env.example .env
rm -rf src-upstream
ls -la
EOF
```
Expected: listing includes `docker-compose.yml`, `.env`, `volumes/`.

## Task 9: Generate Supabase secrets

- [ ] **Step 1: Generate JWT secret, anon key, service role key, DB password**

Run this **locally** (not on VPS) — it prints values you'll paste into VPS `.env`:
```bash
python3 << 'EOF'
import secrets, json, time, base64, hmac, hashlib
jwt_secret = secrets.token_urlsafe(48)
db_password = secrets.token_urlsafe(24)
dashboard_password = secrets.token_urlsafe(16)

def sign(payload):
    header = base64.urlsafe_b64encode(json.dumps({"alg":"HS256","typ":"JWT"}).encode()).rstrip(b'=')
    body   = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b'=')
    msg    = header + b'.' + body
    sig    = base64.urlsafe_b64encode(hmac.new(jwt_secret.encode(), msg, hashlib.sha256).digest()).rstrip(b'=')
    return (msg + b'.' + sig).decode()

now = int(time.time())
anon = sign({"iss":"supabase","role":"anon","iat":now,"exp":now+60*60*24*365*5})
service = sign({"iss":"supabase","role":"service_role","iat":now,"exp":now+60*60*24*365*5})

print(f"JWT_SECRET={jwt_secret}")
print(f"ANON_KEY={anon}")
print(f"SERVICE_ROLE_KEY={service}")
print(f"POSTGRES_PASSWORD={db_password}")
print(f"DASHBOARD_PASSWORD={dashboard_password}")
EOF
```
Copy the 5 values; they're needed in the next step.

## Task 10: Configure Supabase `.env`

- [ ] **Step 1: Edit `/opt/supabase/.env` on VPS**

Replace `<FROM_TASK_9>` placeholders with the values from Task 9.

```bash
ssh root@37.60.232.123 << 'EOF'
cd /opt/supabase
# Back up original example first
cp .env .env.orig

cat > .env << 'ENV'
############
# Secrets (from Task 9 — replace these 5 lines)
############
POSTGRES_PASSWORD=<FROM_TASK_9>
JWT_SECRET=<FROM_TASK_9>
ANON_KEY=<FROM_TASK_9>
SERVICE_ROLE_KEY=<FROM_TASK_9>
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<FROM_TASK_9>

############
# Database
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

############
# API proxy
############
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

############
# API: external URL (for OAuth redirects, emails)
############
API_EXTERNAL_URL=https://supabase.trackmycontainer.info
SUPABASE_PUBLIC_URL=https://supabase.trackmycontainer.info
SITE_URL=https://trackmycontainer.info
ADDITIONAL_REDIRECT_URLS=https://trackmycontainer.info,https://www.trackmycontainer.info

############
# Auth
############
DISABLE_SIGNUP=false
JWT_EXPIRY=3600
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
MAILER_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false

############
# SMTP (Resend)
############
SMTP_ADMIN_EMAIL=onboarding@resend.dev
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_3DhGcenq_8jWDF4mtQHsv6oQABax8o7yU
SMTP_SENDER_NAME=TrackMyContainer

############
# Storage
############
STORAGE_BACKEND=file
FILE_SIZE_LIMIT=52428800

############
# Studio
############
STUDIO_DEFAULT_ORGANIZATION=TrackMyContainer
STUDIO_DEFAULT_PROJECT=Production

############
# Realtime
############
DEFAULT_ORGANIZATION_NAME=TrackMyContainer
DEFAULT_PROJECT_NAME=Production

############
# Functions (not used but must be defined)
############
FUNCTIONS_VERIFY_JWT=false
IMGPROXY_ENABLE_WEBP_DETECTION=true

############
# Logs
############
LOGFLARE_API_KEY=unused
LOGFLARE_LOGGER_BACKEND_API_KEY=unused

############
# Pooler (required by newer supabase/docker)
############
POOLER_PROXY_PORT_TRANSACTION=6543
POOLER_DEFAULT_POOL_SIZE=20
POOLER_MAX_CLIENT_CONN=100
POOLER_TENANT_ID=tmc
POOLER_DB_POOL_SIZE=5
ENV
chmod 600 .env
ls -la .env
EOF
```
Expected: `-rw------- 1 root root ... .env`

- [ ] **Step 2: Attach Supabase compose to `tmc-net`**

```bash
ssh root@37.60.232.123 << 'EOF'
cd /opt/supabase
# Add external network to the compose file so kong joins tmc-net
python3 << 'PY'
import yaml, pathlib
p = pathlib.Path('docker-compose.yml')
d = yaml.safe_load(p.read_text())
d.setdefault('networks', {})
d['networks']['tmc-net'] = {'external': True}
# Attach every service that needs to be reachable from NPM
for svc in ['kong', 'studio']:
    if svc in d['services']:
        d['services'][svc].setdefault('networks', ['default'])
        if isinstance(d['services'][svc]['networks'], list):
            if 'tmc-net' not in d['services'][svc]['networks']:
                d['services'][svc]['networks'].append('tmc-net')
            if 'default' not in d['services'][svc]['networks']:
                d['services'][svc]['networks'].append('default')
        else:
            d['services'][svc]['networks']['tmc-net'] = None
            d['services'][svc]['networks']['default'] = None
p.write_text(yaml.dump(d, default_flow_style=False, sort_keys=False))
print("Attached kong+studio to tmc-net")
PY
grep -A2 "tmc-net" docker-compose.yml | head -10
EOF
```
Expected: grep shows `tmc-net:` and `external: true` present.

## Task 11: Start Supabase stack

- [ ] **Step 1: Pull and launch**

```bash
ssh root@37.60.232.123 "cd /opt/supabase && docker compose pull 2>&1 | tail -5 && docker compose up -d"
```
Expected last output: `✔ Container supabase-xxx  Started` for each service (kong, db, auth, rest, realtime, storage, studio, meta, imgproxy).

- [ ] **Step 2: Wait 30s for all services to be healthy**

```bash
ssh root@37.60.232.123 "sleep 30 && cd /opt/supabase && docker compose ps"
```

Expected: every service shows `Up (healthy)` OR `Up` (for services without health checks). If any shows `Restarting`, check logs: `docker compose logs <service> --tail 50`.

- [ ] **Step 3: Hit Kong from VPS locally**

```bash
ssh root@37.60.232.123 "curl -s http://127.0.0.1:8000/rest/v1/ -H 'apikey: ANON_KEY_FROM_TASK_9' | head -c 200"
```
Expected output starts with JSON: `{"swagger":"2.0", ...}` or similar OpenAPI schema.

## Task 12: Configure NPM host for `supabase.trackmycontainer.info`

- [ ] **Step 1: Open NPM UI** (browser at `http://localhost:8181` via the SSH tunnel from Task 6)

- [ ] **Step 2: Create Proxy Host**

Navigate to **Hosts → Proxy Hosts → Add Proxy Host** and fill:

| Field | Value |
|-------|-------|
| Domain Names | `supabase.trackmycontainer.info` |
| Scheme | `http` |
| Forward Hostname | `supabase-kong` (Docker service DNS name) |
| Forward Port | `8000` |
| Cache Assets | ON |
| Block Common Exploits | ON |
| Websockets Support | **ON** (needed for Realtime) |

Tab **Custom locations** → add one location:
- Location: `/project` (Studio UI mount path)
- Scheme: `http`
- Forward Hostname: `supabase-studio`
- Forward Port: `3000`

- [ ] **Step 3: Add Access List (Basic Auth)**

In NPM UI → **Access Lists → Add Access List**:
- Name: `studio-admin`
- Satisfy: `All`
- **Access**: Leave empty (no IP allow-list)
- **Authorization** tab → add:
  - Username: `admin`
  - Password: `M0541231995`

Then edit the proxy host created in Step 2, **Access List**: select `studio-admin`, save.

- [ ] **Step 4: SSL tab (stays disabled for now — Let's Encrypt happens in Phase 5)**

Save the proxy host.

- [ ] **Step 5: Verify routing works on plain HTTP**

From local machine:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://supabase.trackmycontainer.info/rest/v1/
```
Expected: `401` (Kong needs API key, but routing works — proves NPM → Kong reached).

```bash
curl -s -u admin:M0541231995 -I http://supabase.trackmycontainer.info/project 2>&1 | head -3
```
Expected: `HTTP/1.1 200 OK` or `301` (Studio responding through Basic Auth).

## Phase 2 Verification

- [ ] `docker compose -f /opt/supabase/docker-compose.yml ps` shows all services Up
- [ ] `curl http://127.0.0.1:8000/rest/v1/` from VPS returns 401 (auth required, but responding)
- [ ] `http://supabase.trackmycontainer.info/project` prompts for Basic Auth in browser
- [ ] After Basic Auth, Supabase Studio UI loads (may show "no projects" until data migration)

---

# Phase 3 — Data Migration

Output at end of phase: self-hosted Postgres contains every row and every auth user currently in cloud Supabase; existing user can log in with same password.

## Task 13: Dump cloud public schema

**Files (local):** `scripts/dump-cloud.sh`

- [ ] **Step 1: Create local dump script**

Create on local machine:
```bash
cat > D:/trackmycontainer/scripts/dump-cloud.sh << 'SH'
#!/usr/bin/env bash
# One-time: dump cloud Supabase for migration to self-host.
# Uses port 5432 (direct), not 6543 (pooler) — pg_dump can't talk to pgbouncer.
set -euo pipefail

CLOUD_URL="postgresql://postgres.jtsosbbfqipomejqcmim:Maysa0541231995@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
OUT_DIR="./migration-dumps"
mkdir -p "$OUT_DIR"

echo "==> Dumping public schema (tables, data, triggers, indexes, constraints)..."
pg_dump "$CLOUD_URL" \
  --schema=public \
  --no-owner --no-privileges \
  --format=plain \
  --file="$OUT_DIR/cloud-public.sql"

echo "==> Dumping auth schema (users, identities, sessions)..."
pg_dump "$CLOUD_URL" \
  --schema=auth \
  --data-only \
  --no-owner --no-privileges \
  --format=plain \
  --file="$OUT_DIR/cloud-auth.sql"

echo "==> Done. Files:"
ls -lh "$OUT_DIR"
SH
chmod +x D:/trackmycontainer/scripts/dump-cloud.sh
```

- [ ] **Step 2: Run the dump**

Requires `pg_dump` (Postgres client) installed locally. On Windows:
```bash
# Check if pg_dump is available
pg_dump --version
```
If missing: download "Command Line Tools" from https://www.postgresql.org/download/ (Postgres 15 client).

Then:
```bash
cd D:/trackmycontainer && bash scripts/dump-cloud.sh
```
Expected: `migration-dumps/cloud-public.sql` and `migration-dumps/cloud-auth.sql` both exist, non-empty (>1 KB).

- [ ] **Step 3: Sanity-check dumps**

```bash
grep -c "CREATE TABLE" D:/trackmycontainer/migration-dumps/cloud-public.sql
grep -c "INSERT INTO" D:/trackmycontainer/migration-dumps/cloud-public.sql
wc -l D:/trackmycontainer/migration-dumps/cloud-auth.sql
```
Expected: CREATE TABLE count ≥ 5 (Shipment, User, Subscription, TrackingEvent, Notification, etc.), INSERT count > 0, auth sql > 20 lines.

## Task 14: Upload dumps to VPS

- [ ] **Step 1: Copy over SSH**

```bash
scp -r D:/trackmycontainer/migration-dumps root@37.60.232.123:/tmp/
ssh root@37.60.232.123 "ls -lh /tmp/migration-dumps"
```
Expected: same two files visible on VPS with same sizes.

## Task 15: Import into self-hosted Postgres

- [ ] **Step 1: Import public schema**

```bash
ssh root@37.60.232.123 << 'EOF'
cd /opt/supabase
docker compose exec -T db psql -U supabase_admin -d postgres < /tmp/migration-dumps/cloud-public.sql 2>&1 | tail -20
EOF
```
Expected: no `ERROR:` lines in last output (warnings OK — duplicate extension, role already exists).

- [ ] **Step 2: Import auth data**

```bash
ssh root@37.60.232.123 << 'EOF'
cd /opt/supabase
docker compose exec -T db psql -U supabase_admin -d postgres < /tmp/migration-dumps/cloud-auth.sql 2>&1 | tail -20
EOF
```
Expected: `INSERT 0 N` lines (N = number of users/identities/etc.), no `ERROR:` lines.

If you see `duplicate key value violates unique constraint "users_pkey"`: the self-hosted DB already had a bootstrap user. Fix:
```bash
ssh root@37.60.232.123 "docker compose -f /opt/supabase/docker-compose.yml exec -T db psql -U supabase_admin -d postgres -c 'TRUNCATE auth.users, auth.identities, auth.sessions CASCADE;'"
```
Then re-run the import.

- [ ] **Step 3: Reset Postgres password in the stack to match .env**

The dump doesn't touch the postgres role password, so this is already correct. Skip.

## Task 16: Verify migration

- [ ] **Step 1: Compare row counts**

```bash
ssh root@37.60.232.123 << 'EOF'
cd /opt/supabase
for TBL in "public.\"Shipment\"" "public.\"User\"" "public.\"Subscription\"" "public.\"TrackingEvent\"" "public.\"Notification\"" "auth.users" "auth.identities"; do
  COUNT=$(docker compose exec -T db psql -U supabase_admin -d postgres -tAc "SELECT COUNT(*) FROM $TBL;")
  echo "$TBL: $COUNT"
done
EOF
```

Also from local machine (cloud):
```bash
for TBL in 'public."Shipment"' 'public."User"' 'public."Subscription"' 'public."TrackingEvent"' 'public."Notification"' 'auth.users' 'auth.identities'; do
  COUNT=$(psql "postgresql://postgres.jtsosbbfqipomejqcmim:Maysa0541231995@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" -tAc "SELECT COUNT(*) FROM $TBL;")
  echo "$TBL (cloud): $COUNT"
done
```

Expected: every pair matches exactly.

- [ ] **Step 2: Verify the existing user can authenticate**

```bash
ssh root@37.60.232.123 << 'EOF'
curl -s -X POST http://127.0.0.1:8000/auth/v1/token?grant_type=password \
  -H "apikey: ANON_KEY_FROM_TASK_9" \
  -H "Content-Type: application/json" \
  -d '{"email":"maysahjazi32@gmail.com","password":"<USER_KNOWN_PASSWORD>"}' | head -c 500
EOF
```
Expected: JSON containing `"access_token": "eyJ..."` (not `"error": "Invalid login credentials"`).

**If login fails** with valid password: `pg_dump` may have missed `auth.mfa_factors` or `auth.identities` rows. Re-run dump with `--schema=auth --schema=public` together and re-import.

- [ ] **Step 3: Verify triggers exist**

```bash
ssh root@37.60.232.123 << 'EOF'
cd /opt/supabase
docker compose exec -T db psql -U supabase_admin -d postgres -c "\
SELECT event_object_schema, event_object_table, trigger_name \
FROM information_schema.triggers \
WHERE trigger_schema IN ('public','auth') \
ORDER BY event_object_table;"
EOF
```
Expected: at least the Prisma-generated `updated_at` triggers for each table that has `updatedAt` (Shipment, User, etc.), plus Supabase auth triggers.

## Phase 3 Verification

- [ ] Row counts match cloud for every public table + auth.users + auth.identities
- [ ] API login works with `maysahjazi32@gmail.com`
- [ ] Triggers present in `information_schema.triggers`
- [ ] Studio → Table Editor (via `supabase.trackmycontainer.info/project` + Basic Auth) shows the Shipment table populated

---

# Phase 4 — App Deploy

Output at end of phase: Next.js + worker running in Docker, reachable at `http://trackmycontainer.info` (HTTP only — SSL in Phase 5).

## Task 17: Repo hygiene before first commit

**Files (local):** `.gitignore`, `.dockerignore`, `src/backend/worker/processors/tracking-poll.ts`

- [ ] **Step 1: Create `.gitignore`**

Write to `D:/trackmycontainer/.gitignore`:
```
# Dependencies
/node_modules/
/.pnp
.pnp.js

# Testing
/coverage
*.test.log

# Next.js
/.next/
/out/
next-env.d.ts

# Production
/build

# Misc
.DS_Store
*.pem
*.log

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files (SECRETS — NEVER COMMIT)
.env
.env.local
.env.production
.env.development
.env*.local

# Migration dumps (contain cloud secrets + user data)
/migration-dumps/

# Prisma
/prisma/migrations/dev/

# IDE
.vscode/
.idea/
*.swp
```

- [ ] **Step 2: Create `.dockerignore`**

Write to `D:/trackmycontainer/.dockerignore`:
```
node_modules
.next
.git
.github
.env*
!.env.example
migration-dumps
docs
*.md
!README.md
.vscode
.idea
```

- [ ] **Step 3: Fix stale domain reference**

File `D:/trackmycontainer/src/backend/worker/processors/tracking-poll.ts` line 80 currently reads:
```ts
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://trackmycontainer.ai";
```
Change the fallback to the correct domain:
```ts
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://trackmycontainer.info";
```

Verify nothing else uses the old domain:
```bash
cd D:/trackmycontainer && grep -rn "trackmycontainer\.ai" src/ --include="*.ts" --include="*.tsx"
```
Expected: no matches.

## Task 18: Create production `Dockerfile` for Next.js

**Files (local):** `Dockerfile`

- [ ] **Step 1: Write multi-stage Dockerfile**

Create `D:/trackmycontainer/Dockerfile`:
```dockerfile
# syntax=docker/dockerfile:1.6

# ---- base ----
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# ---- build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runtime ----
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Non-root user
RUN addgroup -S app && adduser -S -G app app

# Copy only what runtime needs
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/node_modules/.prisma ./node_modules/.prisma

USER app
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 2: Enable Next.js standalone output**

Modify `D:/trackmycontainer/next.config.ts` — add `output: "standalone"`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",                     // ← add this
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.maersk.com" },
      { protocol: "https", hostname: "**.shipsgo.com" },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["trackmycontainer.info", "www.trackmycontainer.info", "localhost:3000"],
    },
  },
};

export default nextConfig;
```

- [ ] **Step 3: Verify build works locally**

```bash
cd D:/trackmycontainer && npm run build 2>&1 | tail -10
```
Expected: `✓ Compiled successfully`, `.next/standalone/server.js` now exists:
```bash
ls D:/trackmycontainer/.next/standalone/server.js
```

## Task 19: Create `Dockerfile.worker`

**Files (local):** `Dockerfile.worker`

- [ ] **Step 1: Write Dockerfile.worker**

Create `D:/trackmycontainer/Dockerfile.worker`:
```dockerfile
# syntax=docker/dockerfile:1.6
FROM node:20-alpine
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

COPY . .
RUN npx prisma generate

ENV NODE_ENV=production
USER node
CMD ["npx", "tsx", "src/backend/worker/index.ts"]
```

The worker runs via `tsx` (lightweight TypeScript execution) — no separate build step needed for a long-running background process.

## Task 20: Create `docker-compose.prod.yml`

**Files (local):** `docker-compose.prod.yml`

- [ ] **Step 1: Write compose file**

Create `D:/trackmycontainer/docker-compose.prod.yml`:
```yaml
services:
  next-app:
    build:
      context: .
      dockerfile: Dockerfile
    image: tmc/next-app:latest
    container_name: tmc-next-app
    restart: unless-stopped
    env_file:
      - .env.production
    environment:
      - NODE_ENV=production
      - HOSTNAME=0.0.0.0
    networks:
      - tmc-net
    depends_on:
      - worker
    # No ports published — NPM reaches it via internal network

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    image: tmc/worker:latest
    container_name: tmc-worker
    restart: unless-stopped
    env_file:
      - .env.production
    networks:
      - tmc-net

networks:
  tmc-net:
    external: true
```

## Task 21: Initialize git locally and push to GitHub

- [ ] **Step 1: Initialize repo**

```bash
cd D:/trackmycontainer
git init
git branch -M main
git remote add origin https://github.com/MaysaHjazi/TrackMyContainer.git
git remote -v
```
Expected output:
```
origin  https://github.com/MaysaHjazi/TrackMyContainer.git (fetch)
origin  https://github.com/MaysaHjazi/TrackMyContainer.git (push)
```

- [ ] **Step 2: Stage everything respecting .gitignore**

```bash
cd D:/trackmycontainer
git add .
git status --short | head -30
```
Expected output: lots of `A` entries for source files, `A .gitignore`, `A Dockerfile`, etc.  
**Critical check**: NO `A .env` or `A .env.local` should appear. If they do, `.gitignore` is wrong — fix before committing.

- [ ] **Step 3: First commit**

```bash
cd D:/trackmycontainer
git commit -m "chore: initial commit — app + deployment config"
```

- [ ] **Step 4: Push to GitHub** (Maysa runs this in her own terminal — Git Credential Manager handles auth)

```bash
cd D:/trackmycontainer
git push -u origin main
```
Expected: new main branch visible at `https://github.com/MaysaHjazi/TrackMyContainer`.

## Task 22: Create SSH deploy key on VPS and add to GitHub

- [ ] **Step 1: Generate ed25519 key on VPS**

```bash
ssh root@37.60.232.123 << 'EOF'
sudo -u tmc ssh-keygen -t ed25519 -C "tmc@vps" -f /home/tmc/.ssh/tmc_github -N ""
cat /home/tmc/.ssh/tmc_github.pub
EOF
```
Copy the `ssh-ed25519 AAAA...` output line.

- [ ] **Step 2: Configure SSH client for GitHub**

```bash
ssh root@37.60.232.123 << 'EOF'
cat > /home/tmc/.ssh/config << 'CFG'
Host github.com
  Hostname github.com
  User git
  IdentityFile ~/.ssh/tmc_github
  IdentitiesOnly yes
CFG
chown tmc:tmc /home/tmc/.ssh/config
chmod 600 /home/tmc/.ssh/config
EOF
```

- [ ] **Step 3: Add deploy key to GitHub repo (Maysa does this manually)**

In browser: `https://github.com/MaysaHjazi/TrackMyContainer/settings/keys` → **Add deploy key**:
- Title: `vps-tmc-prod`
- Key: paste the public key from Step 1
- **Allow write access**: unchecked (read-only — safer)

Click **Add key**.

- [ ] **Step 4: Test clone**

```bash
ssh root@37.60.232.123 "sudo -u tmc ssh -o StrictHostKeyChecking=accept-new -T git@github.com 2>&1 | head -2"
```
Expected: `Hi MaysaHjazi/TrackMyContainer! You've successfully authenticated, but GitHub does not provide shell access.`

## Task 23: Clone repo on VPS and build app images

- [ ] **Step 1: Clone under `/opt/trackmycontainer/`**

```bash
ssh root@37.60.232.123 << 'EOF'
sudo -u tmc git clone git@github.com:MaysaHjazi/TrackMyContainer.git /opt/trackmycontainer
ls /opt/trackmycontainer
EOF
```
Expected: listing includes `package.json`, `Dockerfile`, `docker-compose.prod.yml`, `src/`, etc.

- [ ] **Step 2: Create `.env.production` on VPS**

Replace `<FROM_TASK_9>` placeholders with the values generated in Task 9 (ANON_KEY, SERVICE_ROLE_KEY, POSTGRES_PASSWORD).

```bash
ssh root@37.60.232.123 << 'EOF'
cat > /opt/trackmycontainer/.env.production << 'ENV'
# Public origin
NEXT_PUBLIC_APP_URL=https://trackmycontainer.info

# Self-hosted Supabase
NEXT_PUBLIC_SUPABASE_URL=https://supabase.trackmycontainer.info
NEXT_PUBLIC_SUPABASE_ANON_KEY=<FROM_TASK_9_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<FROM_TASK_9_SERVICE_ROLE_KEY>

# Database (through Docker network, directly to supabase-db)
DATABASE_URL=postgresql://postgres:<FROM_TASK_9_POSTGRES_PASSWORD>@supabase-db:5432/postgres
DIRECT_URL=postgresql://postgres:<FROM_TASK_9_POSTGRES_PASSWORD>@supabase-db:5432/postgres

# Email (Resend)
RESEND_API_KEY=re_3DhGcenq_8jWDF4mtQHsv6oQABax8o7yU
RESEND_FROM=onboarding@resend.dev

# Redis (Upstash — unchanged)
REDIS_URL=rediss://default:gQAAAAAAAWmjAAIncDFmM2E2ODc5ZWExYmM0ZTA2OTRlNWY1MjdiNWQwZDFiZHAxOTI1Nzk@amazed-eel-92579.upstash.io:6379
UPSTASH_REDIS_REST_URL=https://amazed-eel-92579.upstash.io
UPSTASH_REDIS_REST_TOKEN=gQAAAAAAAWmjAAIncDFmM2E2ODc5ZWExYmM0ZTA2OTRlNWY1MjdiNWQwZDFiZHAxOTI1Nzk

# Tracking APIs (unchanged)
JSONCARGO_API_KEY=__e3qD0LNlpRBY8Rl8UVVtubxOtpxD8qz8UxIUraARw
LUFTHANSA_CARGO_API_KEY=U8QmucODU4v8wVUmapShTefiNrpGoeYh1RuXRTLYZeGxO2Hq
QATAR_CARGO_CLIENT_ID=4e24b5deb1a04d53a6fbd766ead64629
QATAR_CARGO_CLIENT_SECRET=6425f8C00ba9453890c4D3707db0a604
QATAR_CARGO_BASE_URL=https://api-nprd.qrcargo.com
QATAR_CARGO_TOKEN_URL=https://api-nprd.qrcargo.com/qr-ua-cgo-mule-jwt-token-generator-v1/api/v1/token
ENV
chmod 600 /opt/trackmycontainer/.env.production
chown tmc:tmc /opt/trackmycontainer/.env.production
ls -la /opt/trackmycontainer/.env.production
EOF
```
Expected: `-rw------- 1 tmc tmc ... .env.production`

- [ ] **Step 3: Connect app compose to supabase-db**

The app talks to Supabase via the Docker service name `supabase-db` for direct Prisma connection and `supabase-kong` for REST/Auth. Both live on `tmc-net`, so this works automatically once both compose projects join it.

Verify:
```bash
ssh root@37.60.232.123 "docker network inspect tmc-net | grep -E 'Name|supabase|npm' | head -20"
```
Expected: list contains supabase-kong, supabase-db, NPM service, and (once we start them) tmc-next-app, tmc-worker.

- [ ] **Step 4: Build and start app + worker**

```bash
ssh root@37.60.232.123 << 'EOF'
cd /opt/trackmycontainer
docker compose -f docker-compose.prod.yml build 2>&1 | tail -20
docker compose -f docker-compose.prod.yml up -d
sleep 15
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail 20 next-app
EOF
```
Expected `ps` output: two rows, both `Up`. `logs next-app` shows `▲ Next.js 15.x.x` and `Ready`.

- [ ] **Step 5: Run Prisma generate inside next-app** (first-run compatibility)

```bash
ssh root@37.60.232.123 "docker exec tmc-next-app npx prisma migrate deploy 2>&1 | tail -10"
```
Expected: `All migrations have been successfully applied.` OR `No pending migrations to apply.` (because we imported the schema in Phase 3 already).

## Task 24: Configure NPM proxy host for apex + www

- [ ] **Step 1: Apex host** — in NPM UI (`http://localhost:8181` via tunnel):

**Hosts → Proxy Hosts → Add Proxy Host**:

| Field | Value |
|-------|-------|
| Domain Names | `trackmycontainer.info` |
| Scheme | `http` |
| Forward Hostname | `tmc-next-app` |
| Forward Port | `3000` |
| Cache Assets | ON |
| Block Common Exploits | ON |
| Websockets Support | ON |

Save.

- [ ] **Step 2: www redirect host**

**Hosts → Redirection Hosts → Add Redirection Host**:

| Field | Value |
|-------|-------|
| Domain Names | `www.trackmycontainer.info` |
| Scheme | `http` |
| Forward Hostname | `trackmycontainer.info` |
| Preserve Path | ON |
| HTTP Code | `301` Permanent |

Save.

- [ ] **Step 3: Verify via curl**

From local machine:
```bash
curl -sI http://trackmycontainer.info | head -5
curl -sI http://www.trackmycontainer.info | head -5
```
Expected apex: `HTTP/1.1 200 OK` with Next.js response headers.
Expected www: `HTTP/1.1 301 Moved Permanently` with `Location: http://trackmycontainer.info/`.

## Phase 4 Verification

- [ ] `http://trackmycontainer.info` loads the landing page in a browser
- [ ] `http://trackmycontainer.info/login` renders the login form
- [ ] Logging in as `maysahjazi32@gmail.com` succeeds
- [ ] Dashboard shows the 2–3 shipments imported in Phase 3
- [ ] `docker logs tmc-worker --tail 20` shows "All workers running" and no crashes

---

# Phase 5 — SSL + Finalize

Output at end of phase: HTTPS with valid Let's Encrypt, daily backups running, SSH restricted, runbook in repo.

## Task 25: Request Let's Encrypt certificates

- [ ] **Step 1: Edit apex proxy host — SSL tab**

In NPM UI → edit `trackmycontainer.info` host → **SSL tab**:
- SSL Certificate: `Request a new SSL Certificate`
- Force SSL: ON
- HTTP/2 Support: ON
- HSTS Enabled: ON
- Email Address for Let's Encrypt: `maysahjazi32@gmail.com`
- I Agree to the Let's Encrypt Terms of Service: ✓

**Add domain names**: `trackmycontainer.info` AND `www.trackmycontainer.info` in the certificate (one cert for both). If NPM asks, enable the redirect host to also use the same cert.

Click **Save**. NPM runs `certbot` — takes 15–30 seconds.

- [ ] **Step 2: Edit supabase host — SSL tab**

Same procedure for `supabase.trackmycontainer.info`. Single-domain cert.

- [ ] **Step 3: Verify HTTPS works**

```bash
curl -sI https://trackmycontainer.info | head -5
curl -sI https://supabase.trackmycontainer.info/rest/v1/ | head -5
```
Expected both: `HTTP/2 200` or `HTTP/2 401` (Kong needs apikey — still proves TLS works), and `strict-transport-security` header present.

- [ ] **Step 4: Verify HTTP → HTTPS redirect**

```bash
curl -sI http://trackmycontainer.info | head -5
```
Expected: `HTTP/1.1 301 Moved Permanently` with `Location: https://trackmycontainer.info/`.

## Task 26: Install daily backup cron

**Files (on VPS):** `/usr/local/bin/tmc-backup.sh`, `/etc/cron.d/tmc-pg-backup`

- [ ] **Step 1: Create backup script**

```bash
ssh root@37.60.232.123 << 'EOF'
mkdir -p /var/backups/pg
cat > /usr/local/bin/tmc-backup.sh << 'SH'
#!/usr/bin/env bash
set -euo pipefail
STAMP=$(date -u +%Y-%m-%d)
OUT="/var/backups/pg/backup-$STAMP.sql.gz"

# Use the running supabase-db container
docker exec supabase-db pg_dump -U supabase_admin -d postgres -Fp | gzip -9 > "$OUT"

# Rotate — keep last 7
ls -1t /var/backups/pg/backup-*.sql.gz | tail -n +8 | xargs -r rm -f

echo "[$STAMP] wrote $(ls -lh "$OUT" | awk '{print $5}')"
SH
chmod +x /usr/local/bin/tmc-backup.sh
EOF
```

- [ ] **Step 2: Create cron entry (03:00 UTC daily)**

```bash
ssh root@37.60.232.123 << 'EOF'
cat > /etc/cron.d/tmc-pg-backup << 'CRON'
# TrackMyContainer daily Postgres backup
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 3 * * * root /usr/local/bin/tmc-backup.sh >> /var/log/tmc-backup.log 2>&1
CRON
chmod 0644 /etc/cron.d/tmc-pg-backup
systemctl reload cron || service cron reload
EOF
```

- [ ] **Step 3: Run once manually to prove it works**

```bash
ssh root@37.60.232.123 "/usr/local/bin/tmc-backup.sh && ls -lh /var/backups/pg/"
```
Expected: one `.sql.gz` file, several KB to MB.

## Task 27: End-to-end smoke test

Everything in this task is done **in a browser** via `https://trackmycontainer.info`.

- [ ] **Step 1: Anonymous user**
  - Home page renders, no console errors (F12)
  - `/track/MEDU9091004` returns the shared tracking view with status timeline

- [ ] **Step 2: Existing user login**
  - Click **Login** → email `maysahjazi32@gmail.com` + existing password
  - Dashboard redirects successfully

- [ ] **Step 3: Data integrity check**
  - Dashboard stats cards match Phase 3 count (3 Total Tracked)
  - Right sidebar shows the 3 shipments
  - Map shows only non-delivered/non-AT_PORT dots (per 2026-04-20 row-actions design)

- [ ] **Step 4: Write path**
  - Click **+ Add Shipment** → enter `MSCU1234567` + type SEA → submit
  - New shipment appears in the list within 5 seconds
  - SSH check: `docker logs tmc-worker --tail 30` should show a new `tracking-poll` job (may fail if number is fake, that's fine — we're testing the enqueue)

- [ ] **Step 5: Delete path**
  - Open the dropdown on the just-added shipment → **Delete** → confirm
  - Row disappears. Verify in Studio → Table Editor → Shipment that row is gone (hard delete works).

- [ ] **Step 6: Supabase Studio access**
  - Open `https://supabase.trackmycontainer.info/project` → Basic Auth prompts `admin` / `M0541231995`
  - Studio opens, Table Editor shows all tables with data

## Task 28: SSH hardening

**Only do this AFTER Phase 5 smoke test passes** — locking yourself out now is expensive.

- [ ] **Step 1: Generate a local SSH key (if not already)**

Run **on your Windows machine** (not VPS):
```bash
ls C:/Users/akass/.ssh/id_ed25519.pub 2>/dev/null || ssh-keygen -t ed25519 -f C:/Users/akass/.ssh/id_ed25519 -N ""
cat C:/Users/akass/.ssh/id_ed25519.pub
```

- [ ] **Step 2: Install your pubkey on `tmc` user**

```bash
PUBKEY=$(cat C:/Users/akass/.ssh/id_ed25519.pub)
ssh root@37.60.232.123 "echo '$PUBKEY' >> /home/tmc/.ssh/authorized_keys && chown tmc:tmc /home/tmc/.ssh/authorized_keys && chmod 600 /home/tmc/.ssh/authorized_keys"
```

- [ ] **Step 3: Test new login path BEFORE locking down root**

In a NEW terminal:
```bash
ssh tmc@37.60.232.123 "whoami && sudo -n whoami"
```
Expected output:
```
tmc
root
```

If this fails — DO NOT proceed. Something's wrong with keys or sudoers.

- [ ] **Step 4: Disable root password login**

```bash
ssh root@37.60.232.123 << 'EOF'
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
grep -E "^(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication)" /etc/ssh/sshd_config
systemctl restart ssh
EOF
```
Expected grep output:
```
PermitRootLogin prohibit-password
PasswordAuthentication no
PubkeyAuthentication yes
```

- [ ] **Step 5: Verify lockdown took effect**

From local — this should NOW FAIL:
```bash
ssh -o PubkeyAuthentication=no root@37.60.232.123 echo "should not see this"
```
Expected: `Permission denied (publickey).` — this is correct. Password auth is dead.

From local — this should still work:
```bash
ssh tmc@37.60.232.123 "uptime"
```
Expected: uptime output.

## Task 29: Create `docs/DEPLOYMENT.md` runbook

**Files (local):** `docs/DEPLOYMENT.md`

- [ ] **Step 1: Write the runbook**

Create `D:/trackmycontainer/docs/DEPLOYMENT.md`:

````markdown
# TrackMyContainer — Production Deployment Runbook

Host: `tmc@37.60.232.123` (SSH key only — password auth disabled)
Repo: `/opt/trackmycontainer/`
Supabase: `/opt/supabase/`
NPM: `/opt/npm/`

## Deploy an application update

```bash
ssh tmc@37.60.232.123
cd /opt/trackmycontainer
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs --tail 50 next-app
```

Downtime: ~3–5 seconds while containers swap (no zero-downtime yet).

## Restart services

```bash
# App only
cd /opt/trackmycontainer && docker compose -f docker-compose.prod.yml restart

# Supabase stack
cd /opt/supabase && docker compose restart

# NPM
cd /opt/npm && docker compose restart
```

## Access NPM admin UI

NPM admin is bound to localhost only. From your local machine:
```bash
ssh -L 8181:127.0.0.1:81 tmc@37.60.232.123
# Then open http://localhost:8181
```

## Read logs

```bash
docker logs tmc-next-app --tail 200 --follow
docker logs tmc-worker   --tail 200 --follow
docker compose -f /opt/supabase/docker-compose.yml logs --tail 100 db
```

## Restore DB from backup

1. Stop the app to avoid writes:
   ```bash
   cd /opt/trackmycontainer && docker compose -f docker-compose.prod.yml down
   ```
2. Restore:
   ```bash
   gunzip -c /var/backups/pg/backup-YYYY-MM-DD.sql.gz | \
     docker exec -i supabase-db psql -U supabase_admin -d postgres
   ```
3. Bring app back:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

## Rotate Postgres password

1. Inside DB: `ALTER USER postgres WITH PASSWORD 'new-value';`
2. Update `/opt/supabase/.env` → `POSTGRES_PASSWORD=...`
3. Update `/opt/trackmycontainer/.env.production` → `DATABASE_URL=` and `DIRECT_URL=`
4. Restart both stacks.

## Add Resend verified domain (when ready)

1. In Resend dashboard → Domains → Add `trackmycontainer.info`
2. Add the 3 DNS records (TXT for SPF, CNAME for DKIM, TXT for DMARC) in GoDaddy
3. Wait for Resend to show "Verified"
4. Update `/opt/trackmycontainer/.env.production`:
   - `RESEND_FROM=noreply@trackmycontainer.info`
5. Update `/opt/supabase/.env`:
   - `SMTP_ADMIN_EMAIL=noreply@trackmycontainer.info`
6. Restart: both stacks.

## Fallback to cloud Supabase (first 7 days only)

In `/opt/trackmycontainer/.env.production` swap:
```
NEXT_PUBLIC_SUPABASE_URL=https://jtsosbbfqipomejqcmim.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<cloud anon key from original .env.local>
DATABASE_URL=postgresql://postgres.jtsosbbfqipomejqcmim:Maysa0541231995@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.jtsosbbfqipomejqcmim:Maysa0541231995@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```
Then `docker compose -f docker-compose.prod.yml restart`.
````

- [ ] **Step 2: Commit and push**

```bash
cd D:/trackmycontainer
git add docs/DEPLOYMENT.md docs/superpowers/
git commit -m "docs: production deployment runbook + design + plan"
git push
```

Then on VPS:
```bash
ssh tmc@37.60.232.123 "cd /opt/trackmycontainer && git pull"
```

## Phase 5 Verification

- [ ] `https://trackmycontainer.info` loads with green padlock in browser
- [ ] `https://supabase.trackmycontainer.info/project` shows Studio after Basic Auth, with valid cert
- [ ] `http://trackmycontainer.info` returns 301 to HTTPS
- [ ] `/var/backups/pg/backup-<today>.sql.gz` exists and is ≥ 5 KB
- [ ] `ssh root@37.60.232.123` (password) is refused
- [ ] `ssh tmc@37.60.232.123` (key) works
- [ ] `docs/DEPLOYMENT.md` is pushed to GitHub

---

# Final Handoff

After Phase 5 Verification passes, the user receives a summary message containing:

- Live URLs: `https://trackmycontainer.info`, `https://supabase.trackmycontainer.info`
- Studio Basic Auth: `admin / M0541231995`
- SSH: `ssh tmc@37.60.232.123` (via key), sudo passwordless
- Daily backup location: `/var/backups/pg/`
- Runbook: `docs/DEPLOYMENT.md` in repo
- Reminder: cloud Supabase project stays running until `2026-04-28`; pause after that

**This summary is shown in-chat and is NOT committed to git** (contains credentials).
