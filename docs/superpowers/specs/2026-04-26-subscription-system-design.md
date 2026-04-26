# Subscription System Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the subscription system into three tiers — FREE (5 lifetime containers via JSONCargo, no live features), PRO ($35/month, 10 containers per billing period via ShipsGo, full features), and CUSTOM (unlimited, ShipsGo, contact-us pricing) — with proper Supabase/Prisma enforcement of limits.

**Date:** 2026-04-26

---

## 1. Plan Tiers — Final Specification

### FREE
- **Price:** $0 — always free
- **Provider:** JSONCargo
- **Container limit:** 5 **lifetime total** — `COUNT(*) WHERE userId = X` (no isActive filter, no date filter)
- **Tracking:** One JSONCargo call when the container is added. No polling ever (`isLiveTracking = false`).
- **Features shown:** current location, status text, ETD/ATD/ETA dates
- **Features locked (overlay):** Map, Route Visualization, Event History, auto-updates
- **Registration:** Required **before** any container can be added. User registers → Dashboard → adds containers.
- **Lock behavior:** After 5 total additions → API returns 403 → UI shows "Upgrade to PRO" banner. Existing 5 containers remain visible (no new additions possible, ever).

### PRO
- **Price:** $35/month via Stripe
- **Provider:** ShipsGo
- **Container limit:** 10 **per billing period** — `COUNT(*) WHERE userId = X AND createdAt >= currentPeriodStart`
- **Tracking:** ShipsGo credit consumed on add. Worker polls every 6 hours (`isLiveTracking = true`).
- **Features shown:** All — map, route visualization, event history, ETD/ATD/ETA/ATA, auto-updates
- **Lock behavior:** After 10 containers this period → "Please renew your subscription or contact us for Custom plan." Counter resets automatically when Stripe processes next monthly payment (Webhook updates `currentPeriodStart`).

### CUSTOM
- **Price:** Negotiated — no fixed price
- **Provider:** ShipsGo
- **Container limit:** None (`maxTrackedShipments = 2147483647`, check always passes)
- **Tracking:** Same as PRO — full ShipsGo, worker polling
- **Features shown:** All (same as PRO)
- **Lock behavior:** None — never blocked
- **Acquisition:** Contact form on pricing page → saved to `ContactRequest` table → admin notified by email

---

## 2. Database Changes

### 2a. Prisma Schema — enum change

```prisma
// BEFORE
enum SubscriptionPlan {
  FREE
  PRO
  BUSINESS   // ← remove
}

// AFTER
enum SubscriptionPlan {
  FREE
  PRO
  CUSTOM     // ← replaces BUSINESS
}
```

> **⚠️ Migration note:** Renaming an enum value in Postgres requires a manual migration step. The migration must use raw SQL:
> ```sql
> ALTER TYPE "SubscriptionPlan" RENAME VALUE 'BUSINESS' TO 'CUSTOM';
> ```
> This runs in a single Prisma migration file and is safe because there are no live BUSINESS subscribers (dev environment only).

### 2b. Subscription model — updated defaults

```prisma
model Subscription {
  id                    String           @id @default(cuid())
  userId                String           @unique
  user                  User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Stripe
  stripeCustomerId      String?          @unique
  stripeSubscriptionId  String?          @unique
  stripePriceId         String?          // only for PRO

  // Plan
  plan                  SubscriptionPlan @default(FREE)
  status                SubscriptionStatus @default(ACTIVE)

  // Limits — new values
  maxTrackedShipments   Int              @default(5)   // FREE=5, PRO=10, CUSTOM=2147483647
  maxDailyQueries       Int              @default(50)
  whatsappEnabled       Boolean          @default(false)
  apiAccessEnabled      Boolean          @default(false)

  // Billing period — used by PRO counter
  currentPeriodStart    DateTime?
  currentPeriodEnd      DateTime?
  cancelAtPeriodEnd     Boolean          @default(false)
  trialEnd              DateTime?

  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt
}
```

### 2c. Shipment model — two new fields

```prisma
model Shipment {
  // ... existing fields ...

  // NEW: which provider was used when this shipment was added
  trackingProvider   String   @default("jsoncargo")  // "jsoncargo" | "shipsgo"

  // NEW: false = FREE plan (no worker polling for this shipment)
  isLiveTracking     Boolean  @default(false)

  // ... rest of existing fields ...
}
```

### 2d. ContactRequest model — new table

```prisma
model ContactRequest {
  id              String               @id @default(cuid())
  name            String               // company or person name
  email           String               // contact email
  phone           String?              // optional
  containersCount Int                  // how many containers they need
  message         String?              // optional notes
  status          ContactRequestStatus @default(PENDING)
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt
}

enum ContactRequestStatus {
  PENDING     // form submitted, not yet contacted
  CONTACTED   // admin has reached out
  CLOSED      // done
}
```

