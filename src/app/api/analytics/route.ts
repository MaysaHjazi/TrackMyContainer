import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

// ── GET /api/analytics — Aggregated analytics for the user ──
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse date range
    const range = req.nextUrl.searchParams.get("range") ?? "30d";
    const daysMap: Record<string, number> = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
    };
    const days = daysMap[range] ?? 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      shipmentsByStatus,
      shipmentsByType,
      shipmentsByCarrier,
      totalShipments,
      activeShipments,
      deliveredShipments,
      recentQueries,
    ] = await Promise.all([
      prisma.shipment.groupBy({
        by: ["currentStatus"],
        where: { userId: user.id },
        _count: true,
      }),
      prisma.shipment.groupBy({
        by: ["type"],
        where: { userId: user.id },
        _count: true,
      }),
      prisma.shipment.groupBy({
        by: ["carrier"],
        where: { userId: user.id, carrier: { not: null } },
        _count: true,
        orderBy: { _count: { carrier: "desc" } },
        take: 10,
      }),
      prisma.shipment.count({
        where: { userId: user.id },
      }),
      prisma.shipment.count({
        where: { userId: user.id, isActive: true },
      }),
      prisma.shipment.count({
        where: { userId: user.id, currentStatus: "DELIVERED" },
      }),
      prisma.trackingQuery.count({
        where: {
          userId: user.id,
          createdAt: { gte: since },
        },
      }),
    ]);

    return NextResponse.json({
      shipmentsByStatus,
      shipmentsByType,
      shipmentsByCarrier,
      totalShipments,
      activeShipments,
      deliveredShipments,
      recentQueries,
      range,
    });
  } catch (error) {
    console.error("[GET /api/analytics]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
