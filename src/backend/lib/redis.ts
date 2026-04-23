import IORedis from "ioredis";

/**
 * Shared Redis client for cache + rate-limiter.
 *
 * Uses `ioredis` over the standard Redis protocol (TCP), which works with
 * both self-hosted Redis and any Redis-compatible service.  The wrapper
 * below preserves the original `@upstash/redis` call signatures so
 * consumers (cache.ts, rate-limiter.ts) don't need to change.
 */

const REDIS_URL = process.env.REDIS_URL!;

let client: IORedis | null = null;

function getClient(): IORedis {
  if (!client) {
    client = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });
    client.on("error", (err) => {
      // Non-fatal: cache & rate-limit calls fail open
      console.error("[redis] connection error:", err.message);
    });
  }
  return client;
}

/** Compatibility shim matching the subset of `@upstash/redis` we used. */
export const redis = {
  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = await getClient().get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Value was stored as a raw string (not JSON)
      return raw as unknown as T;
    }
  },

  async set(
    key: string,
    value: unknown,
    opts?: { ex?: number },
  ): Promise<void> {
    const payload = typeof value === "string" ? value : JSON.stringify(value);
    if (opts?.ex) {
      await getClient().set(key, payload, "EX", opts.ex);
    } else {
      await getClient().set(key, payload);
    }
  },

  async del(key: string): Promise<number> {
    return await getClient().del(key);
  },

  async incr(key: string): Promise<number> {
    return await getClient().incr(key);
  },

  async expire(key: string, seconds: number): Promise<number> {
    return await getClient().expire(key, seconds);
  },

  async ttl(key: string): Promise<number> {
    return await getClient().ttl(key);
  },
};

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
