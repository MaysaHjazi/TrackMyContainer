import { Redis } from "@upstash/redis";

// ── Upstash Redis client (for API routes & server actions) ────
export const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ── Cache key builders ────────────────────────────────────────
export const CacheKeys = {
  tracking:     (number: string) => `track:${number.toUpperCase()}`,
  rateLimitIP:  (ip: string)     => `ratelimit:ip:${ip}`,
  rateLimitUID: (uid: string)    => `ratelimit:user:${uid}`,
  session:      (id: string)     => `session:${id}`,
};

// ── TTL constants (seconds) ───────────────────────────────────
export const TTL = {
  TRACKING_RESULT:    30 * 60,   // 30 minutes
  RATE_LIMIT_WINDOW:  24 * 3600, // 24 hours (daily quota window)
  SESSION:            7 * 24 * 3600,
};
