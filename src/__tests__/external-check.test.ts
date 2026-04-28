import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the providers BEFORE importing externalExistenceCheck
vi.mock("@/backend/services/tracking/providers/jsoncargo", () => ({
  JsonCargoProvider: vi.fn().mockImplementation(() => ({
    name:     "jsoncargo",
    supports: ["SEA"],
    track:    vi.fn(),
  })),
}));

vi.mock("@/backend/services/tracking/providers/lufthansa", () => ({
  LufthansaCargoProvider: vi.fn().mockImplementation(() => ({
    name:     "lufthansa",
    supports: ["AIR"],
    track:    vi.fn(),
  })),
}));

vi.mock("@/backend/services/tracking/providers/qatar", () => ({
  QatarAirwaysCargoProvider: vi.fn().mockImplementation(() => ({
    name:     "qatar",
    supports: ["AIR"],
    track:    vi.fn(),
  })),
}));

import { externalExistenceCheck } from "@/backend/services/tracking/external-check";
import { JsonCargoProvider }      from "@/backend/services/tracking/providers/jsoncargo";
import { LufthansaCargoProvider } from "@/backend/services/tracking/providers/lufthansa";
import { QatarAirwaysCargoProvider } from "@/backend/services/tracking/providers/qatar";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("externalExistenceCheck — SEA", () => {
  it("returns FOUND when JsonCargo has events", async () => {
    const trackMock = vi.fn().mockResolvedValue({
      success: true,
      provider: "jsoncargo",
      trackingNumber: "MAEU9184879",
      events: [{ rawStatus: "LOAD", location: "NINGBO", description: "Loaded", timestamp: new Date() }],
    });
    vi.mocked(JsonCargoProvider).mockImplementation(() => ({
      name: "jsoncargo", supports: ["SEA"], track: trackMock,
    }) as never);

    const result = await externalExistenceCheck("MAEU9184879", "SEA", "MAEU");
    expect(result).toBe("FOUND");
  });

  it("returns NOT_FOUND when JsonCargo says not found", async () => {
    vi.mocked(JsonCargoProvider).mockImplementation(() => ({
      name: "jsoncargo", supports: ["SEA"],
      track: vi.fn().mockResolvedValue({
        success: false,
        provider: "jsoncargo",
        trackingNumber: "MSCU0000001",
        events: [],
        error: "Container not found in carrier database",
      }),
    }) as never);

    const result = await externalExistenceCheck("MSCU0000001", "SEA", "MSCU");
    expect(result).toBe("NOT_FOUND");
  });

  it("returns UNKNOWN on a vague error", async () => {
    vi.mocked(JsonCargoProvider).mockImplementation(() => ({
      name: "jsoncargo", supports: ["SEA"],
      track: vi.fn().mockResolvedValue({
        success: false,
        provider: "jsoncargo",
        trackingNumber: "MAEU1234567",
        events: [],
        error: "request failed: 503",
      }),
    }) as never);

    const result = await externalExistenceCheck("MAEU1234567", "SEA", "MAEU");
    expect(result).toBe("UNKNOWN");
  });

  it("returns UNKNOWN when the provider throws", async () => {
    vi.mocked(JsonCargoProvider).mockImplementation(() => ({
      name: "jsoncargo", supports: ["SEA"],
      track: vi.fn().mockRejectedValue(new Error("network down")),
    }) as never);

    const result = await externalExistenceCheck("MAEU1234567", "SEA", "MAEU");
    expect(result).toBe("UNKNOWN");
  });
});

describe("externalExistenceCheck — AIR", () => {
  it("uses Lufthansa for 020- prefix and returns FOUND", async () => {
    vi.mocked(LufthansaCargoProvider).mockImplementation(() => ({
      name: "lufthansa", supports: ["AIR"],
      track: vi.fn().mockResolvedValue({
        success: true,
        provider: "lufthansa",
        trackingNumber: "020-12345675",
        events: [{ rawStatus: "RCS", location: "FRA", description: "Received", timestamp: new Date() }],
      }),
    }) as never);

    const result = await externalExistenceCheck("020-12345675", "AIR", "020");
    expect(result).toBe("FOUND");
  });

  it("uses Qatar for 157- prefix and returns NOT_FOUND when carrier rejects", async () => {
    vi.mocked(QatarAirwaysCargoProvider).mockImplementation(() => ({
      name: "qatar", supports: ["AIR"],
      track: vi.fn().mockResolvedValue({
        success: false,
        provider: "qatar",
        trackingNumber: "157-99999992",
        events: [],
        error: "AWB does not exist",
      }),
    }) as never);

    const result = await externalExistenceCheck("157-99999992", "AIR", "157");
    expect(result).toBe("NOT_FOUND");
  });

  it("returns UNKNOWN for airlines without free coverage (Emirates 176)", async () => {
    const result = await externalExistenceCheck("176-12345678", "AIR", "176");
    expect(result).toBe("UNKNOWN");
  });

  it("returns UNKNOWN for FedEx 023", async () => {
    const result = await externalExistenceCheck("023-12345678", "AIR", "023");
    expect(result).toBe("UNKNOWN");
  });
});
