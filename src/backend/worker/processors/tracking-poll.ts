import type { Job } from "bullmq";
import type { TrackingPollJobData } from "@/backend/lib/queue";
import { trackShipment }           from "@/backend/services/tracking";
import { notificationQueue }       from "@/backend/lib/queue";
import { prisma }                  from "@/backend/lib/db";
import { daysUntil }               from "@/lib/utils";
import { recordEvent }             from "@/lib/audit-log";

/**
 * Polls tracking APIs for a single shipment,
 * detects status changes, and enqueues notifications.
 */
export async function trackingPollProcessor(
  job: Job<TrackingPollJobData>,
): Promise<void> {
  const { shipmentId, trackingNumber, userId } = job.data;

  try {
  // Fetch current state from DB
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { user: { include: { subscription: true } } },
  });

  if (!shipment || !shipment.isActive) {
    return; // Skip deactivated shipments
  }

  // Force-fetch fresh data (skip cache)
  const result = await trackShipment(trackingNumber, {
    skipCache:     true,
    forceProvider: job.data.trackingProvider,  // re-poll using same provider as original add
  });

  // Log this poll to tracking_queries so the admin dashboard's
  // provider-usage tiles (JSONCargo, ShipsGo) reflect ALL traffic,
  // not just public /api/track lookups. cacheHit is always false
  // here — we forced skipCache above. Non-fatal.
  prisma.trackingQuery
    .create({
      data: {
        userId:         userId ?? undefined,
        trackingNumber: result.trackingNumber,
        type:           result.type,
        provider:       result.provider,
        cacheHit:       false,
      },
    })
    .catch(() => {});

  const statusChanged  = result.currentStatus !== shipment.currentStatus;
  const etaChanged     = result.etaDate?.toISOString() !== shipment.etaDate?.toISOString();
  const newlyDelivered = result.currentStatus === "DELIVERED" && shipment.currentStatus !== "DELIVERED";
  const newlyDelayed   = result.currentStatus === "DELAYED"   && shipment.currentStatus !== "DELAYED";
  const isArrivingSoon = result.etaDate && daysUntil(result.etaDate) <= 3 && daysUntil(result.etaDate) >= 0;

  // ── Persist new tracking events ──────────────────────────────
  // Only persist events that have actually happened — providers like
  // ShipsGo return predicted/scheduled future events (e.g. "estimated
  // discharge on day X"), but those can be cancelled or rescheduled.
  // We add events day-by-day as they actually occur on subsequent polls,
  // matching the user's expectation of a real-time timeline.
  const now = new Date();
  const existingEventDates = new Set(
    (await prisma.trackingEvent.findMany({
      where:  { shipmentId },
      select: { eventDate: true },
    })).map((e) => e.eventDate.toISOString()),
  );

  const newEvents = result.events.filter(
    (e) =>
      e.eventDate <= now &&
      !existingEventDates.has(e.eventDate.toISOString()),
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
    void recordEvent({
      type:    "tracking.poll_ok",
      message: `${trackingNumber}: ${newEvents.length} new event${newEvents.length === 1 ? "" : "s"}`,
      userId,
      metadata: { shipmentId, trackingNumber, newEvents: newEvents.length },
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
  const trackUrl = `${appUrl}/dashboard/shipments/${shipmentId}`;

  const user = shipment.user;
  if (!user) return;

  // ── Capability gates ─────────────────────────────────────────
  // Email is enabled per-shipment via shipment.notifyEmail (defaults true).
  // WhatsApp also requires the user to opt in and have whatsappEnabled
  // set on their subscription, plus a phone number on file.
  const emailEnabled =
    shipment.notifyEmail && !!user.email;
  const whatsappEnabled =
    shipment.notifyWhatsapp &&
    !!user.subscription?.whatsappEnabled &&
    !!user.whatsappOptIn &&
    !!user.phone;

  if (!emailEnabled && !whatsappEnabled) return;

  // ── ARRIVAL NOTICE ──────────────────────────────────────────
  if (newlyDelivered) {
    const payloadBase = {
      name:      user.name ?? "there",
      number:    trackingNumber,
      location:  result.currentLocation ?? "destination",
      arrivedAt: (result.etaDate ?? new Date()).toISOString(),
      url:       trackUrl,
    };

    if (whatsappEnabled) {
      await notificationQueue.add("arrival-notice", {
        userId, shipmentId,
        channel: "WHATSAPP", type: "ARRIVAL_NOTICE",
        payload: { ...payloadBase, phone: user.phone! },
      });
    }
    if (emailEnabled) {
      await notificationQueue.add("arrival-notice-email", {
        userId, shipmentId,
        channel: "EMAIL", type: "ARRIVAL_NOTICE",
        payload: { ...payloadBase, email: user.email },
      });
    }
  }

  // ── DELAY ALERT ─────────────────────────────────────────────
  if (newlyDelayed) {
    const payloadBase = {
      name:     user.name ?? "there",
      number:   trackingNumber,
      newEta:   (result.etaDate ?? new Date()).toISOString(),
      location: result.currentLocation,
      url:      trackUrl,
    };

    if (whatsappEnabled) {
      await notificationQueue.add("delay-alert", {
        userId, shipmentId,
        channel: "WHATSAPP", type: "DELAY_ALERT",
        payload: { ...payloadBase, phone: user.phone! },
      });
    }
    if (emailEnabled) {
      await notificationQueue.add("delay-alert-email", {
        userId, shipmentId,
        channel: "EMAIL", type: "DELAY_ALERT",
        payload: { ...payloadBase, email: user.email },
      });
    }
  }

  // ── ETA IMMINENT (≤ 3 days) — dedupe across channels per 24h ──
  if (isArrivingSoon && !newlyDelivered) {
    const recentAlert = await prisma.notification.findFirst({
      where: {
        shipmentId,
        type:   "ETA_IMMINENT",
        sentAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
        status: { in: ["SENT", "DELIVERED"] },
      },
    });

    if (!recentAlert) {
      const payloadBase = {
        name:    user.name ?? "there",
        number:  trackingNumber,
        etaDate: (result.etaDate ?? new Date()).toISOString(),
        url:     trackUrl,
      };

      if (whatsappEnabled) {
        await notificationQueue.add("eta-imminent", {
          userId, shipmentId,
          channel: "WHATSAPP", type: "ETA_IMMINENT",
          payload: { ...payloadBase, phone: user.phone! },
        });
      }
      if (emailEnabled) {
        await notificationQueue.add("eta-imminent-email", {
          userId, shipmentId,
          channel: "EMAIL", type: "ETA_IMMINENT",
          payload: { ...payloadBase, email: user.email },
        });
      }
    }
  }
  } catch (err) {
    void recordEvent({
      type:    "tracking.poll_failed",
      level:   "error",
      message: `${job.data.trackingNumber}: ${err instanceof Error ? err.message : "poll failed"}`,
      userId:  job.data.userId,
      metadata: { shipmentId: job.data.shipmentId, trackingNumber: job.data.trackingNumber },
    });
    throw err; // let BullMQ see the failure
  }
}
