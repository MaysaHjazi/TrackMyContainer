/**
 * JSONCargo — Ocean Container Tracking Provider
 * Docs: https://jsoncargo.com/documentation-api/
 *
 * Plan: MARINER (1000 requests/month)
 * Endpoint: GET https://api.jsoncargo.com/api/v1/containers/{container_id}
 * Auth: x-api-key header
 */

import type { ShipmentType } from "@prisma/client";
import type { TrackingProvider, ProviderResult, ProviderEvent } from "./types";

// ── Container prefix → JSONCargo shipping_line param ─────────
// Covers the top carriers supported by JSONCargo
const PREFIX_TO_SHIPPING_LINE: Record<string, string> = {
  // Maersk
  MAEU: "MAERSK", MRKU: "MAERSK", MSKU: "MAERSK", MSAU: "MAERSK",
  // MSC
  MSCU: "MSC", MEDU: "MSC",
  // CMA CGM
  CMAU: "CMA CGM", CGMU: "CMA CGM", APLU: "CMA CGM",
  // Hapag-Lloyd
  HLCU: "HAPAG-LLOYD", HLXU: "HAPAG-LLOYD", UACU: "HAPAG-LLOYD",
  // COSCO
  COSU: "COSCO", CCLU: "COSCO",
  // Evergreen
  EISU: "EVERGREEN", EMCU: "EVERGREEN", BMOU: "EVERGREEN",
  // Yang Ming
  YMLU: "YANG MING", YMMU: "YANG MING",
  // HMM
  HDMU: "HMM", HMMU: "HMM",
  // ZIM
  ZIMU: "ZIM", ZCLU: "ZIM",
  // PIL
  PILU: "PIL", PCIU: "PIL",
  // ONE
  ONEY: "ONE", NYKU: "ONE", ONEU: "ONE",
};

// ── Shipping line name → JSONCargo API format (kept for ref) ──
const SHIPPING_LINE_MAP: Record<string, string> = {
  "Maersk":                      "MAERSK",
  "MSC":                         "MSC",
  "Mediterranean Shipping":      "MSC",
  "CMA CGM":                     "CMA CGM",
  "Hapag-Lloyd":                 "HAPAG-LLOYD",
  "COSCO":                       "COSCO",
  "Evergreen":                   "EVERGREEN",
  "Yang Ming":                   "YANG MING",
  "HMM":                         "HMM",
  "ZIM":                         "ZIM",
  "PIL":                         "PIL",
  "ONE":                         "ONE",
  "ONE (Ocean Network Express)": "ONE",
  "Wan Hai":                     "WAN HAI",
};

// ── JSONCargo response type ───────────────────────────────────
interface JsonCargoResponse {
  data?: {
    container_id?:              string;
    container_type?:            string;
    container_status?:          string;
    shipping_line_name?:        string;
    shipping_line_id?:          string;
    shipped_from?:              string;
    shipped_from_terminal?:     string;
    shipped_to?:                string;
    shipped_to_terminal?:       string;
    atd_origin?:                string | null;
    eta_final_destination?:     string | null;
    last_location?:             string;
    last_location_terminal?:    string;
    next_location?:             string;
    next_location_terminal?:    string;
    atd_last_location?:         string | null;
    eta_next_destination?:      string | null;
    timestamp_of_last_location?: string | null;
    last_movement_timestamp?:   string | null;
    loading_port?:              string;
    discharging_port?:          string;
    customs_clearance?:         string | null;
    bill_of_lading?:            string;
    last_vessel_name?:          string;
    last_voyage_number?:        string;
    current_vessel_name?:       string;
    current_voyage_number?:     string;
    last_updated?:              string;
  };
  // JSONCargo returns error as an object `{ title: "..." }` on 200 when the
  // container is unknown, or occasionally as a plain string. Support both.
  error?:   string | { title?: string; detail?: string };
  message?: string;
}

// ── Date parser: handles "YYYY-MM-DD; HH:MM" and ISO formats ──
function parseJCDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  // JSONCargo uses "YYYY-MM-DD; HH:MM" format
  const normalized = raw.replace(";", "").replace(/\s+/, "T");
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

export class JsonCargoProvider implements TrackingProvider {
  readonly name     = "jsoncargo";
  readonly supports: ShipmentType[] = ["SEA"];

  private readonly apiKey  = process.env.JSONCARGO_API_KEY!;
  private readonly baseUrl = "https://api.jsoncargo.com/api/v1";

