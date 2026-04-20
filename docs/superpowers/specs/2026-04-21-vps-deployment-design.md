# TrackMyContainer — Self-Hosted VPS Deployment Design

**Date:** 2026-04-21
**Status:** Approved — ready for implementation plan

## Goal

Migrate TrackMyContainer from its current hybrid setup (local Next.js dev server + cloud Supabase) to a fully self-hosted deployment on a single VPS. End state: the app serves `https://trackmycontainer.info` from the VPS, uses a self-hosted Supabase stack for database and auth, and pulls tracking data from the same external APIs it uses today.

## Why

Consolidate infrastructure under one host for full control over data, schema, triggers, and operational access. The user owns the VPS and domain and prefers managing everything in-house over monthly SaaS fees. Cloud Supabase stays running for 7 days post-cutover as rollback safety net.

---

## Pre-flight — Verified 2026-04-21

| Check | Result |
|-------|--------|
| SSH to `root@37.60.232.123` with password `maryamtalal55555` | Working |
| `trackmycontainer.info` A record → `37.60.232.123` | Propagated (Google + Cloudflare DNS) |
| `*.trackmycontainer.info` wildcard A record → `37.60.232.123` | Propagated (verified with `supabase.`, `randomtest.`) |
| VPS OS | Ubuntu 24.04.4 LTS |
| VPS disk | 145 GB total, 142 GB free |
| VPS RAM | 7.8 GB (408 MB used) |
| VPS CPU | 4 cores |
| Pre-installed conflicts (Docker, Nginx, UFW) | None — clean slate |
| Resend API key | `re_3DhGcenq_8jWDF4mtQHsv6oQABax8o7yU` |
| GitHub repo | `https://github.com/MaysaHjazi/TrackMyContainer.git` (empty, ready) |

---

## Architecture

```
Internet
   │
   ▼
┌────────────────────────────────────────────────────────────────────┐
│  VPS 37.60.232.123 — Ubuntu 24.04                                  │
│  UFW: 22 (SSH) + 80 (HTTP) + 443 (HTTPS)                           │
│                                                                    │
│  ┌── Docker network: tmc-net ──────────────────────────────────┐   │
│  │                                                             │   │
│  │  Nginx Proxy Manager (npm)                                  │   │
│  │  - 80/443 public, 81 admin (SSH-tunnel only)                │   │
│  │  - Let's Encrypt certs for apex + supabase subdomain        │   │
│  │    │                                                        │   │
│  │    ├─ trackmycontainer.info         →  next-app:3000        │   │
│  │    ├─ www.trackmycontainer.info     →  301 → apex           │   │
│  │    └─ supabase.trackmycontainer.info → kong:8000            │   │
│  │       (+ Basic Auth admin/M0541231995)                      │   │
│  │                                                             │   │
│  │  Supabase stack (supabase/docker compose):                  │   │
│  │    postgres, gotrue, postgrest, realtime, storage-api,      │   │
│  │    kong, studio, meta                                       │   │
│  │                                                             │   │
│  │  App stack (custom compose):                                │   │
│  │    next-app (Next.js 15), worker (BullMQ)                   │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  /opt/trackmycontainer/ ── git clone of MaysaHjazi/TrackMyContainer│
│  /var/backups/pg/       ── daily pg_dump, 7-day retention          │
└────────────────────────────────────────────────────────────────────┘

External (unchanged):
  Upstash Redis   ── BullMQ queue
  Resend          ── transactional email (starts on resend.dev domain)
  JSONCargo, Lufthansa Cargo, Qatar Cargo ── tracking APIs
```

### Subdomain routing

| Hostname | Target | Notes |
|----------|--------|-------|
| `trackmycontainer.info` | next-app:3000 | Public site + API routes |
| `www.trackmycontainer.info` | 301 redirect → apex | SEO/consistency |
| `supabase.trackmycontainer.info` | kong:8000 | Studio + Supabase API, Basic Auth gated |

---

## Components

### Phase 1 — VPS foundation

| Service | Source | Purpose |
|---------|--------|---------|
| Docker Engine | `get.docker.com` official | Container runtime |
| Docker Compose v2 | Docker plugin | Multi-container orchestration |
| UFW | Ubuntu repo | Host firewall |
| Nginx Proxy Manager | `jc21/nginx-proxy-manager:latest` | TLS-terminating reverse proxy |
| Unattended-upgrades | Ubuntu repo | Auto-apply security patches |

### Phase 2 — Supabase stack (via `supabase/docker`)

| Service | Image (pinned) | Purpose |
|---------|---------------|---------|
| postgres | `supabase/postgres:15.*` | Primary DB |
| gotrue | `supabase/gotrue:v2.*` | Auth server |
| postgrest | `postgrest/postgrest:v12.*` | Auto REST API |
| realtime | `supabase/realtime:v2.*` | WebSocket updates |
| storage-api | `supabase/storage-api:v1.*` | File uploads |
| kong | `kong:2.8` | API gateway |
| studio | `supabase/studio:*` | Admin UI |
| meta | `supabase/postgres-meta:v0.*` | Schema management |

