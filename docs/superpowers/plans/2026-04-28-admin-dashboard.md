# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 of the admin dashboard described in `docs/superpowers/specs/2026-04-28-admin-dashboard-design.md` — an `/admin/*` area exclusive to operators that surfaces user counts, ShipsGo credit usage, API call volume, errors, and contact requests, all derived from our own DB without consuming any ShipsGo credit on render.

**Architecture:** Additive only. Two schema additions (`User.role` enum, `AuditLog` table). Two new helper modules (`audit-log.ts`, `admin-auth.ts`). One new Next.js route segment (`(admin)/admin/*`) with three pages. Event recording calls (`recordEvent(...)`) sprinkled into existing routes inside `try/catch` so they can never break the host code.

**Tech Stack:** Next.js 15 App Router, React 18, Prisma + PostgreSQL/Supabase, Vitest, Tailwind, Lucide icons, Framer Motion (already present), hand-rolled SVG charts.

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `prisma/schema.prisma` | Add `UserRole` enum, `User.role` field, `AuditLog` model |
| `prisma/migrations/20260428000001_admin_dashboard/migration.sql` | Raw SQL migration (run via `prisma db execute` like the subscription one) |
| `src/lib/audit-log.ts` | `recordEvent()` — single non-throwing helper |
| `src/lib/admin-auth.ts` | `isAdmin()` + `requireAdmin()` |
| `src/lib/admin-stats.ts` | Pure aggregation functions used by all admin pages — kept testable |
| `src/app/(admin)/layout.tsx` | Admin shell + auth gate, redirects/404s non-admins |
| `src/app/(admin)/admin/page.tsx` | Overview — KPI cards, activity feed, API chart, contact requests |
| `src/app/(admin)/admin/users/page.tsx` | Users list + filter |
| `src/app/(admin)/admin/errors/page.tsx` | Error feed + filter pills |
| `src/frontend/components/admin/kpi-card.tsx` | One reusable KPI tile |
| `src/frontend/components/admin/activity-feed.tsx` | Recent audit-log feed |
| `src/frontend/components/admin/api-calls-chart.tsx` | 7-day SVG bar chart |
| `src/frontend/components/admin/admin-sidebar.tsx` | Sidebar nav (links to overview/users/errors + back to dashboard) |
| `src/__tests__/audit-log.test.ts` | Unit tests for `recordEvent` |
| `src/__tests__/admin-auth.test.ts` | Unit tests for `isAdmin` |
| `src/__tests__/admin-stats.test.ts` | Unit tests for aggregation functions |
| `.env.local`, `.env` (and prod `.env.production` later) | `ADMIN_EMAILS`, `SHIPSGO_TOTAL_CREDITS` |

---

## Task 1: Schema migration — add `User.role` and `AuditLog`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260428000001_admin_dashboard/migration.sql`

- [ ] **Step 1: Add `UserRole` enum + `role` field on User**

Edit `prisma/schema.prisma`. Find the existing `model User` block (around line 19). Add the import-style enum below the existing `SubscriptionPlan` enum (around line 128 area), and add the `role` field on User. Final shape:

```prisma
enum UserRole {
  USER
  ADMIN
}

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String?
  emailVerified   DateTime?
  image           String?
  hashedPassword  String?
  role            UserRole  @default(USER)
  // ...rest of the existing fields stay exactly as they are
  // (phone, whatsappOptIn, messengerPsid, createdAt, updatedAt, relations)
  auditLogs       AuditLog[]
}
```

(The existing relation list — `accounts`, `sessions`, `subscription`, `shipments`, `notifications`, `trackingQueries`, `apiKeys`, `teamMemberships` — stays exactly as it is. Only `role` and `auditLogs` are new.)

- [ ] **Step 2: Add `AuditLog` model at the bottom of `schema.prisma`**

Append this block after the `WhatsappSession` model (before `ContactRequest` works fine, but the bottom of the file is also OK):

```prisma
// ══════════════════════════════════════════════════════════════
// AUDIT LOG (admin dashboard)
// ══════════════════════════════════════════════════════════════

model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  type      String
  level     String   @default("info")
  message   String
  metadata  Json?
  createdAt DateTime @default(now())

  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([type, createdAt])
  @@index([userId, createdAt])
  @@index([level, createdAt])
  @@map("audit_log")
}
```

- [ ] **Step 3: Write the migration SQL**

Create `prisma/migrations/20260428000001_admin_dashboard/migration.sql`:

```sql
-- Add role column to users (TEXT — same approach as the subscription migration)
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';

-- audit_log table
CREATE TABLE "audit_log" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT,
  "type"      TEXT NOT NULL,
  "level"     TEXT NOT NULL DEFAULT 'info',
  "message"   TEXT NOT NULL,
  "metadata"  JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_log_type_createdAt_idx"     ON "audit_log"("type", "createdAt");
CREATE INDEX "audit_log_userId_createdAt_idx"   ON "audit_log"("userId", "createdAt");
CREATE INDEX "audit_log_level_createdAt_idx"    ON "audit_log"("level", "createdAt");

ALTER TABLE "audit_log"
  ADD CONSTRAINT "audit_log_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL;
```

- [ ] **Step 4: Apply the migration to local cloud Supabase + Prisma Generate**

```bash
cd D:/trackmycontainer
npx prisma db execute --stdin --url "$(grep DIRECT_URL .env.local | cut -d'=' -f2- | tr -d '"')" < prisma/migrations/20260428000001_admin_dashboard/migration.sql
npx prisma migrate resolve --applied 20260428000001_admin_dashboard
npx prisma generate
```

Expected: each command finishes with no errors. Prisma client now exposes `AuditLog` and `UserRole`.

- [ ] **Step 5: Verify schema is in sync**

```bash
npx tsc --noEmit
```

