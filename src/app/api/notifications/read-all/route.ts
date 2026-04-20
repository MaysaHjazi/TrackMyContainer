import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

// ── POST /api/notifications/read-all — Mark all unread as read ──
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await prisma.notification.updateMany({
      where: {
        userId: user.id,
        status: { not: "READ" },
      },
      data: { status: "READ" },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error("[POST /api/notifications/read-all]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
