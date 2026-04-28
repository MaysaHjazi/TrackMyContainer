import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { getAuthenticatedUser, canAddShipment } from "@/lib/auth";
import { PLANS, getProviderForPlan, type PlanKey } from "@/config/plans";
import { createShipmentSchema, shipmentsQuerySchema } from "@/lib/validations";
import { trackShipment, TrackingError } from "@/backend/services/tracking";
import { ShipsgoProvider } from "@/backend/services/tracking/providers/shipsgo";
import { parseTrackingIdentifier } from "@/backend/services/tracking/identifier-parser";
import { externalExistenceCheck } from "@/backend/services/tracking/external-check";
import { recordEvent } from "@/lib/audit-log";
import type { Prisma } from "@prisma/client";

// Track in-flight ShipsGo creates so a double-click doesn't trigger two
// concurrent ShipsGo POSTs (which would burn 2 credits before our DB
// unique constraint kicks in). Keyed on userId+trackingNumber+type.
const inFlightCreates = new Map<string, Promise<unknown>>();

// ── GET /api/shipments — List user's shipments with filters ──
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const query = shipmentsQuerySchema.parse(params);

  const where: Prisma.ShipmentWhereInput = { userId: user.id };

  if (query.status) where.currentStatus = query.status as Prisma.ShipmentWhereInput["currentStatus"];
  if (query.type) where.type = query.type;
  if (query.favorite) where.isFavorite = true;
  if (query.search) {
    where.OR = [
      { trackingNumber: { contains: query.search, mode: "insensitive" } },
      { nickname: { contains: query.search, mode: "insensitive" } },
      { carrier: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const sortMap: Record<string, Prisma.ShipmentOrderByWithRelationInput> = {
    eta: { etaDate: query.order },
    created: { createdAt: query.order },
    status: { currentStatus: query.order },
    tracking: { trackingNumber: query.order },
  };

  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      orderBy: [{ isFavorite: "desc" }, sortMap[query.sort] ?? { createdAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        trackingEvents: {
          orderBy: { eventDate: "desc" },
          take: 1,
        },
      },
    }),
    prisma.shipment.count({ where }),
  ]);

  return NextResponse.json({
    data: shipments,
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(total / query.limit),
  });
}

