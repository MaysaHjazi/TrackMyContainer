import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { createPortalSession } from "@/backend/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stripeCustomerId = user.subscription?.stripeCustomerId;
    if (!stripeCustomerId || stripeCustomerId.startsWith("free_")) {
      return NextResponse.json(
        { error: "No active subscription to manage" },
        { status: 400 },
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin;
    const portalUrl = await createPortalSession(stripeCustomerId, `${baseUrl}/dashboard/billing`);

    return NextResponse.json({ url: portalUrl });
  } catch (error: unknown) {
    console.error("[billing/portal]", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 },
    );
  }
}