All services join `tmc-net` network. Postgres port 5432 is NOT exposed to the host — app connects via Docker network only.

### Phase 4 — App stack

| Service | Source | Purpose |
|---------|--------|---------|
| next-app | `Dockerfile` in repo root | Next.js 15 web app |
| worker | `Dockerfile.worker` in repo root | BullMQ worker for tracking + notifications |

Both built from `git clone` of the GitHub repo. Code mounted at `/opt/trackmycontainer/`.

---

## Data Migration Plan (Phase 3)

### Steps

1. **Snapshot cloud DB**
   - `pg_dump` schema + data from cloud Supabase into `cloud-public.sql`
   - `pg_dump` auth schema (`auth.users`, `auth.identities`, `auth.sessions`) into `cloud-auth.sql`
   - Total size expected < 10 MB (project has ~3 shipments, 2 users)

2. **Prepare self-hosted DB**
   - Start Supabase stack on VPS
   - Confirm default schemas created (`public`, `auth`, `storage`, etc.)
   - Note down generated JWT secret — needed for auth compatibility

3. **Import**
   - `psql` import `cloud-public.sql` into self-hosted Postgres
   - `psql` import `cloud-auth.sql` — preserves password hashes, user IDs, and identities
   - Auth users keep the SAME UUIDs so FK relationships (`Shipment.userId`) remain valid

4. **Verify**
   - Row counts match on every table (`shipment`, `user`, `subscription`, `tracking_event`, `notification`, `auth.users`)
   - Log in as `maysahjazi32@gmail.com` using current password → should succeed
   - Check dashboard renders same 3 shipments

5. **Cut over**
   - Swap env vars in running app (point to self-hosted Supabase)
   - Smoke-test login, add shipment, track
   - Cloud Supabase project remains running untouched for 7 days as rollback — we don't write to it, but it stays online in case we need to flip env vars back

### Triggers and RLS

`pg_dump` includes them by default — no extra step required. Will spot-check after import that `auth.users` triggers and RLS policies are present.

---

## Environment Variables

File locations on VPS:
- `/opt/trackmycontainer/.env.production` (mode 600, owner root)
- `/opt/supabase/.env` (Supabase stack secrets, mode 600)

| Variable | Source | Notes |
|----------|--------|-------|
| `NEXT_PUBLIC_APP_URL` | `https://trackmycontainer.info` | New — needed for email links |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://supabase.trackmycontainer.info` | Replaces cloud URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Generated by Supabase setup | Replaces cloud anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Generated by Supabase setup | Server-side only |
| `DATABASE_URL` | `postgresql://postgres:<pw>@postgres:5432/postgres` | Internal Docker network hostname |
| `DIRECT_URL` | Same as DATABASE_URL | Local, no pooler needed |
| `RESEND_API_KEY` | `re_3DhGcenq_8jWDF4mtQHsv6oQABax8o7yU` | New key |
| `RESEND_FROM` | `onboarding@resend.dev` | Placeholder until domain verified |
| `REDIS_URL` | Existing Upstash | Unchanged |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Existing | Unchanged |
| `JSONCARGO_API_KEY` | Existing | Unchanged |
| `LUFTHANSA_CARGO_API_KEY` | Existing | Unchanged |
| `QATAR_CARGO_CLIENT_ID` / `_SECRET` | Existing | Unchanged |

Code changes needed:
- `src/backend/worker/processors/tracking-poll.ts:80` — fallback `"https://trackmycontainer.ai"` needs to become `"https://trackmycontainer.info"` (or better: drop the fallback and fail loud if env var missing).

---

## Security

### Firewall (UFW)
```
22/tcp   ALLOW   SSH (will restrict to key-auth later)
80/tcp   ALLOW   HTTP (Let's Encrypt + redirect to 443)
443/tcp  ALLOW   HTTPS (NPM)
default  DENY    all other inbound
```
Port 81 (NPM admin) stays on localhost — accessed via SSH tunnel.
Port 5432 (Postgres) never exposed outside Docker network.

### SSH hardening (done AFTER successful deploy, not before — avoids lockout)
1. Create non-root user with sudo
2. Add SSH public key to user
3. Disable `PermitRootLogin` in `/etc/ssh/sshd_config`
4. Disable `PasswordAuthentication`
5. Reload sshd

### Supabase Studio access
- Single path: `https://supabase.trackmycontainer.info`
- NPM applies HTTP Basic Auth (user `admin`, password `M0541231995`)
- Studio itself has no built-in auth — Basic Auth is the only gate
- Same domain provides Supabase REST API for the app (same Kong backend)

