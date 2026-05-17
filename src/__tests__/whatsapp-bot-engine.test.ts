import { describe, it, expect } from "vitest";
import { runBot, type BotState } from "@/backend/services/whatsapp-bot/bot-engine";

const base = { savedShipments: [], track: undefined };

describe("runBot", () => {
  it("greeting → 2 buttons, Arabic by default", () => {
    const r = runBot({ state: "MAIN", lang: "ar", text: "مرحبا", ...base });
    expect(r.nextState).toBe("MAIN");
    expect(r.replies[0].type).toBe("buttons");
    expect(r.replies[0].buttons!.map(b => b.id)).toEqual(["TRACK", "ADD"]);
    expect(r.replies[0].buttons!.map(b => b.title)).toEqual(["📦 تتبع الشحنة", "➕ إضافة شحنة"]);
  });

  it("English text → English buttons + lang switch", () => {
    const r = runBot({ state: "MAIN", lang: "ar", text: "hello", ...base });
    expect(r.lang).toBe("en");
    expect(r.replies[0].buttons!.map(b => b.title)).toEqual(["📦 Track shipment", "➕ Add shipment"]);
  });

  it("TRACK button → ask for number, state AWAIT_TRACK", () => {
    const r = runBot({ state: "MAIN", lang: "ar", text: "TRACK", ...base });
    expect(r.nextState).toBe("AWAIT_TRACK");
    expect(r.replies[0].type).toBe("text");
    expect(r.replies[0].body).toContain("أرسل رقم الشحنة");
  });

  it("ADD button → ask for number, state AWAIT_SAVE", () => {
    const r = runBot({ state: "MAIN", lang: "ar", text: "ADD", ...base });
    expect(r.nextState).toBe("AWAIT_SAVE");
    expect(r.replies[0].body).toContain("تريد حفظها");
  });

  it("AWAIT_TRACK + found → formatted status, back to MAIN", () => {
    const r = runBot({
      state: "AWAIT_TRACK", lang: "ar", text: "MRKU4711130", savedShipments: [],
      track: { found: true, trackingNumber: "MRKU4711130", status: "وصلت ميناء جدة", updatedAt: "اليوم 3:42 PM", eta: "18 مايو" },
    });
    expect(r.nextState).toBe("MAIN");
    expect(r.replies[0].body).toContain("معلومات الشحنة");
    expect(r.replies[0].body).toContain("MRKU4711130");
    expect(r.replies[0].body).toContain("وصلت ميناء جدة");
  });

  it("AWAIT_TRACK + not found → friendly error, MAIN", () => {
    const r = runBot({ state: "AWAIT_TRACK", lang: "ar", text: "BAD1", savedShipments: [], track: { found: false } });
    expect(r.nextState).toBe("MAIN");
    expect(r.replies[0].body).toContain("لم أتمكن");
  });

  it("AWAIT_SAVE + valid → success copy", () => {
    const r = runBot({ state: "AWAIT_SAVE", lang: "ar", text: "CAIU2444270", savedShipments: [], track: { found: true, trackingNumber: "CAIU2444270", status: "x" } });
    expect(r.nextState).toBe("MAIN");
    expect(r.action).toEqual({ kind: "SAVE", trackingNumber: "CAIU2444270" });
    expect(r.replies[0].body).toContain("تم حفظ الشحنة");
  });

  it("keyword محفوظة → list", () => {
    const r = runBot({ state: "MAIN", lang: "ar", text: "محفوظة",
      savedShipments: [{ trackingNumber: "MRKU4711130", lastStatus: "وصلت" }], track: undefined });
    expect(r.replies[0].body).toContain("شحناتك المحفوظة");
    expect(r.replies[0].body).toContain("MRKU4711130");
  });

  it("keyword saved (en) → English list", () => {
    const r = runBot({ state: "MAIN", lang: "en", text: "saved",
      savedShipments: [{ trackingNumber: "X1", lastStatus: "In transit" }], track: undefined });
    expect(r.replies[0].body.toLowerCase()).toContain("your saved shipments");
  });

  it("keyword دعم → support info", () => {
    const r = runBot({ state: "MAIN", lang: "ar", text: "دعم", ...base });
    expect(r.replies[0].body).toContain("الدعم");
  });
});
