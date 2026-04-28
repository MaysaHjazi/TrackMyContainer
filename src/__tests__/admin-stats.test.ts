import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/backend/lib/db", () => ({
  prisma: {
    user:           { count: vi.fn() },
    shipment:       { count: vi.fn() },
    subscription:   { count: vi.fn() },
    trackingQuery:  { count: vi.fn() },
    auditLog:       { count: vi.fn(), findMany: vi.fn() },
    contactRequest: { findMany: vi.fn() },
  },
}));

import {
  getUserCounts,
  getShipmentCounts,
  getShipsgoCredits,
  getApiCallsToday,
  getErrorCount24h,
  getMrrCents,
  getRecentActivity,
  getPendingContactRequests,
  getApiCallsByDay,
} from "@/lib/admin-stats";
import { prisma } from "@/backend/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SHIPSGO_TOTAL_CREDITS = "10";
});

describe("getUserCounts", () => {
  it("returns total + breakdown by plan", async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(12);
    vi.mocked(prisma.subscription.count)
      .mockResolvedValueOnce(7)  // FREE
      .mockResolvedValueOnce(5)  // PRO
      .mockResolvedValueOnce(0); // CUSTOM
    const r = await getUserCounts();
    expect(r).toEqual({ total: 12, free: 7, pro: 5, custom: 0 });
  });
});

describe("getShipmentCounts", () => {
  it("returns total + active counts", async () => {
    vi.mocked(prisma.shipment.count)
      .mockResolvedValueOnce(28) // total
      .mockResolvedValueOnce(23); // active
    const r = await getShipmentCounts();
    expect(r).toEqual({ total: 28, active: 23 });
  });
});

describe("getShipsgoCredits", () => {
  it("computes used and remaining from shipments", async () => {
    vi.mocked(prisma.shipment.count).mockResolvedValue(3);
    const r = await getShipsgoCredits();
    expect(r).toEqual({ total: 10, used: 3, remaining: 7 });
  });
  it("clamps remaining at 0 when used exceeds total", async () => {
    vi.mocked(prisma.shipment.count).mockResolvedValue(15);
    const r = await getShipsgoCredits();
    expect(r.remaining).toBe(0);
  });
});

describe("getApiCallsToday", () => {
  it("counts queries where createdAt >= start of today", async () => {
    vi.mocked(prisma.trackingQuery.count)
      .mockResolvedValueOnce(245) // total
      .mockResolvedValueOnce(218); // cache hits
    const r = await getApiCallsToday();
    expect(r.total).toBe(245);
    expect(r.cacheHitRate).toBeCloseTo(218 / 245, 3);
  });
});

describe("getErrorCount24h", () => {
  it("counts audit_log rows with level=error in last 24h", async () => {
    vi.mocked(prisma.auditLog.count).mockResolvedValue(3);
    expect(await getErrorCount24h()).toBe(3);
  });
});

describe("getMrrCents", () => {
  it("multiplies active PRO subs by 3500 cents", async () => {
    vi.mocked(prisma.subscription.count).mockResolvedValue(5);
    expect(await getMrrCents()).toBe(5 * 3500);
  });
});

describe("getRecentActivity", () => {
  it("returns the latest 20 audit-log rows", async () => {
    const rows = [{ id: "a" }, { id: "b" }];
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue(rows as never);
    const r = await getRecentActivity();
    expect(r).toEqual(rows);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    );
  });
});

describe("getPendingContactRequests", () => {
  it("filters by status=PENDING", async () => {
    vi.mocked(prisma.contactRequest.findMany).mockResolvedValue([] as never);
    await getPendingContactRequests();
    expect(prisma.contactRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PENDING" },
      }),
    );
  });
});

describe("getApiCallsByDay", () => {
  it("returns 7 buckets for the last 7 days, oldest first", async () => {
    vi.mocked(prisma.trackingQuery.count).mockResolvedValue(10);
    const r = await getApiCallsByDay();
    expect(r).toHaveLength(7);
    expect(r[0]).toEqual(expect.objectContaining({ count: expect.any(Number) }));
    // The most recent bucket is last
    expect(new Date(r[6].day).getTime()).toBeGreaterThan(new Date(r[0].day).getTime());
  });
});
