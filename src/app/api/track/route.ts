import { NextRequest, NextResponse } from "next/server";
import { trackShipment, TrackingError } from "@/backend/services/tracking";
import { checkRateLimit }               from "@/backend/services/rate-limiter";
import { prisma }                       from "@/backend/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/track?number=MAEU1234567
 *
 * Public tracking endpoint.
 * - Rate limited: 5/day anonymous (by IP), more for authenticated users.
 * - Returns normalized TrackingResult JSON.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const number = searchParams.get("number")?.trim();

  if (!number) {
    return NextResponse.json(
      { error: "Missing tracking number. Use ?number=CONTAINER_OR_AWB" },
      { status: 400 },
    );
  }

  // ── Rate limiting ─────────────────────────────────────────
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          ?? req.headers.get("x-real-ip")
          ?? "unknown";

  // TODO: extract userId from session once auth is set up
  const userId: string | null = null;
  const plan = "FREE"; // TODO: look up from session

  const rl = await checkRateLimit(
    userId ?? ip,
    userId ? "user" : "ip",
    plan as "FREE",
  );

  if (!rl.allowed) {
    return NextResponse.json(
      {
        error:     "Rate limit exceeded. Upgrade to Pro for more lookups.",
        resetAt:   rl.resetAt,
        remaining: 0,
        upgradeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit":     String(rl.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset":     String(Math.floor(rl.resetAt.getTime() / 1000)),
          "Retry-After":           String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)),
        },
      },
    );
  }

  // ── Track ─────────────────────────────────────────────────
  try {
    const result = await trackShipment(number);

    // Log query for analytics (non-blocking)
    prisma.trackingQuery
      .create({
        data: {
          userId:        userId ?? undefined,
          trackingNumber: result.trackingNumber,
          type:          result.type,
          ipAddress:     ip,
          provider:      result.provider,
          cacheHit:      !!result.cachedAt,
        },
      })
      .catch(() => {}); // Non-fatal

    return NextResponse.json(result, {
      headers: {
        "X-RateLimit-Remaining": String(rl.remaining),
        "Cache-Control": result.cachedAt
          ? "public, s-maxage=1800"  // 30min for cached results
          : "no-cache",
      },
    });
  } catch (err) {
    if (err instanceof TrackingError) {
      const statusCode =
        err.code === "INVALID_INPUT" ? 400
        : err.code === "NO_DATA"     ? 404
        : err.code === "RATE_LIMITED"? 429
        : 502;

      return NextResponse.json({ error: err.message, code: err.code }, { status: statusCode });
    }

    console.error("[/api/track] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 },
    );
  }
}
