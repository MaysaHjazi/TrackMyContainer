# Subscription System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a 3-tier subscription system (FREE/PRO/CUSTOM) with plan-based provider routing, feature gates, and a contact form for CUSTOM plan inquiries.

**Architecture:** Prisma schema migration adds `isLiveTracking` + `trackingProvider` to Shipment and replaces BUSINESS enum with CUSTOM. The `canAddShipment()` function is rewritten to return rich `{allowed, current, max, plan, message}`. The tracking service and worker are updated to respect `isLiveTracking`. UI gates locked features behind `UpgradeOverlay` for FREE users.

**Tech Stack:** Next.js 15, Prisma, PostgreSQL/Supabase, Stripe webhooks, BullMQ worker, ShipsGo + JSONCargo providers, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `prisma/schema.prisma` | Modify | Enum BUSINESS→CUSTOM, 2 new Shipment fields, ContactRequest model |
| `prisma/migrations/20260426000001_subscription_system/migration.sql` | Create | Raw SQL migration with enum rename |
| `prisma/vitest.config.ts` → root `vitest.config.ts` | Create | Vitest configuration |
| `src/config/plans.ts` | Rewrite | Add provider/liveTracking, rename BUSINESS→CUSTOM |
| `src/lib/auth.ts` | Modify | Rewrite canAddShipment(), fix subscription defaults (3→5) |
| `src/backend/services/tracking/index.ts` | Modify | Register ShipsGo, add forceProvider option |
| `src/app/api/shipments/route.ts` | Modify | Use new canAddShipment(), set trackingProvider+isLiveTracking |
| `src/backend/worker/processors/tracking-dispatch.ts` | Modify | Filter `isLiveTracking: true` |
| `src/backend/worker/processors/tracking-poll.ts` | Modify | Pass `forceProvider` from shipment.trackingProvider |
| `src/app/api/webhooks/stripe/route.ts` | Modify | BUSINESS→CUSTOM, currentPeriodStart on payment_succeeded |
| `src/app/api/shipments/count/route.ts` | Create | GET counter endpoint |
| `src/app/(dashboard)/dashboard/shipments/[id]/page.tsx` | Modify | Wrap RouteVisualization, RouteMap, Event History in UpgradeOverlay |
| `src/frontend/components/dashboard/upgrade-overlay.tsx` | Modify | Update price text + link |
| `src/frontend/components/dashboard/billing-client.tsx` | Modify | Replace BUSINESS→CUSTOM with Contact Us CTA |
| `src/app/api/contact/route.ts` | Create | POST contact form endpoint |
| `src/app/(marketing)/pricing/page.tsx` | Create | Full pricing page |
| `src/__tests__/canAddShipment.test.ts` | Create | Unit tests for canAddShipment logic |

---

## Task 1: Prisma Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260426000001_subscription_system/migration.sql`

- [ ] **Step 1: Update prisma/schema.prisma**

Replace the `SubscriptionPlan` enum:

```prisma
enum SubscriptionPlan {
  FREE
  PRO
  CUSTOM
}
```

Update Subscription model defaults (change `maxTrackedShipments @default(0)` to `@default(5)`):

```prisma
model Subscription {
  id                   String             @id @default(cuid())
  userId               String             @unique

  // Stripe
  stripeCustomerId     String             @unique
  stripeSubscriptionId String?            @unique
  stripePriceId        String?

  // Plan
  plan                 SubscriptionPlan   @default(FREE)
  status               SubscriptionStatus @default(ACTIVE)

  // Billing cycle
  currentPeriodStart   DateTime?
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean            @default(false)
  trialEnd             DateTime?

  // Feature gates (denormalized for fast access)
  maxTrackedShipments  Int                @default(5)
  maxDailyQueries      Int                @default(50)
  whatsappEnabled      Boolean            @default(false)
  apiAccessEnabled     Boolean            @default(false)
  maxTeamMembers       Int                @default(1)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("subscriptions")
}
```

Add 2 new fields to the Shipment model (after `lastPolledAt`):

```prisma
  // Provider used when this shipment was added
  trackingProvider String  @default("jsoncargo")  // "jsoncargo" | "shipsgo"

  // false = FREE (no worker polling ever)
  isLiveTracking   Boolean @default(false)
```

Add after the existing enums:

```prisma
model ContactRequest {
  id              String               @id @default(cuid())
  name            String
  email           String
  phone           String?
  containersCount Int
  message         String?
  status          ContactRequestStatus @default(PENDING)
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt

  @@map("contact_requests")
}

enum ContactRequestStatus {
  PENDING
  CONTACTED
  CLOSED
}
```

- [ ] **Step 2: Create migration directory and SQL file**

Create the directory `prisma/migrations/20260426000001_subscription_system/` and write `migration.sql`:

```sql
-- Rename BUSINESS → CUSTOM (PostgreSQL supports this in-place — safe, no downtime)
ALTER TYPE "SubscriptionPlan" RENAME VALUE 'BUSINESS' TO 'CUSTOM';

-- Add trackingProvider column to shipments
ALTER TABLE "shipments" ADD COLUMN "trackingProvider" TEXT NOT NULL DEFAULT 'jsoncargo';

-- Add isLiveTracking column to shipments
ALTER TABLE "shipments" ADD COLUMN "isLiveTracking" BOOLEAN NOT NULL DEFAULT false;

-- Update Subscription schema default (existing FREE rows: 0 or 3 → 5)
ALTER TABLE "subscriptions" ALTER COLUMN "maxTrackedShipments" SET DEFAULT 5;
UPDATE "subscriptions" SET "maxTrackedShipments" = 5 WHERE "plan" = 'FREE';

-- Update maxDailyQueries default for new FREE subscriptions
ALTER TABLE "subscriptions" ALTER COLUMN "maxDailyQueries" SET DEFAULT 50;

-- Create ContactRequestStatus enum
CREATE TYPE "ContactRequestStatus" AS ENUM ('PENDING', 'CONTACTED', 'CLOSED');

-- Create contact_requests table
CREATE TABLE "contact_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "containersCount" INTEGER NOT NULL,
    "message" TEXT,
    "status" "ContactRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contact_requests_pkey" PRIMARY KEY ("id")
);
```

- [ ] **Step 3: Apply migration and regenerate client**

```bash
cd D:\trackmycontainer
npx prisma migrate dev --name subscription_system
```

Expected output: `The following migration(s) have been applied: 20260426000001_subscription_system`

Then regenerate the Prisma client:

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 4: Verify schema in Prisma Studio**

```bash
npx prisma studio
```

Open browser → Subscription table: confirm `maxTrackedShipments` default is 5. Shipment table: confirm `trackingProvider` and `isLiveTracking` columns exist. ContactRequest table: confirm it was created.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: prisma migration — BUSINESS→CUSTOM enum, isLiveTracking, ContactRequest"
```

---

## Task 2: Vitest Configuration

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Create vitest.config.ts in project root**

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 2: Run vitest to confirm it boots**

```bash
npx vitest run --reporter=verbose
```

Expected: `No test files found` (no tests yet — not a failure)

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: add vitest config with path alias"
```

---

## Task 3: Update plans.ts

