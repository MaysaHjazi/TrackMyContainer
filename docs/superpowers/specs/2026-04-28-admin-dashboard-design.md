# Admin Dashboard — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an admin-only dashboard for `trackmycontainer.info` that surfaces every operational signal a single human operator needs to run the service: API usage, ShipsGo credit consumption, errors, per-account activity, contact requests, and revenue. The dashboard reads exclusively from the existing database and a new `audit_log` table — it does **not** call any paid third-party API (no ShipsGo credit-burning, no extra cost), and it does **not** modify any existing functionality.

**Date:** 2026-04-28
**Audience:** owner/operator (initially `maysahjazi32@gmail.com`); extensible to delegated admins later via DB role.

---

## 1. Constraints (HARD)

These are non-negotiable. Every decision below honours them.

1. **Don't break existing flows.** Tracking, billing, shipments, notifications, theme switching — all the work shipped earlier today must keep working. The admin dashboard is purely **additive**: new routes, new tables, new helpers. No changes to existing logic.
2. **Don't consume ShipsGo credits.** No call to ShipsGo's `POST /v2/{ocean,air}/shipments` from the dashboard. Credit usage is **derived** from our own DB by counting `Shipment` rows whose `trackingProvider='shipsgo'` — every such row corresponds to one credit consumed at creation time.
3. **Don't expose admin pages to non-admins.** Both the route and the data must be protected. The current logged-in user's email AND DB role are checked on every admin request.

---

## 2. Authorization model

A hybrid that gives the user `maysahjazi32@gmail.com` admin access today and lets them promote others tomorrow without code changes.

### 2a. Schema change — add a `role` enum to User

```prisma
enum UserRole {
  USER
  ADMIN
}

model User {
  // ...existing fields
  role  UserRole  @default(USER)
}
```

Migration: `ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER'` (use TEXT not enum to avoid the BUSINESS→CUSTOM migration ordeal).

Add the enum at Prisma level only:
```prisma
enum UserRole { USER ADMIN }
```

### 2b. Bootstrap via env

