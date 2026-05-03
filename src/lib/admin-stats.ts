import { prisma } from "@/backend/lib/db";

const PRO_MONTHLY_CENTS = 3500; // matches src/config/plans.ts PRO price

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3600 * 1000);
}

// ── Card: Users ─────────────────────────────────────────────
export async function getUserCounts(): Promise<{
  total: number; free: number; pro: number; custom: number;
}> {
  const [total, free, pro, custom] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({ where: { plan: "FREE"   } }),
    prisma.subscription.count({ where: { plan: "PRO"    } }),
    prisma.subscription.count({ where: { plan: "CUSTOM" } }),
  ]);
  return { total, free, pro, custom };
}

// ── Card: Shipments ─────────────────────────────────────────
export async function getShipmentCounts(): Promise<{ total: number; active: number }> {
  const [total, active] = await Promise.all([
    prisma.shipment.count(),
    prisma.shipment.count({ where: { isActive: true } }),
  ]);
  return { total, active };
}

// ── Card: ShipsGo credits ───────────────────────────────────
// "Used" is read from ShipsGo directly via GET /v2/ocean/shipments —
// `meta.total` excludes deleted/discarded shipments, so it matches the
// account's real consumed-credit count (1 successful create = 1 credit
// = 1 row in their list). Falls back to our local DB count if the API
// is unreachable. The live call is FREE on ShipsGo (GET endpoints are
// not metered).
async function fetchShipsgoUsed(): Promise<number | null> {
  const apiKey = process.env.SHIPSGO_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.shipsgo.com/v2/ocean/shipments?limit=1", {
      headers: { "X-Shipsgo-User-Token": apiKey },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json() as { meta?: { total?: number } };
    if (typeof data.meta?.total !== "number") return null;
    return data.meta.total;
  } catch {
    return null;
  }
}

export async function getShipsgoCredits(): Promise<{
  total: number; used: number; remaining: number; live: boolean;
}> {
  const total = parseInt(process.env.SHIPSGO_TOTAL_CREDITS ?? "10", 10);
  const [liveUsed, dbUsed] = await Promise.all([
    fetchShipsgoUsed(),
    prisma.shipment.count({ where: { trackingProvider: "shipsgo" } }),
  ]);
  const used = liveUsed ?? dbUsed;
  return { total, used, remaining: Math.max(0, total - used), live: liveUsed !== null };
}

// ── JSONCargo live quota (direct API call) ──────────────────
// Hits GET /api/v1/api_key/stats — returns actual counter from
// JSONCargo's servers, bypassing our DB entirely. Non-fatal.
async function fetchJsonCargoLiveStats(): Promise<{
  requestsMade:      number;
  requestsAvailable: number;
  requestsTotal:     number;
} | null> {
  const apiKey = process.env.JSONCARGO_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.jsoncargo.com/api/v1/api_key/stats", {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json() as {
      data?: {
        requests_made?: number;
        requests_available?: number;
        requests_total?: number;
      };
    };
    const stats = json.data;
    if (!stats || typeof stats.requests_made !== "number") return null;
    return {
      requestsMade:      stats.requests_made,
      requestsAvailable: stats.requests_available ?? 0,
      requestsTotal:     stats.requests_total ?? 0,
    };
  } catch {
    return null;
  }
}

// ── Card: JSONCargo usage ───────────────────────────────────
// Primary numbers come from JSONCargo's live API stats endpoint
// (ground truth). DB counts are kept as fallback and for cache-hit ratio.
export async function getJsonCargoUsage(): Promise<{
  today:             number;
  thisMonth:         number;
  consumed:          number;
  total:             number;
  cacheHitRate:      number;
  quota:             number | null;
  remaining:         number | null;
  live:              { requestsMade: number; requestsAvailable: number; requestsTotal: number } | null;
}> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const todayStart = startOfToday();

  const [today, thisMonth, total, monthHits, live] = await Promise.all([
    prisma.trackingQuery.count({
      where: { provider: "jsoncargo", createdAt: { gte: todayStart } },
    }),
    prisma.trackingQuery.count({
      where: { provider: "jsoncargo", createdAt: { gte: startOfMonth } },
    }),
    prisma.trackingQuery.count({
      where: { provider: "jsoncargo" },
    }),
    prisma.trackingQuery.count({
      where: { provider: "jsoncargo", cacheHit: true, createdAt: { gte: startOfMonth } },
    }),
    fetchJsonCargoLiveStats(),
  ]);

  const cacheHitRate = thisMonth === 0 ? 0 : monthHits / thisMonth;
  const quotaRaw = process.env.JSONCARGO_MONTHLY_QUOTA;
  const quota = live?.requestsTotal
    ? live.requestsTotal
    : quotaRaw && Number.isFinite(parseInt(quotaRaw, 10))
      ? parseInt(quotaRaw, 10)
      : null;
  const consumed = live ? live.requestsMade : thisMonth - monthHits;
  const remaining = live ? live.requestsAvailable : (quota === null ? null : Math.max(0, quota - consumed));

  return { today, thisMonth, consumed, total, cacheHitRate, quota, remaining, live };
}

// ── Card: API calls today ───────────────────────────────────
export async function getApiCallsToday(): Promise<{ total: number; cacheHitRate: number }> {
  const since = startOfToday();
  const [total, hits] = await Promise.all([
    prisma.trackingQuery.count({ where: { createdAt: { gte: since } } }),
    prisma.trackingQuery.count({ where: { createdAt: { gte: since }, cacheHit: true } }),
  ]);
  const cacheHitRate = total === 0 ? 0 : hits / total;
  return { total, cacheHitRate };
}

// ── Card: Errors 24h ────────────────────────────────────────
export async function getErrorCount24h(): Promise<number> {
  return prisma.auditLog.count({
    where: { level: "error", createdAt: { gte: hoursAgo(24) } },
  });
}

// ── Card: MRR (cents) ───────────────────────────────────────
export async function getMrrCents(): Promise<number> {
  const proActive = await prisma.subscription.count({
    where: { plan: "PRO", status: "ACTIVE" },
  });
  return proActive * PRO_MONTHLY_CENTS;
}

// ── Activity feed: last 20 audit-log entries ────────────────
export async function getRecentActivity() {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take:    20,
    include: {
      user: { select: { email: true, name: true } },
    },
  });
}

// ── Pending contact requests ────────────────────────────────
export async function getPendingContactRequests() {
  return prisma.contactRequest.findMany({
    where:   { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take:    10,
  });
}

// ── API calls per day (last 7 days) ─────────────────────────
export async function getApiCallsByDay(): Promise<Array<{ day: string; count: number }>> {
  const ranges = Array.from({ length: 7 }, (_, i) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (6 - i));
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  });

  const counts = await Promise.all(
    ranges.map((r) =>
      prisma.trackingQuery.count({
        where: { createdAt: { gte: r.start, lt: r.end } },
      }),
    ),
  );

  return ranges.map((r, i) => ({
    day:   r.start.toISOString().slice(0, 10),
    count: counts[i],
  }));
}