**Files:**
- Rewrite: `src/config/plans.ts`

The new file must keep all fields that existing consumers need:
- `pricing-cards.tsx` uses: `plan.badge`, `plan.priceLabel`, `plan.highlights`, `plan.cta`, `plan.price`, `plan.description`
- `stripe webhook` uses: `features.maxTrackedShipments`, `features.maxDailyQueries`, `features.whatsappNotifications`, `features.apiAccess`, `features.maxTeamMembers`
- New consumers need: `provider`, `liveTracking` (top-level), `getProviderForPlan()`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/plans.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { PLANS, getProviderForPlan } from "@/config/plans";

describe("PLANS config", () => {
  it("FREE plan uses jsoncargo and has no live tracking", () => {
    expect(PLANS.FREE.provider).toBe("jsoncargo");
    expect(PLANS.FREE.liveTracking).toBe(false);
    expect(PLANS.FREE.features.maxTrackedShipments).toBe(5);
  });

  it("PRO plan uses shipsgo and has live tracking", () => {
    expect(PLANS.PRO.provider).toBe("shipsgo");
    expect(PLANS.PRO.liveTracking).toBe(true);
    expect(PLANS.PRO.features.maxTrackedShipments).toBe(10);
    expect(PLANS.PRO.price).toBe(3500);
  });

  it("CUSTOM plan uses shipsgo and has no limit", () => {
    expect(PLANS.CUSTOM.provider).toBe("shipsgo");
    expect(PLANS.CUSTOM.liveTracking).toBe(true);
    expect(PLANS.CUSTOM.features.maxTrackedShipments).toBe(2147483647);
    expect(PLANS.CUSTOM.price).toBe(null);
  });

  it("getProviderForPlan returns correct provider", () => {
    expect(getProviderForPlan("FREE")).toBe("jsoncargo");
    expect(getProviderForPlan("PRO")).toBe("shipsgo");
    expect(getProviderForPlan("CUSTOM")).toBe("shipsgo");
  });

  it("CUSTOM replaces BUSINESS — no BUSINESS key", () => {
    expect((PLANS as Record<string, unknown>).BUSINESS).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/__tests__/plans.test.ts --reporter=verbose
```

Expected: FAIL (PLANS.FREE has no `provider` field yet)

- [ ] **Step 3: Rewrite src/config/plans.ts**

```typescript
export const PLANS = {
  FREE: {
    id:             "free" as const,
    name:           "Free",
    price:          0,
    priceLabel:     "$0",
    stripePriceId:  null,
    description:    "Track up to 5 containers, no updates",
    badge:          null,
    // New: provider routing
    provider:       "jsoncargo",
    liveTracking:   false,
    features: {
      maxTrackedShipments:    5,
      maxDailyQueries:        50,
      whatsappNotifications:  false,
      messengerNotifications: false,
      emailNotifications:     false,
      dashboardAccess:        true,
      apiAccess:              false,
      exportReports:          false,
      maxTeamMembers:         1,
      map:                    false,
      routeVisualization:     false,
      eventHistory:           false,
      autoUpdates:            false,
    },
    highlights: [
      "5 containers — lifetime total",
      "One-time lookup via JSONCargo",
      "Location, status, ETA/ATA dates",
      "Sea container & air AWB support",
    ],
    cta:   "Start for Free",
    color: "navy",
  },

  PRO: {
    id:            "pro" as const,
    name:          "Pro",
    price:         3500,          // cents — $35/month
    priceLabel:    "$35",
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
    description:   "10 containers/month, ShipsGo, live updates every 6h",
    badge:         "Most Popular",
    provider:      "shipsgo",
    liveTracking:  true,
    features: {
      maxTrackedShipments:    10,
      maxDailyQueries:        500,
      whatsappNotifications:  false,
      messengerNotifications: false,
      emailNotifications:     true,
      dashboardAccess:        true,
      apiAccess:              false,
      exportReports:          true,
      maxTeamMembers:         1,
      map:                    true,
      routeVisualization:     true,
      eventHistory:           true,
      autoUpdates:            true,
    },
    highlights: [
      "10 containers per billing period",
      "ShipsGo live tracking (updates every 6h)",
      "Interactive world map & route visualization",
      "Full event history timeline",
      "Auto-updates — never stale",
    ],
    cta:   "Subscribe Now",
    color: "orange",
  },

  CUSTOM: {
    id:            "custom" as const,
    name:          "Custom",
    price:         null,          // negotiated — no fixed price
    priceLabel:    "Custom",
    stripePriceId: null,
    description:   "Unlimited containers, dedicated support",
    badge:         null,
    provider:      "shipsgo",
    liveTracking:  true,
    features: {
      maxTrackedShipments:    2147483647,
      maxDailyQueries:        2147483647,
      whatsappNotifications:  true,
      messengerNotifications: true,
      emailNotifications:     true,
      dashboardAccess:        true,
      apiAccess:              true,
      exportReports:          true,
      maxTeamMembers:         99,
      map:                    true,
      routeVisualization:     true,
      eventHistory:           true,
      autoUpdates:            true,
    },
    highlights: [
      "Unlimited containers — never blocked",
      "ShipsGo live tracking (updates every 6h)",
      "All PRO features included",
      "Dedicated account manager",
    ],
    cta:   "Contact Us",
    color: "teal",
  },
} as const;

export type PlanKey = keyof typeof PLANS;
export type Plan    = (typeof PLANS)[PlanKey];

export function getPlanById(id: string): Plan | null {
  const key = id.toUpperCase() as PlanKey;
  return PLANS[key] ?? null;
}

export function getProviderForPlan(plan: PlanKey): string {
  return PLANS[plan].provider;
}

export function planAllows(plan: PlanKey, feature: keyof Plan["features"]): boolean {
  const value = PLANS[plan].features[feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number")  return (value as number) !== 0;
  return false;
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/__tests__/plans.test.ts --reporter=verbose
```

Expected: All 5 tests PASS

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Fix any type errors before continuing. Common one: `CARD_STYLES` in `pricing-cards.tsx` uses a `business` key — update it to `custom` in Task 12.

- [ ] **Step 6: Commit**

```bash
git add src/config/plans.ts src/__tests__/plans.test.ts
git commit -m "feat: rewrite plans config — FREE/PRO/CUSTOM with provider and liveTracking"
```

---

## Task 4: Rewrite canAddShipment() in auth.ts

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/canAddShipment.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the core counting logic in isolation, mocking prisma
vi.mock("@/backend/lib/db", () => ({
  prisma: {
    subscription: { findUnique: vi.fn() },
    shipment:     { count: vi.fn() },
  },
}));

import { prisma } from "@/backend/lib/db";
import { canAddShipment } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  subscription: { findUnique: ReturnType<typeof vi.fn> };
  shipment:     { count:      ReturnType<typeof vi.fn> };
};

beforeEach(() => vi.clearAllMocks());

describe("canAddShipment", () => {
  it("CUSTOM plan: always allowed, never queries shipments", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "CUSTOM",
      maxTrackedShipments: 2147483647,
      currentPeriodStart: null,
    });

    const result = await canAddShipment("user-1");

    expect(result.allowed).toBe(true);
    expect(result.plan).toBe("CUSTOM");
    expect(mockPrisma.shipment.count).not.toHaveBeenCalled();
  });

  it("FREE plan: counts ALL shipments (no date/isActive filter)", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "FREE",
      maxTrackedShipments: 5,
      currentPeriodStart: null,
    });
    mockPrisma.shipment.count.mockResolvedValue(3);

    const result = await canAddShipment("user-1");

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(3);
    expect(result.max).toBe(5);
    // Confirm NO date filter was applied (FREE = lifetime total)
    const callArgs = mockPrisma.shipment.count.mock.calls[0][0];
    expect(callArgs.where.createdAt).toBeUndefined();
  });

  it("FREE plan: blocks at 5 with Arabic message", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "FREE",
      maxTrackedShipments: 5,
      currentPeriodStart: null,
    });
    mockPrisma.shipment.count.mockResolvedValue(5);

    const result = await canAddShipment("user-1");

    expect(result.allowed).toBe(false);
    expect(result.message).toContain("PRO");
  });

  it("PRO plan: counts only current billing period shipments", async () => {
    const periodStart = new Date("2026-04-01");
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "PRO",
      maxTrackedShipments: 10,
      currentPeriodStart: periodStart,
    });
    mockPrisma.shipment.count.mockResolvedValue(7);

    const result = await canAddShipment("user-1");

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(7);
    const callArgs = mockPrisma.shipment.count.mock.calls[0][0];
    expect(callArgs.where.createdAt).toEqual({ gte: periodStart });
  });

  it("throws if no subscription found", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    await expect(canAddShipment("user-1")).rejects.toThrow("No subscription found");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/__tests__/canAddShipment.test.ts --reporter=verbose
```

Expected: FAIL — `canAddShipment` currently takes a user object and returns boolean

- [ ] **Step 3: Update src/lib/auth.ts**

Replace the entire file:

```typescript
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/backend/lib/db";
import type { User, Subscription } from "@prisma/client";

export type AuthenticatedUser = User & { subscription: Subscription | null };

/**
 * Get the authenticated user from Supabase session + Prisma DB.
 * Returns null if not authenticated or user not found.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) return null;

  // Find or auto-create user in Prisma DB
  let dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    include: { subscription: true },
  });

  if (!dbUser) {
    // Auto-create user + FREE subscription on first login
    dbUser = await prisma.user.create({
      data: {
        email: user.email,
        name:  user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email.split("@")[0],
        image: user.user_metadata?.avatar_url ?? user.user_metadata?.picture,
        subscription: {
          create: {
            stripeCustomerId:    `free_${user.id}`,
            plan:                "FREE",
            status:              "ACTIVE",
            maxTrackedShipments: 5,      // ← was 3, now 5
            maxDailyQueries:     50,     // ← was 5, now 50
            whatsappEnabled:     false,
            apiAccessEnabled:    false,
            maxTeamMembers:      1,
          },
        },
      },
      include: { subscription: true },
    });
  }

  return dbUser;
}

export interface CanAddShipmentResult {
  allowed:  boolean;
  current:  number;
  max:      number | typeof Infinity;
  plan:     string;
  message:  string | null;
}

/**
 * Check if a user can add another tracked shipment.
 *
 * FREE:   lifetime total (COUNT(*) WHERE userId — no date/isActive filter)
 * PRO:    current billing period (COUNT(*) WHERE userId AND createdAt >= currentPeriodStart)
 * CUSTOM: always allowed — no query needed
 */
export async function canAddShipment(userId: string): Promise<CanAddShipmentResult> {
  const sub = await prisma.subscription.findUnique({
    where:  { userId },
    select: { plan: true, maxTrackedShipments: true, currentPeriodStart: true },
  });

  if (!sub) throw new Error("No subscription found for user");

  // CUSTOM — never blocked
  if (sub.plan === "CUSTOM") {
    return { allowed: true, current: 0, max: Infinity, plan: "CUSTOM", message: null };
  }

  // FREE: COUNT(*) with no filters — lifetime total
  // PRO:  COUNT(*) filtered to current billing period
  const count = await prisma.shipment.count({
    where: {
      userId,
      ...(sub.plan === "PRO" && sub.currentPeriodStart
        ? { createdAt: { gte: sub.currentPeriodStart } }
        : {}),
    },
  });

  const allowed = count < sub.maxTrackedShipments;

  return {
    allowed,
    current: count,
    max:     sub.maxTrackedShipments,
    plan:    sub.plan,
    message: allowed
      ? null
      : sub.plan === "FREE"
        ? "وصلت للحد المجاني (5 حاويات). رقّ للـ PRO بـ $35/شهر للحصول على 10 حاويات مع تتبع كامل."
        : "استخدمت كل الـ 10 حاويات هذا الشهر. جدّد اشتراكك أو تواصل معنا للـ Custom.",
  };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/__tests__/canAddShipment.test.ts --reporter=verbose
```

Expected: All 5 tests PASS

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

The old `canAddShipment(user: AuthenticatedUser)` callers will now fail. The only caller is `src/app/api/shipments/route.ts` — we fix that in Task 6.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts src/__tests__/canAddShipment.test.ts
git commit -m "feat: rewrite canAddShipment() — new signature, lifetime/period counting, CUSTOM bypass"
```

---

## Task 5: Update Tracking Service (Register ShipsGo + forceProvider)

**Files:**
- Modify: `src/backend/services/tracking/index.ts`

The tracking service currently doesn't have ShipsGo registered, and has no way to force a specific provider. We add both.

- [ ] **Step 1: Open src/backend/services/tracking/index.ts and add ShipsgoProvider import**

At the top, add the ShipsGo import alongside the existing ones:

```typescript
import { ShipsgoProvider } from "./providers/shipsgo";
```

- [ ] **Step 2: Register ShipsGo in getProvider() switch**

In the `getProvider()` function, add the `shipsgo` case:

```typescript
function getProvider(name: string): TrackingProvider | null {
  switch (name) {
    case "lufthansa":
      return process.env.LUFTHANSA_CARGO_API_KEY ? new LufthansaCargoProvider() : null;
    case "qatar":
      return (process.env.QATAR_CARGO_CLIENT_ID && process.env.QATAR_CARGO_CLIENT_SECRET)
        ? new QatarAirwaysCargoProvider()
        : null;
    case "jsoncargo":
      return process.env.JSONCARGO_API_KEY ? new JsonCargoProvider() : null;
    case "shipsgo":                                           // ← NEW
      return process.env.SHIPSGO_API_KEY ? new ShipsgoProvider() : null;
    default:
      return null;
  }
}
```

- [ ] **Step 3: Add forceProvider to trackShipment() options**

Change the function signature and provider-chain logic:

```typescript
export async function trackShipment(
  rawInput: string,
  options: { skipCache?: boolean; forceProvider?: string } = {},  // ← add forceProvider
): Promise<TrackingResult> {

  // 1. Parse identifier
  const parsed = parseTrackingIdentifier(rawInput);
  if (!parsed.valid) {
    throw new TrackingError(parsed.error ?? "Invalid tracking number", "INVALID_INPUT");
  }

  const {
    normalized,
    type,
    carrierCode,
    carrierName,
    preferredProvider,
    fallbackProviders,
  } = parsed;

  // 2. Cache check (skip when forcing a provider — caller wants fresh data)
  if (!options.skipCache && !options.forceProvider) {
    const cached = await getCachedTracking(normalized);
    if (cached) return cached;
  }

  // 3. Build provider chain — if forceProvider is set, use it exclusively
  const chain = options.forceProvider
    ? [options.forceProvider]
    : [...new Set([preferredProvider, ...fallbackProviders])].filter(Boolean);

  // ... rest of function unchanged ...
```

- [ ] **Step 4: Build check**

```bash
npx tsc --noEmit 2>&1 | grep "tracking/index"
```

Expected: No errors in this file

- [ ] **Step 5: Commit**

```bash
git add src/backend/services/tracking/index.ts
git commit -m "feat: register ShipsGo provider, add forceProvider option to trackShipment()"
```

---

## Task 6: Update POST /api/shipments

**Files:**
- Modify: `src/app/api/shipments/route.ts`

The POST handler currently calls `canAddShipment(user)` (old boolean signature) and uses a single generic `trackShipment()`. We update it to:
1. Call `canAddShipment(user.id)` (new signature)
2. Get provider from plan
3. Force the correct provider for the initial fetch
4. Save `trackingProvider` and `isLiveTracking` on the new shipment

- [ ] **Step 1: Update imports in route.ts**

Change the import line for auth and plans:

```typescript
import { getAuthenticatedUser, canAddShipment } from "@/lib/auth";
import { PLANS, getProviderForPlan, type PlanKey } from "@/config/plans";
```

- [ ] **Step 2: Replace the POST function body**

Replace only the POST handler (GET stays unchanged):

```typescript
// ── POST /api/shipments — Create a new tracked shipment ──────
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check plan limit — new signature returns rich object
  const { allowed, message, plan } = await canAddShipment(user.id);
  if (!allowed) {
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createShipmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { trackingNumber, type, nickname, reference, notifyEmail, notifyWhatsapp } = parsed.data;

  // Check for duplicate
  const existing = await prisma.shipment.findUnique({
    where: { userId_trackingNumber: { userId: user.id, trackingNumber: trackingNumber.toUpperCase() } },
  });
  if (existing) {
    return NextResponse.json({ error: "You are already tracking this number." }, { status: 409 });
  }

  // Determine provider from plan
  const provider       = getProviderForPlan(plan as PlanKey);  // "jsoncargo" | "shipsgo"
  const isLiveTracking = PLANS[plan as PlanKey].liveTracking;  // false for FREE, true for PRO/CUSTOM

  // Fetch initial tracking data using plan-specific provider
  let trackingData;
  try {
    trackingData = await trackShipment(trackingNumber, {
      skipCache:     true,
      forceProvider: provider,
    });
  } catch (err) {
    if (err instanceof TrackingError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Failed to fetch tracking data" }, { status: 500 });
  }

  // Create shipment with enriched data + plan-specific fields
  const shipment = await prisma.shipment.create({
    data: {
      userId:          user.id,
      trackingNumber:  trackingData.trackingNumber,
      type,
      carrier:         trackingData.carrier,
      carrierCode:     trackingData.carrierCode,
      origin:          trackingData.origin,
      destination:     trackingData.destination,
      currentStatus:   trackingData.currentStatus,
      currentLocation: trackingData.currentLocation,
      etaDate:         trackingData.ataDate ? null : trackingData.etaDate,
      etdDate:         trackingData.etdDate,
      atdDate:         trackingData.atdDate,
      ataDate:         trackingData.ataDate,
      vesselName:      trackingData.vesselName,
      voyageNumber:    trackingData.voyageNumber,
      flightNumber:    trackingData.flightNumber,
      nickname,
      reference,
      notifyEmail,
      notifyWhatsapp,
      lastPolledAt:    new Date(),
      trackingProvider: provider,       // ← NEW
      isLiveTracking,                   // ← NEW: false for FREE, true for PRO/CUSTOM
      trackingEvents: {
        create: trackingData.events.map((e) => ({
          status:      e.status,
          location:    e.location,
          description: e.description,
          eventDate:   e.eventDate,
          source:      e.source,
        })),
      },
    },
    include: { trackingEvents: true },
  });

  return NextResponse.json(shipment, { status: 201 });
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "api/shipments/route"
```

Expected: No errors

- [ ] **Step 4: Smoke test via curl**

Start the dev server (`npm run dev`), log in as a FREE user, then:

```bash
curl -X POST http://localhost:3000/api/shipments \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"trackingNumber":"MSKU1234567","type":"SEA"}'
```

Expected: 201 with shipment object containing `"trackingProvider":"jsoncargo"` and `"isLiveTracking":false`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/shipments/route.ts
git commit -m "feat: POST /api/shipments — plan-based provider routing, trackingProvider + isLiveTracking on save"
```

---

## Task 7: Update Tracking Worker (Dispatch + Poll)

**Files:**
- Modify: `src/backend/worker/processors/tracking-dispatch.ts`
- Modify: `src/backend/worker/processors/tracking-poll.ts`

FREE shipments (`isLiveTracking=false`) must never be polled. The dispatch processor needs to filter them out. The poll processor needs to pass `forceProvider` so it re-polls with the same provider that created the shipment.

- [ ] **Step 1: Update tracking-dispatch.ts — add isLiveTracking filter**

Replace the `prisma.shipment.findMany` call:

```typescript
const shipments = await prisma.shipment.findMany({
  where: {
    isActive:       true,
    isLiveTracking: true,   // ← NEW: FREE shipments (isLiveTracking=false) are excluded
  },
  select: {
    id:              true,
    trackingNumber:  true,
    type:            true,
    userId:          true,
    trackingProvider: true, // ← NEW: needed by the poll processor
  },
});
```

Also pass `trackingProvider` in the job data:

```typescript
await trackingPollQueue.add(
  "poll",
  {
    shipmentId:      s.id,
    trackingNumber:  s.trackingNumber,
    type:            s.type,
    userId:          s.userId,
    trackingProvider: s.trackingProvider,  // ← NEW
  },
  { jobId: s.id },
);
```

- [ ] **Step 2: Update tracking-poll.ts — use forceProvider**

Check the `TrackingPollJobData` type in `src/backend/lib/queue.ts` and add `trackingProvider?: string` to it:

```typescript
// In queue.ts, find TrackingPollJobData and add:
trackingProvider?: string;
```

Then in `tracking-poll.ts`, update the `trackShipment` call:

```typescript
// Force-fetch fresh data using the same provider that created the shipment
const result = await trackShipment(trackingNumber, {
  skipCache:     true,
  forceProvider: job.data.trackingProvider,  // ← NEW: "jsoncargo" | "shipsgo"
});
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "tracking-dispatch|tracking-poll|queue"
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/backend/worker/processors/tracking-dispatch.ts \
        src/backend/worker/processors/tracking-poll.ts \
        src/backend/lib/queue.ts
git commit -m "feat: worker — exclude FREE shipments (isLiveTracking), use stored trackingProvider for re-poll"
```

---

## Task 8: Update Stripe Webhook

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

Two changes needed:
1. `syncSubscription`: Replace `STRIPE_BUSINESS_PRICE_ID` → `STRIPE_CUSTOM_PRICE_ID` (CUSTOM has no Stripe price, so remove that lookup). Remove `BUSINESS` plan reference.
2. `invoice.payment_succeeded`: Add `currentPeriodStart` update to reset PRO counter.

- [ ] **Step 1: Fix syncSubscription to remove BUSINESS and fix CUSTOM**

Replace the `syncSubscription` function:

```typescript
async function syncSubscription(sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price.id ?? null;

  // Determine plan from Stripe price ID
  // CUSTOM has no Stripe price — it's only set manually by admin
  let plan: "FREE" | "PRO" = "FREE";
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = "PRO";

  const planConfig = PLANS[plan];
  const features   = planConfig.features;

  await prisma.subscription.updateMany({
    where: { stripeCustomerId: sub.customer as string },
    data:  {
      stripeSubscriptionId: sub.id,
      stripePriceId:        priceId,
      plan,
      status:               mapStripeStatus(sub.status),
      currentPeriodStart:   new Date(sub.current_period_start * 1000),
      currentPeriodEnd:     new Date(sub.current_period_end   * 1000),
      cancelAtPeriodEnd:    sub.cancel_at_period_end,
      trialEnd:             sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      maxTrackedShipments:  features.maxTrackedShipments,
      maxDailyQueries:      features.maxDailyQueries,
      whatsappEnabled:      features.whatsappNotifications,
      apiAccessEnabled:     features.apiAccess,
      maxTeamMembers:       features.maxTeamMembers,
    },
  });
}
```

- [ ] **Step 2: Fix customer.subscription.deleted to use CUSTOM-safe values**

Update the CANCELED branch (was setting `plan: "FREE"` with old maxTrackedShipments):

```typescript
case "customer.subscription.deleted": {
  const sub = event.data.object as Stripe.Subscription;
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data:  {
      status:               "CANCELED",
      plan:                 "FREE",
      stripeSubscriptionId: null,
      stripePriceId:        null,
      maxTrackedShipments:  5,     // ← FREE limit (not 0)
      maxDailyQueries:      50,
      whatsappEnabled:      false,
      apiAccessEnabled:     false,
    },
  });
  break;
}
```

- [ ] **Step 3: Fix invoice.payment_succeeded to update currentPeriodStart**

This is the mechanism that resets the PRO counter each billing period:

```typescript
case "invoice.payment_succeeded": {
  const invoice = event.data.object as Stripe.Invoice;
  if (invoice.subscription) {
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: invoice.subscription as string },
      data:  {
        status:             "ACTIVE",
        currentPeriodStart: new Date((invoice as unknown as { period_start: number }).period_start * 1000),
        currentPeriodEnd:   new Date((invoice as unknown as { period_end: number }).period_end   * 1000),
      },
    });
  }
  break;
}
```

> **Note:** Stripe's TypeScript types may not expose `period_start`/`period_end` on Invoice directly (they depend on billing period). If `invoice.lines.data[0]?.period` is available, use that instead:
> ```typescript
> const period = (invoice as Stripe.Invoice & { period_start?: number; period_end?: number });
> currentPeriodStart: period.period_start ? new Date(period.period_start * 1000) : undefined,
> ```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "webhooks/stripe"
```

Fix any type errors. The `invoice.period_start` access may need casting — see note above.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "feat: stripe webhook — remove BUSINESS, add currentPeriodStart reset on payment_succeeded"
```

---

## Task 9: Create GET /api/shipments/count

**Files:**
- Create: `src/app/api/shipments/count/route.ts`

This endpoint powers the container counter widget in the UI. Returns `{current, max, plan, allowed}`.

- [ ] **Step 1: Create the file**

```typescript
import { NextResponse }            from "next/server";
import { getAuthenticatedUser, canAddShipment } from "@/lib/auth";

/**
 * GET /api/shipments/count
 * Returns current shipment count vs plan limit for the authenticated user.
 * Used by the counter widget on the dashboard and Add Shipment page.
 */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await canAddShipment(user.id);

  return NextResponse.json({
    current: result.current,
    max:     result.max === Infinity ? null : result.max,  // null = unlimited (CUSTOM)
    plan:    result.plan,
    allowed: result.allowed,
  });
}
```

- [ ] **Step 2: Smoke test**

```bash
curl http://localhost:3000/api/shipments/count \
  -H "Cookie: <your-session-cookie>"
```

Expected response (FREE user with 2 shipments):

```json
{"current": 2, "max": 5, "plan": "FREE", "allowed": true}
```

Expected for CUSTOM user:

```json
{"current": 0, "max": null, "plan": "CUSTOM", "allowed": true}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/shipments/count/route.ts
git commit -m "feat: GET /api/shipments/count — container counter endpoint"
```

---

## Task 10: Update Shipment Detail Page — Feature Gates

**Files:**
- Modify: `src/app/(dashboard)/dashboard/shipments/[id]/page.tsx`

FREE users (`subscription.plan === 'FREE'`) must see Map, RouteVisualization, and Event History wrapped in `UpgradeOverlay` (blurred, with upgrade CTA).

- [ ] **Step 1: Update the data fetch to include subscription plan**

In the `ShipmentDetailPage` server component, update the user fetch to pass subscription info:

The page already calls `getAuthenticatedUser()` which returns `user.subscription`. No extra query needed.

- [ ] **Step 2: Add UpgradeOverlay import**

At the top of the file, add:

```typescript
import { UpgradeOverlay } from "@/frontend/components/dashboard/upgrade-overlay";
```

- [ ] **Step 3: Determine plan before JSX**

After `if (!shipment) notFound();`, add:

```typescript
const isFreePlan = user.subscription?.plan === "FREE" || !user.subscription;
```

- [ ] **Step 4: Wrap RouteVisualization in UpgradeOverlay for FREE users**

Change:

```tsx
{/* ── Cinematic Route Visualization ─────────────────────── */}
<RouteVisualization
  origin={shipment.origin}
  destination={shipment.destination}
  type={shipment.type}
  currentStatus={shipment.currentStatus}
  atdDate={shipment.atdDate}
  etaDate={shipment.etaDate}
  ataDate={shipment.ataDate}
/>
```

To:

```tsx
{/* ── Cinematic Route Visualization ─────────────────────── */}
{isFreePlan ? (
  <UpgradeOverlay
    feature="Route Visualization"
    description="Upgrade to PRO to see the animated route map with live vessel position and port-by-port progress."
  >
    <RouteVisualization
      origin={shipment.origin}
      destination={shipment.destination}
      type={shipment.type}
      currentStatus={shipment.currentStatus}
      atdDate={shipment.atdDate}
      etaDate={shipment.etaDate}
      ataDate={shipment.ataDate}
    />
  </UpgradeOverlay>
) : (
  <RouteVisualization
    origin={shipment.origin}
    destination={shipment.destination}
    type={shipment.type}
    currentStatus={shipment.currentStatus}
    atdDate={shipment.atdDate}
    etaDate={shipment.etaDate}
    ataDate={shipment.ataDate}
  />
)}
```

- [ ] **Step 5: Wrap Event History in UpgradeOverlay for FREE users**

Find the "Tracking History" section. Wrap only the event list part (not the card header):

```tsx
{/* ── Tracking Events Timeline ────────────────────────── */}
<div className="rounded-xl border border-navy-200 bg-white p-6 shadow-sm dark:border-navy-800 dark:bg-navy-900">
  <h3 className="mb-5 text-sm font-bold uppercase tracking-wider text-navy-400 dark:text-navy-500">
    Tracking History
  </h3>

  {isFreePlan ? (
    <UpgradeOverlay
      feature="Event History"
      description="Upgrade to PRO to see the full tracking timeline — every port, vessel departure, and customs event."
    >
      {/* Show a blurred placeholder so user understands what they're missing */}
      <div className="space-y-4 pointer-events-none">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-navy-100 dark:bg-navy-800 animate-pulse" />
        ))}
      </div>
    </UpgradeOverlay>
  ) : shipment.trackingEvents.length === 0 ? (
    <div className="flex flex-col items-center py-8 text-center">
      <Clock size={28} className="text-navy-300 dark:text-navy-600" />
      <p className="mt-2 text-sm text-navy-500 dark:text-navy-400">
        No tracking events yet. Updates will appear once the carrier reports movement.
      </p>
    </div>
  ) : (
    <div className="relative ml-4">
      {/* ... existing timeline code unchanged ... */}
    </div>
  )}
</div>
```

- [ ] **Step 6: Wrap RouteMap in UpgradeOverlay for FREE users (in sidebar)**

Find the `<RouteMap ... />` in the right sidebar. Wrap it:

```tsx
{/* Route map */}
{isFreePlan ? (
  <UpgradeOverlay
    feature="Live Map"
    description="Upgrade to PRO to see the real-time world map with vessel position."
  >
    <div className="h-40 rounded-xl bg-navy-100 dark:bg-navy-800" />
  </UpgradeOverlay>
) : (
  <RouteMap
    origin={shipment.origin}
    destination={shipment.destination}
    currentLocation={shipment.currentLocation}
  />
)}
```

- [ ] **Step 7: Hide "Last updated" for FREE users**

Find the "Last updated" row in the sidebar details section:

```tsx
{/* Only show last-updated for live-tracking shipments */}
{!isFreePlan && (
  <div className="flex items-center justify-between text-navy-400 dark:text-navy-500">
    <span>Last updated</span>
    <span className="font-semibold text-navy-700 dark:text-navy-300">
      {shipment.lastPolledAt ? formatDate(shipment.lastPolledAt) : "—"}
    </span>
  </div>
)}
```

- [ ] **Step 8: TypeScript check + visual review**

```bash
npx tsc --noEmit
```

Start dev server, open a shipment detail page as a FREE user. Confirm:
- RouteVisualization is blurred with overlay
- Event History shows blurred placeholder + overlay
- Map shows blurred placeholder + overlay
- "Last updated" is hidden

- [ ] **Step 9: Commit**

```bash
git add "src/app/(dashboard)/dashboard/shipments/[id]/page.tsx"
git commit -m "feat: shipment detail — feature gates for FREE plan (RouteViz, EventHistory, Map)"
```

---

## Task 11: Update UpgradeOverlay + BillingClient

**Files:**
- Modify: `src/frontend/components/dashboard/upgrade-overlay.tsx`
- Modify: `src/frontend/components/dashboard/billing-client.tsx`

- [ ] **Step 1: Update UpgradeOverlay — fix price and link**

In `upgrade-overlay.tsx`, find and update the price note and upgrade action:

Change the price note from `$29/month` to `$35/month`:

```tsx
<p className="text-[11px] text-navy-500">Starting at $35/month · Cancel anytime</p>
```

Change `handleUpgrade` to redirect to billing page instead of calling the upgrade API (which was for instant upgrades, not Stripe checkout):

```tsx
const handleUpgrade = () => {
  router.push("/dashboard/billing");
};
```

And remove the `loading` state / `useState` import since we no longer do async work — the button just navigates:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Lock, Zap } from "lucide-react";

interface Props {
  feature: string;
  description: string;
  children: React.ReactNode;
}

export function UpgradeOverlay({ feature, description, children }: Props) {
  const router = useRouter();

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[6px] opacity-50">
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center z-20">
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-navy-900/90 backdrop-blur-md border border-white/10 px-8 py-8 shadow-2xl max-w-sm text-center">
          <div className="h-14 w-14 rounded-2xl bg-orange-500/20 flex items-center justify-center">
            <Lock size={28} className="text-orange-400" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-white mb-1">{feature}</h3>
            <p className="text-sm text-navy-300 leading-relaxed">{description}</p>
          </div>

          <button
            onClick={() => router.push("/dashboard/billing")}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600
                       px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25
                       hover:from-orange-400 hover:to-orange-500 transition-all active:scale-95"
          >
            <Zap size={16} />
            Upgrade to PRO — $35/month
          </button>

          <p className="text-[11px] text-navy-500">Cancel anytime · ShipsGo live tracking</p>
        </div>
      </div>
    </div>
  );
}

export function ProBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-400 uppercase tracking-wider">
      <Zap size={10} />
      Pro
    </span>
  );
}
```

- [ ] **Step 2: Update billing-client.tsx — replace BUSINESS with CUSTOM**

The `billing-client.tsx` has its own local `PLANS` array (separate from `src/config/plans.ts`). Update it:

Replace the PLANS array local constant. Find and replace the BUSINESS entry:

```tsx
const PLANS = [
  {
    id: "FREE",
    name: "Free",
    price: "$0",
    period: "",
    icon: Zap,
    color: "navy",
    description: "5 containers lifetime, JSONCargo lookup",
    features: [
      "5 containers — lifetime total",
      "One-time tracking lookup",
      "Location, status & ETA/ATA dates",
      "Sea container & air AWB support",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    price: "$35",
    period: "/month",
    icon: Crown,
    color: "orange",
    badge: "Most Popular",
    description: "10 containers/month, ShipsGo, live updates",
    features: [
      "10 containers per billing period",
      "ShipsGo live tracking (every 6h)",
      "Interactive world map & route viz",
      "Full event history timeline",
      "Auto-updates — never stale",
    ],
  },
  {
    id: "CUSTOM",
    name: "Custom",
    price: "Custom",
    period: "",
    icon: Building2,
    color: "teal",
    description: "Unlimited containers, dedicated support",
    features: [
      "Unlimited containers — never blocked",
      "ShipsGo live tracking (every 6h)",
      "All PRO features included",
      "Dedicated account manager",
    ],
  },
];
```

Update the upgrade detection (CUSTOM can't be upgraded to via Stripe):

```tsx
const isUpgrade = currentPlan === "FREE" && plan.id === "PRO";
```

Update the CTA rendering for the CUSTOM card (it should show "Contact Us" instead of upgrade button):

In the plan card CTA section, after `isCurrent` check, add a `isCustom` branch:

```tsx
const isCurrent = currentPlan === plan.id;
const isCustom  = plan.id === "CUSTOM";
const isUpgrade = currentPlan === "FREE" && plan.id === "PRO";
```

```tsx
{/* CTA */}
{isCurrent ? (
  <button disabled className="w-full rounded-xl py-3 text-sm font-bold text-navy-400 bg-white/5 border border-white/10 cursor-default">
    Current Plan
  </button>
) : isCustom ? (
  <a
    href="/contact"
    className="block w-full rounded-xl py-3 text-center text-sm font-bold text-white
               bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500
               shadow-lg shadow-teal-500/25 transition-all"
  >
    Contact Us
  </a>
) : isUpgrade ? (
  <button
    onClick={() => handleUpgrade(plan.id)}
    disabled={loading === plan.id}
    className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50
               bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 shadow-lg shadow-orange-500/25"
  >
    {loading === plan.id ? <Loader2 size={16} className="animate-spin mx-auto" /> : <>Upgrade to {plan.name}</>}
  </button>
) : (
  <button disabled className="w-full rounded-xl py-3 text-sm font-bold text-navy-500 bg-white/5 border border-white/10 cursor-default">
    {plan.id === "FREE" ? "Free Forever" : "Not Available"}
  </button>
)}
```

Remove the trial note for CUSTOM (it only applies to PRO):

```tsx
{isUpgrade && (
  <p className="text-center text-[11px] text-navy-500 mt-2">Cancel anytime</p>
)}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "upgrade-overlay|billing-client"
```

Expected: No errors

- [ ] **Step 4: Visual review**

Open billing page as FREE user. Confirm:
- FREE card shows "Current Plan"
- PRO card shows "Upgrade to Pro" with orange gradient
- CUSTOM card shows "Contact Us" teal link

- [ ] **Step 5: Commit**

```bash
git add src/frontend/components/dashboard/upgrade-overlay.tsx \
        src/frontend/components/dashboard/billing-client.tsx
git commit -m "feat: upgrade overlay — $35/mo + billing redirect; billing client — CUSTOM contact us"
```

---

## Task 12: Create POST /api/contact

**Files:**
- Create: `src/app/api/contact/route.ts`

Saves `ContactRequest` to DB. Sends admin notification email via Resend if `RESEND_API_KEY` is set (graceful fallback if not configured).

- [ ] **Step 1: Install Resend**

```bash
npm install resend
```

- [ ] **Step 2: Create src/app/api/contact/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { z }     from "zod";

const contactSchema = z.object({
  name:           z.string().min(2).max(100),
  email:          z.string().email(),
  phone:          z.string().optional(),
  containersCount: z.number().int().min(1).max(100000),
  message:        z.string().max(2000).optional(),
});

/**
 * POST /api/contact
 * Saves a CUSTOM plan inquiry to the DB and notifies admin via email.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { name, email, phone, containersCount, message } = parsed.data;

  // Save to DB
  const request = await prisma.contactRequest.create({
    data: { name, email, phone, containersCount, message },
  });

  // Notify admin via email (best-effort — don't fail the request if email fails)
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from:    "TrackMyContainer <noreply@trackmycontainer.info>",
        to:      [process.env.ADMIN_EMAIL ?? "akassawneh@gmail.com"],
        subject: `New Custom Plan Inquiry — ${name} (${containersCount} containers)`,
        text:    [
          `Name: ${name}`,
          `Email: ${email}`,
          `Phone: ${phone ?? "not provided"}`,
          `Containers needed: ${containersCount}`,
          `Message: ${message ?? "none"}`,
          ``,
          `View in DB: https://supabase.com (contact_requests table, id: ${request.id})`,
        ].join("\n"),
      });
    } catch (err) {
      console.error("[contact] Failed to send admin email:", err);
      // Don't return error — the DB record was saved
    }
  }

  return NextResponse.json({ success: true, id: request.id }, { status: 201 });
}
```

- [ ] **Step 3: Smoke test**

```bash
curl -X POST http://localhost:3000/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Corp","email":"ops@acme.com","containersCount":50,"message":"Need unlimited plan"}'
```

Expected: `{"success":true,"id":"clxxx..."}` with 201

Then verify in Prisma Studio:

```bash
npx prisma studio
```

Open → ContactRequest table → confirm the row was created.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/contact/route.ts package.json package-lock.json
git commit -m "feat: POST /api/contact — save inquiry to DB, admin email via Resend"
```

