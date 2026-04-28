import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/backend/lib/db", () => ({
  prisma: {
    user:     { update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/backend/lib/db";

const originalEnv = process.env.ADMIN_EMAILS;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAILS = "owner@example.com,helper@example.com";
});

afterEach(() => {
  process.env.ADMIN_EMAILS = originalEnv;
});

function fakeUser(over: Partial<{ id: string; email: string; role: "USER" | "ADMIN" }> = {}) {
  return {
    id:    "u1",
    email: "owner@example.com",
    role:  "USER" as const,
    ...over,
  };
}

describe("isAdmin", () => {
  it("returns true for an email listed in ADMIN_EMAILS", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    expect(await isAdmin(fakeUser())).toBe(true);
  });

  it("auto-promotes the user to ADMIN role on the first allow", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    await isAdmin(fakeUser({ role: "USER" }));
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data:  { role: "ADMIN" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("does not re-promote a user who is already ADMIN", async () => {
    await isAdmin(fakeUser({ role: "ADMIN" }));
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("returns true for a USER whose role is ADMIN even if not in env list", async () => {
    process.env.ADMIN_EMAILS = "someone-else@example.com";
    expect(await isAdmin(fakeUser({ email: "x@x.com", role: "ADMIN" }))).toBe(true);
  });

  it("returns false otherwise", async () => {
    process.env.ADMIN_EMAILS = "someone-else@example.com";
    expect(await isAdmin(fakeUser({ email: "x@x.com", role: "USER" }))).toBe(false);
  });

  it("matches emails case-insensitively and trims whitespace", async () => {
    process.env.ADMIN_EMAILS = " Owner@Example.com , Helper@Example.com ";
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    expect(await isAdmin(fakeUser({ email: "OWNER@EXAMPLE.COM" }))).toBe(true);
  });
});
