import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Prisma ────────────────────────────────────────────────
vi.mock("@/backend/lib/db", () => ({
  prisma: {
    contactRequest: { create: vi.fn() },
  },
}));

// ── Mock Resend ────────────────────────────────────────────────
const mockSendEmail = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSendEmail },
  })),
}));

import { prisma } from "@/backend/lib/db";
import { POST } from "@/app/api/contact/route";
import { NextRequest } from "next/server";

const mockPrisma = prisma as unknown as {
  contactRequest: { create: ReturnType<typeof vi.fn> };
};

// Helper to build a NextRequest with a JSON body
function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Ensure RESEND_API_KEY is unset by default so email is skipped
  delete process.env.RESEND_API_KEY;
  delete process.env.ADMIN_EMAIL;
});

describe("POST /api/contact", () => {
  // ── 1. Valid body ──────────────────────────────────────────
  it("creates ContactRequest in DB and returns 201", async () => {
    const fakeRecord = {
      id: "cltest123",
      name: "Alice",
      email: "alice@example.com",
      phone: "+1234567890",
      containersCount: 10,
      message: "Hello",
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.contactRequest.create.mockResolvedValue(fakeRecord);

    const req = makeRequest({
      name: "Alice",
      email: "alice@example.com",
      phone: "+1234567890",
      containersCount: 10,
      message: "Hello",
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.id).toBe("cltest123");
    expect(mockPrisma.contactRequest.create).toHaveBeenCalledOnce();
    expect(mockPrisma.contactRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Alice",
          email: "alice@example.com",
          containersCount: 10,
        }),
      }),
    );
  });

  // ── 2. Missing name ────────────────────────────────────────
  it("returns 400 when name is missing", async () => {
    const req = makeRequest({
      email: "alice@example.com",
      containersCount: 5,
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/name/i);
    expect(mockPrisma.contactRequest.create).not.toHaveBeenCalled();
  });

  // ── 3. Missing email ───────────────────────────────────────
  it("returns 400 when email is missing", async () => {
    const req = makeRequest({
      name: "Alice",
      containersCount: 5,
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/email/i);
    expect(mockPrisma.contactRequest.create).not.toHaveBeenCalled();
  });

  it("returns 400 when email has no @", async () => {
    const req = makeRequest({
      name: "Alice",
      email: "notanemail",
      containersCount: 5,
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/email/i);
  });

  // ── 4. Invalid containersCount ─────────────────────────────
  it("returns 400 when containersCount is 0", async () => {
    const req = makeRequest({
      name: "Alice",
      email: "alice@example.com",
      containersCount: 0,
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/containersCount/i);
    expect(mockPrisma.contactRequest.create).not.toHaveBeenCalled();
  });

  it("returns 400 when containersCount is negative", async () => {
    const req = makeRequest({
      name: "Alice",
      email: "alice@example.com",
      containersCount: -3,
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/containersCount/i);
  });

  it("returns 400 when containersCount is missing", async () => {
    const req = makeRequest({
      name: "Alice",
      email: "alice@example.com",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/containersCount/i);
  });

  // ── 5. DB error → 500 ─────────────────────────────────────
  it("returns 500 when the DB throws", async () => {
    mockPrisma.contactRequest.create.mockRejectedValue(new Error("DB connection failed"));

    const req = makeRequest({
      name: "Bob",
      email: "bob@example.com",
      containersCount: 3,
    });

    const res = await POST(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  // ── 6. Resend called when API key is set ──────────────────
  it("sends admin email when RESEND_API_KEY is present", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.ADMIN_EMAIL = "admin@trackmycontainer.info";

    mockPrisma.contactRequest.create.mockResolvedValue({
      id: "clxyz",
      name: "Carol",
      email: "carol@example.com",
      containersCount: 20,
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockSendEmail.mockResolvedValue({ data: { id: "email-1" }, error: null });

    const req = makeRequest({
      name: "Carol",
      email: "carol@example.com",
      containersCount: 20,
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "TrackMyContainer <noreply@trackmycontainer.info>",
        to: "admin@trackmycontainer.info",
        subject: "New Custom Plan Request from Carol",
      }),
    );
  });

  // ── 7. Resend NOT called when API key is absent ───────────
  it("skips email when RESEND_API_KEY is not set", async () => {
    mockPrisma.contactRequest.create.mockResolvedValue({
      id: "clxyz2",
      name: "Dave",
      email: "dave@example.com",
      containersCount: 1,
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = makeRequest({
      name: "Dave",
      email: "dave@example.com",
      containersCount: 1,
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // ── 8. Resend throws → still 201 (best-effort) ───────────
  it("returns 201 even when Resend throws", async () => {
    process.env.RESEND_API_KEY = "test-key";
    mockSendEmail.mockRejectedValue(new Error("Resend network error"));

    mockPrisma.contactRequest.create.mockResolvedValue({
      id: "clxyz3",
      name: "Test",
      email: "test@example.com",
      containersCount: 50,
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", email: "test@example.com", containersCount: 50 }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  // ── 9. Invalid JSON body → 400 ───────────────────────────
  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json-at-all{{{",
    });

    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  // ── 10. Float containersCount → 400 ──────────────────────
  it("returns 400 when containersCount is a float", async () => {
    const req = new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", email: "test@example.com", containersCount: 2.5 }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});
