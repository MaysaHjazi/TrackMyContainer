import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { getAuthenticatedUser, canAddShipment } from "@/lib/auth";
import { bulkImportRowSchema } from "@/lib/validations";
import { trackShipment, TrackingError } from "@/backend/services/tracking";
import { z } from "zod";

const bulkImportSchema = z.object({
  rows: z.array(bulkImportRowSchema).min(1).max(50),
});

// ── POST /api/shipments/bulk-import — Import multiple shipments ──
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = bulkImportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { rows } = parsed.data;
    let created = 0;
    const failed: { trackingNumber: string; error: string }[] = [];

    for (const row of rows) {
      try {
        // Check shipment limit before each creation
        const result = await canAddShipment(user.id);
        if (!result.allowed) {
          failed.push({
            trackingNumber: row.trackingNumber,
            error: "Shipment limit reached",
          });
          continue;
        }

        // Check for duplicate
        const existing = await prisma.shipment.findUnique({
          where: {
            userId_trackingNumber: {
              userId: user.id,
              trackingNumber: row.trackingNumber.toUpperCase(),
            },
          },
        });
        if (existing) {
          failed.push({
            trackingNumber: row.trackingNumber,
            error: "Already tracking this number",
          });
          continue;
        }

        // Fetch tracking data
        const trackingData = await trackShipment(row.trackingNumber, {
          skipCache: true,
        });

        // Create shipment
        await prisma.shipment.create({
          data: {
            userId: user.id,
            trackingNumber: trackingData.trackingNumber,
            type: trackingData.type,
            carrier: trackingData.carrier,
            carrierCode: trackingData.carrierCode,
            origin: trackingData.origin,
            destination: trackingData.destination,
            currentStatus: trackingData.currentStatus,
            currentLocation: trackingData.currentLocation,
            // Skip ETA when already arrived — the carrier field has been
            // overwritten with the actual date, so storing it would duplicate ATA.
            etaDate: trackingData.ataDate ? null : trackingData.etaDate,
            etdDate: trackingData.etdDate,
            atdDate: trackingData.atdDate,
            ataDate: trackingData.ataDate,
            vesselName: trackingData.vesselName,
            voyageNumber: trackingData.voyageNumber,
            flightNumber: trackingData.flightNumber,
            nickname: row.nickname,
            reference: row.reference,
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
        });

        created++;
      } catch (err) {
        const message =
          err instanceof TrackingError
            ? err.message
            : "Failed to fetch tracking data";
        failed.push({ trackingNumber: row.trackingNumber, error: message });
      }
    }

    return NextResponse.json({ created, failed });
  } catch (error) {
    console.error("[POST /api/shipments/bulk-import]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