---

## Task 13: Create Pricing Page + Update PricingCards

**Files:**
- Create: `src/app/(marketing)/pricing/page.tsx`
- Modify: `src/frontend/components/marketing/pricing-cards.tsx`

The `pricing-cards.tsx` currently uses `CARD_STYLES` and `CTA_STYLES` keyed by `"business"` — rename to `"custom"`. The pricing page is just a wrapper.

- [ ] **Step 1: Update pricing-cards.tsx — rename business → custom**

Find `CARD_STYLES` and `CTA_STYLES` in the file. Replace the `business` key with `custom`:

```typescript
const CARD_STYLES = {
  free:   "border-[#E5E7EB] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] dark:border-navy-800 dark:bg-gradient-to-br dark:from-navy-900 dark:to-navy-950 dark:shadow-none",
  pro:    "border-[#FF6A00]/40 bg-white shadow-[0_10px_40px_rgba(255,106,0,0.12)] scale-[1.02] dark:border-orange-500/40 dark:bg-gradient-to-br dark:from-navy-900 dark:to-navy-950 dark:shadow-[0_0_30px_rgba(245,130,31,0.08)]",
  custom: "border-[#3B82F6]/40 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] dark:border-teal-500/40 dark:bg-gradient-to-br dark:from-navy-900 dark:to-navy-950 dark:shadow-none",
};

const CTA_STYLES = {
  free:   "bg-[#F5F7FA] text-[#1F2937] border border-[#E5E7EB] hover:bg-[#EEF2F6] dark:bg-navy-700 dark:text-white dark:border-0 dark:hover:bg-navy-600",
  pro:    "bg-[#FF6A00] text-white hover:bg-[#FF7A1A] shadow-[0_4px_12px_rgba(255,106,0,0.25)] hover:shadow-[0_6px_18px_rgba(255,106,0,0.35)] dark:bg-gradient-to-r dark:from-orange-500 dark:to-orange-600 dark:hover:from-orange-600 dark:hover:to-orange-700 dark:shadow-lg dark:shadow-orange-500/20",
  custom: "bg-[#3B82F6] text-white hover:bg-[#2563EB] shadow-[0_4px_12px_rgba(59,130,246,0.25)] hover:shadow-[0_6px_18px_rgba(59,130,246,0.35)] dark:bg-gradient-to-r dark:from-teal-500 dark:to-teal-600 dark:hover:from-teal-600 dark:hover:to-teal-700 dark:shadow-lg dark:shadow-teal-500/20",
};
```

