import type { Job } from "bullmq";
import type { TrackingPollJobData } from "@/backend/lib/queue";
import { trackShipment }           from "@/backend/services/tracking";
import { notificationQueue }       from "@/backend/lib/queue";
import { prisma }                  from "@/backend/lib/db";
import { daysUntil }               from "@/lib/utils";

/**
 * Polls tracking APIs for a single shipment,
 * detects status changes, and enqueues notifications.
 */
export async function trackingPollProcessor(
  job: Job<TrackingPollJobData>,
): Promise<void> {
  const { shipmentId, trackingNumber, userId } = job.data;

  // Fetch current state from DB
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { user: { include: { subscription: true } } },
  });

  if (!shipment || !shipment.isActive) {
    return; // Skip deactivated shipments
  }

  // Force-fetch fresh data (skip cache)
  const result = await trackShipment(trackingNumber, { skipCache: true });

  const statusChanged  = result.currentStatus !== shipment.currentStatus;
  const etaChanged     = result.etaDate?.toISOString() !== shipment.etaDate?.toISOString();
  const newlyDelivered = result.currentStatus === "DELIVERED" && shipment.currentStatus !== "DELIVERED";
  const newlyDelayed   = result.currentStatus === "DELAYED"   && shipment.currentStatus !== "DELAYED";
  const isArrivingSoon = result.etaDate && daysUntil(result.etaDate) <= 3 && daysUntil(result.etaDate) >= 0;

  // ── Persist new tracking events ──────────────────────────────
  const existingEventDates = new Set(
    (await prisma.trackingEvent.findMany({
      where:  { shipmentId },
      select: { eventDate: true },
    })).map((e) => e.eventDate.toISOString()),
  );

  const newEvents = result.events.filter(
    (e) => !existingEventDates.has(e.eventDate.toISOString()),
  );

  if (newEvents.length > 0) {
    await prisma.trackingEvent.createMany({
      data: newEvents.map((e) => ({
        shipmentId,
        status:      e.status,
        location:    e.location,
        description: e.description,
        eventDate:   e.eventDate,
        source:      e.source,
      })),
    });
  }

  // ── ETA "freeze on arrival" rule ──────────────────────────────
  // Carriers like JSONCargo overwrite `eta_final_destination` with the
  // actual arrival date once a container arrives, which would destroy the
  // original estimate. To let users compare estimated-vs-actual, we lock
  // the saved ETA once ATA lands: no further ETA writes after arrival.
  const newlyArrived   = !shipment.ataDate && !!result.ataDate;
  const alreadyArrived = !!shipment.ataDate;
  const etaUpdate = alreadyArrived
    ? {}                                             // freeze — don't touch etaDate
    : newlyArrived
      ? { etaDate: shipment.etaDate }                // keep prior estimate (null if none — avoids ETA==ATA)
      : { etaDate: result.etaDate ?? null };         // in transit — refresh estimate

  // ── Update shipment record ────────────────────────────────────
  await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      currentStatus:   result.currentStatus,
      currentLocation: result.currentLocation,
      ...etaUpdate,
      etdDate:         result.etdDate ?? null,
      atdDate:         result.atdDate ?? null,
      ataDate:         result.ataDate ?? null,
      vesselName:      result.vesselName,
      voyageNumber:    result.voyageNumber,
      flightNumber:    result.flightNumber,
      lastPolledAt:    new Date(),
      // Stop polling once the container has arrived at its destination port.
      // AT_PORT at destination is terminal for most routes — JSONCargo often
      // never reports DELIVERED (last-mile handoff isn't visible to the API).
      // TRANSSHIPMENT is a different status and remains active.
      isActive:        result.currentStatus !== "DELIVERED" && result.currentStatus !== "AT_PORT",
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://trackmycontainer.info";
  const trackUrl = `${appUrl}/track/${encodeURIComponent(trackingNumber)}`;

  const user = shipment.user;
  if (!user?.subscription?.whatsappEnabled || !user?.whatsappOptIn || !user?.phone) {
    return; // No WhatsApp notifications configured
  }

  // ── Enqueue notifications ─────────────────────────────────────
  if (newlyDelivered && shipment.notifyWhatsapp) {
    await notificationQueue.add("arrival-notice", {
      userId,
      shipmentId,
      channel:  "WHATSAPP",
      type:     "ARRIVAL_NOTICE",
      payload: {
        phone:     user.phone,
        name:      user.name ?? "there",
        number:    trackingNumber,
        location:  result.currentLocation ?? "destination",
        arrivedAt: result.etaDate ?? new Date(),
        url:       trackUrl,
      },
    });
  }

  if (newlyDelayed && shipment.notifyWhatsapp) {
    await notificationQueue.add("delay-alert", {
      userId,
      shipmentId,
      channel:  "WHATSAPP",
      type:     "DELAY_ALERT",
      payload: {
        phone:  user.phone,
        name:   user.name ?? "there",
        number: trackingNumber,
        newEta: result.etaDate ?? new Date(),
        url:    trackUrl,
      },
    });
  }

  if (isArrivingSoon && !newlyDelivered && shipment.notifyWhatsapp) {
    // Check if we already sent an ETA_IMMINENT for this shipment recently (avoid spam)
    const recentAlert = await prisma.notification.findFirst({
      where: {
        shipmentId,
        type:     "ETA_IMMINENT",
        sentAt:   { gte: new Date(Date.now() - 24 * 3600 * 1000) },
        status:   { in: ["SENT", "DELIVERED"] },
      },
    });

    if (!recentAlert) {
      await notificationQueue.add("eta-imminent", {
        userId,
        shipmentId,
        channel: "WHATSAPP",
        type:    "ETA_IMMINENT",
        payload: {
          phone:   user.phone,
          name:    user.name ?? "there",
          number:  trackingNumber,
          etaDate: result.etaDate ?? new Date(),
          url:     trackUrl,
        },
      });
    }
  }
}
