/**
 * Carrier prefix configuration.
 * Containers follow ISO 6346: 4-letter owner code + 6 digits + check digit.
 * AWB numbers: 3-digit airline code prefix.
 */

export interface CarrierInfo {
  code: string;       // SCAC (sea) or IATA numeric prefix (air)
  name: string;
  type: "SEA" | "AIR";
  logo?: string;      // URL or local path
  preferredProvider: string;  // Which tracking provider to try first
  websiteUrl?: string;
}

// ── Sea Carriers (top 30 by volume) ──────────────────────────
export const SEA_CARRIERS: Record<string, CarrierInfo> = {
  // Container prefix → carrier
  MAEU: { code: "MAEU", name: "Maersk",          type: "SEA", preferredProvider: "maersk",   websiteUrl: "https://www.maersk.com" },
  MRKU: { code: "MRKU", name: "Maersk",          type: "SEA", preferredProvider: "maersk",   websiteUrl: "https://www.maersk.com" },
  MSKU: { code: "MSKU", name: "MSC",             type: "SEA", preferredProvider: "jsoncargo",  websiteUrl: "https://www.msc.com" },
  MSCU: { code: "MSCU", name: "MSC",             type: "SEA", preferredProvider: "jsoncargo",  websiteUrl: "https://www.msc.com" },
  CMAU: { code: "CMAU", name: "CMA CGM",         type: "SEA", preferredProvider: "jsoncargo",  websiteUrl: "https://www.cma-cgm.com" },
  CGMU: { code: "CGMU", name: "CMA CGM",         type: "SEA", preferredProvider: "jsoncargo",  websiteUrl: "https://www.cma-cgm.com" },
  HLCU: { code: "HLCU", name: "Hapag-Lloyd",     type: "SEA", preferredProvider: "jsoncargo",  websiteUrl: "https://www.hapag-lloyd.com" },
  HLXU: { code: "HLXU", name: "Hapag-Lloyd",     type: "SEA", preferredProvider: "jsoncargo",  websiteUrl: "https://www.hapag-lloyd.com" },
  COSU: { code: "COSU", name: "COSCO",           type: "SEA", preferredProvider: "jsoncargo",  websiteUrl: "https://www.cosco.com" },
  CCLU: { code: "CCLU", name: "COSCO",           type: "SEA", preferredProvider: "jsoncargo",  websiteUrl: "https://www.cosco.com" },
  EISU: { code: "EISU", name: "Evergreen",       type: "SEA", preferredProvider: "jsoncargo",  websiteUrl: "https://www.evergreen-line.com" },
  EMCU: { code: "EMCU", name: "Evergreen",       type: "SEA", preferredProvider: "jsoncargo",  websiteUrl: "https://www.evergreen-line.com" },
  YMLU: { code: "YMLU", name: "Yang Ming",       type: "SEA", preferredProvider: "jsoncargo",  websiteUrl: "https://www.yangming.com" },
  YMMU: { code: "YMMU", name: "Yang Ming",       type: "SEA", preferredProvider: "jsoncargo",  websiteUrl: "https://www.yangming.com" },
  HDMU: { code: "HDMU", name: "HMM",             type: "SEA", preferredProvider: "jsoncargo",  websiteUrl: "https://www.hmm21.com" },
  ZIMU: { code: "ZIMU", name: "ZIM",             type: "SEA", preferredProvider: "jsoncargo",  websiteUrl: "https://www.zim.com" },
  PILU: { code: "PILU", name: "PIL",             type: "SEA", preferredProvider: "jsoncargo",  websiteUrl: "https://www.pilship.com" },
  WHLU: { code: "WHLУ", name: "Wan Hai",         type: "SEA", preferredProvider: "jsoncargo",  websiteUrl: "https://www.wanhai.com" },
  MEDU: { code: "MEDU", name: "Mediterranean Shipping", type: "SEA", preferredProvider: "jsoncargo" },
  ONEY: { code: "ONEY", name: "ONE (Ocean Network Express)", type: "SEA", preferredProvider: "jsoncargo", websiteUrl: "https://www.one-line.com" },
};

