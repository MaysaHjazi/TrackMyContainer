import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

// ── GET /api/analytics/export — Export all shipments as CSV ──
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const shipments = await prisma.shipment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    // Build CSV
    const headers = [
      "trackingNumber",
      "type",
      "carrier",
      "status",
      "origin",
      "destination",
      "etaDate",
      "createdAt",
    ];

    const lines: string[] = [headers.join(",")];

    for (const s of shipments) {
      lines.push(
        [
          csvEscape(s.trackingNumber),
          csvEscape(s.type),
          csvEscape(s.carrier ?? ""),
          csvEscape(s.currentStatus),
          csvEscape(s.origin ?? ""),
          csvEscape(s.destination ?? ""),
          s.etaDate?.toISOString() ?? "",
          s.createdAt.toISOString(),
        ].join(","),
      );
    }

    const csv = lines.join("\n");
    const filename = `analytics-shipments-${Date.now()}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/analytics/export]", error);
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
