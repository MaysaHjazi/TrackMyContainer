import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { getAuthenticatedUser, canAddShipment } from "@/lib/auth";
import { createShipmentSchema, shipmentsQuerySchema } from "@/lib/validations";
import { trackShipment, TrackingError } from "@/backend/services/tracking";
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

  const allowed = await canAddShipment(user);
  if (!allowed) {
    return NextResponse.json(
      { error: "Shipment limit reached. Upgrade your plan for more tracked shipments." },
      { status: 403 },
    );
  }

  const body = await req.json();
  const parsed = createShipmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { trackingNumber, type, nickname, reference, notifyEmail, notifyWhatsapp } = parsed.data;

  // Check for duplicate
  const existing = await prisma.shipment.findUnique({
    where: { userId_trackingNumber: { userId: user.id, trackingNumber: trackingNumber.toUpperCase() } },
  });
  if (existing) {
    return NextResponse.json({ error: "You are already tracking this number." }, { status: 409 });
  }

  // Fetch initial tracking data
  let trackingData;
  try {
    trackingData = await trackShipment(trackingNumber, { skipCache: true });
  } catch (err) {
    if (err instanceof TrackingError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Failed to fetch tracking data" }, { status: 500 });
  }

  // Create shipment with enriched data
  const shipment = await prisma.shipment.create({
    data: {
      userId: user.id,
      trackingNumber: trackingData.trackingNumber,
      type,
      carrier: trackingData.carrier,
      carrierCode: trackingData.carrierCode,
      origin: trackingData.origin,
      destination: trackingData.destination,
      currentStatus: trackingData.currentStatus,
      currentLocation: trackingData.currentLocation,
      // If the shipment was already arrived on first add, the carrier's
      // ETA field has been overwritten with the actual arrival date —
      // skip saving it so we don't show a redundant (ETA == ATA) value.
      etaDate: trackingData.ataDate ? null : trackingData.etaDate,
      etdDate: trackingData.etdDate,
      atdDate: trackingData.atdDate,
      ataDate: trackingData.ataDate,
      vesselName: trackingData.vesselName,
      voyageNumber: trackingData.voyageNumber,
      flightNumber: trackingData.flightNumber,
      nickname,
      reference,
      notifyEmail,
      notifyWhatsapp,
      lastPolledAt: new Date(),
      trackingEvents: {
        create: trackingData.events.map((e) => ({
          status: e.status,
          location: e.location,
          description: e.description,
          eventDate: e.eventDate,
          source: e.source,
        })),
      },
    },
    include: { trackingEvents: true },
  });

  return NextResponse.json(shipment, { status: 201 });
}
