/**
 * TrackMyContainer.ai — BullMQ Worker Process
 * Deploy separately to Railway or Render as a long-running Node.js process.
 *
 * Start: npx tsx worker/index.ts
 */

import { Worker } from "bullmq";
import IORedis from "ioredis";
import { scheduleTrackingDispatcher } from "@/backend/lib/queue";
import { trackingPollProcessor }     from "./processors/tracking-poll";
import { notificationProcessor }     from "./processors/notification-send";
import { trackingDispatchProcessor } from "./processors/tracking-dispatch";

// BullMQ workers must NOT share a Redis connection with the Queue
// instances — each worker gets its own dedicated connection.
function newConnection(): IORedis {
  return new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

console.log("[Worker] Starting TrackMyContainer.ai background workers...");

// ── Tracking Poll Worker ──────────────────────────────────────
const trackingWorker = new Worker(
  "tracking-poll",
  trackingPollProcessor,
  {
    connection: newConnection(),
    concurrency: 10,   // Process 10 shipments in parallel
  },
);

trackingWorker.on("completed", (job) => {
  console.log(`[tracking-poll] ✅ Job ${job.id} completed`);
});
trackingWorker.on("failed", (job, err) => {
  console.error(`[tracking-poll] ❌ Job ${job?.id} failed:`, err.message);
});

// ── Tracking Dispatcher Worker ────────────────────────────────
const trackingDispatcherWorker = new Worker(
  "tracking-dispatcher",
  trackingDispatchProcessor,
  {
    connection: newConnection(),
    concurrency: 1,   // One fan-out at a time
  },
);

trackingDispatcherWorker.on("completed", (job) => {
  console.log(`[tracking-dispatcher] ✅ Job ${job.id} completed`);
});
trackingDispatcherWorker.on("failed", (job, err) => {
  console.error(`[tracking-dispatcher] ❌ Job ${job?.id} failed:`, err.message);
});

// ── Notification Worker ───────────────────────────────────────
const notificationWorker = new Worker(
  "notification-send",
  notificationProcessor,
  {
    connection: newConnection(),
    concurrency: 20,
  },
);

notificationWorker.on("completed", (job) => {
  console.log(`[notification-send] ✅ Job ${job.id} completed`);
});
notificationWorker.on("failed", (job, err) => {
  console.error(`[notification-send] ❌ Job ${job?.id} failed:`, err.message);
});

// ── Schedule the recurring dispatcher (runs every 6h) ─────────
scheduleTrackingDispatcher()
  .then(() => console.log("[Worker] Tracking dispatcher scheduled every 6 hours"))
  .catch((err) => console.error("[Worker] Failed to schedule dispatcher:", err));

// ── Graceful shutdown ─────────────────────────────────────────
async function shutdown() {
  console.log("[Worker] Shutting down gracefully...");
  await Promise.all([
    trackingWorker.close(),
    trackingDispatcherWorker.close(),
    notificationWorker.close(),
  ]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT",  shutdown);

console.log("[Worker] All workers running. Waiting for jobs...");
