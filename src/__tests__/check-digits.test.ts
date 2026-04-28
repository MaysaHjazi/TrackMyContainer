import { describe, it, expect } from "vitest";
import {
  isValidAWBCheckDigit,
  isValidContainerCheckDigit,
  detectIdentifierType,
} from "@/config/carriers";

describe("AWB check digit validation", () => {
  it("accepts a valid AWB (1234567 mod 7 = 5)", () => {
    expect(isValidAWBCheckDigit("157-12345675")).toBe(true);
  });

  it("rejects 176-12345678 (placeholder, check digit should be 5 not 8)", () => {
    expect(isValidAWBCheckDigit("176-12345678")).toBe(false);
  });

  it("rejects 176-99999999 (check digit should be 2 not 9)", () => {
    expect(isValidAWBCheckDigit("176-99999999")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isValidAWBCheckDigit("not-an-awb")).toBe(false);
    expect(isValidAWBCheckDigit("")).toBe(false);
    expect(isValidAWBCheckDigit("123-4567")).toBe(false);
  });

  it("accepts AWB without dash", () => {
    expect(isValidAWBCheckDigit("15712345675")).toBe(true);
  });
});

describe("Container check digit validation (ISO 6346)", () => {
  it("accepts a real container (MAEU9184879)", () => {
    expect(isValidContainerCheckDigit("MAEU9184879")).toBe(true);
  });

  it("accepts another real container (MSCU5165329)", () => {
    expect(isValidContainerCheckDigit("MSCU5165329")).toBe(true);
  });

  it("rejects all-zeros placeholder", () => {
    expect(isValidContainerCheckDigit("AAAA0000000")).toBe(false);
  });

  it("rejects MSCU0000001 (typical fake test)", () => {
    expect(isValidContainerCheckDigit("MSCU0000001")).toBe(false);
  });

  it("rejects MSCU1234567 (random fake)", () => {
    expect(isValidContainerCheckDigit("MSCU1234567")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isValidContainerCheckDigit("BAD-FORMAT")).toBe(false);
    expect(isValidContainerCheckDigit("")).toBe(false);
    expect(isValidContainerCheckDigit("ABCD12345")).toBe(false);
  });
});

describe("detectIdentifierType integration with check digit", () => {
  it("returns SEA for valid containers", () => {
    expect(detectIdentifierType("MAEU9184879")).toBe("SEA");
    expect(detectIdentifierType("MSCU5165329")).toBe("SEA");
  });

  it("returns AIR for valid AWBs", () => {
    expect(detectIdentifierType("157-12345675")).toBe("AIR");
  });

  it("returns UNKNOWN for valid format but bad check digit", () => {
    expect(detectIdentifierType("176-12345678")).toBe("UNKNOWN");
    expect(detectIdentifierType("MSCU1234567")).toBe("UNKNOWN");
  });

  it("returns UNKNOWN for completely malformed input", () => {
    expect(detectIdentifierType("hello world")).toBe("UNKNOWN");
    expect(detectIdentifierType("")).toBe("UNKNOWN");
  });
});
