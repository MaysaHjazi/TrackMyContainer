import type { Job } from "bullmq";
import type { TrackingPollJobData } from "@/backend/lib/queue";
import { trackShipment }           from "@/backend/services/tracking";
import { notificationQueue }       from "@/backend/lib/queue";
import { prisma }                  from "@/backend/lib/db";
import { daysUntil }               from "@/lib/utils";
import { recordEvent }             from "@/lib/audit-log";
import { isMetaProvider }          from "@/backend/services/notifications/whatsapp-meta";

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
  const isArrivingSoon = result.etaDate && daysUntil(result.etaDate) <= 3 && daysUntil(result.etaDate) >= 0;

  // ── Effective-delay detection ─────────────────────────────────
  // Carriers (ShipsGo + JSONCargo) usually update the ETA when a
  // shipment slips, but they rarely flip the status to DELAYED.
  //
  // Two complementary signals drive our delay logic:
  //
  //   1. POLL-OVER-POLL SHIFT: new etaDate vs. previously-saved
  //      etaDate. Catches NEW slips going forward.
  //
  //   2. CARRIER-SIDE BASELINE: ShipsGo exposes the booking-time
  //      ETA as `date_of_discharge_initial` (surfaced as
  //      `result.etaInitial`). Comparing that to today's carrier
  //      ETA reveals the FULL slip — including delays that
  //      happened before we ever started tracking the shipment.
  //
  // We take the larger of the two so an already-saved 18-day
  // delay surfaces on the next poll instead of silently sitting
  // at the same number forever.
  const dayMs = 86_400_000;
  const oldEtaMs           = shipment.etaDate?.getTime() ?? null;
  const newEtaMs           = result.etaDate?.getTime() ?? null;
  const etaInitialMs       = result.etaInitialDate?.getTime() ?? null;
  const pollShiftDays      = (oldEtaMs && newEtaMs)
    ? Math.round((newEtaMs - oldEtaMs) / dayMs)
    : 0;
  const carrierBaselineDays = (etaInitialMs && newEtaMs)
    ? Math.round((newEtaMs - etaInitialMs) / dayMs)
    : 0;
  const etaShiftDays       = Math.max(pollShiftDays, carrierBaselineDays);

  const carrierDelayed   = result.currentStatus === "DELAYED";
  const etaSlipped       = etaShiftDays >= 1
    && shipment.currentStatus !== "DELIVERED"
    && shipment.currentStatus !== "AT_PORT";
  const effectiveDelayed = carrierDelayed || etaSlipped;
  const newlyDelayed     = effectiveDelayed && shipment.currentStatus !== "DELAYED";

  // If we inferred the delay from an ETA shift (rather than the
  // carrier saying DELAYED outright), promote the saved status to
  // DELAYED so the UI badge turns red and the dashboard filter
  // correctly classifies it. We only do this for shipments still
  // in flight — never for arrivals.
  const persistedStatus = (etaSlipped && !carrierDelayed
    && result.currentStatus !== "DELIVERED"
    && result.currentStatus !== "AT_PORT")
      ? "DELAYED"
      : result.currentStatus;

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
      currentStatus:   persistedStatus,
      currentLocation: result.currentLocation,
      ...etaUpdate,
      // Original carrier ETA — never changes after first capture, so
      // only write when it's newly available. Avoids overwriting a
      // known value with null on a poll where the carrier omitted it.
      ...(result.etaInitialDate && !shipment.etaInitialDate
        ? { etaInitialDate: result.etaInitialDate }
        : {}),
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
      isActive:        persistedStatus !== "DELIVERED" && persistedStatus !== "AT_PORT",
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

  // WhatsApp gate:
  //  • Meta path (WHATSAPP_PROVIDER=meta): mirror email — any PRO/CUSTOM
  //    user with a phone on file gets the SAME alert on WhatsApp. FREE
  //    plan is excluded. No per-shipment toggle / opt-in needed.
  //  • Twilio path (default): unchanged strict gate, byte-for-byte.
  const plan = user.subscription?.plan ?? "FREE";
  const whatsappEnabled = isMetaProvider()
    ? !!user.phone && plan !== "FREE"
    : shipment.notifyWhatsapp &&
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
    // Prefer the carrier-side baseline (booking ETA) when we have it
    // — it's the most meaningful reference for the user, matching
    // the date they originally planned around. Fall back to the
    // last-saved ETA only when the carrier didn't expose a baseline.
    const previousEta = result.etaInitialDate ?? shipment.etaDate ?? null;
    const payloadBase = {
      name:       user.name ?? "there",
      number:     trackingNumber,
      newEta:     (result.etaDate ?? new Date()).toISOString(),
      previousEta: previousEta?.toISOString() ?? null,
      delayDays:  etaShiftDays > 0 ? etaShiftDays : null,
      location:   result.currentLocation,
      url:        trackUrl,
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

  // ── EVENT UPDATE — fire when new events appeared but none of the
  // higher-priority specific notifications above triggered. This is
  // the "in-between" status (vessel departed, transshipment, customs
  // hold, etc.) that the user wants to see in their inbox in real time
  // with TrackMyContainer branding instead of waiting for ShipsGo's
  // own — and now-disabled — emails.
  const triggeredSpecificNotice = newlyDelivered || newlyDelayed || isArrivingSoon;
  if (newEvents.length > 0 && !triggeredSpecificNotice) {
    const eventsPayload = newEvents.map((e) => ({
      status:      e.status,
      location:    e.location ?? null,
      description: e.description ?? null,
      eventDate:   e.eventDate.toISOString(),
    }));
    const payloadBase = {
      name:            user.name ?? "there",
      number:          trackingNumber,
      currentStatus:   result.currentStatus,
      currentLocation: result.currentLocation ?? null,
      events:          eventsPayload,
      url:             trackUrl,
    };

    if (emailEnabled) {
      await notificationQueue.add("status-change-email", {
        userId, shipmentId,
        channel: "EMAIL", type: "STATUS_CHANGE",
        payload: { ...payloadBase, email: user.email },
      });
    }
    if (whatsappEnabled) {
      await notificationQueue.add("status-change-whatsapp", {
        userId, shipmentId,
        channel: "WHATSAPP", type: "STATUS_CHANGE",
        payload: { ...payloadBase, phone: user.phone! },
      });
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
