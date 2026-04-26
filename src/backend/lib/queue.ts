import { Queue, QueueOptions } from "bullmq";
import IORedis from "ioredis";

// ── Redis connection for BullMQ (requires standard Redis) ─────
let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,  // Required by BullMQ
      enableReadyCheck: false,
    });
  }
  return connection;
}

const defaultQueueOptions: QueueOptions = {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts:    3,
    backoff: {
      type:  "exponential",
      delay: 5000,       // 5s, 10s, 20s
    },
    removeOnComplete: { count: 1000 },
    removeOnFail:     { count: 500 },
  },
};

// ── Queue definitions ─────────────────────────────────────────

/** Poll tracking APIs for status updates on active shipments */
export const trackingPollQueue = new Queue("tracking-poll", defaultQueueOptions);

/** Periodically fans out poll jobs for every active shipment */
export const trackingDispatcherQueue = new Queue("tracking-dispatcher", defaultQueueOptions);

/** Send WhatsApp / email / Messenger notifications */
export const notificationQueue = new Queue("notification-send", defaultQueueOptions);

/** Daily subscription health checks */
export const subscriptionCheckQueue = new Queue("subscription-check", defaultQueueOptions);

// ── Repeatable dispatcher scheduling ──────────────────────────

export const DISPATCHER_SCHEDULER_ID = "tracking-dispatcher-recurring";
export const DISPATCHER_JOB_NAME = "dispatch-polls";
export const DISPATCHER_REPEAT_EVERY_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Register the repeating dispatcher job. Safe to call on every worker
 * startup — `upsertJobScheduler` replaces any existing schedule under the
 * same id, so we never duplicate the recurring entry. Also triggers one
 * immediate dispatch so a fresh worker boot polls without waiting 6 hours.
 */
export async function scheduleTrackingDispatcher(): Promise<void> {
  await trackingDispatcherQueue.upsertJobScheduler(
    DISPATCHER_SCHEDULER_ID,
    { every: DISPATCHER_REPEAT_EVERY_MS },
    {
      name: DISPATCHER_JOB_NAME,
      data: {},
      opts: { removeOnComplete: true, removeOnFail: 50 },
    },
  );

  // Kick off one run immediately on boot — the scheduler alone would
  // wait `every` ms before the first fire.
  await trackingDispatcherQueue.add(
    DISPATCHER_JOB_NAME,
    {},
    { removeOnComplete: true, removeOnFail: true },
  );
}

// ── Job payload types ─────────────────────────────────────────

export interface TrackingPollJobData {
  shipmentId:       string;
  trackingNumber:   string;
  type:             "SEA" | "AIR";
  userId:           string;
  trackingProvider?: string;  // "jsoncargo" | "shipsgo" — used for forced re-poll
}

export interface NotificationJobData {
  userId:     string;
  shipmentId?: string;
  channel:    "WHATSAPP" | "EMAIL" | "MESSENGER";
  type:       string;
  payload:    Record<string, unknown>;
}

export interface SubscriptionCheckJobData {
  userId: string;
}