// ── POST /api/shipments — Create a new tracked shipment ──────
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check plan limit — new signature returns rich object
  const { allowed, message, plan } = await canAddShipment(user.id);
  if (!allowed) {
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createShipmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { trackingNumber, type, nickname, reference, notifyEmail, notifyWhatsapp } = parsed.data;
  const normalized = trackingNumber.toUpperCase();
  const logCtx     = `${user.id.slice(0, 8)}/${normalized}`;

  // ── Layer A+B: Format + Check Digit Validation ────────────────
  // Rejects fake/typo numbers without ever touching ShipsGo.
  const parsedId = parseTrackingIdentifier(trackingNumber);
  if (!parsedId.valid) {
    console.log(`[shipments] FORMAT_OR_CHECK_DIGIT_FAILED ${logCtx}: ${parsedId.error}`);
    return NextResponse.json(
      { code: "INVALID_TRACKING_NUMBER", error: parsedId.error },
      { status: 400 },
    );
  }

  // ── Layer C: Local DB Duplicate Check ─────────────────────────
  const existing = await prisma.shipment.findUnique({
    where: { userId_trackingNumber: { userId: user.id, trackingNumber: normalized } },
  });
  if (existing) {
    console.log(`[shipments] DUPLICATE_PREVENTED ${logCtx} (existing id=${existing.id})`);
    return NextResponse.json(
      { code: "ALREADY_TRACKED", error: "You are already tracking this number." },
      { status: 409 },
    );
  }

  // Determine provider from plan
  const provider       = getProviderForPlan(plan as PlanKey);  // "jsoncargo" | "shipsgo"
  const isLiveTracking = PLANS[plan as PlanKey].liveTracking;

  // ── Layers D + E: Cache + External (STRICT MODE) ──────────────
  // For ShipsGo, we only allow a credit-consuming create if the
  // shipment is already in our ShipsGo cache (free) OR the external
  // free providers definitively verified it exists. NOT_FOUND or
  // UNKNOWN both block — no dialog, no user override. The user
  // chose "safety > coverage": better to reject a real shipment than
  // burn a credit on one that turns out to be fake or missing.
  if (provider === "shipsgo") {
    const sg = new ShipsgoProvider();

    // Layer D: ShipsGo cache (free GET search)
    const inCache = await sg.existsInCache(trackingNumber, type);

    if (inCache) {
      console.log(`[shipments] SHIPSGO_CACHE_HIT ${logCtx} (proceeding free)`);
      // Fall through to trackShipment — it will reuse, no credit.
    } else {
      // Layer E: External existence check via free providers.
      // Only FOUND is acceptable. UNKNOWN and NOT_FOUND both reject.
      const ext = await externalExistenceCheck(trackingNumber, type, parsedId.carrierCode);

      if (ext !== "FOUND") {
        const codeLabel = ext === "NOT_FOUND" ? "EXTERNAL_NOT_FOUND" : "EXTERNAL_UNKNOWN";
        console.log(`[shipments] ${codeLabel} ${logCtx} (blocking create — strict mode)`);
        return NextResponse.json(
          {
            code:    "NOT_VERIFIED",
            externalStatus: ext,
            message: ext === "NOT_FOUND"
              ? `Shipment "${trackingNumber}" was not found by any free verification source. Adding it would waste 1 ShipsGo credit. Please verify the number and try again.`
              : `Shipment "${trackingNumber}" could not be verified by free sources (${type === "AIR" ? "the airline isn't covered by our free verification — only Lufthansa and Qatar are" : "carrier not covered"}). To protect your credits, the shipment was not added.`,
          },
          { status: 400 },
        );
      }

      console.log(`[shipments] EXTERNAL_VERIFIED ${logCtx} (proceeding to create)`);
    }
  }

  // ── Idempotency: prevent double-click double-charge ───────────
  const lockKey = `${user.id}:${normalized}:${type}`;
  if (inFlightCreates.has(lockKey)) {
    console.log(`[shipments] DUPLICATE_PREVENTED (in-flight) ${logCtx}`);
    return NextResponse.json(
      { code: "REQUEST_IN_FLIGHT", error: "Already processing this number. Please wait." },
      { status: 409 },
    );
  }

  // Fetch initial tracking data using plan-specific provider.
  // Wrap in a Promise stored in inFlightCreates so concurrent requests
  // for the same key are rejected before they can reach ShipsGo.
  let trackingData;
  const trackPromise = trackShipment(trackingNumber, {
    skipCache:     true,
    forceProvider: provider,
  });
  inFlightCreates.set(lockKey, trackPromise);
  try {
    trackingData = await trackPromise;
    console.log(`[shipments] SHIPSGO_CREATED_OR_FETCHED ${logCtx} (events=${trackingData.events.length})`);

    // Log this provider call to tracking_queries so the admin
    // dashboard's per-provider tiles (JSONCargo, ShipsGo) include
    // shipment-creation traffic, not just public /api/track lookups.
    // skipCache:true above means this never came from local cache.
    prisma.trackingQuery
      .create({
        data: {
          userId:         user.id,
          trackingNumber: trackingData.trackingNumber,
          type:           trackingData.type,
          provider:       trackingData.provider,
          cacheHit:       false,
        },
      })
      .catch(() => {});
  } catch (err) {
    inFlightCreates.delete(lockKey);
    if (err instanceof TrackingError) {
      void recordEvent({
        type:    "shipment.create_failed",
        level:   "warning",
        message: `${trackingNumber}: ${err instanceof Error ? err.message : "tracking failed"}`,
        userId:  user.id,
        metadata: { trackingNumber, type },
      });
      return NextResponse.json({ code: "TRACKING_FAILED", error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Failed to fetch tracking data" }, { status: 500 });
  } finally {
    inFlightCreates.delete(lockKey);
  }

  // Create shipment with enriched data + plan-specific fields
  const shipment = await prisma.shipment.create({
    data: {
      userId:           user.id,
      trackingNumber:   trackingData.trackingNumber,
      type,
      carrier:          trackingData.carrier,
      carrierCode:      trackingData.carrierCode,
      origin:           trackingData.origin,
      destination:      trackingData.destination,
      currentStatus:    trackingData.currentStatus,
      currentLocation:  trackingData.currentLocation,
      // If the shipment was already arrived on first add, the carrier's
      // ETA field has been overwritten with the actual arrival date —
      // skip saving it so we don't show a redundant (ETA == ATA) value.
      etaDate:          trackingData.ataDate ? null : trackingData.etaDate,
      etdDate:          trackingData.etdDate,
      atdDate:          trackingData.atdDate,
      ataDate:          trackingData.ataDate,
      vesselName:       trackingData.vesselName,
      voyageNumber:     trackingData.voyageNumber,
      flightNumber:     trackingData.flightNumber,
      nickname,
      reference,
      notifyEmail,
      notifyWhatsapp,
      lastPolledAt:     new Date(),
      trackingProvider: provider,       // "jsoncargo" or "shipsgo"
      isLiveTracking,                   // false for FREE, true for PRO/CUSTOM
      trackingEvents: {
        // Only persist events that have actually happened. Future/predicted
        // events (e.g. "estimated discharge on day X") can be cancelled or
        // rescheduled — we add them day-by-day on subsequent polls.
        create: trackingData.events
          .filter((e) => e.eventDate <= new Date())
          .map((e) => ({
            status:      e.status,
            location:    e.location,
            description: e.description,
            eventDate:   e.eventDate,
            source:      e.source,
          })),
      },
    },
    include: { trackingEvents: true },
  });

  void recordEvent({
    type:    "shipment.created",
    message: `${trackingNumber} added (${type}, provider=${provider})`,
    userId:  user.id,
    metadata: { shipmentId: shipment.id, trackingNumber, type, provider },
  });

  return NextResponse.json(shipment, { status: 201 });
}