---

## 3. Plans Config

**File:** `src/config/plans.ts` — full replacement

```typescript
export const PLANS = {
  FREE: {
    name: 'Free',
    price: 0,
    maxTrackedShipments: 5,
    maxDailyQueries: 50,
    provider: 'jsoncargo',
    liveTracking: false,
    features: {
      map: false,
      routeVisualization: false,
      eventHistory: false,
      autoUpdates: false,
      whatsapp: false,
    },
  },
  PRO: {
    name: 'Pro',
    price: 35,                    // USD per month
    maxTrackedShipments: 10,
    maxDailyQueries: 500,
    provider: 'shipsgo',
    liveTracking: true,
    features: {
      map: true,
      routeVisualization: true,
      eventHistory: true,
      autoUpdates: true,
      whatsapp: false,            // future
    },
  },
  CUSTOM: {
    name: 'Custom',
    price: null,                  // negotiated
    maxTrackedShipments: 2147483647,
    maxDailyQueries: 2147483647,
    provider: 'shipsgo',
    liveTracking: true,
    features: {
      map: true,
      routeVisualization: true,
      eventHistory: true,
      autoUpdates: true,
      whatsapp: true,
    },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getProviderForPlan(plan: PlanKey): string {
  return PLANS[plan].provider;
}
```

---

## 4. Core Logic — canAddShipment()

**File:** `src/lib/auth.ts`

```typescript
export async function canAddShipment(userId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      plan: true,
      maxTrackedShipments: true,
      currentPeriodStart: true,
    },
  });

  if (!sub) throw new Error('No subscription found for user');

  // CUSTOM — never blocked. current=0 is a sentinel (UI never shows counter for CUSTOM).
  if (sub.plan === 'CUSTOM') {
    return { allowed: true, current: 0, max: Infinity, plan: 'CUSTOM', message: null };
  }

  // FREE — lifetime total (no filters)
  // PRO  — current billing period only
  const count = await prisma.shipment.count({
    where: {
      userId,
      ...(sub.plan === 'PRO' && sub.currentPeriodStart
        ? { createdAt: { gte: sub.currentPeriodStart } }
        : {}),
    },
  });

  const allowed = count < sub.maxTrackedShipments;

  return {
    allowed,
    current: count,
    max: sub.maxTrackedShipments,
    plan: sub.plan,
    message: allowed
      ? null
      : sub.plan === 'FREE'
        ? 'وصلت للحد المجاني (5 حاويات). رقّ للـ PRO بـ $35/شهر للحصول على 10 حاويات مع تتبع كامل.'
        : 'استخدمت كل الـ 10 حاويات هذا الشهر. جدّد اشتراكك أو تواصل معنا للـ Custom.',
  };
}
```

---

## 5. API — Add Shipment (POST /api/shipments)

When a shipment is added:

1. Call `canAddShipment(userId)` → if `!allowed` return `403` with `message`
2. Determine provider: `getProviderForPlan(sub.plan)`
3. Call the provider API (JSONCargo for FREE, ShipsGo for PRO/CUSTOM)
4. Save to DB with:
   - `trackingProvider = 'jsoncargo' | 'shipsgo'`
   - `isLiveTracking = PLANS[plan].liveTracking`
5. Return shipment data

**FREE users get one JSONCargo call — no further updates.**

---

## 6. Worker — tracking-poll.ts

The worker only polls shipments with `isLiveTracking = true`:

```typescript
const shipments = await prisma.shipment.findMany({
  where: {
    isActive: true,
    isLiveTracking: true,   // ← FREE shipments are excluded automatically
    lastPolledAt: { lt: new Date(Date.now() - 6 * 60 * 60 * 1000) },
  },
  include: { user: { include: { subscription: true } } },
});
```

Provider used for polling: read `shipment.trackingProvider` from DB.

---

## 7. Feature Gates — UI

**File:** `src/app/(dashboard)/dashboard/shipments/[id]/page.tsx` and `src/frontend/components/dashboard/route-visualization.tsx`, `route-map.tsx`

For FREE users (`subscription.plan === 'FREE'`), wrap locked features with `UpgradeOverlay`:

- `<RouteMap>` → wrapped in `UpgradeOverlay` (map is blurred, upgrade prompt shown)
- `<RouteVisualization>` → wrapped in `UpgradeOverlay`
- Event history list → wrapped in `UpgradeOverlay`
- "Last updated" / auto-update indicator → hidden

The `UpgradeOverlay` component already exists — just needs to wrap these components conditionally.

---

## 8. Container Counter — UI

Add a counter widget to the dashboard sidebar and the "Add Shipment" page:

