import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { updateSettingsSchema } from "@/lib/validations";

// ── GET /api/settings — Return user profile + subscription info ──
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      profile: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        whatsappOptIn: user.whatsappOptIn,
      },
      subscription: user.subscription
        ? {
            plan: user.subscription.plan,
            status: user.subscription.status,
            maxTrackedShipments: user.subscription.maxTrackedShipments,
            maxDailyQueries: user.subscription.maxDailyQueries,
            whatsappEnabled: user.subscription.whatsappEnabled,
            apiAccessEnabled: user.subscription.apiAccessEnabled,
            maxTeamMembers: user.subscription.maxTeamMembers,
            currentPeriodEnd: user.subscription.currentPeriodEnd,
            cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
          }
        : null,
    });
  } catch (error) {
    console.error("[GET /api/settings]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ── PATCH /api/settings — Update user profile ───────────────────
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { name, phone, whatsappOptIn } = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone || null;
    if (whatsappOptIn !== undefined) {
      updateData.whatsappOptIn = whatsappOptIn;
      if (whatsappOptIn && !user.whatsappOptIn) {
        updateData.whatsappOptInAt = new Date();
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return NextResponse.json({
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      whatsappOptIn: updated.whatsappOptIn,
    });
  } catch (error) {
    console.error("[PATCH /api/settings]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
