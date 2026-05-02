import type { Job } from "bullmq";
import { prisma } from "@/backend/lib/db";
import { trackingPollQueue, DISPATCHER_REPEAT_EVERY_MS } from "@/backend/lib/queue";

/**
 * Scheduler fan-out: enumerate every active shipment and enqueue a
 * `tracking-poll` job for it.
 *
 * jobId is bucketed by dispatch window (`shipmentId:bucket`) and we set
 * removeOnComplete/removeOnFail so the ID is freed once a poll finishes.
 * Two requirements at once:
 *   1. Within a single 30-min window, a duplicate dispatcher tick (or
 *      manual kick) for the same shipment is deduped — we don't stack up
 *      backlog while a slow poll is still running.
 *   2. Across windows, the next tick CAN re-enqueue the same shipment
 *      because the bucket suffix changes. (The previous version used a
 *      bare `jobId: shipmentId`, and BullMQ remembered completed jobs in
 *      Redis history — every redispatch silently no-op'd, so each
 *      shipment was only ever polled once after creation.)
 */
export async function trackingDispatchProcessor(job: Job): Promise<void> {
  console.log(`[tracking-dispatch] Processing job ${job.id} (${job.name})`);
  const shipments = await prisma.shipment.findMany({
    where: {
      isActive:       true,
      isLiveTracking: true,   // FREE shipments (isLiveTracking=false) are excluded
    },
    select: {
      id:               true,
      trackingNumber:   true,
      type:             true,
      userId:           true,
      trackingProvider: true,  // needed by poll processor to re-poll with same provider
    },
  });

  if (shipments.length === 0) {
    console.log("[tracking-dispatch] No active shipments to poll");
    return;
  }

  // Bucket by dispatch window: every shipment gets a fresh jobId per cycle.
  const bucket = Math.floor(Date.now() / DISPATCHER_REPEAT_EVERY_MS);
  let added = 0;
  for (const s of shipments) {
    const result = await trackingPollQueue.add(
      "poll",
      {
        shipmentId:       s.id,
        trackingNumber:   s.trackingNumber,
        type:             s.type,
        userId:           s.userId,
        trackingProvider: s.trackingProvider,  // "jsoncargo" | "shipsgo"
      },
      {
        jobId:            `${s.id}:${bucket}`,
        removeOnComplete: true,
        removeOnFail:     true,
      },
    );
    if (result?.id) added++;
  }

  console.log(`[tracking-dispatch] Enqueued ${added}/${shipments.length} poll job(s) (bucket=${bucket})`);
}