// ── Air Carriers (IATA numeric prefix → airline) ──────────────
export const AIR_CARRIERS: Record<string, CarrierInfo> = {
  // ── Providers with active API keys ─────────────────────────
  "020": { code: "020", name: "Lufthansa Cargo",         type: "AIR", preferredProvider: "lufthansa" },
  "157": { code: "157", name: "Qatar Airways Cargo",     type: "AIR", preferredProvider: "qatar"     },

  // ── Providers pending (CargoAi will cover these once wired) ─
  "023": { code: "023", name: "Atlas Air",               type: "AIR", preferredProvider: "cargoai" },
  "057": { code: "057", name: "Air France Cargo",        type: "AIR", preferredProvider: "cargoai" },
  "074": { code: "074", name: "KLM Cargo",               type: "AIR", preferredProvider: "cargoai" },
  "098": { code: "098", name: "China Airlines Cargo",    type: "AIR", preferredProvider: "cargoai" },
  "106": { code: "106", name: "American Airlines Cargo", type: "AIR", preferredProvider: "cargoai" },
  "125": { code: "125", name: "British Airways Cargo",   type: "AIR", preferredProvider: "cargoai" },
  "160": { code: "160", name: "Cathay Pacific Cargo",    type: "AIR", preferredProvider: "cargoai" },
  "172": { code: "172", name: "Emirates SkyCargo",       type: "AIR", preferredProvider: "cargoai" },
  "180": { code: "180", name: "Korean Air Cargo",        type: "AIR", preferredProvider: "cargoai" },
  "205": { code: "205", name: "FedEx Express",           type: "AIR", preferredProvider: "cargoai" },
  "232": { code: "232", name: "UPS Airlines",            type: "AIR", preferredProvider: "cargoai" },
  "235": { code: "235", name: "Turkish Airlines Cargo",  type: "AIR", preferredProvider: "cargoai" },
  "369": { code: "369", name: "Ethiopian Airlines Cargo",type: "AIR", preferredProvider: "cargoai" },
  "406": { code: "406", name: "DHL Air",                 type: "AIR", preferredProvider: "cargoai" },
  "618": { code: "618", name: "China Cargo Airlines",    type: "AIR", preferredProvider: "cargoai" },
  "781": { code: "781", name: "Singapore Airlines Cargo",type: "AIR", preferredProvider: "cargoai" },
  "607": { code: "607", name: "Etihad Cargo",            type: "AIR", preferredProvider: "cargoai" },
};

// ── Detector helpers ──────────────────────────────────────────

/** ISO 6346 container number: 4 letters + 7 digits (6 + check digit) */
const CONTAINER_REGEX = /^[A-Z]{4}\d{7}$/i;

/** AWB: optional 3-digit prefix + dash + 8 digits, or just 11 digits */
const AWB_REGEX = /^(\d{3})-?(\d{8})$/;

/**
 * AWB check digit per IATA Resolution 600a: the 8th digit of the serial
 * is `firstSeven mod 7`. Catches typos and obvious fakes (12345678,
 * 99999999, etc.) BEFORE we burn a ShipsGo credit creating the shipment.
 */
export function isValidAWBCheckDigit(awb: string): boolean {
  const m = awb.trim().replace(/\s/g, "").match(/^\d{3}-?(\d{7})(\d)$/);
  if (!m) return false;
  const serial = parseInt(m[1], 10);
  const check  = parseInt(m[2], 10);
  return serial % 7 === check;
}

/**
 * ISO 6346 container check digit. Each letter has a numeric value
 * (skipping multiples of 11 — A=10, B=12, ..., U=32, V=34, ...). Each
 * character's value is multiplied by 2^position, summed, mod 11
 * (10 collapses to 0). Catches typos and fake numbers (MSCU0000000,
 * AAAA1111111, etc.) before they hit ShipsGo.
 */
const CONTAINER_LETTER_VALUE: Record<string, number> = {
  A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20,
  K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31,
  U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
};

export function isValidContainerCheckDigit(num: string): boolean {
  const clean = num.trim().toUpperCase().replace(/[\s-]/g, "");
  if (!CONTAINER_REGEX.test(clean)) return false;

  const letters = clean.slice(0, 4);
  const digits  = clean.slice(4, 10);
  const check   = parseInt(clean[10], 10);
  if (isNaN(check)) return false;

  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const v = CONTAINER_LETTER_VALUE[letters[i]];
    if (v === undefined) return false;
    sum += v * (1 << i);  // 2^i
  }
  for (let i = 0; i < 6; i++) {
    sum += parseInt(digits[i], 10) * (1 << (i + 4));
  }
  const mod = sum % 11 % 10;
  return mod === check;
}

export function detectIdentifierType(input: string): "SEA" | "AIR" | "UNKNOWN" {
  const clean = input.trim().toUpperCase().replace(/[\s-]/g, "");
  if (CONTAINER_REGEX.test(clean)) {
    // Format match — but require valid check digit so we don't burn
    // ShipsGo credits on typos and obviously-fake test numbers.
    return isValidContainerCheckDigit(clean) ? "SEA" : "UNKNOWN";
  }
  if (AWB_REGEX.test(input.trim())) {
    return isValidAWBCheckDigit(input.trim()) ? "AIR" : "UNKNOWN";
  }
  return "UNKNOWN";
}

export function getSeaCarrier(containerNumber: string): CarrierInfo | null {
  const prefix = containerNumber.trim().toUpperCase().slice(0, 4);
  return SEA_CARRIERS[prefix] ?? null;
}

export function getAirCarrier(awbNumber: string): CarrierInfo | null {
  const match = awbNumber.trim().match(/^(\d{3})/);
  if (!match) return null;
  return AIR_CARRIERS[match[1]] ?? null;
}

export function normalizeContainerNumber(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function normalizeAWBNumber(input: string): string {
  const clean = input.trim().replace(/[\s]/g, "");
  // Ensure format: XXX-XXXXXXXX
  const match = clean.match(/^(\d{3})-?(\d{8})$/);
  if (match) return `${match[1]}-${match[2]}`;
  return clean;
}