### Secrets handling
- `.env.production` and Supabase `.env` files: mode 600, owned by root
- `.gitignore` excludes all `.env*` files EXCEPT `.env.example`
- DB password: 32-char random, generated with `openssl rand -hex 16`
- JWT secret: 64-char random, generated with `openssl rand -hex 32`
- Anon + service role keys: generated by Supabase CLI during setup

---

## Backup Strategy

### Automated (from day one)
Cron job `/etc/cron.d/tmc-pg-backup`:
```
0 3 * * * root /usr/local/bin/tmc-backup.sh
```
Script behavior:
- `pg_dump -Fc` the full database
- Gzip output to `/var/backups/pg/backup-YYYY-MM-DD.sql.gz`
- Keep last 7 days, delete older

### Rollback to cloud (7-day window)
- Cloud Supabase project kept live until 2026-04-28
- Env var swap is the only action needed to fall back
- After 7 successful days on self-host, cloud project can be paused

### Out of scope for v1
- Off-site backups (S3/B2) — document the need, implement later
- Point-in-time recovery (WAL archiving) — not needed at current scale

---

## Deployment Phases (overview)

Each phase will have its own implementation plan with step-by-step tasks.

| Phase | Scope | Est. time | Blockers if skipped |
|-------|-------|-----------|---------------------|
| **1** | VPS base: Docker, UFW, NPM, swap file, unattended-upgrades | 30–45 min | Everything downstream |
| **2** | Supabase stack: clone `supabase/docker`, configure, start all services | 45–60 min | Phase 3 onwards |
| **3** | Data migration: dump cloud → import self-host → verify | 30 min | Real data won't be in the new system |
| **4** | App deploy: git init local, push to GitHub, clone on VPS, build & run next-app + worker, NPM routing (apex + www 301 + supabase subdomain) | 45 min | No public-facing site |
| **5** | SSL via Let's Encrypt, end-to-end smoke test, backup cron, SSH hardening | 30 min | Site works over HTTP but not HTTPS; no backups |

**Total wall time:** ~3–4 hours of active work. Each phase is independently testable and revertible.

---

## Rollback Plan

Per phase:
- **Phase 1 fail**: nothing important yet; rerun or reimage VPS
- **Phase 2 fail**: `docker compose down -v` wipes the stack; retry
- **Phase 3 fail**: no env swap yet, cloud Supabase unchanged; re-run migration
- **Phase 4 fail**: `docker compose down` app only; cloud still serves users if DNS not cut over yet
- **Phase 5 fail**: SSL/routing issue — we've already proven the stack works, just fix the specific proxy rule

Per-day after go-live:
- Daily `pg_dump` → restore from gzip if DB corruption
- Cloud Supabase fallback (first 7 days) by swapping env vars and redeploy

---

## Success Criteria

All must hold after Phase 5:
- `https://trackmycontainer.info` returns 200 with valid Let's Encrypt cert
- `maysahjazi32@gmail.com` logs in with the password already used on cloud Supabase
- Dashboard shows the same 3 shipments with same statuses
- Adding a new shipment works end-to-end (API → DB → UI)
- BullMQ worker processes at least one `tracking-dispatch` run successfully
- `https://supabase.trackmycontainer.info` prompts for Basic Auth, then shows Studio
- `/var/backups/pg/backup-<today>.sql.gz` exists after first cron run
- SSH still accessible (now with restricted auth)

---

## Out of Scope (deferred)

These were raised but explicitly postponed:

| Item | Reason | When to revisit |
|------|--------|-----------------|
| CI/CD pipeline (GitHub Actions) | Manual `git pull + docker compose up` is simpler for first deploy | When deploy frequency > weekly |
| Resend domain verification | `resend.dev` sender works for now; verifying adds 10 min of DNS wait | Before public launch / first ad |
| Self-hosted Redis | Upstash free tier covers current usage (<15 ops/day) | If Upstash quota exceeded |
| Off-site backups | Single VPS backup acceptable for MVP data volume | When paying customers exist |
| Monitoring / alerting | `docker compose logs` suffices for now | When uptime guarantees needed |
| Multi-environment (staging) | Solo project | When second developer joins |

---

## Open Questions (for user before implementation plan)

All resolved during brainstorming. None outstanding.

---

## Artifacts delivered

At the end of Phase 5 the user receives:
- Live site: `https://trackmycontainer.info`
- Admin Studio: `https://supabase.trackmycontainer.info` (admin / M0541231995)
- GitHub repo populated with full source + this design doc + implementation plan
- `DEPLOYMENT.md` runbook in the repo covering: how to deploy an update, how to restart services, how to restore from backup, how to access logs
- Summary of all credentials and URLs (in a final handoff message, not committed)
