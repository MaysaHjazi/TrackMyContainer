# TrackMyContainer — Production Deployment Runbook

**Server:** `37.60.232.123` (Ubuntu 24.04 LTS, 4 cores, 7.8 GB RAM, 145 GB disk)
**Public URLs:**
- `https://trackmycontainer.info` — main app
- `https://supabase.trackmycontainer.info` — Supabase Studio (Basic Auth `admin` / `M0541231995`)

**SSH:** `ssh root@37.60.232.123` (password: `maryamtalal55555`) — *plan: harden to key-only after trust period*

---

## Where things live on the VPS

| Path | Purpose |
|------|---------|
| `/opt/trackmycontainer/` | Next.js app + BullMQ worker (git clone) |
| `/opt/supabase/` | Self-hosted Supabase stack |
| `/opt/npm/` | Nginx Proxy Manager |
| `/opt/migration-dumps/` | One-time migration dumps from cloud Supabase |
| `/var/backups/pg/` | Daily Postgres backups (7-day retention) |
| `/var/log/tmc-backup.log` | Backup cron log |

---

## Deploy an application update

```bash
ssh root@37.60.232.123
cd /opt/trackmycontainer
sudo -u tmc git pull
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs --tail 50 next-app
```

Downtime: ~3–5 seconds while containers swap.

## Restart services

```bash
# App + worker only
cd /opt/trackmycontainer && docker compose -f docker-compose.prod.yml restart

# Supabase stack
cd /opt/supabase && docker compose restart

# NPM
cd /opt/npm && docker compose restart
```

## Access NPM admin UI

NPM admin is bound to localhost only. From your local machine:
```bash
ssh -L 8181:127.0.0.1:81 root@37.60.232.123
# Then open http://localhost:8181
# Login: maysahjazi32@gmail.com / M0541231995
```

## Read logs

```bash
docker logs tmc-next-app --tail 200 --follow
docker logs tmc-worker   --tail 200 --follow
docker compose -f /opt/supabase/docker-compose.yml logs --tail 100 db
tail -f /var/log/tmc-backup.log
```

## Restore DB from backup

1. Stop the app to avoid writes:
   ```bash
   cd /opt/trackmycontainer && docker compose -f docker-compose.prod.yml down
   ```
2. Restore:
   ```bash
   gunzip -c /var/backups/pg/backup-YYYY-MM-DD.sql.gz | \
     docker exec -i supabase-db psql -U postgres -d postgres
   ```
3. Bring app back:
   ```bash
   docker compose --env-file .env.production -f docker-compose.prod.yml up -d
   ```

## Rotate Postgres password

1. Inside DB: `ALTER USER postgres WITH PASSWORD 'new-value';`
2. Update `/opt/supabase/.env` → `POSTGRES_PASSWORD=...`
3. Update `/opt/trackmycontainer/.env.production` → `DATABASE_URL=` and `DIRECT_URL=`
4. Restart both stacks.

## Add Resend verified domain (when ready)

Email currently sends from `onboarding@resend.dev`. To use your own domain:

1. In Resend dashboard → Domains → Add `trackmycontainer.info`
2. Add the 3 DNS records (TXT for SPF, CNAME for DKIM, TXT for DMARC) in GoDaddy
3. Wait for Resend to show "Verified" (usually < 15 min)
4. Update `/opt/trackmycontainer/.env.production`:
   ```
   RESEND_FROM=noreply@trackmycontainer.info
   ```
5. Update `/opt/supabase/.env`:
   ```
   SMTP_ADMIN_EMAIL=noreply@trackmycontainer.info
   ```
6. Restart both stacks.

## Fallback to cloud Supabase (first 7 days only, until 2026-04-28)

In `/opt/trackmycontainer/.env.production` swap:
```
NEXT_PUBLIC_SUPABASE_URL=https://jtsosbbfqipomejqcmim.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<cloud anon key from original .env.local>
DATABASE_URL=postgresql://postgres.jtsosbbfqipomejqcmim:Maysa0541231995@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.jtsosbbfqipomejqcmim:Maysa0541231995@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```
Then:
```bash
cd /opt/trackmycontainer
docker compose --env-file .env.production -f docker-compose.prod.yml down
docker compose --env-file .env.production -f docker-compose.prod.yml build  # NEXT_PUBLIC_* baked into build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

After 2026-04-28, cloud Supabase project can be paused via their dashboard.

## SSL certificate renewal

Handled automatically by Nginx Proxy Manager (Let's Encrypt renews ~30 days before expiry). Current certs expire **2026-07-20**.

Manual renewal (if ever needed):
```bash
docker exec tmc-npm certbot renew --non-interactive
docker exec tmc-npm nginx -s reload
```

## Common issues

### App container won't start after `docker compose up`
```bash
docker logs tmc-next-app --tail 100
# If DB connection error: check supabase-db is healthy
docker ps --filter "name=supabase-db" --format "{{.Status}}"
# If env missing: verify /opt/trackmycontainer/.env.production permissions (600) and values
```

### Worker keeps crashing
```bash
docker logs tmc-worker --tail 100
# Most common: Redis unreachable → check Upstash console
# If Prisma error: run migrations
docker exec -it tmc-next-app npx prisma migrate deploy
```

### SSL failed after renewal
```bash
# Force re-request via NPM UI (SSL tab → Renew Now)
# OR check DNS hasn't changed: dig +short trackmycontainer.info
```

### Disk fills up with Docker images
```bash
docker system prune -a --volumes  # careful — wipes unused images
```

---

## Credentials summary

| Thing | Value |
|-------|-------|
| NPM admin | `maysahjazi32@gmail.com` / `M0541231995` (http://localhost:8181 via SSH tunnel) |
| Supabase Studio | `admin` / `M0541231995` (https://supabase.trackmycontainer.info) |
| Supabase Postgres (direct) | `postgres` / in `/opt/supabase/.env` → `POSTGRES_PASSWORD` |
| SSH | `root` / `maryamtalal55555` |
| Backup location | `/var/backups/pg/backup-YYYY-MM-DD.sql.gz` |

Keep this file off of git when updating credentials — replace with `<see runbook on VPS>` or encrypt before committing.
