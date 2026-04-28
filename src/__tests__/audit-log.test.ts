import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/backend/lib/db", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { recordEvent } from "@/lib/audit-log";
import { prisma } from "@/backend/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recordEvent", () => {
  it("writes a row with required fields", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    await recordEvent({
      type:    "shipment.created",
      message: "user added MAEU9184879",
      userId:  "user_xyz",
      metadata: { trackingNumber: "MAEU9184879" },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        type:     "shipment.created",
        level:    "info",
        message:  "user added MAEU9184879",
        userId:   "user_xyz",
        metadata: { trackingNumber: "MAEU9184879" },
      },
    });
  });

  it("defaults level to 'info' when omitted", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
    await recordEvent({ type: "user.signed_up", message: "first login" });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ level: "info" }) }),
    );
  });

  it("respects an explicit level", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
    await recordEvent({ type: "tracking.poll_failed", level: "error", message: "boom" });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ level: "error" }) }),
    );
  });

  it("never throws when the DB write fails", async () => {
    vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error("connection lost"));
    await expect(
      recordEvent({ type: "shipment.created", message: "x" }),
    ).resolves.toBeUndefined();
  });
});