Update the `styleKey` cast:

```typescript
const styleKey = key.toLowerCase() as keyof typeof CARD_STYLES;
```

This already works as long as the PLANS keys are `FREE`, `PRO`, `CUSTOM` and `key.toLowerCase()` gives `free`, `pro`, `custom`. ✓

Update the CTA link logic — CUSTOM should go to `/contact`, FREE to `/register`, PRO to `/register` (then they upgrade):

```tsx
<Link
  href={key === "CUSTOM" ? "/contact" : "/register"}
  className={cn(
    "mt-auto block rounded-xl px-6 py-3 text-center text-sm font-bold transition-all",
    CTA_STYLES[styleKey],
  )}
>
  {plan.cta}
</Link>
```

- [ ] **Step 2: Create the pricing page**

Create `src/app/(marketing)/pricing/page.tsx`:

```typescript
import { PricingCards } from "@/frontend/components/marketing/pricing-cards";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Pricing — TrackMyContainer",
  description: "Track containers for free or upgrade to PRO for $35/month with ShipsGo live tracking.",
};

export default function PricingPage() {
  return (
    <main>
      <PricingCards />
    </main>
  );
}
```

- [ ] **Step 3: Create the contact page (linked from CUSTOM CTA)**

Create `src/app/(marketing)/contact/page.tsx`:

