import type { ShipmentType } from "@prisma/client";
import {
  detectIdentifierType,
  getSeaCarrier,
  getAirCarrier,
  normalizeContainerNumber,
  normalizeAWBNumber,
  isValidAWBCheckDigit,
  isValidContainerCheckDigit,
} from "@/config/carriers";

export interface ParsedIdentifier {
  type:            ShipmentType;
  normalized:      string;        // Clean, normalized tracking number
  carrierCode:     string | null; // e.g. "MAEU" or "157"
  carrierName:     string | null; // e.g. "Maersk" or "Emirates SkyCargo"
  preferredProvider: string;      // First provider to try
  fallbackProviders: string[];    // Fallback chain
  valid:           boolean;
  error?:          string;
}

/**
 * Parses a raw tracking number input and returns a structured
 * ParsedIdentifier with carrier detection and provider routing.
 */
export function parseTrackingIdentifier(input: string): ParsedIdentifier {
  if (!input?.trim()) {
    return invalid("Tracking number cannot be empty");
  }

  const raw  = input.trim();
  const type = detectIdentifierType(raw);

  if (type === "UNKNOWN") {
    // Distinguish "wrong format" from "right format but invalid check digit".
    // The latter is the most common cause of ShipsGo credit waste: users
    // typing test/placeholder numbers like 176-12345678 (sequential), or
    // a real number with one digit wrong. We catch both before the
    // request ever reaches ShipsGo.
    const cleanContainer = raw.trim().toUpperCase().replace(/[\s-]/g, "");
    const looksLikeContainer = /^[A-Z]{4}\d{7}$/i.test(cleanContainer);
    const looksLikeAWB       = /^\d{3}-?\d{8}$/.test(raw.trim());

    if (looksLikeContainer && !isValidContainerCheckDigit(cleanContainer)) {
      return invalid(
        `Container number "${raw}" has an invalid check digit. ` +
        `The last digit must match the ISO 6346 checksum — please verify the number is typed correctly.`
      );
    }
    if (looksLikeAWB && !isValidAWBCheckDigit(raw.trim())) {
      return invalid(
        `AWB "${raw}" has an invalid check digit. ` +
        `The last digit of the 8-digit serial must equal (first 7 digits) mod 7 — please verify the number.`
      );
    }
    return invalid(
      `"${raw}" doesn't match a known container number (e.g. MAEU1234567) ` +
      `or air waybill format (e.g. 157-12345678). Please check and try again.`
    );
  }

  if (type === "SEA") {
    const normalized = normalizeContainerNumber(raw);
    const carrier    = getSeaCarrier(normalized);

    // JSONCargo is our ocean provider (pending key setup).
    // Maersk direct API is tried first ONLY for Maersk containers when configured.
    const preferredProvider  = carrier?.preferredProvider ?? "jsoncargo";
    const fallbackProviders  = buildSeaFallbacks(preferredProvider);

    return {
      type:              "SEA",
      normalized,
      carrierCode:       carrier?.code       ?? null,
      carrierName:       carrier?.name       ?? null,
      preferredProvider,
      fallbackProviders,
      valid: true,
    };
  }

  // AIR
  const normalized = normalizeAWBNumber(raw);
  const carrier    = getAirCarrier(raw);

  return {
    type:              "AIR",
    normalized,
    carrierCode:       carrier?.code ?? null,
    carrierName:       carrier?.name ?? null,
    preferredProvider: carrier?.preferredProvider ?? "cargoai",
    fallbackProviders: ["lufthansa", "qatar"],
    valid: true,
  };
}

// ── Helpers ───────────────────────────────────────────────────

function invalid(error: string): ParsedIdentifier {
  return {
    type:              "SEA",  // placeholder
    normalized:        "",
    carrierCode:       null,
    carrierName:       null,
    preferredProvider: "",
    fallbackProviders: [],
    valid: false,
    error,
  };
}

function buildSeaFallbacks(preferred: string): string[] {
  // Fallback order: JSONCargo → Maersk direct (for Maersk containers only)
  const allProviders = ["jsoncargo", "maersk"];
  return allProviders.filter((p) => p !== preferred);
}