```
ADMIN_EMAILS=maysahjazi32@gmail.com
```
Comma-separated list. On every authenticated request to an admin route, the guard checks:
1. `ADMIN_EMAILS` includes the user's email → allow, **and** if their DB role is still `USER`, promote them to `ADMIN` lazily on first admin page load (so the role flag stays accurate for analytics).
2. OR `user.role === ADMIN` in DB → allow.
3. Otherwise → 404 (not 403; we don't reveal the route exists).

### 2c. Admin promotion later

To grant a colleague admin access without a deploy:
- Open Prisma Studio.
- Set `users.role = 'ADMIN'` for the target email.
- They can now reach `/admin/*`.

---

## 3. Audit log table — `audit_log`

A single append-only table is the spine of the dashboard. Every interesting event in the system writes a row.

### 3a. Schema

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String?              // null for system-level events
  type      String               // dot-notation, see §3c
  level     String   @default("info")   // info | warning | error
  message   String               // human-readable summary
  metadata  Json?                // shape varies per type — never break this contract
  createdAt DateTime @default(now())

  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([type, createdAt])
  @@index([userId, createdAt])
  @@index([level, createdAt])
  @@map("audit_log")
}
```

Indexes match the three primary access patterns: filter-by-type, per-user feed, level (error log).

### 3b. Helper API

```typescript
// src/lib/audit-log.ts
export async function recordEvent(input: {
  type:      string;
  level?:   "info" | "warning" | "error";
  message:  string;
  userId?:  string;
  metadata?: Record<string, unknown>;
}): Promise<void>;
```

Behaviour:
- Wraps the Prisma write in `try/catch`. On any failure, logs to console and returns silently — **never throws**. The host code that called it must keep running. This is what makes the helper "non-breaking" by design.
- Never blocks the calling code with await/await chains; callers can `void recordEvent(...)` from non-async contexts where it makes sense.

### 3c. Event types (initial set)

| Type                     | Level   | Where it's emitted                                                                  |
|--------------------------|---------|--------------------------------------------------------------------------------------|
| `user.signed_up`         | info    | `getAuthenticatedUser` first-login block (when DB user is auto-created)              |
| `shipment.created`       | info    | After `prisma.shipment.create` in `POST /api/shipments`                              |
| `shipment.create_failed` | warning | In the `TrackingError` catch of `POST /api/shipments`                                |
| `tracking.poll_failed`   | error   | In the catch of `tracking-poll` processor                                            |
| `tracking.poll_ok`       | info    | After successful poll in `tracking-poll` (only when events delta > 0, to keep volume sane) |
| `notification.failed`    | error   | In the email/whatsapp send error paths (`email.ts`, `whatsapp.ts`)                   |
| `notification.sent`      | info    | On successful email/whatsapp send                                                    |
| `contact.received`       | info    | `POST /api/contact` after DB insert                                                  |
| `billing.event`          | info    | Stripe webhook handler — one entry per event with `metadata.stripeEventType`         |
| `billing.error`          | error   | Stripe webhook signature failure / unhandled errors                                  |
| `auth.admin_promoted`    | info    | When a user is auto-promoted because their email is in `ADMIN_EMAILS`                |

The list is open-ended; new types can be added without migration.

### 3d. Retention

Out of scope for v1. Old rows accumulate. A future cron can delete `WHERE createdAt < NOW() - INTERVAL '90 days'`.

---

## 4. Routes & layout

All admin routes live under a Next.js App Router segment. Auth guards are component-level (not middleware) to keep the rest of the app untouched.

```
src/app/(admin)/
  layout.tsx                    # admin chrome — sidebar, dark/light, "back to user dashboard"
  admin/
    page.tsx                    # Overview (KPI cards + activity feed + chart)
    users/
      page.tsx                  # User list, filterable
      [id]/page.tsx             # Per-user drill-down (Phase 2)
    errors/
      page.tsx                  # Error log feed