Expected: 0 errors. (Prisma client typings include the new model.)

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260428000001_admin_dashboard/migration.sql
git commit -m "feat(db): add User.role + audit_log table for admin dashboard"
```

---

## Task 2: `recordEvent` helper

**Files:**
- Create: `src/lib/audit-log.ts`
- Create: `src/__tests__/audit-log.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/audit-log.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/backend/lib/db", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { recordEvent } from "@/lib/audit-log";
import { prisma } from "@/backend/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recordEvent", () => {
  it("writes a row with required fields", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    await recordEvent({
      type:    "shipment.created",
      message: "user added MAEU9184879",
      userId:  "user_xyz",
      metadata: { trackingNumber: "MAEU9184879" },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        type:     "shipment.created",
        level:    "info",
        message:  "user added MAEU9184879",
        userId:   "user_xyz",
        metadata: { trackingNumber: "MAEU9184879" },
      },
    });
  });

  it("defaults level to 'info' when omitted", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
    await recordEvent({ type: "user.signed_up", message: "first login" });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ level: "info" }) }),
    );
  });

  it("respects an explicit level", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
    await recordEvent({ type: "tracking.poll_failed", level: "error", message: "boom" });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ level: "error" }) }),
    );
  });

  it("never throws when the DB write fails", async () => {
    vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error("connection lost"));
    await expect(
      recordEvent({ type: "shipment.created", message: "x" }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/audit-log.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/audit-log'`.

- [ ] **Step 3: Implement `recordEvent`**

Create `src/lib/audit-log.ts`:

```typescript
import { prisma } from "@/backend/lib/db";

export type AuditLevel = "info" | "warning" | "error";

export interface RecordEventInput {
  type:      string;
  level?:    AuditLevel;
  message:   string;
  userId?:   string;
  metadata?: Record<string, unknown>;
}

/**
 * Append a row to the `audit_log` table. Wrapped in try/catch so it
 * NEVER throws — callers in the existing tracking/billing/notification
 * paths can use this without risk of corrupting their own behaviour
 * if the audit write happens to fail.
 */
export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        type:     input.type,
        level:    input.level ?? "info",
        message:  input.message,
        userId:   input.userId   ?? null,
        metadata: (input.metadata as never) ?? null,
      },
    });
  } catch (err) {
    console.warn(
      `[audit-log] failed to record ${input.type}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/audit-log.test.ts
```

Expected: 4/4 tests pass.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/audit-log.ts src/__tests__/audit-log.test.ts
git commit -m "feat(audit): add recordEvent helper (non-throwing)"
```

---

## Task 3: `isAdmin` admin auth guard

**Files:**
- Create: `src/lib/admin-auth.ts`
- Create: `src/__tests__/admin-auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/admin-auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/backend/lib/db", () => ({
  prisma: {
    user:     { update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/backend/lib/db";

const originalEnv = process.env.ADMIN_EMAILS;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAILS = "owner@example.com,helper@example.com";
});

afterEach(() => {
  process.env.ADMIN_EMAILS = originalEnv;
});

function fakeUser(over: Partial<{ id: string; email: string; role: "USER" | "ADMIN" }> = {}) {
  return {
    id:    "u1",
    email: "owner@example.com",
    role:  "USER" as const,
    ...over,
  };
}

describe("isAdmin", () => {
  it("returns true for an email listed in ADMIN_EMAILS", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    expect(await isAdmin(fakeUser())).toBe(true);
  });

  it("auto-promotes the user to ADMIN role on the first allow", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    await isAdmin(fakeUser({ role: "USER" }));
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data:  { role: "ADMIN" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("does not re-promote a user who is already ADMIN", async () => {
    await isAdmin(fakeUser({ role: "ADMIN" }));
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("returns true for a USER whose role is ADMIN even if not in env list", async () => {
    process.env.ADMIN_EMAILS = "someone-else@example.com";
    expect(await isAdmin(fakeUser({ email: "x@x.com", role: "ADMIN" }))).toBe(true);
  });

  it("returns false otherwise", async () => {
    process.env.ADMIN_EMAILS = "someone-else@example.com";
    expect(await isAdmin(fakeUser({ email: "x@x.com", role: "USER" }))).toBe(false);
  });

  it("matches emails case-insensitively and trims whitespace", async () => {
    process.env.ADMIN_EMAILS = " Owner@Example.com , Helper@Example.com ";
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    expect(await isAdmin(fakeUser({ email: "OWNER@EXAMPLE.COM" }))).toBe(true);
  });
});

import { afterEach } from "vitest";
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/admin-auth.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/admin-auth'`.

- [ ] **Step 3: Implement `isAdmin`**

Create `src/lib/admin-auth.ts`:

```typescript
import { prisma } from "@/backend/lib/db";
import { recordEvent } from "@/lib/audit-log";

export interface AdminAuthInput {
  id:    string;
  email: string;
  role:  "USER" | "ADMIN";
}

function envAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns true if the given user is permitted to access /admin pages.
 * If the user's email is in ADMIN_EMAILS but their DB role is still
 * USER, lazily promote them to ADMIN (idempotent — only the first
 * call writes to the DB) and audit-log the promotion.
 */
export async function isAdmin(user: AdminAuthInput): Promise<boolean> {
  const allowed = envAdminEmails();
  const emailMatch = allowed.includes(user.email.toLowerCase());

  if (emailMatch) {
    if (user.role !== "ADMIN") {
      await prisma.user.update({
        where: { id: user.id },
        data:  { role: "ADMIN" },
      });
      await recordEvent({
        type:    "auth.admin_promoted",
        level:   "info",
        message: `${user.email} auto-promoted via ADMIN_EMAILS`,
        userId:  user.id,
      });
    }
    return true;
  }

  return user.role === "ADMIN";
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/admin-auth.test.ts
```

Expected: 6/6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-auth.ts src/__tests__/admin-auth.test.ts
git commit -m "feat(admin): add isAdmin guard with env-based bootstrap and lazy DB promotion"
```

---

## Task 4: `admin-stats` aggregation library

**Files:**
- Create: `src/lib/admin-stats.ts`
- Create: `src/__tests__/admin-stats.test.ts`

These are the pure "given the DB, return a number" functions used by every admin page. Putting them in their own module makes them straightforward to unit-test with mocked Prisma.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/admin-stats.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/backend/lib/db", () => ({
  prisma: {
    user:           { count: vi.fn(), groupBy: vi.fn() },
    shipment:       { count: vi.fn(), groupBy: vi.fn() },
    subscription:   { count: vi.fn() },
    trackingQuery:  { count: vi.fn() },
    auditLog:       { count: vi.fn(), findMany: vi.fn() },
    contactRequest: { findMany: vi.fn() },
  },
}));

import {
  getUserCounts,
  getShipmentCounts,
  getShipsgoCredits,
  getApiCallsToday,
  getErrorCount24h,
  getMrrCents,
  getRecentActivity,
  getPendingContactRequests,
  getApiCallsByDay,
} from "@/lib/admin-stats";
import { prisma } from "@/backend/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SHIPSGO_TOTAL_CREDITS = "10";
});

describe("getUserCounts", () => {
  it("returns total + breakdown by plan", async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(12);
    vi.mocked(prisma.subscription.count)
      .mockResolvedValueOnce(7)  // FREE
      .mockResolvedValueOnce(5)  // PRO
      .mockResolvedValueOnce(0); // CUSTOM
    const r = await getUserCounts();
    expect(r).toEqual({ total: 12, free: 7, pro: 5, custom: 0 });
  });
});

describe("getShipmentCounts", () => {
  it("returns total + active counts", async () => {
    vi.mocked(prisma.shipment.count)
      .mockResolvedValueOnce(28) // total
      .mockResolvedValueOnce(23); // active
    const r = await getShipmentCounts();
    expect(r).toEqual({ total: 28, active: 23 });
  });
});

describe("getShipsgoCredits", () => {
  it("computes used and remaining from shipments", async () => {
    vi.mocked(prisma.shipment.count).mockResolvedValue(3);
    const r = await getShipsgoCredits();
    expect(r).toEqual({ total: 10, used: 3, remaining: 7 });
  });
  it("clamps remaining at 0 when used exceeds total", async () => {
    vi.mocked(prisma.shipment.count).mockResolvedValue(15);
    const r = await getShipsgoCredits();
    expect(r.remaining).toBe(0);
  });
});

describe("getApiCallsToday", () => {
  it("counts queries where createdAt >= start of today", async () => {
    vi.mocked(prisma.trackingQuery.count)
      .mockResolvedValueOnce(245) // total
      .mockResolvedValueOnce(218); // cache hits
    const r = await getApiCallsToday();
    expect(r.total).toBe(245);
    expect(r.cacheHitRate).toBeCloseTo(218 / 245, 3);
  });
});

describe("getErrorCount24h", () => {
  it("counts audit_log rows with level=error in last 24h", async () => {
    vi.mocked(prisma.auditLog.count).mockResolvedValue(3);
    expect(await getErrorCount24h()).toBe(3);
  });
});

describe("getMrrCents", () => {
  it("multiplies active PRO subs by 3500 cents", async () => {
    vi.mocked(prisma.subscription.count).mockResolvedValue(5);
    expect(await getMrrCents()).toBe(5 * 3500);
  });
});

describe("getRecentActivity", () => {
  it("returns the latest 20 audit-log rows", async () => {
    const rows = [{ id: "a" }, { id: "b" }];
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue(rows as never);
    const r = await getRecentActivity();
    expect(r).toEqual(rows);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    );
  });
});

describe("getPendingContactRequests", () => {
  it("filters by status=PENDING", async () => {
    vi.mocked(prisma.contactRequest.findMany).mockResolvedValue([] as never);
    await getPendingContactRequests();
    expect(prisma.contactRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PENDING" },
      }),
    );
  });
});

describe("getApiCallsByDay", () => {
  it("returns 7 buckets for the last 7 days, oldest first", async () => {
    vi.mocked(prisma.trackingQuery.count).mockResolvedValue(10);
    const r = await getApiCallsByDay();
    expect(r).toHaveLength(7);
    expect(r[0]).toEqual(expect.objectContaining({ count: expect.any(Number) }));
    // The most recent bucket is last
    expect(new Date(r[6].day).getTime()).toBeGreaterThan(new Date(r[0].day).getTime());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/admin-stats.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/admin-stats'`.

- [ ] **Step 3: Implement the aggregations**

Create `src/lib/admin-stats.ts`:

```typescript
import { prisma } from "@/backend/lib/db";

const PRO_MONTHLY_CENTS = 3500; // matches src/config/plans.ts PRO price

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3600 * 1000);
}

// ── Card: Users ─────────────────────────────────────────────
export async function getUserCounts(): Promise<{
  total: number; free: number; pro: number; custom: number;
}> {
  const [total, free, pro, custom] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({ where: { plan: "FREE"   } }),
    prisma.subscription.count({ where: { plan: "PRO"    } }),
    prisma.subscription.count({ where: { plan: "CUSTOM" } }),
  ]);
  return { total, free, pro, custom };
}

// ── Card: Shipments ─────────────────────────────────────────
export async function getShipmentCounts(): Promise<{ total: number; active: number }> {
  const [total, active] = await Promise.all([
    prisma.shipment.count(),
    prisma.shipment.count({ where: { isActive: true } }),
  ]);
  return { total, active };
}

// ── Card: ShipsGo credits (NEVER calls ShipsGo API) ─────────
export async function getShipsgoCredits(): Promise<{
  total: number; used: number; remaining: number;
}> {
  const total = parseInt(process.env.SHIPSGO_TOTAL_CREDITS ?? "10", 10);
  const used  = await prisma.shipment.count({
    where: { trackingProvider: "shipsgo" },
  });
  return { total, used, remaining: Math.max(0, total - used) };
}

// ── Card: API calls today ───────────────────────────────────
export async function getApiCallsToday(): Promise<{ total: number; cacheHitRate: number }> {
  const since = startOfToday();
  const [total, hits] = await Promise.all([
    prisma.trackingQuery.count({ where: { createdAt: { gte: since } } }),
    prisma.trackingQuery.count({ where: { createdAt: { gte: since }, cacheHit: true } }),
  ]);
  const cacheHitRate = total === 0 ? 0 : hits / total;
  return { total, cacheHitRate };
}

// ── Card: Errors 24h ────────────────────────────────────────
export async function getErrorCount24h(): Promise<number> {
  return prisma.auditLog.count({
    where: { level: "error", createdAt: { gte: hoursAgo(24) } },
  });
}

// ── Card: MRR (cents) ───────────────────────────────────────
export async function getMrrCents(): Promise<number> {
  const proActive = await prisma.subscription.count({
    where: { plan: "PRO", status: "ACTIVE" },
  });
  return proActive * PRO_MONTHLY_CENTS;
}

// ── Activity feed: last 20 audit-log entries ────────────────
export async function getRecentActivity() {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take:    20,
    include: {
      user: { select: { email: true, name: true } },
    },
  });
}

// ── Pending contact requests ────────────────────────────────
export async function getPendingContactRequests() {
  return prisma.contactRequest.findMany({
    where:   { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take:    10,
  });
}

// ── API calls per day (last 7 days) ─────────────────────────
export async function getApiCallsByDay(): Promise<Array<{ day: string; count: number }>> {
  const buckets: Array<{ day: string; count: number }> = [];
  for (let offset = 6; offset >= 0; offset--) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - offset);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const count = await prisma.trackingQuery.count({
      where: { createdAt: { gte: start, lt: end } },
    });
    buckets.push({ day: start.toISOString().slice(0, 10), count });
  }
  return buckets;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/admin-stats.test.ts
```

Expected: 9/9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-stats.ts src/__tests__/admin-stats.test.ts
git commit -m "feat(admin): aggregation helpers for dashboard KPIs"
```

---

## Task 5: Admin layout + sidebar

**Files:**
- Create: `src/app/(admin)/layout.tsx`
- Create: `src/frontend/components/admin/admin-sidebar.tsx`

- [ ] **Step 1: Create the sidebar**

Create `src/frontend/components/admin/admin-sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, AlertTriangle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin",        icon: LayoutDashboard, label: "Overview" },
  { href: "/admin/users",  icon: Users,           label: "Users" },
  { href: "/admin/errors", icon: AlertTriangle,   label: "Errors" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 flex-shrink-0 border-r border-navy-200 bg-white
                      dark:border-navy-800 dark:bg-navy-950 lg:flex lg:flex-col">
      <div className="px-5 py-5 border-b border-navy-200 dark:border-navy-800">
        <p className="text-xs font-bold uppercase tracking-wider text-orange-500">Admin</p>
        <p className="mt-1 text-sm font-semibold text-navy-900 dark:text-white">Operations</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300"
                  : "text-navy-600 hover:bg-navy-50 dark:text-navy-300 dark:hover:bg-navy-800/60",
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-navy-200 dark:border-navy-800">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold
                     text-navy-500 hover:text-navy-900 hover:bg-navy-50
                     dark:text-navy-400 dark:hover:text-navy-100 dark:hover:bg-navy-800/60"
        >
          <ArrowLeft size={14} />
          Back to dashboard
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create the layout (auth gate)**

Create `src/app/(admin)/layout.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin-auth";
import { AdminSidebar } from "@/frontend/components/admin/admin-sidebar";

// Refresh server-rendered admin data every 60s — same cadence the
// shipment detail page uses. Cheap DB queries, safe to refresh often.
export const revalidate = 60;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Email/role check. notFound (not 403) so the existence of /admin
  // is hidden from non-admins.
  const allowed = await isAdmin({
    id:    user.id,
    email: user.email,
    role:  (user.role as "USER" | "ADMIN") ?? "USER",
  });
  if (!allowed) notFound();

  return (
    <div className="flex min-h-screen bg-navy-50 dark:bg-navy-950">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. (If there's an error about `user.role`, the Prisma client may need a `npx prisma generate` — but Task 1 ran it already.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/layout.tsx" src/frontend/components/admin/admin-sidebar.tsx
git commit -m "feat(admin): admin layout with sidebar nav and auth gate"
```

---

## Task 6: KPI card component + activity feed component

**Files:**
- Create: `src/frontend/components/admin/kpi-card.tsx`
- Create: `src/frontend/components/admin/activity-feed.tsx`

- [ ] **Step 1: Create the KPI card**

Create `src/frontend/components/admin/kpi-card.tsx`:

```tsx
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon:     LucideIcon;
  label:    string;
  primary:  string;       // "245" or "$175"
  secondary?: string;     // "89% cache hit"
  tone?:    "navy" | "orange" | "teal" | "red" | "green";
}

const TONES: Record<NonNullable<Props["tone"]>, { ring: string; iconBg: string; iconText: string }> = {
  navy:   { ring: "ring-navy-200 dark:ring-navy-800",   iconBg: "bg-navy-100 dark:bg-navy-800",   iconText: "text-navy-700 dark:text-navy-200" },
  orange: { ring: "ring-orange-200 dark:ring-orange-500/30", iconBg: "bg-orange-100 dark:bg-orange-500/15", iconText: "text-orange-700 dark:text-orange-300" },
  teal:   { ring: "ring-teal-200 dark:ring-teal-500/30",     iconBg: "bg-teal-100 dark:bg-teal-500/15",     iconText: "text-teal-700 dark:text-teal-300" },
  red:    { ring: "ring-red-200 dark:ring-red-500/30",       iconBg: "bg-red-100 dark:bg-red-500/15",       iconText: "text-red-700 dark:text-red-300" },
  green:  { ring: "ring-green-200 dark:ring-green-500/30",   iconBg: "bg-green-100 dark:bg-green-500/15",   iconText: "text-green-700 dark:text-green-300" },
};

export function KpiCard({ icon: Icon, label, primary, secondary, tone = "navy" }: Props) {
  const t = TONES[tone];
  return (
    <div className={cn(
      "rounded-2xl bg-white p-5 shadow-sm ring-1 dark:bg-navy-900",
      t.ring,
    )}>
      <div className="flex items-start justify-between">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", t.iconBg)}>
          <Icon size={18} className={t.iconText} />
        </div>
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-navy-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold text-navy-900 dark:text-white">{primary}</p>
      {secondary && (
        <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">{secondary}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the activity feed**

Create `src/frontend/components/admin/activity-feed.tsx`:

```tsx
import { CheckCircle2, AlertTriangle, AlertCircle, Activity } from "lucide-react";
import { cn, relativeDate } from "@/lib/utils";

interface ActivityItem {
  id:         string;
  type:       string;
  level:      string;
  message:    string;
  createdAt:  Date;
  user?:      { email: string; name: string | null } | null;
}

function levelMeta(level: string) {
  if (level === "error")   return { Icon: AlertCircle,    color: "text-red-500" };
  if (level === "warning") return { Icon: AlertTriangle,  color: "text-orange-500" };
  return                   { Icon: CheckCircle2,          color: "text-teal-500" };
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <Activity size={28} className="text-navy-300 dark:text-navy-600" />
        <p className="mt-2 text-sm text-navy-500 dark:text-navy-400">
          No activity yet. Events will appear as they happen.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-navy-100 dark:divide-navy-800">
      {items.map((item) => {
        const { Icon, color } = levelMeta(item.level);
        return (
          <li key={item.id} className="flex items-start gap-3 py-3">
            <Icon size={16} className={cn("mt-0.5 flex-shrink-0", color)} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-navy-900 dark:text-white">
                <span className="font-mono text-xs text-navy-500 dark:text-navy-400 mr-1.5">
                  {item.type}
                </span>
                {item.message}
              </p>
              <p className="mt-0.5 text-xs text-navy-400 dark:text-navy-500">
                {item.user?.email ?? "system"} · {relativeDate(item.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/frontend/components/admin/kpi-card.tsx src/frontend/components/admin/activity-feed.tsx
git commit -m "feat(admin): KpiCard and ActivityFeed components"
```

---

## Task 7: API calls bar chart (SVG)

**Files:**
- Create: `src/frontend/components/admin/api-calls-chart.tsx`

- [ ] **Step 1: Implement the chart**

Create `src/frontend/components/admin/api-calls-chart.tsx`:

```tsx
interface Bucket {
  day:   string; // YYYY-MM-DD
  count: number;
}

const VB_W = 600;
const VB_H = 200;
const PADDING_X = 28;
const PADDING_Y = 24;

export function ApiCallsChart({ data }: { data: Bucket[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const innerW = VB_W - PADDING_X * 2;
  const innerH = VB_H - PADDING_Y * 2;
  const slot   = innerW / data.length;
  const barW   = slot * 0.6;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-navy-200 dark:bg-navy-900 dark:ring-navy-800">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-bold text-navy-900 dark:text-white">API calls — last 7 days</h3>
        <p className="text-xs text-navy-400 dark:text-navy-500">
          {data.reduce((s, d) => s + d.count, 0)} total
        </p>
      </div>

      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Y-axis line */}
        <line
          x1={PADDING_X} y1={PADDING_Y}
          x2={PADDING_X} y2={VB_H - PADDING_Y}
          stroke="currentColor"
          className="text-navy-200 dark:text-navy-700"
          strokeWidth={1}
        />

        {data.map((d, i) => {
          const h  = (d.count / max) * innerH;
          const x  = PADDING_X + slot * i + (slot - barW) / 2;
          const y  = VB_H - PADDING_Y - h;
          const day = new Date(d.day).toLocaleDateString(undefined, { weekday: "short" });
          return (
            <g key={d.day}>
              <rect
                x={x} y={y}
                width={barW} height={h}
                rx={3}
                className="fill-orange-400 dark:fill-orange-500"
              />
              <text
                x={x + barW / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize={10}
                className="fill-navy-700 dark:fill-navy-300 font-bold"
              >
                {d.count}
              </text>
              <text
                x={x + barW / 2}
                y={VB_H - PADDING_Y + 14}
                textAnchor="middle"
                fontSize={10}
                className="fill-navy-400 dark:fill-navy-500"
              >
                {day}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/components/admin/api-calls-chart.tsx
git commit -m "feat(admin): SVG bar chart for 7-day API call history"
```

---

## Task 8: `/admin` Overview page

**Files:**
- Create: `src/app/(admin)/admin/page.tsx`

- [ ] **Step 1: Implement the Overview page**

Create `src/app/(admin)/admin/page.tsx`:

```tsx
import { Users, Ship, CreditCard, Activity, AlertTriangle, DollarSign, MailQuestion } from "lucide-react";
import {
  getUserCounts,
  getShipmentCounts,
  getShipsgoCredits,
  getApiCallsToday,
  getErrorCount24h,
  getMrrCents,
  getRecentActivity,
  getApiCallsByDay,
  getPendingContactRequests,
} from "@/lib/admin-stats";
import { KpiCard }       from "@/frontend/components/admin/kpi-card";
import { ActivityFeed }  from "@/frontend/components/admin/activity-feed";
import { ApiCallsChart } from "@/frontend/components/admin/api-calls-chart";
import { formatPrice, formatDate } from "@/lib/utils";

export const metadata = { title: "Admin · Overview" };

export default async function AdminOverviewPage() {
  const [users, shipments, credits, apiToday, errors24h, mrr, recent, chartData, pending] =
    await Promise.all([
      getUserCounts(),
      getShipmentCounts(),
      getShipsgoCredits(),
      getApiCallsToday(),
      getErrorCount24h(),
      getMrrCents(),
      getRecentActivity(),
      getApiCallsByDay(),
      getPendingContactRequests(),
    ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-navy-900 dark:text-white">Overview</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Live snapshot of the service. Updates every minute.
        </p>
      </header>

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          icon={Users}
          label="Users"
          primary={String(users.total)}
          secondary={`${users.pro} PRO · ${users.free} FREE${users.custom ? ` · ${users.custom} CUSTOM` : ""}`}
          tone="navy"
        />
        <KpiCard
          icon={Ship}
          label="Shipments"
          primary={String(shipments.total)}
          secondary={`${shipments.active} active`}
          tone="teal"
        />
        <KpiCard
          icon={CreditCard}
          label="ShipsGo credits"
          primary={`${credits.used} / ${credits.total}`}
          secondary={`${credits.remaining} remaining`}
          tone="orange"
        />
        <KpiCard
          icon={Activity}
          label="API calls today"
          primary={String(apiToday.total)}
          secondary={`${Math.round(apiToday.cacheHitRate * 100)}% cache hit`}
          tone="navy"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Errors 24h"
          primary={String(errors24h)}
          secondary={errors24h === 0 ? "all clear" : "attention needed"}
          tone={errors24h === 0 ? "green" : "red"}
        />
        <KpiCard
          icon={DollarSign}
          label="MRR"
          primary={formatPrice(mrr)}
          secondary={`${users.pro} active PRO subs`}
          tone="green"
        />
      </div>

      {/* Chart + activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><ApiCallsChart data={chartData} /></div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-navy-200 dark:bg-navy-900 dark:ring-navy-800">
          <h3 className="text-sm font-bold text-navy-900 dark:text-white mb-3">Recent activity</h3>
          <ActivityFeed items={recent.map((r) => ({
            id:        r.id,
            type:      r.type,
            level:     r.level,
            message:   r.message,
            createdAt: r.createdAt,
            user:      r.user,
          }))} />
        </div>
      </div>

      {/* Pending contact requests */}
      {pending.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-navy-200 dark:bg-navy-900 dark:ring-navy-800">
          <div className="flex items-center gap-2 mb-3">
            <MailQuestion size={16} className="text-orange-500" />
            <h3 className="text-sm font-bold text-navy-900 dark:text-white">
              Pending contact requests ({pending.length})
            </h3>
          </div>
          <ul className="divide-y divide-navy-100 dark:divide-navy-800">
            {pending.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-navy-900 dark:text-white">
                    {r.name} <span className="text-navy-400 font-normal">· {r.containersCount} containers/mo</span>
                  </p>
                  <p className="text-xs text-navy-500 dark:text-navy-400">
                    {r.email} · {formatDate(r.createdAt)}
                  </p>
                </div>
                <a
                  href={`mailto:${r.email}`}
                  className="text-xs font-bold text-orange-500 hover:text-orange-600"
                >
                  Reply →
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/admin/page.tsx"
git commit -m "feat(admin): overview page with KPIs, chart, activity, contact requests"
```

---

## Task 9: `/admin/users` page

**Files:**
- Create: `src/app/(admin)/admin/users/page.tsx`

- [ ] **Step 1: Implement the users list page**

Create `src/app/(admin)/admin/users/page.tsx`:

```tsx
import Link from "next/link";
import { prisma } from "@/backend/lib/db";
import { cn, formatDate, relativeDate } from "@/lib/utils";

export const metadata = { title: "Admin · Users" };

interface SearchParams {
  q?:    string;
  plan?: string;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, plan } = await searchParams;

  const where: import("@prisma/client").Prisma.UserWhereInput = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name:  { contains: q, mode: "insensitive" } },
    ];
  }
  if (plan && ["FREE", "PRO", "CUSTOM"].includes(plan)) {
    where.subscription = { plan: plan as "FREE" | "PRO" | "CUSTOM" };
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take:    100,
    include: {
      subscription: { select: { plan: true } },
      _count:       { select: { shipments: true, trackingQueries: true } },
      trackingQueries: {
        select:  { createdAt: true },
        orderBy: { createdAt: "desc" },
        take:    1,
      },
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-navy-900 dark:text-white">Users</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          {users.length} user{users.length === 1 ? "" : "s"} shown (most recent 100).
        </p>
      </header>

      {/* Filters */}
      <form className="flex flex-wrap gap-3" method="GET">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search email or name…"
          className="flex-1 min-w-[240px] rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm
                     dark:border-navy-700 dark:bg-navy-900 dark:text-white"
        />
        <select
          name="plan"
          defaultValue={plan ?? ""}
          className="rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm
                     dark:border-navy-700 dark:bg-navy-900 dark:text-white"
        >
          <option value="">All plans</option>
          <option value="FREE">FREE</option>
          <option value="PRO">PRO</option>
          <option value="CUSTOM">CUSTOM</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600"
        >
          Apply
        </button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl ring-1 ring-navy-200 dark:ring-navy-800">
        <table className="w-full text-sm">
          <thead className="bg-navy-50 dark:bg-navy-900/60 text-navy-500 dark:text-navy-400">
            <tr className="text-left">
              <th className="px-4 py-2.5 font-semibold">Email</th>
              <th className="px-4 py-2.5 font-semibold">Plan</th>
              <th className="px-4 py-2.5 font-semibold">Shipments</th>
              <th className="px-4 py-2.5 font-semibold">API calls</th>
              <th className="px-4 py-2.5 font-semibold">Last seen</th>
              <th className="px-4 py-2.5 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100 dark:divide-navy-800 bg-white dark:bg-navy-900">
            {users.map((u) => {
              const planName = u.subscription?.plan ?? "FREE";
              const lastSeen = u.trackingQueries[0]?.createdAt ?? null;
              return (
                <tr key={u.id} className="hover:bg-navy-50 dark:hover:bg-navy-800/40">
                  <td className="px-4 py-3 font-medium text-navy-900 dark:text-white">
                    <div>{u.email}</div>
                    {u.name && <div className="text-xs text-navy-400 dark:text-navy-500">{u.name}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-block rounded-full px-2 py-0.5 text-xs font-bold",
                      planName === "PRO"    && "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
                      planName === "CUSTOM" && "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
                      planName === "FREE"   && "bg-navy-100 text-navy-700 dark:bg-navy-800 dark:text-navy-300",
                    )}>
                      {planName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy-700 dark:text-navy-200">{u._count.shipments}</td>
                  <td className="px-4 py-3 text-navy-700 dark:text-navy-200">{u._count.trackingQueries}</td>
                  <td className="px-4 py-3 text-navy-500 dark:text-navy-400">
                    {lastSeen ? relativeDate(lastSeen) : "never"}
                  </td>
                  <td className="px-4 py-3 text-navy-500 dark:text-navy-400">{formatDate(u.createdAt)}</td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-navy-500 dark:text-navy-400">
                  No users match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/admin/users/page.tsx"
git commit -m "feat(admin): users list with search, plan filter, last-seen"
```

---

## Task 10: `/admin/errors` page

**Files:**
- Create: `src/app/(admin)/admin/errors/page.tsx`

- [ ] **Step 1: Implement the errors feed page**

Create `src/app/(admin)/admin/errors/page.tsx`:

```tsx
import Link from "next/link";
import { prisma } from "@/backend/lib/db";
import { cn, relativeDate } from "@/lib/utils";

export const metadata = { title: "Admin · Errors" };

interface SearchParams {
  category?: string;  // tracking | notifications | webhooks | auth
  range?:    string;  // 24h | 7d | 30d
}

const CATEGORY_PREFIX: Record<string, string> = {
  tracking:      "tracking.",
  notifications: "notification.",
  webhooks:      "billing.",
  auth:          "auth.",
};

const RANGE_HOURS: Record<string, number> = {
  "24h": 24,
  "7d":  24 * 7,
  "30d": 24 * 30,
};

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { category, range } = await searchParams;
  const hours = RANGE_HOURS[range ?? "24h"] ?? 24;
  const since = new Date(Date.now() - hours * 3600 * 1000);

  const where: import("@prisma/client").Prisma.AuditLogWhereInput = {
    level:     { in: ["warning", "error"] },
    createdAt: { gte: since },
  };
  if (category && CATEGORY_PREFIX[category]) {
    where.type = { startsWith: CATEGORY_PREFIX[category] };
  }

  const items = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take:    200,
    include: { user: { select: { email: true } } },
  });

  const categories = [
    { key: "all",           label: "All" },
    { key: "tracking",      label: "Tracking" },
    { key: "notifications", label: "Notifications" },
    { key: "webhooks",      label: "Webhooks" },
    { key: "auth",          label: "Auth" },
  ];

  const ranges = [
    { key: "24h", label: "24h" },
    { key: "7d",  label: "7d" },
    { key: "30d", label: "30d" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-navy-900 dark:text-white">Errors</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          {items.length} entr{items.length === 1 ? "y" : "ies"} in the last {range ?? "24h"}.
        </p>
      </header>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-navy-500 dark:text-navy-400 mr-1">
          Category
        </span>
        {categories.map((c) => {
          const active = (category ?? "all") === c.key;
          const href = c.key === "all"
            ? `?range=${range ?? "24h"}`
            : `?category=${c.key}&range=${range ?? "24h"}`;
          return (
            <Link key={c.key} href={href} className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold border transition-colors",
              active
                ? "border-orange-500 bg-orange-500 text-white"
                : "border-navy-200 text-navy-700 hover:border-navy-300 dark:border-navy-700 dark:text-navy-300 dark:hover:border-navy-600",
            )}>
              {c.label}
            </Link>
          );
        })}

        <span className="text-xs font-bold uppercase tracking-wider text-navy-500 dark:text-navy-400 ml-4 mr-1">
          Range
        </span>
        {ranges.map((r) => {
          const active = (range ?? "24h") === r.key;
          const href = category
            ? `?category=${category}&range=${r.key}`
            : `?range=${r.key}`;
          return (
            <Link key={r.key} href={href} className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold border transition-colors",
              active
                ? "border-orange-500 bg-orange-500 text-white"
                : "border-navy-200 text-navy-700 hover:border-navy-300 dark:border-navy-700 dark:text-navy-300 dark:hover:border-navy-600",
            )}>
              {r.label}
            </Link>
          );
        })}
      </div>

      {/* Feed */}
      <div className="rounded-2xl ring-1 ring-navy-200 dark:ring-navy-800 divide-y divide-navy-100 dark:divide-navy-800 bg-white dark:bg-navy-900 overflow-hidden">
        {items.map((item) => (
          <details key={item.id} className="group">
            <summary className="flex items-start gap-3 px-4 py-3 cursor-pointer list-none hover:bg-navy-50 dark:hover:bg-navy-800/40">
              <span className={cn(
                "mt-0.5 h-2 w-2 rounded-full flex-shrink-0",
                item.level === "error"   ? "bg-red-500" : "bg-orange-400",
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-navy-900 dark:text-white">
                  <span className="font-mono text-xs text-navy-500 dark:text-navy-400 mr-1.5">
                    {item.type}
                  </span>
                  {item.message}
                </p>
                <p className="mt-0.5 text-xs text-navy-400 dark:text-navy-500">
                  {item.user?.email ?? "system"} · {relativeDate(item.createdAt)}
                </p>
              </div>
            </summary>
            {item.metadata != null && (
              <pre className="bg-navy-50 dark:bg-navy-950 text-xs text-navy-700 dark:text-navy-300 p-4 overflow-x-auto">
                {JSON.stringify(item.metadata, null, 2)}
              </pre>
            )}
          </details>
        ))}

        {items.length === 0 && (
          <div className="px-4 py-12 text-center text-navy-500 dark:text-navy-400">
            No errors in this window. 🎉
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/admin/errors/page.tsx"
git commit -m "feat(admin): errors feed with category and range filters"
```

---

## Task 11: Sprinkle `recordEvent` calls into existing routes

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/app/api/shipments/route.ts`
- Modify: `src/app/api/contact/route.ts`
- Modify: `src/backend/worker/processors/tracking-poll.ts`
- Modify: `src/backend/services/notifications/email.ts`
- Modify: `src/app/api/webhooks/stripe/route.ts`

Each modification adds an import and 1-2 `recordEvent(...)` calls. The existing logic is unchanged. Because `recordEvent` swallows its own errors, even if the audit-log write fails, the host code keeps running.

- [ ] **Step 1: `src/lib/auth.ts` — log new signups**

Add the import at the top:

```typescript
import { recordEvent } from "@/lib/audit-log";
```

In `getAuthenticatedUser`, after the `prisma.user.create({...})` block (the `if (!dbUser)` branch), add:

```typescript
    void recordEvent({
      type:    "user.signed_up",
      message: `${dbUser.email} created their account`,
      userId:  dbUser.id,
    });
```

- [ ] **Step 2: `src/app/api/shipments/route.ts` — log success and failure**

Add the import at the top:

```typescript
import { recordEvent } from "@/lib/audit-log";
```

After the `const shipment = await prisma.shipment.create({...})` block but before the `return NextResponse.json(shipment, { status: 201 })`:

```typescript
  void recordEvent({
    type:    "shipment.created",
    message: `${trackingNumber} added (${type}, provider=${provider})`,
    userId:  user.id,
    metadata: { shipmentId: shipment.id, trackingNumber, type, provider },
  });
```

In the `catch (err)` block where `TrackingError` is handled, before the `return NextResponse.json({ error: err.message }, { status: 422 })`:

```typescript
    void recordEvent({
      type:    "shipment.create_failed",
      level:   "warning",
      message: `${trackingNumber}: ${err instanceof Error ? err.message : "tracking failed"}`,
      userId:  user.id,
      metadata: { trackingNumber, type },
    });
```

- [ ] **Step 3: `src/app/api/contact/route.ts` — log received**

Add the import:

```typescript
import { recordEvent } from "@/lib/audit-log";
```

After `prisma.contactRequest.create({...})` succeeds, before the response:

```typescript
  void recordEvent({
    type:    "contact.received",
    message: `${contact.name} (${contact.email}) — ${contact.containersCount} containers/mo`,
    metadata: { contactRequestId: contact.id, email: contact.email, containersCount: contact.containersCount },
  });
```

- [ ] **Step 4: `src/backend/worker/processors/tracking-poll.ts` — log poll success/fail**

Add the import:

```typescript
import { recordEvent } from "@/lib/audit-log";
```

After the `await prisma.shipment.update(...)` call where `lastPolledAt` is set, but only when `newEvents.length > 0`, log a poll-ok event. Find the `if (newEvents.length > 0) { await prisma.trackingEvent.createMany(...) }` block and append:

```typescript
    void recordEvent({
      type:    "tracking.poll_ok",
      message: `${trackingNumber}: ${newEvents.length} new event${newEvents.length === 1 ? "" : "s"}`,
      userId,
      metadata: { shipmentId, trackingNumber, newEvents: newEvents.length },
    });
```

Wrap the entire body of `trackingPollProcessor` in a try/catch (or extend any existing catch). On error, log:

```typescript
  } catch (err) {
    void recordEvent({
      type:    "tracking.poll_failed",
      level:   "error",
      message: `${job.data.trackingNumber}: ${err instanceof Error ? err.message : "poll failed"}`,
      userId:  job.data.userId,
      metadata: { shipmentId: job.data.shipmentId, trackingNumber: job.data.trackingNumber },
    });
    throw err; // let BullMQ see the failure
  }
```

(If a try/catch already exists, just add the `recordEvent` call inside the existing catch and keep the existing rethrow.)

- [ ] **Step 5: `src/backend/services/notifications/email.ts` — log sends and failures**

Add the import:

```typescript
import { recordEvent } from "@/lib/audit-log";
```

In the `try { await resend.emails.send(...) }` success path, after the `prisma.notification.update({...status: "SENT"...})`:

```typescript
    void recordEvent({
      type:    "notification.sent",
      message: `EMAIL · ${notificationType} → ${to}`,
      userId,
      metadata: { channel: "EMAIL", notificationType, to },
    });
```

In the catch block, after `prisma.notification.update({...status: "FAILED"...})`:

```typescript
    void recordEvent({
      type:    "notification.failed",
      level:   "error",
      message: `EMAIL · ${notificationType} → ${to}: ${msg}`,
      userId,
      metadata: { channel: "EMAIL", notificationType, to, error: msg },
    });
```

- [ ] **Step 6: `src/app/api/webhooks/stripe/route.ts` — log Stripe events**

Add the import:

```typescript
import { recordEvent } from "@/lib/audit-log";
```

After the signature has been verified and `event` is constructed, before the switch/handlers:

```typescript
  void recordEvent({
    type:    "billing.event",
    message: `Stripe: ${event.type}`,
    metadata: { stripeEventType: event.type, stripeEventId: event.id },
  });
```

In the catch block where signature verification fails (or the top-level catch in the route handler):

```typescript
    void recordEvent({
      type:    "billing.error",
      level:   "error",
      message: `Stripe webhook failed: ${err instanceof Error ? err.message : "unknown"}`,
    });
```

- [ ] **Step 7: TypeScript check + run all tests**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: 0 TypeScript errors. All previous tests still pass (the new helper code doesn't change return types of existing routes).

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth.ts \
        src/app/api/shipments/route.ts \
        src/app/api/contact/route.ts \
        src/backend/worker/processors/tracking-poll.ts \
        src/backend/services/notifications/email.ts \
        src/app/api/webhooks/stripe/route.ts
git commit -m "feat(audit): record events from auth, shipments, contact, worker, email, billing"
```

---

## Task 12: Final verification + env vars

**Files:**
- Modify: `.env.local`, `.env`

- [ ] **Step 1: Add the env vars locally**

Append to `.env.local`:

```
ADMIN_EMAILS=maysahjazi32@gmail.com
SHIPSGO_TOTAL_CREDITS=10
```

- [ ] **Step 2: Full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Run the entire test suite**

```bash
npx vitest run
```

Expected: every test file passes (audit-log, admin-auth, admin-stats, plus all earlier tests still green).

- [ ] **Step 4: Run `next build` locally**

```bash
npm run build
```

Expected: build succeeds. New routes appear in the build output: `/admin`, `/admin/users`, `/admin/errors`. (If build is too slow on Windows, skip and rely on the VPS production build during deploy.)

- [ ] **Step 5: Sanity-poke the new routes locally**

Start the dev server (`npm run dev`), log in with `maysahjazi32@gmail.com`, then:
- Visit `http://localhost:3000/admin` — KPI cards render with current numbers.
- Visit `http://localhost:3000/admin/users` — table renders.
- Visit `http://localhost:3000/admin/errors` — feed renders (likely empty if no errors yet).
- Log in as a non-admin (or run `update users set role='USER' where email='other@example.com'`) and visit `/admin` — 404.

- [ ] **Step 6: Commit env note (without secrets)**

`.env.local` is gitignored, so nothing to commit there. If `.env.example` exists, add the two new keys to it as documentation:

```
ADMIN_EMAILS=
SHIPSGO_TOTAL_CREDITS=10
```

```bash
git add .env.example   # only if it exists; otherwise skip this commit
git commit -m "docs(env): document ADMIN_EMAILS and SHIPSGO_TOTAL_CREDITS" --allow-empty
```

- [ ] **Step 7: Push and deploy**

```bash
git push origin main
```

Then on the VPS (the operator runs this — or include the same dance the rest of the project uses: `git pull`, `docker compose --env-file .env.production -f docker-compose.prod.yml build`, then `up -d --force-recreate`. The `.env.production` file on the VPS needs `ADMIN_EMAILS` and `SHIPSGO_TOTAL_CREDITS` added before the rebuild.)

Apply the SQL migration on the production self-hosted Supabase the same way the subscription-system migration was applied:

```bash
ssh root@37.60.232.123
docker exec tmc-next-app cat prisma/migrations/20260428000001_admin_dashboard/migration.sql \
  | docker exec -i supabase-db psql -U postgres -d postgres
docker exec tmc-next-app npx prisma@6.4.0 migrate resolve --applied 20260428000001_admin_dashboard
```

Verify in Prisma Studio (or psql) that `audit_log` exists and `users.role` defaults to `USER`.

---

## Self-review checklist (run before handing the plan over)

- **Spec coverage:**
  - Auth (§2 of the spec) → Tasks 1, 3, 5, 12.
  - Audit log table (§3) → Tasks 1, 2.
  - Routes & layout (§4) → Tasks 5, 8, 9, 10.
  - Page contents (§5) → Tasks 6, 7, 8, 9, 10.
  - Events to record from existing code (§6) → Task 11.
  - UI tokens (§7) — reused from main app, no new task needed.
  - Files to create or modify (§8) — all listed in the file structure table above.
  - Tests (§9) → Tasks 2, 3, 4, 12.
  - Phase 2 items (§10) intentionally not in this plan.
  - Counting summary (§11) — covered by Task 4 (admin-stats).

- **Type consistency:**
  - `RecordEventInput` (Task 2), `AdminAuthInput` (Task 3), and `recordEvent`'s argument shape line up everywhere.
  - `getShipsgoCredits` returns `{ total, used, remaining }` — matches the KpiCard usage in Task 8.
  - `ActivityItem` shape in Task 6 matches what `getRecentActivity` returns (with `user` relation included).

- **No placeholders:** every code block is complete; no "implement later" or "similar to Task X" — code is duplicated where reading the task in isolation requires it.

- **Frequent commits:** every task ends with a commit; tests are committed together with the code they test.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-28-admin-dashboard.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
