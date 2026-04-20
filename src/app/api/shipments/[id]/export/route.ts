import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

// ── GET /api/shipments/[id]/export — Export shipment as CSV ──
export async function GET(
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
      include: {
        trackingEvents: { orderBy: { eventDate: "asc" } },
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 },
      );
    }

    // Build CSV
    const lines: string[] = [];

    // Shipment info section
    lines.push("Shipment Information");
    lines.push(`Tracking Number,${csvEscape(shipment.trackingNumber)}`);
    lines.push(`Type,${csvEscape(shipment.type)}`);
    lines.push(`Carrier,${csvEscape(shipment.carrier ?? "")}`);
    lines.push(`Status,${csvEscape(shipment.currentStatus)}`);
    lines.push(`Origin,${csvEscape(shipment.origin ?? "")}`);
    lines.push(`Destination,${csvEscape(shipment.destination ?? "")}`);
    lines.push(`Vessel,${csvEscape(shipment.vesselName ?? "")}`);
    lines.push(`Voyage,${csvEscape(shipment.voyageNumber ?? "")}`);
    lines.push(`Flight,${csvEscape(shipment.flightNumber ?? "")}`);
    lines.push(`ETD,${shipment.etdDate?.toISOString() ?? ""}`);
    lines.push(`ETA,${shipment.etaDate?.toISOString() ?? ""}`);
    lines.push(`Nickname,${csvEscape(shipment.nickname ?? "")}`);
    lines.push(`Reference,${csvEscape(shipment.reference ?? "")}`);
    lines.push("");

    // Tracking events section
    lines.push("Tracking Events");
    lines.push("Date,Status,Location,Description,Source");
    for (const event of shipment.trackingEvents) {
      lines.push(
        [
          event.eventDate.toISOString(),
          csvEscape(event.status),
          csvEscape(event.location ?? ""),
          csvEscape(event.description),
          csvEscape(event.source),
        ].join(","),
      );
    }

    const csv = lines.join("\n");
    const filename = `shipment-${shipment.trackingNumber}-${Date.now()}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/shipments/[id]/export]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
