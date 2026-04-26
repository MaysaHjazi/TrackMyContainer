import { describe, it, expect } from "vitest";
import { PLANS, getProviderForPlan } from "@/config/plans";

describe("PLANS config", () => {
  it("FREE plan uses jsoncargo and has no live tracking", () => {
    expect(PLANS.FREE.provider).toBe("jsoncargo");
    expect(PLANS.FREE.liveTracking).toBe(false);
    expect(PLANS.FREE.features.maxTrackedShipments).toBe(5);
  });

  it("PRO plan uses shipsgo and has live tracking", () => {
    expect(PLANS.PRO.provider).toBe("shipsgo");
    expect(PLANS.PRO.liveTracking).toBe(true);
    expect(PLANS.PRO.features.maxTrackedShipments).toBe(10);
    expect(PLANS.PRO.price).toBe(3500);
  });

  it("CUSTOM plan uses shipsgo and has no limit", () => {
    expect(PLANS.CUSTOM.provider).toBe("shipsgo");
    expect(PLANS.CUSTOM.liveTracking).toBe(true);
    expect(PLANS.CUSTOM.features.maxTrackedShipments).toBe(2147483647);
    expect(PLANS.CUSTOM.price).toBe(null);
  });

  it("getProviderForPlan returns correct provider", () => {
    expect(getProviderForPlan("FREE")).toBe("jsoncargo");
    expect(getProviderForPlan("PRO")).toBe("shipsgo");
    expect(getProviderForPlan("CUSTOM")).toBe("shipsgo");
  });

  it("CUSTOM replaces BUSINESS — no BUSINESS key", () => {
    expect((PLANS as Record<string, unknown>).BUSINESS).toBeUndefined();
  });
});
