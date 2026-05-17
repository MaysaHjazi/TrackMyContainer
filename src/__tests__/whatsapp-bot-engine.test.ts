import { describe, it, expect } from "vitest";
import { runBot } from "@/backend/services/whatsapp-bot/bot-engine";

const base = { savedShipments: [], track: undefined };

describe("runBot (English-only)", () => {
  it("greeting → 2 English buttons", () => {
    const r = runBot({ state: "MAIN", text: "hello", ...base });
    expect(r.nextState).toBe("MAIN");
    expect(r.replies[0].type).toBe("buttons");
    expect(r.replies[0].buttons!.map((b) => b.id)).toEqual(["TRACK", "ADD"]);
    expect(r.replies[0].buttons!.map((b) => b.title)).toEqual([
      "📦 Track shipment",
      "➕ Add shipment",
    ]);
  });

  it("unknown / Arabic text still → English menu (no language switch)", () => {
    const r = runBot({ state: "MAIN", text: "مرحبا", ...base });
    expect(r.lang).toBe("en");
    expect(r.replies[0].type).toBe("buttons");
    expect(r.replies[0].buttons!.map((b) => b.title)).toEqual([
      "📦 Track shipment",
      "➕ Add shipment",
    ]);
  });

  it("TRACK button → ask for number, state AWAIT_TRACK", () => {
    const r = runBot({ state: "MAIN", text: "TRACK", ...base });
    expect(r.nextState).toBe("AWAIT_TRACK");
    expect(r.replies[0].type).toBe("text");
    expect(r.replies[0].body).toContain("Send the shipment or container number");
  });

  it("ADD button → ask for number, state AWAIT_SAVE", () => {
    const r = runBot({ state: "MAIN", text: "ADD", ...base });
    expect(r.nextState).toBe("AWAIT_SAVE");
    expect(r.replies[0].body).toContain("save for follow-up");
  });

  it("AWAIT_TRACK + found → formatted status, back to MAIN", () => {
    const r = runBot({
      state: "AWAIT_TRACK",
      text: "MRKU4711130",
      savedShipments: [],
      track: {
        found: true,
        trackingNumber: "MRKU4711130",
        status: "Arrived at Jeddah Port",
        updatedAt: "Today 3:42 PM",
        eta: "May 18",
      },
    });
    expect(r.nextState).toBe("MAIN");
    expect(r.replies[0].body).toContain("Shipment details");
    expect(r.replies[0].body).toContain("MRKU4711130");
    expect(r.replies[0].body).toContain("Arrived at Jeddah Port");
  });

  it("AWAIT_TRACK + not found → friendly error, MAIN", () => {
    const r = runBot({
      state: "AWAIT_TRACK",
      text: "BAD1",
      savedShipments: [],
      track: { found: false },
    });
    expect(r.nextState).toBe("MAIN");
    expect(r.replies[0].body).toContain("couldn't find that shipment");
  });

  it("AWAIT_SAVE + valid → success copy + SAVE action", () => {
    const r = runBot({
      state: "AWAIT_SAVE",
      text: "CAIU2444270",
      savedShipments: [],
      track: { found: true, trackingNumber: "CAIU2444270", status: "x" },
    });
    expect(r.nextState).toBe("MAIN");
    expect(r.action).toEqual({ kind: "SAVE", trackingNumber: "CAIU2444270" });
    expect(r.replies[0].body).toContain("Shipment saved");
  });

  it("keyword saved → list", () => {
    const r = runBot({
      state: "MAIN",
      text: "saved",
      savedShipments: [{ trackingNumber: "MRKU4711130", lastStatus: "In transit" }],
      track: undefined,
    });
    expect(r.replies[0].body.toLowerCase()).toContain("your saved shipments");
    expect(r.replies[0].body).toContain("MRKU4711130");
  });

  it("keyword support → support info", () => {
    const r = runBot({ state: "MAIN", text: "support", ...base });
    expect(r.replies[0].body.toLowerCase()).toContain("support team");
  });

  it("junk → menu only", () => {
    const r = runBot({ state: "MAIN", text: "asdkjh", ...base });
    expect(r.replies.length).toBe(1);
    expect(r.replies[0].type).toBe("buttons");
  });
});