```

### 4a. Layout

`src/app/(admin)/layout.tsx`:
1. `await getAuthenticatedUser()` → if null → `redirect("/login")`.
2. `await isAdmin(user)` → if false → `notFound()`.
3. Renders an admin shell with a sidebar:
   - 📊 Overview (`/admin`)
   - 👥 Users (`/admin/users`)
   - ⚠️ Errors (`/admin/errors`)
   - ↩ Back to dashboard (`/dashboard`)
4. Reuses theme tokens from the main app — admin pages crossfade with the same theme switch.

### 4b. Guard (`isAdmin`)

```typescript
// src/lib/admin-auth.ts
export async function isAdmin(user: AuthenticatedUser): Promise<boolean>;
```

Logic:
1. Parse `process.env.ADMIN_EMAILS` (comma-separated, trimmed, lower-cased).
2. If user.email ∈ that list:
   - If `user.role !== 'ADMIN'` → update DB to `ADMIN`, record `auth.admin_promoted` event.
   - Return true.
3. Else if `user.role === 'ADMIN'` → return true.
4. Else → return false.

### 4c. Caching

All admin pages use `export const revalidate = 60` (server-component cache invalidates every minute, same pattern as the shipment detail page). The DB queries are cheap (counts and small selects); refreshing once a minute is plenty.

---

## 5. Page-by-page contents

### 5a. `/admin` — Overview

**Top: 6 KPI cards** in a responsive grid (1 col on mobile, 3 col on desktop):

| Card                | Computation                                                                                                          |
|---------------------|----------------------------------------------------------------------------------------------------------------------|
| 👥 Users            | `users` count, broken down by `subscription.plan`                                                                    |
| 🚢 Shipments        | `shipments` count, group by `currentStatus`                                                                          |
| 💳 ShipsGo Credits  | `total = COUNT(shipments WHERE trackingProvider='shipsgo')` and `remaining = SHIPSGO_TOTAL_CREDITS - total` (env var) |
| 📡 API Today        | `tracking_queries WHERE createdAt > start_of_day` count, plus cache-hit rate                                         |
| ⚠️ Errors 24h       | `audit_log WHERE level='error' AND createdAt > NOW() - 24h` count                                                    |
| 💰 MRR              | `subscriptions WHERE plan='PRO' AND status='ACTIVE'` count × $35                                                     |

Below the cards:

- **Recent activity feed** — last 20 `audit_log` rows, with type icon, message, time-ago, click-through to user.
- **API calls chart** — bar chart, last 7 days, FREE vs PRO breakdown. Hand-rolled SVG (the project already paints SVG charts in `route-visualization.tsx` — keeps the bundle lean and the styling consistent with the rest of the dashboard).
- **Pending Contact Requests** card — list of `contact_requests WHERE status='PENDING'`, link to `mailto:`.

### 5b. `/admin/users`

**Filter bar:** plain text search (email, name) + plan dropdown (`All | FREE | PRO | CUSTOM`).

**Table columns:**
- Email
- Plan (badge)
- Shipments count (this period for PRO, lifetime for FREE)
- API calls (last 30d, joined from `tracking_queries`)
- Last seen — `MAX(tracking_queries.createdAt)` for that user (cheap)
- Created — `users.createdAt`

**Action:** click a row → `/admin/users/[id]` (Phase 2 — render placeholder for now).

### 5c. `/admin/errors`

**Filter pills:** `All | tracking | notifications | webhooks | auth` plus a date selector (`24h | 7d | 30d`).

**Feed:**
- One row per `audit_log` entry where `level IN ('warning','error')`.
- Each row: level badge (yellow/red), type, message, time-ago, expandable JSON metadata.
- Group consecutive identical errors (same type + same message) with a count, à la Sentry — keeps the list readable when one shipment poll fails repeatedly.

---

## 6. Events to record from existing code (non-invasive)

Every `recordEvent` call is wrapped in its own try/catch via the helper. The hosting code path doesn't change behaviour if recording fails.

| File                                            | Where in the file               | Event                                              |
|-------------------------------------------------|---------------------------------|----------------------------------------------------|
| `src/lib/auth.ts`                               | `getAuthenticatedUser` create branch | `user.signed_up`                              |
| `src/app/api/shipments/route.ts`                | After `prisma.shipment.create`  | `shipment.created`                                 |
| `src/app/api/shipments/route.ts`                | TrackingError catch             | `shipment.create_failed`                           |
| `src/app/api/contact/route.ts`                  | After successful insert         | `contact.received`                                 |
| `src/backend/worker/processors/tracking-poll.ts`| Top-level catch                 | `tracking.poll_failed`                             |
| `src/backend/worker/processors/tracking-poll.ts`| When `newEvents.length > 0`     | `tracking.poll_ok` (only when something changed)   |
| `src/backend/services/notifications/email.ts`   | Resend success                  | `notification.sent`                                |
| `src/backend/services/notifications/email.ts`   | Resend failure catch            | `notification.failed`                              |
| `src/backend/services/notifications/whatsapp.ts`| Send success / failure          | `notification.sent` / `notification.failed`        |
| `src/app/api/webhooks/stripe/route.ts`          | Per-event handler entry         | `billing.event`                                    |
| `src/app/api/webhooks/stripe/route.ts`          | Signature check failure         | `billing.error`                                    |

The data already in `notifications.status='FAILED'` rows is fine — the audit log is for **system-level visibility**; the existing per-shipment notification rows stay where they are.

---

## 7. UI tokens

Reuse the existing dashboard's CSS variables. No new theme tokens. Admin pages follow the same dark/light palette as the main dashboard, the same crossfade transition, the same card styling.

---

## 8. Files to create or modify

| File                                                       | Action  |
|------------------------------------------------------------|---------|
| `prisma/schema.prisma`                                     | Modify  | Add `role` field on User, add `AuditLog` model, add `UserRole` enum |
| `prisma/migrations/.../admin_dashboard.sql`                | Create  | role column on users + audit_log table + indexes |
| `src/lib/audit-log.ts`                                     | Create  | `recordEvent()` helper with safe try/catch |
| `src/lib/admin-auth.ts`                                    | Create  | `isAdmin()` + `requireAdmin()` |
| `src/app/(admin)/layout.tsx`                               | Create  | Admin shell + auth guard |
| `src/app/(admin)/admin/page.tsx`                           | Create  | Overview |
| `src/app/(admin)/admin/users/page.tsx`                     | Create  | Users list |
| `src/app/(admin)/admin/errors/page.tsx`                    | Create  | Error feed |
| `src/frontend/components/admin/kpi-card.tsx`               | Create  | Reusable KPI tile |
| `src/frontend/components/admin/activity-feed.tsx`          | Create  | Activity feed widget |
| `src/frontend/components/admin/api-calls-chart.tsx`        | Create  | 7-day bar chart |
| `src/lib/auth.ts`                                          | Modify  | Add `recordEvent("user.signed_up")` to auto-create branch |
| `src/app/api/shipments/route.ts`                           | Modify  | Add `recordEvent` calls (success + fail) |
| `src/app/api/contact/route.ts`                             | Modify  | Add `recordEvent("contact.received")` |
| `src/backend/worker/processors/tracking-poll.ts`           | Modify  | Add `recordEvent` calls (success delta + fail catch) |
| `src/backend/services/notifications/email.ts`              | Modify  | Add `recordEvent` calls (sent + failed) |
| `src/app/api/webhooks/stripe/route.ts`                     | Modify  | Add `recordEvent` calls per event |
| `.env.local` and `.env.production`                         | Modify  | Add `ADMIN_EMAILS=maysahjazi32@gmail.com` and `SHIPSGO_TOTAL_CREDITS=10` |

---

## 9. Tests

Vitest is already set up (`vitest.config.ts`). Add:

| Test                                              | What it verifies                                                   |
|---------------------------------------------------|--------------------------------------------------------------------|
| `audit-log.test.ts`                               | `recordEvent` writes a row; throws inside it don't escape          |
| `admin-auth.test.ts`                              | env email allowed; DB role allowed; otherwise rejected; auto-promote |
| `kpi-aggregations.test.ts`                        | Each KPI computation returns the expected number from a seeded DB  |
| `existing-flow-untouched.test.ts` (smoke)         | Adding a `recordEvent` call doesn't change the return value of the modified routes |

---

## 10. Out of scope (Phase 2)

- Per-user drill-down page (`/admin/users/[id]`) — placeholder route, "coming soon"
- CSV export
- Email alerts when error rate exceeds threshold
- Audit-log retention cron
- Charts beyond the 7-day API bar chart (e.g. revenue trend)
- Real-time push (server-sent events / websockets) — 60s revalidation is plenty

---

## 11. Counting summary

| Metric                      | Source                                              | Cost                |
|-----------------------------|-----------------------------------------------------|---------------------|
| FREE API calls              | `tracking_queries` count by date                    | DB query, no money  |
| ShipsGo credits used        | `shipments WHERE trackingProvider='shipsgo'` count  | DB query, no money  |
| ShipsGo credits remaining   | `SHIPSGO_TOTAL_CREDITS env − used`                  | env arithmetic      |
| Worker errors               | `audit_log WHERE level='error' AND type LIKE 'tracking.%'` | DB query     |
| Notification failures       | `audit_log WHERE type='notification.failed'`        | DB query            |
| MRR                         | `subscriptions WHERE plan='PRO' AND status='ACTIVE'` × 3500 cents | DB query  |

Every figure on the admin dashboard is **derived from data we already own**. No third-party API call is made on a dashboard render.
