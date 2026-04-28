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

// ── Card: ShipsGo credits (NEVER calls ShipsGo API) ─────────
export async function getShipsgoCredits(): Promise<{
  total: number; used: number; remaining: number;
}> {
  const total = parseInt(process.env.SHIPSGO_TOTAL_CREDITS ?? "10", 10);
  const used  = await prisma.shipment.count({
    where: { trackingProvider: "shipsgo" },
  });
  return { total, used, remaining: Math.max(0, total - used) };
}

// ── Card: JSONCargo usage ───────────────────────────────────
// Counts every /api/track lookup that hit JSONCargo, broken down
// across today / this month / lifetime, with cache-hit ratio
// (cache hits don't burn quota). Optional env JSONCARGO_MONTHLY_QUOTA
// renders a "used / quota" progress headline.
export async function getJsonCargoUsage(): Promise<{
  today:        number;
  thisMonth:    number;
  total:        number;
  cacheHitRate: number;
  quota:        number | null;
  remaining:    number | null;
}> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const todayStart = startOfToday();

  const [today, thisMonth, total, monthHits] = await Promise.all([
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
  ]);

  const cacheHitRate = thisMonth === 0 ? 0 : monthHits / thisMonth;
  const quotaRaw = process.env.JSONCARGO_MONTHLY_QUOTA;
  const quota = quotaRaw && Number.isFinite(parseInt(quotaRaw, 10))
    ? parseInt(quotaRaw, 10)
    : null;
  // Cache hits don't consume quota — only "real" API calls do
  const consumed = thisMonth - monthHits;
  const remaining = quota === null ? null : Math.max(0, quota - consumed);

  return { today, thisMonth, total, cacheHitRate, quota, remaining };
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