```tsx
// Shows: "3 / 5 حاويات مستخدمة" with a progress bar
// Source: API GET /api/shipments/count → returns { current, max, plan }
```

Progress bar colors:
- Green: < 60% used
- Yellow: 60–90% used  
- Red: 90–100% used

When `current >= max`: show upgrade banner instead of "Add Shipment" button.

---

## 9. Subscription Auto-Create on Registration

**File:** `src/lib/auth.ts` — existing `getAuthenticatedUser()` already auto-creates FREE subscription.

Update the default values to match new plan:

```typescript
await prisma.subscription.create({
  data: {
    userId: user.id,
    plan: 'FREE',
    status: 'ACTIVE',
    maxTrackedShipments: 5,    // ← was 3, now 5
    maxDailyQueries: 50,
    whatsappEnabled: false,
    apiAccessEnabled: false,
  },
});
```

---

## 10. Pricing Page

**File:** `src/app/(marketing)/pricing/page.tsx` — new page (currently empty directory)

Three columns: FREE | PRO | CUSTOM

- FREE card: "Start Free" → `/register`
- PRO card: "Subscribe Now" → `/api/billing/checkout` (Stripe)
- CUSTOM card: "Contact Us" → `/contact` or opens modal with contact form

Contact form saves to `ContactRequest` table via `POST /api/contact`.

---

## 11. Stripe Webhook — PRO Counter Reset

**File:** `src/app/api/webhooks/stripe/route.ts` — already handles `invoice.payment_succeeded`

Ensure this event updates `currentPeriodStart`:

```typescript
case 'invoice.payment_succeeded': {
  const invoice = event.data.object;
  await prisma.subscription.update({
    where: { stripeSubscriptionId: invoice.subscription },
    data: {
      status: 'ACTIVE',
      currentPeriodStart: new Date(invoice.period_start * 1000), // ← resets PRO counter
      currentPeriodEnd:   new Date(invoice.period_end   * 1000),
    },
  });
}
```

---

## 12. Stripe Config — PRO Plan

In Stripe Dashboard:
- Create product "TrackMyContainer PRO" at $35/month
- Set `STRIPE_PRO_PRICE_ID` env var
- Remove old BUSINESS price ID references

In `src/config/plans.ts` / `src/backend/lib/stripe.ts`:
- Map `PRO` plan → `STRIPE_PRO_PRICE_ID`
- Remove `BUSINESS` plan references

---

## 13. Contact Form API

**New file:** `src/app/api/contact/route.ts`

```typescript
POST /api/contact
Body: { name, email, phone?, containersCount, message? }

→ Creates ContactRequest in DB
→ Sends notification email to admin via Resend (same service used elsewhere in the app, env var: RESEND_API_KEY)
→ Returns 201
```

---

## 14. Files to Create or Modify

| File | Action | What |
|------|--------|------|
| `prisma/schema.prisma` | Modify | enum BUSINESS→CUSTOM, new fields on Shipment, new ContactRequest model |
| `src/config/plans.ts` | Rewrite | New plan definitions with provider + liveTracking |
| `src/lib/auth.ts` | Modify | canAddShipment() new logic, default subscription values |
| `src/app/api/shipments/route.ts` | Modify | Call canAddShipment(), set trackingProvider + isLiveTracking |
| `src/backend/worker/processors/tracking-poll.ts` | Modify | Filter isLiveTracking=true, read provider from shipment |
| `src/frontend/components/dashboard/shipment-detail-client.tsx` | Modify | Gate Map + RouteViz + EventHistory behind UpgradeOverlay for FREE |
| `src/frontend/components/dashboard/shipment-list.tsx` | Modify | Show container counter widget |
| `src/app/(dashboard)/dashboard/billing/page.tsx` | Modify | Update plan names, prices, limits |
| `src/frontend/components/marketing/pricing-cards.tsx` | Modify | Update to FREE/PRO/CUSTOM |
| `src/app/(marketing)/pricing/page.tsx` | Create | Full pricing page |
| `src/app/api/contact/route.ts` | Create | Contact form endpoint |
| `src/app/api/shipments/count/route.ts` | Create | GET counter for UI |
| `src/app/api/webhooks/stripe/route.ts` | Modify | Ensure currentPeriodStart updated on payment |

---

## 15. Out of Scope (This Spec)

- Payment gateway integration details (user will provide)
- WhatsApp notifications
- Admin dashboard for ContactRequest management
- Team member features
- API key management

---

## Counting Summary

| Plan | Query | Resets? |
|------|-------|---------|
| FREE | `COUNT(*) WHERE userId = X` | Never — lifetime |
| PRO | `COUNT(*) WHERE userId = X AND createdAt >= currentPeriodStart` | Yes — on each Stripe payment |
| CUSTOM | Always allowed — no query | N/A |
