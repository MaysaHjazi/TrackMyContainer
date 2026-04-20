import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { updateShipmentSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

// ── GET /api/shipments/[id] — Single shipment with events ────
export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const shipment = await prisma.shipment.findFirst({
    where: { id, userId: user.id },
    include: {
      trackingEvents: { orderBy: { eventDate: "desc" } },
      notifications: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  return NextResponse.json(shipment);
}

// ── PATCH /api/shipments/[id] — Update shipment ──────────────
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const body = await req.json();
  const parsed = updateShipmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const existing = await prisma.shipment.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const shipment = await prisma.shipment.update({ where: { id }, data: parsed.data });
  return NextResponse.json(shipment);
}

// ── DELETE /api/shipments/[id] — Permanently delete shipment ─
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const existing = await prisma.shipment.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  // Hard delete — tracking events cascade (schema onDelete: Cascade);
  // notifications keep history with shipmentId set to null (onDelete: SetNull).
  await prisma.shipment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
