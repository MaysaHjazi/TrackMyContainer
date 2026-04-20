import type { TrackingProvider, ProviderResult, ProviderEvent } from "./types";
import type { ShipmentType } from "@prisma/client";

/**
 * Qatar Airways Cargo Tracking API
 * Portal:   https://developer.qrcargo.com
 * Endpoint: POST /shipment/track
 *
 * Auth: OAuth2 Client Credentials
 *   Token endpoint: QATAR_CARGO_TOKEN_URL (env)
 *   → returns Bearer token
 *
 * Request body:
 *   { cargoTrackingRequestSOs: [{ documentType, documentPrefix, documentNumber }] }
 *
 * Response:
 *   { cargoTrackingSOs: [{ origin, destination, cargoTrackingFlightList[], cargoTrackingMvtStausList[] }] }
 */

// ── IATA Cargo-IMP event code descriptions ────────────────────
const IATA_EVENT_DESC: Record<string, string> = {
  RCS: "Received from shipper",
  MAN: "Manifested",
  DEP: "Departed",
  ARR: "Arrived",
  RCF: "Received from flight",
  NFD: "Notified for delivery",
  AWD: "Consignee notified",
  DLV: "Delivered",
  CCD: "Customs clearance delayed",
  FOH: "Freight on hold",
  DIS: "Discrepancy",
  DLY: "Delayed",
  TRM: "Transfer manifest",
  PRE: "Pre-advised",
  BKD: "Booked",
};

// ── Response types (exact field names from QR API docs) ───────
interface QRMovementStatus {
  movementStatus:       string;            // RCS | MAN | DEP | ARR | RCF | NFD | DLV …
  eventAirport:         string;
  eventDate:            string;            // "24-Oct-2021 07:19"
  createdDate?:         string;
  movementDetails?:     string;
  shipmentWeight?:      number;
  shipmentPieces?:      number;
  partOrTotal?:         string;
  cargoTrackingMvtULDSOs?: unknown[];
}

interface QRFlight {
  flightNumber?:        string;            // "QR-1234 " (may have trailing space)
  departedDate?:        string;            // "21-Oct-2021 00:00"
  arrivalDate?:         string;
  operationType?:       string;
  segmentOfDeparture?:  string;
  segmetnOfArrival?:    string;            // NOTE: typo in QR API ("segmetnOfArrival")
  std?:                 string;            // Scheduled Time of Departure "16:53"
  sta?:                 string;            // Scheduled Time of Arrival
  flightStatus?:        string;
  bkgStatus?:           string;
}

interface QRCargoTracking {
  docType?:                     string;
  docPrefix?:                   string;
  docNumber?:                   string;
  origin?:                      string;
  destination?:                 string;
  pieces?:                      number;
  weight?:                      number;
  shipmentInfo?:                string;
  cargoTrackingFlightList?:     QRFlight[];
  cargoTrackingMvtStausList?:   QRMovementStatus[];
}

interface QRTrackingResponse {
  cargoTrackingSOs?: QRCargoTracking[];
}

// ── In-memory token cache ─────────────────────────────────────
let _cachedToken: string | null = null;
let _tokenExpiry  = 0;

export class QatarAirwaysCargoProvider implements TrackingProvider {
  readonly name     = "qatar";
  readonly supports: ShipmentType[] = ["AIR"];

  private get clientId()     { return process.env.QATAR_CARGO_CLIENT_ID     ?? ""; }
  private get clientSecret() { return process.env.QATAR_CARGO_CLIENT_SECRET ?? ""; }

  /** API base URL — set QATAR_CARGO_BASE_URL in .env.local once you have the UAT/Prod URL */
  private get baseUrl() {
    return process.env.QATAR_CARGO_BASE_URL ?? "";
  }

  /** OAuth2 token URL — set QATAR_CARGO_TOKEN_URL in .env.local */
  private get tokenUrl() {
    return process.env.QATAR_CARGO_TOKEN_URL ?? "";
  }

