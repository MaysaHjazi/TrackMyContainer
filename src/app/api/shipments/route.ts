import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { getAuthenticatedUser, canAddShipment } from "@/lib/auth";
import { PLANS, getProviderForPlan, type PlanKey } from "@/config/plans";
import { createShipmentSchema, shipmentsQuerySchema } from "@/lib/validations";
import { trackShipment, TrackingError } from "@/backend/services/tracking";
import { ShipsgoProvider } from "@/backend/services/tracking/providers/shipsgo";
import { parseTrackingIdentifier } from "@/backend/services/tracking/identifier-parser";
import type { Prisma } from "@prisma/client";

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
  // Frontend can pass confirmCharge:true after the user accepted the
  // "this will use 1 credit" dialog. Default false → safe by default.
  const confirmCharge = body?.confirmCharge === true;

  // Validate format + check digit BEFORE any provider call.
  // This rejects fake/typo numbers without ever touching ShipsGo.
  const parsedId = parseTrackingIdentifier(trackingNumber);
  if (!parsedId.valid) {
    return NextResponse.json({ error: parsedId.error }, { status: 400 });
  }

  // Check for duplicate
  const existing = await prisma.shipment.findUnique({
    where: { userId_trackingNumber: { userId: user.id, trackingNumber: trackingNumber.toUpperCase() } },
  });
  if (existing) {
    return NextResponse.json({ error: "You are already tracking this number." }, { status: 409 });
  }

  // Determine provider from plan
  const provider       = getProviderForPlan(plan as PlanKey);  // "jsoncargo" | "shipsgo"
  const isLiveTracking = PLANS[plan as PlanKey].liveTracking;  // false for FREE, true for PRO/CUSTOM

  // ── Credit guard for ShipsGo (PRO/CUSTOM) ──────────────────────
  // Before calling trackShipment (which could create a new ShipsGo
  // shipment and consume 1 credit), we ask ShipsGo if the number is
  // already in our account's cache. If yes → free. If not → require
  // explicit user consent via confirmCharge:true.
  if (provider === "shipsgo" && !confirmCharge) {
    const sg = new ShipsgoProvider();
    const inCache = await sg.existsInCache(trackingNumber, type);
    if (!inCache) {
      return NextResponse.json(
        {
          code:    "WILL_CHARGE_CREDIT",
          message: `This ${type === "AIR" ? "AWB" : "container"} is not yet in your ShipsGo account. Adding it will use 1 ShipsGo credit. Resend with confirmCharge:true to proceed.`,
        },
        { status: 409 },
      );
    }
  }

  // Fetch initial tracking data using plan-specific provider
  let trackingData;
  try {
    trackingData = await trackShipment(trackingNumber, {
      skipCache:     true,
      forceProvider: provider,
    });
  } catch (err) {
    if (err instanceof TrackingError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Failed to fetch tracking data" }, { status: 500 });
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

  return NextResponse.json(shipment, { status: 201 });
}
