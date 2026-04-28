import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { trackingPollQueue } from "@/backend/lib/queue";

/**
 * ShipsGo webhook receiver — POST /api/webhooks/shipsgo
 *
 * ShipsGo can push events to this endpoint the moment a tracked
 * shipment changes (vessel arrives, container discharged, ATA filled,
 * etc.). On receipt we don't trust the body alone — we enqueue a
 * tracking-poll job for that shipment, which then re-fetches via the
 * (free) GET endpoint and updates our DB. This keeps the diff/notify
 * logic in one place (tracking-poll) and avoids parsing every variant
 * of ShipsGo's webhook payload schema.
 *
 * Setup:
 *   1. ShipsGo dashboard → Webhooks → Add endpoint:
 *      https://trackmycontainer.info/api/webhooks/shipsgo
 *   2. (Optional) set SHIPSGO_WEBHOOK_SECRET in .env.production and
 *      configure ShipsGo to include it as a header.
 *
 * Result: shipment data updates within seconds of ShipsGo learning
 * about a change — instead of waiting up to 30 minutes for the next
 * scheduled poll.
 */

const SECRET = process.env.SHIPSGO_WEBHOOK_SECRET ?? "";

export async function POST(req: NextRequest) {
  // Optional shared-secret check. ShipsGo lets you configure custom
  // headers per webhook — we look for X-Shipsgo-Secret. If the env
  // var is unset, we skip the check (still useful in early setup).
  if (SECRET) {
    const incoming = req.headers.get("x-shipsgo-secret") ?? "";
    if (incoming !== SECRET) {
      console.warn("[shipsgo-webhook] rejected — bad/missing secret");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ShipsGo's payload shape varies by event type; we look for the
  // tracking number under several common keys.
  const containerNumber =
    (body.container_number as string | undefined) ??
    ((body.shipment as Record<string, unknown> | undefined)?.container_number as string | undefined);
  const awbNumber =
    (body.awb_number as string | undefined) ??
    ((body.shipment as Record<string, unknown> | undefined)?.awb_number as string | undefined);

  const trackingNumber = containerNumber ?? awbNumber;
  if (!trackingNumber) {
    console.warn("[shipsgo-webhook] payload missing tracking number");
    return NextResponse.json({ ok: true, ignored: "no tracking number" }, { status: 200 });
  }

  const normalized = trackingNumber.toUpperCase().replace(/[\s-]/g, "");
  const type       = awbNumber ? "AIR" : "SEA";

  // Find every shipment in our DB that matches this number across all
  // users, but only if we ARE tracking via ShipsGo (otherwise this
  // webhook isn't authoritative for them).
  const shipments = await prisma.shipment.findMany({
    where: {
      trackingProvider: "shipsgo",
      isLiveTracking:   true,
      trackingNumber:   normalized,
    },
    select: { id: true, userId: true, trackingNumber: true, type: true },
  });

  if (shipments.length === 0) {
    console.log(`[shipsgo-webhook] no matching shipments for ${normalized} (${type})`);
    return NextResponse.json({ ok: true, matched: 0 }, { status: 200 });
  }

  // Enqueue a poll for each matching shipment. The poll processor uses
  // jobId = shipmentId so a duplicate webhook fired during an in-flight
  // poll is silently coalesced.
  await Promise.all(
    shipments.map((s) =>
      trackingPollQueue.add(
        "poll",
        {
          shipmentId:       s.id,
          trackingNumber:   s.trackingNumber,
          type:             s.type,
          userId:           s.userId,
          trackingProvider: "shipsgo",
        },
        { jobId: s.id, removeOnComplete: true, removeOnFail: 50 },
      ),
    ),
  );

  console.log(
    `[shipsgo-webhook] enqueued polls for ${shipments.length} shipment(s) matching ${normalized}`,
  );
  return NextResponse.json({ ok: true, matched: shipments.length }, { status: 200 });
}
