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