```typescript
"use client";

import { useState } from "react";

export default function ContactPage() {
  const [form, setForm]         = useState({ name: "", email: "", phone: "", containersCount: "", message: "" });
  const [status, setStatus]     = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...form,
          containersCount: parseInt(form.containersCount, 10),
        }),
      });

      if (res.ok) {
        setStatus("success");
      } else {
        const data = await res.json();
        setErrorMsg(data.error ? JSON.stringify(data.error) : "Failed to submit. Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-white dark:bg-navy-950">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">Request received!</h1>
          <p className="text-navy-500 dark:text-navy-400">
            We'll get back to you within 24 hours to discuss the Custom plan.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-20 bg-white dark:bg-navy-950">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-navy-900 dark:text-white mb-3">
            Contact Us for Custom Plan
          </h1>
          <p className="text-navy-500 dark:text-navy-400">
            Need more than 10 containers? Tell us your volume and we'll set up a custom deal.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-navy-700 dark:text-navy-300 mb-1.5">
              Name / Company *
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl border border-navy-200 bg-white px-4 py-3 text-sm text-navy-900
                         focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20
                         dark:border-navy-700 dark:bg-navy-900 dark:text-white"
              placeholder="Acme Logistics"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-navy-700 dark:text-navy-300 mb-1.5">
              Email *
            </label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl border border-navy-200 bg-white px-4 py-3 text-sm text-navy-900
                         focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20
                         dark:border-navy-700 dark:bg-navy-900 dark:text-white"
              placeholder="ops@acme.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-navy-700 dark:text-navy-300 mb-1.5">
              Phone (optional)
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-xl border border-navy-200 bg-white px-4 py-3 text-sm text-navy-900
                         focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20
                         dark:border-navy-700 dark:bg-navy-900 dark:text-white"
              placeholder="+1 555 000 0000"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-navy-700 dark:text-navy-300 mb-1.5">
              Containers per month *
            </label>
            <input
              required
              type="number"
              min={11}
              value={form.containersCount}
              onChange={(e) => setForm({ ...form, containersCount: e.target.value })}
              className="w-full rounded-xl border border-navy-200 bg-white px-4 py-3 text-sm text-navy-900
                         focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20
                         dark:border-navy-700 dark:bg-navy-900 dark:text-white"
              placeholder="e.g. 50"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-navy-700 dark:text-navy-300 mb-1.5">
              Message (optional)
            </label>
            <textarea
              rows={3}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full rounded-xl border border-navy-200 bg-white px-4 py-3 text-sm text-navy-900
                         focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20
                         dark:border-navy-700 dark:bg-navy-900 dark:text-white resize-none"
              placeholder="Tell us about your tracking needs..."
            />
          </div>

          {errorMsg && (
            <p className="text-sm text-red-500 dark:text-red-400">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-3.5
                       text-sm font-bold text-white shadow-lg shadow-orange-500/25
                       hover:from-orange-400 hover:to-orange-500 transition-all active:scale-[0.98]
                       disabled:opacity-50"
          >
            {status === "loading" ? "Sending..." : "Send Request"}
          </button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 5: Smoke test**

Visit `http://localhost:3000/pricing` — confirm 3 plan cards render.
Visit `http://localhost:3000/contact` — fill in form, submit. Check Prisma Studio for new ContactRequest row.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(marketing)/pricing/page.tsx" \
        "src/app/(marketing)/contact/page.tsx" \
        src/frontend/components/marketing/pricing-cards.tsx
