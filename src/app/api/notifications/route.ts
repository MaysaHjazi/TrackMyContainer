import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { notificationQuerySchema } from "@/lib/validations";
import type { Prisma } from "@prisma/client";

// ── GET /api/notifications — List notifications with filters ──
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = notificationQuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { channel, type, unread, page, limit } = parsed.data;

    const where: Prisma.NotificationWhereInput = { userId: user.id };

    if (channel) where.channel = channel;
    if (type) where.type = type as Prisma.NotificationWhereInput["type"];
    if (unread) where.status = { not: "READ" };

    const [data, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    console.error("[GET /api/notifications]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
