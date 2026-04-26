import { redis, CacheKeys, TTL } from "@/backend/lib/redis";
import type { SubscriptionPlan } from "@prisma/client";

// ── Queries allowed per day per plan ──────────────────────────
const DAILY_LIMITS: Record<SubscriptionPlan, number> = {
  FREE:   5,
  PRO:    200,
  CUSTOM: -1,   // unlimited
};

interface RateLimitResult {
  allowed:   boolean;
  remaining: number;
  resetAt:   Date;
  limit:     number;
}

/**
 * Sliding-window rate limiter using Redis INCR + EXPIRE.
 * Keyed by userId (authenticated) or IP address (anonymous).
 */
export async function checkRateLimit(
  identifier: string,        // userId or IP
  identifierType: "user" | "ip",
  plan: SubscriptionPlan = "FREE",
): Promise<RateLimitResult> {
  const limit = DAILY_LIMITS[plan];

  // Unlimited plans always pass
  if (limit === -1) {
    return { allowed: true, remaining: Infinity, resetAt: tomorrow(), limit: -1 };
  }

  const key = identifierType === "user"
    ? CacheKeys.rateLimitUID(identifier)
    : CacheKeys.rateLimitIP(identifier);

  try {
    const current = await redis.incr(key);

    // Set expiry only on first increment
    if (current === 1) {
      await redis.expire(key, TTL.RATE_LIMIT_WINDOW);
    }

    const ttl  = await redis.ttl(key);
    const resetAt = new Date(Date.now() + ttl * 1000);

    if (current > limit) {
      return {
        allowed:   false,
        remaining: 0,
        resetAt,
        limit,
      };
    }

    return {
      allowed:   true,
      remaining: Math.max(0, limit - current),
      resetAt,
      limit,
    };
  } catch {
    // On Redis failure, fail open (allow the request)
    return { allowed: true, remaining: 0, resetAt: tomorrow(), limit };
  }
}

function tomorrow(): Date {
  return new Date(Date.now() + 24 * 3600 * 1000);
}
