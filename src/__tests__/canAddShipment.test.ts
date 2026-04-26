import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the core counting logic in isolation, mocking prisma
vi.mock("@/backend/lib/db", () => ({
  prisma: {
    subscription: { findUnique: vi.fn() },
    shipment:     { count: vi.fn() },
  },
}));

import { prisma } from "@/backend/lib/db";
import { canAddShipment } from "@/lib/auth";

const mockPrisma = prisma as unknown as {
  subscription: { findUnique: ReturnType<typeof vi.fn> };
  shipment:     { count:      ReturnType<typeof vi.fn> };
};

beforeEach(() => vi.clearAllMocks());

describe("canAddShipment", () => {
  it("CUSTOM plan: always allowed, never queries shipments", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "CUSTOM",
      maxTrackedShipments: 2147483647,
      currentPeriodStart: null,
    });

    const result = await canAddShipment("user-1");

    expect(result.allowed).toBe(true);
    expect(result.plan).toBe("CUSTOM");
    expect(mockPrisma.shipment.count).not.toHaveBeenCalled();
  });

  it("FREE plan: counts ALL shipments (no date/isActive filter)", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "FREE",
      maxTrackedShipments: 5,
      currentPeriodStart: null,
    });
    mockPrisma.shipment.count.mockResolvedValue(3);

    const result = await canAddShipment("user-1");

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(3);
    expect(result.max).toBe(5);
    // Confirm NO date filter was applied (FREE = lifetime total)
    const callArgs = mockPrisma.shipment.count.mock.calls[0][0];
    expect(callArgs.where.createdAt).toBeUndefined();
  });

  it("FREE plan: blocks at 5 with Arabic message", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "FREE",
      maxTrackedShipments: 5,
      currentPeriodStart: null,
    });
    mockPrisma.shipment.count.mockResolvedValue(5);

    const result = await canAddShipment("user-1");

    expect(result.allowed).toBe(false);
    expect(result.message).toContain("PRO");
  });

  it("PRO plan: counts only current billing period shipments", async () => {
    const periodStart = new Date("2026-04-01");
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "PRO",
      maxTrackedShipments: 10,
      currentPeriodStart: periodStart,
    });
    mockPrisma.shipment.count.mockResolvedValue(7);

    const result = await canAddShipment("user-1");

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(7);
    const callArgs = mockPrisma.shipment.count.mock.calls[0][0];
    expect(callArgs.where.createdAt).toEqual({ gte: periodStart });
  });

  it("throws if no subscription found", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    await expect(canAddShipment("user-1")).rejects.toThrow("No subscription found");
  });
});
