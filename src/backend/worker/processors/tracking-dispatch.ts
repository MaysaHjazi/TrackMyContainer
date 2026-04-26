import type { Job } from "bullmq";
import { prisma } from "@/backend/lib/db";
import { trackingPollQueue } from "@/backend/lib/queue";

/**
 * Scheduler fan-out: enumerate every active shipment and enqueue a
 * `tracking-poll` job for it. Uses `jobId: shipmentId` so if the previous
 * run's job for the same shipment is still queued/processing, BullMQ
 * skips the duplicate and we don't stack up backlog during slow polls.
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

  for (const s of shipments) {
    await trackingPollQueue.add(
      "poll",
      {
        shipmentId:       s.id,
        trackingNumber:   s.trackingNumber,
        type:             s.type,
        userId:           s.userId,
        trackingProvider: s.trackingProvider,  // "jsoncargo" | "shipsgo"
      },
      { jobId: s.id },
    );
  }

  console.log(`[tracking-dispatch] Enqueued poll jobs for ${shipments.length} shipment(s)`);
}
