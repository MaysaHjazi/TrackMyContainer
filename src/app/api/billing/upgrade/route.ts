import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/backend/lib/db";

/**
 * POST /api/billing/upgrade
 * Demo upgrade — toggles user plan to PRO directly in DB.
 * In production, this would be handled by Stripe webhooks.
 */
export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.subscription) {
    return NextResponse.json({ error: "No subscription found" }, { status: 400 });
  }

  // Already PRO or CUSTOM
  if (user.subscription.plan === "PRO" || user.subscription.plan === "CUSTOM") {
    return NextResponse.json({ message: "Already upgraded", plan: user.subscription.plan });
  }

  // Upgrade to PRO
  const updated = await prisma.subscription.update({
    where: { userId: user.id },
    data: {
      plan: "PRO",
      status: "ACTIVE",
      maxTrackedShipments: 50,
      maxDailyQueries: 200,
      whatsappEnabled: true,
      apiAccessEnabled: false,
      maxTeamMembers: 1,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  return NextResponse.json({
    message: "Upgraded to PRO!",
    plan: updated.plan,
  });
}