  async track(
    trackingNumber: string,
    _type: ShipmentType,
  ): Promise<ProviderResult> {

    const url = new URL(`${this.baseUrl}/containers/${encodeURIComponent(trackingNumber)}`);

    // Auto-detect shipping line from the 4-letter container prefix
    const prefix = trackingNumber.slice(0, 4).toUpperCase();
    const shippingLine = PREFIX_TO_SHIPPING_LINE[prefix];
    if (shippingLine) url.searchParams.set("shipping_line", shippingLine);

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: {
          "x-api-key": this.apiKey,
          "Accept":    "application/json",
        },
        next: { revalidate: 0 },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      return this.failure(trackingNumber, `Network error: ${(err as Error).message}`);
    }

    if (res.status === 401 || res.status === 403) {
      return this.failure(trackingNumber, "JSONCargo authentication failed — check JSONCARGO_API_KEY");
    }

    // JSONCargo returns 500 instead of 404 for containers not in their DB (server bug)
    if (res.status === 404 || res.status === 500) {
      return this.failure(trackingNumber, "Container not found in JSONCargo");
    }

    if (res.status === 400) {
      let msg = "Bad request";
      try {
        const errJson = await res.json() as { error?: { title?: string } };
        msg = errJson.error?.title ?? msg;
      } catch { /* ignore */ }
      return this.failure(trackingNumber, `JSONCargo: ${msg}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return this.failure(trackingNumber, `JSONCargo HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    let json: JsonCargoResponse;
    try {
      json = await res.json() as JsonCargoResponse;
    } catch {
      return this.failure(trackingNumber, "JSONCargo returned invalid JSON");
    }

    if (!json.data) {
      // Extract the human-readable message whether `error` came back as a
      // string or as `{ title, detail }`.
      const errMsg =
        typeof json.error === "string"
          ? json.error
          : json.error?.title ?? json.error?.detail ?? json.message ?? "No data returned";
      return this.failure(trackingNumber, errMsg);
    }

    const d = json.data;

    // ── Build synthetic events from available fields ───────────
    const events: ProviderEvent[] = [];

    // 1. Departure from origin
    const departureTime = parseJCDate(d.atd_origin);
    if (departureTime && d.shipped_from) {
      events.push({
        rawStatus:   "Departed",
        location:    d.shipped_from,
        description: `Departed from ${d.shipped_from}${d.shipped_from_terminal ? ` — ${d.shipped_from_terminal}` : ""}`,
        timestamp:   departureTime,
      });
    }

    // 2. Last known location
    const lastMovement = parseJCDate(d.timestamp_of_last_location ?? d.last_movement_timestamp ?? d.atd_last_location);
    if (lastMovement && d.last_location) {
      const isAtDest = d.last_location === d.shipped_to;
      events.push({
        rawStatus:   isAtDest ? "Arrived" : (d.container_status ?? "In Transit"),
        location:    d.last_location,
        description: `${isAtDest ? "Arrived at" : "Last seen at"} ${d.last_location}${d.last_location_terminal ? ` — ${d.last_location_terminal}` : ""}`,
        timestamp:   lastMovement,
      });
    }

    // If we have no events at all, use the current status as a fallback
    if (events.length === 0 && d.container_status) {
      events.push({
        rawStatus:   d.container_status,
        location:    d.last_location ?? d.shipped_from ?? "Unknown",
        description: d.container_status,
        timestamp:   parseJCDate(d.last_updated) ?? new Date(),
      });
    }

    if (events.length === 0) {
      return this.failure(trackingNumber, "No movement data available yet");
    }

    // ── ETA / ETD ──────────────────────────────────────────────
    const eta = parseJCDate(d.eta_final_destination);
    const etd = parseJCDate(d.atd_origin);

    return {
      success:        true,
      provider:       this.name,
      trackingNumber,
      carrier:        d.shipping_line_name,
      events,
      eta:            eta ?? undefined,
      etd:            etd ?? undefined,
      origin:         d.shipped_from ?? d.loading_port,
      destination:    d.shipped_to   ?? d.discharging_port,
      vessel:         d.current_vessel_name ?? d.last_vessel_name,
      voyage:         d.current_voyage_number ?? d.last_voyage_number,
      rawData:        json,
    };
  }

  private failure(trackingNumber: string, error: string): ProviderResult {
    return { success: false, provider: this.name, trackingNumber, events: [], error };
  }
}