git commit -m "feat: pricing page + contact page with Custom plan inquiry form"
```

---

## Task 14: Full TypeScript Check + All Tests Pass

**Files:** None created/modified — validation only

- [ ] **Step 1: Run all tests**

```bash
npx vitest run --reporter=verbose
```

Expected: All tests in `src/__tests__/` pass. No failures.

- [ ] **Step 2: Run full TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: No errors. If errors remain, fix them before this task is marked complete.

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: Build succeeds with no type or compilation errors. Warnings about dynamic imports are acceptable.

- [ ] **Step 4: End-to-end smoke test (manual)**

As a FREE user:
1. Register a new account → subscription is auto-created with `maxTrackedShipments: 5`
2. Add a container → shipment created with `trackingProvider: "jsoncargo"`, `isLiveTracking: false`
3. Open shipment detail → RouteVisualization, RouteMap, Event History show UpgradeOverlay
4. Add 4 more containers (total = 5)
5. Try to add 6th → API returns 403 with Arabic message

As a simulated PRO user (manually update DB via Prisma Studio — set `plan: "PRO"`, `maxTrackedShipments: 10`, `currentPeriodStart: now`):
1. Add a container → `trackingProvider: "shipsgo"`, `isLiveTracking: true`
2. Open shipment detail → all features visible, no UpgradeOverlay
3. `GET /api/shipments/count` → `{current: 1, max: 10, plan: "PRO"}`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final typecheck and build validation for subscription system"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Task 1: BUSINESS→CUSTOM enum rename (§2a)
- ✅ Task 1: trackingProvider + isLiveTracking on Shipment (§2c)
- ✅ Task 1: ContactRequest model (§2d)
- ✅ Task 3: plans.ts rewrite with provider + liveTracking (§3)
- ✅ Task 4: canAddShipment() rewrite — FREE lifetime / PRO period / CUSTOM bypass (§4)
- ✅ Task 6: POST /api/shipments — provider routing + new fields (§5)
- ✅ Task 7: Worker — isLiveTracking filter + forceProvider (§6)
- ✅ Task 8: Stripe webhook — BUSINESS→CUSTOM + currentPeriodStart reset (§11)
- ✅ Task 9: GET /api/shipments/count (§8)
- ✅ Task 10: Feature gates — UpgradeOverlay on Map/RouteViz/EventHistory (§7)
- ✅ Task 11: BillingClient — CUSTOM with Contact Us CTA (§10)
- ✅ Task 12: POST /api/contact (§13)
- ✅ Task 13: Pricing page (§10) + Contact page

**Not covered (out of scope per §15):**
- Container counter widget in dashboard sidebar (§8) — not included to keep scope tight; the API is built (Task 9), frontend widget can be added later
- Admin dashboard for ContactRequest management (§15)
