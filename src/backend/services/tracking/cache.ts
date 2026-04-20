import { redis, CacheKeys, TTL } from "@/backend/lib/redis";
import type { TrackingResult } from "./providers/types";

export async function getCachedTracking(
  trackingNumber: string,
): Promise<TrackingResult | null> {
  try {
    const key  = CacheKeys.tracking(trackingNumber);
    const data = await redis.get<TrackingResult>(key);
    if (data) {
      return { ...data, cachedAt: new Date(data.polledAt) };
    }
    return null;
  } catch {
    // Cache miss is not a hard error
    return null;
  }
}

export async function setCachedTracking(
  trackingNumber: string,
  result: TrackingResult,
): Promise<void> {
  try {
    const key = CacheKeys.tracking(trackingNumber);
    await redis.set(key, result, { ex: TTL.TRACKING_RESULT });
  } catch {
    // Cache write failure is non-fatal
  }
}

export async function invalidateTracking(trackingNumber: string): Promise<void> {
  try {
    await redis.del(CacheKeys.tracking(trackingNumber));
  } catch {
    // Ignore
  }
}
