import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import crypto from "crypto";

// ── POST /api/shipments/[id]/share — Generate share token ──
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const shipment = await prisma.shipment.findFirst({
      where: { id: (await ctx.params).id, userId: user.id },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 },
      );
    }

    const token = crypto.randomUUID();

    await prisma.shipment.update({
      where: { id: (await ctx.params).id },
      data: { shareToken: token },
    });

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/shared/${token}`;

    return NextResponse.json({ shareUrl, token });
  } catch (error) {
    console.error("[POST /api/shipments/[id]/share]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ── DELETE /api/shipments/[id]/share — Remove share token ──
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const shipment = await prisma.shipment.findFirst({
      where: { id: (await ctx.params).id, userId: user.id },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 },
      );
    }

    await prisma.shipment.update({
      where: { id: (await ctx.params).id },
      data: { shareToken: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/shipments/[id]/share]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
