import type { TrackingProvider, ProviderResult, ProviderEvent } from "./types";
import type { ShipmentType } from "@prisma/client";

/**
 * Lufthansa Cargo Shipment Tracking API
 * Docs: https://developer.lufthansa-cargo.com/docs/read/apis/shipmenttracking
 *
 * Auth: Header `APIKEY: <LUFTHANSA_CARGO_API_KEY>`
 *
 * Flow:
 *   GET /lh/handling/shipment?aWBPrefix=020&aWBNumber=12345678
 *   → returns shipmentTrackingInfo with trackingEvents[]
 */

// ── IATA standard event codes (shared with QR/AirRates) ─────
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

interface LHTrackingEvent {
  eventCode:        string;
  eventDescription?: string;
  eventDate:        string;   // YYYY-MM-DD
  eventTime?:       string;   // HH:mm
  station:          string;
  pieces?:          number;
  weight?:          number;
}

interface LHFlightDetail {
  flightNumber?:         string;
  origin?:               string;
  destination?:          string;
  scheduledDeparture?:   string;
  scheduledArrival?:     string;
  actualDeparture?:      string;
  actualArrival?:        string;
  flightDate?:           string;
}

interface LHShipmentInfo {
  awbNumber?:       string;
  origin?:          string;
  destination?:     string;
  trackingEvents?:  LHTrackingEvent[];
  flightDetails?:   LHFlightDetail[];
}

export class LufthansaCargoProvider implements TrackingProvider {
  readonly name     = "lufthansa";
  readonly supports: ShipmentType[] = ["AIR"];

  private get apiKey()  { return process.env.LUFTHANSA_CARGO_API_KEY ?? ""; }
  private get baseUrl() { return process.env.LUFTHANSA_CARGO_BASE_URL ?? "https://api.lufthansa-cargo.com"; }

  async track(trackingNumber: string, type: ShipmentType): Promise<ProviderResult> {
    if (!this.apiKey) {
      return this.fail(trackingNumber, "Lufthansa Cargo API key not configured");
    }
    if (type !== "AIR") {
      return this.fail(trackingNumber, "Lufthansa Cargo only supports AIR tracking");
    }
    return this.trackAir(trackingNumber);
  }

  private async trackAir(awbNumber: string): Promise<ProviderResult> {
    try {
      // AWB format: 020-12345678
      const match = awbNumber.match(/^(\d{3})-(\d{8})$/);
      if (!match) return this.fail(awbNumber, `Invalid AWB format: ${awbNumber}`);

      const [, aWBPrefix, aWBNumber] = match;

      const url = `${this.baseUrl}/lh/handling/shipment?aWBPrefix=${aWBPrefix}&aWBNumber=${aWBNumber}`;
      console.log(`[lufthansa] Fetching: ${url}`);

      const res = await fetch(url, {
        method:  "GET",
        headers: {
          "APIKEY":  this.apiKey,
          "Accept":  "application/json",
        },
        signal: AbortSignal.timeout(15_000),
        next: { revalidate: 0 },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[lufthansa] HTTP ${res.status}: ${body.slice(0, 300)}`);
        return this.fail(awbNumber, `Lufthansa API error: HTTP ${res.status}`);
      }

      const data = await res.json() as { shipmentTrackingInfo?: LHShipmentInfo };
      // Debug log — remove in production once field names confirmed
      console.log("[lufthansa] raw response:", JSON.stringify(data, null, 2));

      const info = data.shipmentTrackingInfo;
      if (!info) {
        return this.fail(awbNumber, "Lufthansa: empty shipmentTrackingInfo in response");
      }

      return this.parse(awbNumber, info);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lufthansa request failed";
      console.error(`[lufthansa] Error for ${awbNumber}:`, msg);
      return this.fail(awbNumber, msg);
    }
  }

  private parse(awbNumber: string, info: LHShipmentInfo): ProviderResult {
    const events: ProviderEvent[] = (info.trackingEvents ?? [])
      .filter((e) => e.eventDate && e.station)
      .map((e) => ({
        rawStatus:   e.eventCode.toUpperCase(),
        location:    e.station,
        description: e.eventDescription
                      ?? IATA_EVENT_DESC[e.eventCode.toUpperCase()]
                      ?? e.eventCode,
        timestamp:   new Date(`${e.eventDate}T${e.eventTime ?? "00:00"}:00Z`),
      }))
      .filter((e) => !Number.isNaN(e.timestamp.getTime()))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const firstFlight = info.flightDetails?.[0];
    const lastFlight  = info.flightDetails?.at(-1);

    if (events.length === 0 && !info.origin) {
      return this.fail(awbNumber, "Lufthansa: no tracking data available for this AWB");
    }

    return {
      success:        true,
      provider:       this.name,
      trackingNumber: awbNumber,
      carrier:        "Lufthansa Cargo",
      events,
      origin:         info.origin ?? firstFlight?.origin ?? "",
      destination:    info.destination ?? lastFlight?.destination ?? "",
      eta:            lastFlight?.scheduledArrival
                        ? new Date(lastFlight.scheduledArrival)
                        : lastFlight?.actualArrival
                          ? new Date(lastFlight.actualArrival)
                          : undefined,
      etd:            firstFlight?.scheduledDeparture
                        ? new Date(firstFlight.scheduledDeparture)
                        : undefined,
      flight:         lastFlight?.flightNumber ?? firstFlight?.flightNumber ?? "",
      rawData:        info,
    };
  }

  private fail(trackingNumber: string, error: string): ProviderResult {
    return { success: false, provider: this.name, trackingNumber, events: [], error };
  }

  async healthCheck(): Promise<boolean> {
    try {
      // A dummy AWB to test auth (will get 404 or 200, but not 401)
      const res = await fetch(
        `${this.baseUrl}/lh/handling/shipment?aWBPrefix=020&aWBNumber=00000001`,
        { headers: { APIKEY: this.apiKey }, signal: AbortSignal.timeout(8_000) },
      );
      return res.status !== 401 && res.status !== 403;
    } catch {
      return false;
    }
  }
}
