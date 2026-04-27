/**
 * ─────────────────────────────────────────────────────────────
 * TrackMyContainer.ai — Core Tracking Orchestrator
 * ─────────────────────────────────────────────────────────────
 *
 * Active providers:
 *   AIR  → Lufthansa Cargo (020-prefix)  — free, direct API
 *   AIR  → Qatar Airways Cargo (157-prefix) — free, OAuth2
 *
 * Pending (keys not yet configured):
 *   SEA  → JSONCargo  (ocean containers)
 *   AIR  → CargoAi   (other airlines fallback)
 *
 * Flow:
 *  1. Parse & validate the tracking identifier
 *  2. Check Redis cache (30min TTL)
 *  3. Try preferred provider → fallbacks in order
 *  4. Normalize events to unified ShipmentStatus
 *  5. Cache result
 *  6. Return TrackingResult
 */

import type { ShipmentType } from "@prisma/client";
import type { TrackingResult, TrackingProvider } from "./providers/types";
import { parseTrackingIdentifier }             from "./identifier-parser";
import { normalizeStatus }                     from "./normalizer";
import { getCachedTracking, setCachedTracking } from "./cache";
import { LufthansaCargoProvider }              from "./providers/lufthansa";
import { QatarAirwaysCargoProvider }           from "./providers/qatar";
import { JsonCargoProvider }                   from "./providers/jsoncargo";
import { ShipsgoProvider }                     from "./providers/shipsgo";

// ── Provider registry ─────────────────────────────────────────
/**
 * Loose match for location strings — providers return "CASABLANCA",
 * "Casablanca, MA", "Casablanca Port", etc. We strip non-letters and
 * check substring either way.
 */
function locationsMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

function getProvider(name: string): TrackingProvider | null {
  switch (name) {
    case "lufthansa":
      return process.env.LUFTHANSA_CARGO_API_KEY ? new LufthansaCargoProvider() : null;
    case "qatar":
      return (process.env.QATAR_CARGO_CLIENT_ID && process.env.QATAR_CARGO_CLIENT_SECRET)
        ? new QatarAirwaysCargoProvider()
        : null;
    case "jsoncargo":
      return process.env.JSONCARGO_API_KEY ? new JsonCargoProvider() : null;
    case "shipsgo":
      return process.env.SHIPSGO_API_KEY ? new ShipsgoProvider() : null;
    // ── Placeholder — wire up once key is ready ────────────────
    // case "cargoai":
    //   return process.env.CARGOAI_API_KEY ? new CargoAiProvider() : null;
    default:
      return null;
  }
}

// ── Main export ───────────────────────────────────────────────
export async function trackShipment(
  rawInput: string,
  options: { skipCache?: boolean; forceProvider?: string } = {},
): Promise<TrackingResult> {

  // 1. Parse identifier
  const parsed = parseTrackingIdentifier(rawInput);
  if (!parsed.valid) {
    throw new TrackingError(parsed.error ?? "Invalid tracking number", "INVALID_INPUT");
  }

  const {
    normalized,
    type,
    carrierCode,
    carrierName,
    preferredProvider,
    fallbackProviders,
  } = parsed;

  // 2. Cache check (skip when forceProvider is set — caller wants specific fresh data)
  if (!options.skipCache && !options.forceProvider) {
    const cached = await getCachedTracking(normalized);
    if (cached) return cached;
  }

  // 3. Build provider chain — if forceProvider is set, use it exclusively
  const chain = options.forceProvider
    ? [options.forceProvider]
    : [...new Set([preferredProvider, ...fallbackProviders])].filter(Boolean);

  let lastError: string | null = null;

  for (const providerName of chain) {
    const provider = getProvider(providerName);
    if (!provider) {
      console.log(`[tracking] Skipping "${providerName}" — not configured`);
      continue;
    }
    if (!provider.supports.includes(type)) continue;

    try {
      const result = await provider.track(normalized, type);

      if (result.success && result.events.length > 0) {
        const normalizedEvents = result.events.map((e) => ({
          status:      normalizeStatus(e.rawStatus, providerName),
          location:    e.location,
          description: e.description,
          eventDate:   e.timestamp,
          source:      providerName,
        }));

        // Determine currentStatus from events that actually happened.
        // ShipsGo (and others) include scheduled future events — using
        // them for "current" status would lie to the user.
        const now = new Date();
        const pastEvents   = normalizedEvents.filter((e) => e.eventDate <= now);
        const latestEvent  = pastEvents.at(-1) ?? normalizedEvents.at(0);
        let currentStatus  = latestEvent?.status ?? "UNKNOWN";

        // AT_PORT at any non-destination port is transshipment, not arrival.
        // Without this, a container sitting at an intermediate port (e.g.
        // Algeciras while routing Shanghai→Casablanca) shows as "Arrived".
        if (
          currentStatus === "AT_PORT" &&
          result.destination &&
          latestEvent?.location &&
          !locationsMatch(latestEvent.location, result.destination)
        ) {
          currentStatus = "TRANSSHIPMENT";
        }

        const trackingResult: TrackingResult = {
          trackingNumber:  normalized,
          type,
          carrier:         result.carrier ?? carrierName ?? undefined,
          carrierCode:     carrierCode ?? undefined,
          currentStatus,
          currentLocation: latestEvent?.location,
          origin:          result.origin,
          destination:     result.destination,
          etaDate:         result.eta,
          etdDate:         result.etd,
          atdDate:         result.atd,
          ataDate:         result.ata,
          vesselName:      result.vessel,
          voyageNumber:    result.voyage,
          flightNumber:    result.flight,
          events:          normalizedEvents,
          provider:        providerName,
          polledAt:        new Date(),
        };

        await setCachedTracking(normalized, trackingResult);
        return trackingResult;
      }

      lastError = result.error ?? `${providerName} returned no events`;
      console.warn(`[tracking] ${providerName} failed: ${lastError}`);
    } catch (err) {
      lastError = err instanceof Error ? err.message : `${providerName} threw an error`;
      console.error(`[tracking] ${providerName} threw:`, lastError);
    }
  }

  // 4. All providers exhausted — surface the most specific error we got.
  // If a provider gave a clear "not found" / "invalid" reason, use it;
  // otherwise fall back to a generic hint.
  const specificFromProvider =
    lastError && /not exist|not found|invalid|check.*number|proper format/i.test(lastError)
      ? lastError
      : null;

  // Avoid double-mentioning the tracking number if the provider already included it
  if (specificFromProvider) {
    throw new TrackingError(specificFromProvider, "NO_DATA");
  }

  const hint =
    type === "SEA"
      ? "Container not found in any carrier database. Verify the number is typed correctly — it may also be too new for the carrier to report yet."
      : "AWB not found. Verify the number is typed correctly (3-digit airline prefix + 8-digit serial, e.g. 176-12345678) — it may also be too new for the airline to report yet.";

  throw new TrackingError(
    `No tracking data for ${normalized}. ${hint}`,
    "NO_DATA",
  );
}

// ── Custom error ──────────────────────────────────────────────
export class TrackingError extends Error {
  constructor(
    message: string,
    public readonly code: "INVALID_INPUT" | "NO_DATA" | "RATE_LIMITED" | "PROVIDER_ERROR",
  ) {
    super(message);
    this.name = "TrackingError";
  }
}