  // ── Entry point ───────────────────────────────────────────────
  async track(trackingNumber: string, type: ShipmentType): Promise<ProviderResult> {
    if (!this.clientId || !this.clientSecret) {
      return this.fail(trackingNumber, "Qatar Airways Cargo credentials not configured");
    }
    if (!this.baseUrl) {
      return this.fail(trackingNumber, "QATAR_CARGO_BASE_URL not set — check .env.local");
    }
    if (type !== "AIR") {
      return this.fail(trackingNumber, "Qatar Airways Cargo only supports AIR tracking");
    }
    return this.trackAir(trackingNumber);
  }

  // ── Track AWB ─────────────────────────────────────────────────
  private async trackAir(awbNumber: string): Promise<ProviderResult> {
    try {
      const token = await this.getToken();
      if (!token) return this.fail(awbNumber, "Qatar Airways: could not obtain auth token");

      // AWB format: 157-12345678 → prefix=157, number=12345678
      const match = awbNumber.match(/^(\d{3})-(\d{8})$/);
      if (!match) return this.fail(awbNumber, `Invalid AWB format: ${awbNumber}`);
      const [, documentPrefix, documentNumber] = match;

      const url = `${this.baseUrl}/shipment/track`;
      console.log(`[qatar] POST ${url} — AWB: ${awbNumber}`);

      const res = await fetch(url, {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type":  "application/json",
          "Accept":        "application/json",
        },
        // cargoTrackingRequestSOs is an ARRAY (supports batch, we send 1 item)
        body: JSON.stringify({
          cargoTrackingRequestSOs: [
            {
              documentType:   "MAWB",
              documentPrefix,
              documentNumber,
            },
          ],
        }),
        signal: AbortSignal.timeout(15_000),
        next: { revalidate: 0 },
      });

      // If 401/403 — clear token cache and retry once
      if (res.status === 401 || res.status === 403) {
        _cachedToken = null;
        _tokenExpiry  = 0;
        return this.fail(awbNumber, `Qatar Airways: auth failed (HTTP ${res.status}) — token may be expired`);
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[qatar] HTTP ${res.status}: ${body.slice(0, 300)}`);
        return this.fail(awbNumber, `Qatar Airways API error: HTTP ${res.status}`);
      }

      const data = await res.json() as QRTrackingResponse;
      console.log("[qatar] raw response:", JSON.stringify(data, null, 2));

      // Response is an array — take the first matching entry
      const tracking = data.cargoTrackingSOs?.[0];
      if (!tracking) {
        return this.fail(awbNumber, "Qatar Airways: no tracking data in response");
      }

      return this.parse(awbNumber, tracking);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Qatar Airways Cargo request failed";
      console.error(`[qatar] Error for ${awbNumber}:`, msg);
      return this.fail(awbNumber, msg);
    }
  }

  // ── OAuth2 token (client credentials) ────────────────────────
  private async getToken(): Promise<string | null> {
    if (_cachedToken && Date.now() < _tokenExpiry - 60_000) return _cachedToken;

    if (!this.tokenUrl) {
      console.error("[qatar] QATAR_CARGO_TOKEN_URL not set");
      return null;
    }

    try {
      console.log(`[qatar] Fetching token from: ${this.tokenUrl}`);

      // Try standard OAuth2 client_credentials grant (form-encoded)
      const res = await fetch(this.tokenUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type:    "client_credentials",
          client_id:     this.clientId,
          client_secret: this.clientSecret,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        // Fallback: try JSON body format (some QR environments require this)
        const jsonRes = await fetch(this.tokenUrl, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type:    "client_credentials",
            client_id:     this.clientId,
            client_secret: this.clientSecret,
          }),
          signal: AbortSignal.timeout(10_000),
        });

        if (!jsonRes.ok) {
          const body = await jsonRes.text().catch(() => "");
          console.error(`[qatar] Token failed: HTTP ${jsonRes.status} — ${body.slice(0, 200)}`);
          return null;
        }

        const json = await jsonRes.json() as { access_token?: string; expires_in?: number };
        return this.cacheToken(json);
      }

      const json = await res.json() as { access_token?: string; expires_in?: number };
      return this.cacheToken(json);
    } catch (err) {
      console.error("[qatar] Token fetch error:", err instanceof Error ? err.message : err);
      return null;
    }
  }

  private cacheToken(json: { access_token?: string; expires_in?: number }): string | null {
    if (!json.access_token) {
      console.error("[qatar] Token response missing access_token:", JSON.stringify(json));
      return null;
    }
    _cachedToken = json.access_token;
    _tokenExpiry  = Date.now() + (json.expires_in ?? 3600) * 1_000;
    console.log("[qatar] Token cached, expires in", json.expires_in ?? 3600, "s");
    return _cachedToken;
  }

  // ── Parse response ────────────────────────────────────────────
  private parse(awbNumber: string, data: QRCargoTracking): ProviderResult {
    // Movement events — sorted oldest → newest
    const events: ProviderEvent[] = (data.cargoTrackingMvtStausList ?? [])
      .filter((e) => e.eventDate && e.eventAirport)
      .map((e) => ({
        rawStatus:   e.movementStatus.toUpperCase(),
        location:    e.eventAirport,
        description: e.movementDetails
                      ?? IATA_EVENT_DESC[e.movementStatus.toUpperCase()]
                      ?? e.movementStatus,
        timestamp:   parseQRDate(e.eventDate),
      }))
      .filter((e) => !Number.isNaN(e.timestamp.getTime()))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Flights
    const flights = data.cargoTrackingFlightList ?? [];
    const firstFlight = flights[0];
    const lastFlight  = flights.at(-1);

    if (events.length === 0 && !data.origin) {
      return this.fail(awbNumber, "Qatar Airways: no tracking data available for this AWB");
    }

    // Build ETA/ETD from flight list  (combine date + scheduled time)
    const etd = firstFlight?.departedDate
      ? combineDateTime(firstFlight.departedDate, firstFlight.std)
      : undefined;
    const eta = lastFlight?.arrivalDate
      ? combineDateTime(lastFlight.arrivalDate, lastFlight.sta?.replace(/\(\+\d+\)/, "").trim())
      : undefined;

    return {
      success:        true,
      provider:       this.name,
      trackingNumber: awbNumber,
      carrier:        "Qatar Airways Cargo",
      events,
      origin:         data.origin ?? firstFlight?.segmentOfDeparture ?? "",
      destination:    data.destination ?? lastFlight?.segmetnOfArrival ?? "",
      eta,
      etd,
      flight:         lastFlight?.flightNumber?.trim() ?? firstFlight?.flightNumber?.trim() ?? "",
      rawData:        data,
    };
  }

  private fail(trackingNumber: string, error: string): ProviderResult {
    return { success: false, provider: this.name, trackingNumber, events: [], error };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const token = await this.getToken();
      return !!token;
    } catch {
      return false;
    }
  }
}

// ── Date helpers ──────────────────────────────────────────────

/**
 * Parse QR date format: "24-Oct-2021 07:19"
 * Falls back to native Date parse if already ISO.
 */
function parseQRDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  // "24-Oct-2021 07:19" → native Date can handle "24 Oct 2021 07:19"
  const normalized = dateStr.replace(/-/g, " ");
  const d = new Date(normalized);
  return d;
}

/**
 * Combine a date string ("21-Oct-2021 00:00") with a separate time ("16:53")
 * to produce a more precise Date.
 */
function combineDateTime(dateStr: string, time?: string): Date | undefined {
  if (!dateStr) return undefined;
  if (!time) return parseQRDate(dateStr);
  // Replace the time part in the date string
  const datePart = dateStr.split(" ")[0]; // "21-Oct-2021"
  return parseQRDate(`${datePart} ${time}`);
}
