/**
 * External Existence Check — Layer E.
 *
 * BEFORE we ask ShipsGo to create a tracking record (which costs 1 credit
 * regardless of whether data ever materializes), we ask one of our FREE
 * providers if the shipment exists out there in the real world.
 *
 *   FOUND     → real shipment, ShipsGo create is justified
 *   NOT_FOUND → carrier explicitly said this number does not exist
 *               → block the ShipsGo create unless user overrides
 *   UNKNOWN   → free provider couldn't speak (no key, timeout, no coverage)
 *               → fall through to user confirmation as before
 *
 * Coverage:
 *   - SEA: JsonCargo (most major ocean carriers)
 *   - AIR + 020 prefix: Lufthansa Cargo
 *   - AIR + 157 prefix: Qatar Airways Cargo
 *   - Other AIR airlines (Emirates, FedEx, etc.): UNKNOWN — no free check
 */
import type { ShipmentType } from "@prisma/client";
import { JsonCargoProvider }       from "./providers/jsoncargo";
import { LufthansaCargoProvider }  from "./providers/lufthansa";
import { QatarAirwaysCargoProvider } from "./providers/qatar";
import { MaerskProvider }          from "./providers/maersk";
import type { TrackingProvider, ProviderResult } from "./providers/types";

export type ExternalCheckResult = "FOUND" | "NOT_FOUND" | "UNKNOWN";

const NOT_FOUND_PATTERNS = [
  /not\s*found/i,
  /no\s*data/i,
  /does\s*not\s*exist/i,
  /invalid\s*(number|tracking|awb|container)/i,
  /no\s*shipment/i,
  /unknown\s*(awb|container)/i,
];

function classify(result: ProviderResult): ExternalCheckResult {
  if (result.success && result.events.length > 0) return "FOUND";
  // Provider responded with a definitive negative
  if (result.error && NOT_FOUND_PATTERNS.some((re) => re.test(result.error!))) {
    return "NOT_FOUND";
  }
  // Empty success or vague error — we genuinely don't know
  return "UNKNOWN";
}

async function tryProvider(
  provider: TrackingProvider,
  trackingNumber: string,
  type: ShipmentType,
  label: string,
): Promise<ExternalCheckResult> {
  if (!provider.supports.includes(type)) return "UNKNOWN";
  try {
    // Race against a 12s timeout — don't make the user wait if a free
    // provider is slow. ShipsGo confirmation can still be reached.
    const result = await Promise.race<ProviderResult>([
      provider.track(trackingNumber, type),
      new Promise<ProviderResult>((resolve) =>
        setTimeout(() => resolve({
          success:        false,
          provider:       provider.name,
          trackingNumber,
          events:         [],
          error:          "external_check_timeout",
        }), 12_000),
      ),
    ]);
    const verdict = classify(result);
    console.log(`[external-check] ${label} for ${trackingNumber}: ${verdict} (${result.error ?? "ok"})`);
    return verdict;
  } catch (err) {
    console.warn(`[external-check] ${label} threw for ${trackingNumber}:`, err);
    return "UNKNOWN";
  }
}

export async function externalExistenceCheck(
  trackingNumber: string,
  type: ShipmentType,
  carrierCode: string | null,
): Promise<ExternalCheckResult> {
  if (type === "AIR") {
    if (carrierCode === "020") {
      return tryProvider(new LufthansaCargoProvider(), trackingNumber, type, "lufthansa");
    }
    if (carrierCode === "157") {
      return tryProvider(new QatarAirwaysCargoProvider(), trackingNumber, type, "qatar");
    }
    // Other airlines have no free verification path
    console.log(`[external-check] no coverage for AIR carrier=${carrierCode} (${trackingNumber})`);
    return "UNKNOWN";
  }

  // SEA — try our free providers in order, FIRST one to FIND wins.
  //
  // 1. Maersk Track & Trace (free, 100k calls/month)
  //    Activates the moment MAERSK_CONSUMER_KEY is set in env.
  //    Critical for leased-container prefixes (CAIU, TRIU, BEAU, ...)
  //    that JSONCargo can't resolve without a carrier hint.
  //
  // 2. JSONCargo MARINER (1k calls/month)
  //    Falls back when Maersk isn't configured or the container is
  //    on a non-Maersk carrier.
  //
  // We short-circuit on the first FOUND, but a NOT_FOUND from one
  // source is NOT enough to block — the next source may know the
  // shipment. Only block when EVERY source we tried said NOT_FOUND
  // or all returned UNKNOWN.
  const verdicts: ExternalCheckResult[] = [];

  if (process.env.MAERSK_CONSUMER_KEY) {
    const v = await tryProvider(new MaerskProvider(), trackingNumber, type, "maersk");
    if (v === "FOUND") return "FOUND";
    verdicts.push(v);
  }

  const v = await tryProvider(new JsonCargoProvider(), trackingNumber, type, "jsoncargo");
  if (v === "FOUND") return "FOUND";
  verdicts.push(v);

  // No source said FOUND. Prefer NOT_FOUND only if EVERY source
  // we asked agreed on it; otherwise return UNKNOWN so the user
  // sees the gentler "carrier not covered" message rather than
  // a wrong "doesn't exist" claim.
  return verdicts.every((x) => x === "NOT_FOUND") ? "NOT_FOUND" : "UNKNOWN";
}
