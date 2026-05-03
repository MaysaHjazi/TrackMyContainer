import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/backend/lib/db";
import { recordEvent } from "@/lib/audit-log";
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

  // Find or auto-create user in Prisma DB.
  //
  // The first time a user lands on the dashboard, Next.js renders
  // multiple Server Components in parallel — layout + page + KPI cards
  // each call getAuthenticatedUser concurrently. The earlier
  // findUnique → create pattern raced: every parallel call saw
  // findUnique=null, all of them tried prisma.user.create, the second
  // (and later) ones threw P2002 (Unique constraint on `email`),
  // bubbled up as Next.js's "server-side exception" and crashed the
  // dashboard right after a successful Google sign-in.
  //
  // Atomic upsert collapses both the check and the insert into one
  // statement: races become benign, and `subscription` is only
  // created on the create branch (the connectOrCreate-style nested
  // write below).
  const fallbackName =
    user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email.split("@")[0];
  const avatar = user.user_metadata?.avatar_url ?? user.user_metadata?.picture;

  // Cheap pre-read so we can detect the "newly created" case without
  // a second round-trip — upsert can't tell us whether it inserted
  // or updated.
  const existed = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true },
  });

  const dbUser = await prisma.user.upsert({
    where: { email: user.email },
    update: {}, // never overwrite name/image on subsequent logins
    create: {
      email: user.email,
      name:  fallbackName,
      image: avatar,
      subscription: {
        create: {
          stripeCustomerId:    `free_${user.id}`,
          plan:                "FREE",
          status:              "ACTIVE",
          maxTrackedShipments: 5,      // FREE plan: 5 lifetime containers
          maxDailyQueries:     50,
          whatsappEnabled:     false,
          apiAccessEnabled:    false,
          maxTeamMembers:      1,
        },
      },
    },
    include: { subscription: true },
  });

  if (!existed) {
    void recordEvent({
      type:    "user.signed_up",
      message: `${dbUser.email} created their account`,
      userId:  dbUser.id,
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
