import type { ShipmentType } from "@prisma/client";
import {
  detectIdentifierType,
  getSeaCarrier,
  getAirCarrier,
  normalizeContainerNumber,
  normalizeAWBNumber,
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
