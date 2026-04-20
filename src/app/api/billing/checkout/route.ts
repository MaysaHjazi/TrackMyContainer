import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { createCheckoutSession, getOrCreateStripeCustomer } from "@/backend/lib/stripe";
import { prisma } from "@/backend/lib/db";
import { PLANS } from "@/config/plans";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId } = await req.json();
    const plan = planId === "PRO" ? PLANS.PRO : planId === "BUSINESS" ? PLANS.BUSINESS : null;

    if (!plan || !plan.stripePriceId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Get or create Stripe customer
    let stripeCustomerId = user.subscription?.stripeCustomerId;
    if (!stripeCustomerId || stripeCustomerId.startsWith("free_")) {
      stripeCustomerId = await getOrCreateStripeCustomer(user.id, user.email, user.name ?? undefined);
      // Update DB
      if (user.subscription) {
        await prisma.subscription.update({
          where: { id: user.subscription.id },
          data: { stripeCustomerId },
        });
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin;

    const checkoutUrl = await createCheckoutSession({
      userId: user.id,
      stripeCustomerId,
      priceId: plan.stripePriceId,
      successUrl: `${baseUrl}/dashboard/billing?success=true`,
      cancelUrl: `${baseUrl}/dashboard/billing?canceled=true`,
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (error: unknown) {
    console.error("[billing/checkout]", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
