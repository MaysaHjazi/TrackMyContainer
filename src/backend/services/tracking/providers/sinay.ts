import type { TrackingProvider, ProviderResult, ProviderEvent } from "./types";
import type { ShipmentType } from "@prisma/client";

/**
 * Sinay.ai Container Tracking API — FREE plan available
 *
 * Docs:    https://documentation.sinay.ai
 * Swagger: https://api.sinay.ai/container-tracking/api/v2/swagger.yaml
 *
 * ── Auth ──────────────────────────────────────────────────────
 *   Header: API_KEY: {key}
 *
 * ── Endpoint ─────────────────────────────────────────────────
 *   GET https://api.sinay.ai/container-tracking/api/v2/shipment
 *       ?shipmentNumber={container}
 *       &sealine={SCAC}         ← optional but speeds up response
 *       &shipmentType=CT        ← CT=container, BL=bill of lading
 *       &route=false            ← skip AIS/route data (faster, cheaper)
 *
 * ── Free plan ────────────────────────────────────────────────
 *   Sign up free at https://app.sinay.ai
 *   FREE plan: 4 API units/month per container, 170+ carriers
 *
 * ── DCSA event codes used ─────────────────────────────────────
 *   GTIN Gate in  | LOAD Loaded | DEPA Departed | ARRI Arrived
 *   DISC Discharged | GTOT Gate out | STUF Stuffed | CONF Booked
 *   CUSS/CUSI Customs hold | CUSR Customs released | CMPL Complete
 */
export class SinayProvider implements TrackingProvider {
  readonly name    = "sinay";
  readonly supports: ShipmentType[] = ["SEA"];

  private get apiKey() { return process.env.SINAY_API_KEY ?? ""; }
  private readonly baseUrl = "https://api.sinay.ai/container-tracking/api/v2";

  // ── Track ───────────────────────────────────────────────────
  async track(trackingNumber: string, _type: ShipmentType): Promise<ProviderResult> {
    if (!this.apiKey) {
      return {
        success: false, provider: this.name, trackingNumber, events: [],
        error: "Sinay API key not configured. Get a free key at app.sinay.ai",
      };
    }

    try {
      // Build query: shipmentType=CT (container tracking)
      const qs = new URLSearchParams({
        shipmentNumber: trackingNumber,
        shipmentType:   "CT",
        route:          "false", // skip AIS for speed
      });

      const res = await fetch(`${this.baseUrl}/shipment?${qs}`, {
        headers: {
          "API_KEY": this.apiKey,
          "Accept":  "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const parsed = this.tryParseJson(body);
        // 404 = container not found / not supported by this carrier
        if (res.status === 404) {
          return {
            success: false, provider: this.name, trackingNumber, events: [],
            error: `Sinay: container not found (${parsed?.message ?? "404"})`,
          };
        }
        throw new Error(`Sinay API error ${res.status}: ${body.slice(0, 200)}`);
      }

      const data = await res.json();
      return this.parse(trackingNumber, data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sinay request failed";
      console.error(`[sinay] Error tracking ${trackingNumber}:`, msg);
      return { success: false, provider: this.name, trackingNumber, events: [], error: msg };
    }
  }

  // ── Parse response ──────────────────────────────────────────
  private parse(trackingNumber: string, data: SinayResponse): ProviderResult {
    const metadata   = data.metadata;
    const containers = data.containers ?? [];

    if (!containers.length) {
      return {
        success: false, provider: this.name, trackingNumber, events: [],
        error: "Sinay: no container data returned",
      };
    }

    // Use first container (CT tracking = single container)
    const container = containers[0];
    const events    = this.parseEvents(container.events ?? []);

    if (events.length === 0) {
      return {
        success: false, provider: this.name, trackingNumber, events: [],
        error: "Sinay: no events returned",
      };
    }

    // Route info: POL/POD
    const pol = data.route?.pol;
    const pod = data.route?.pod;

    // Carrier name from metadata
    const carrier = metadata?.sealineName ?? metadata?.sealine;

    // ETA = pod planned date (if not actual yet)
    const etaDate = pod?.date && !pod.actual
      ? this.parseDate(pod.date)
      : undefined;

    // ETD = pol actual or planned date
    const etdDate = pol?.date
      ? this.parseDate(pol.date)
      : undefined;

    // Origin / Destination from route
    const origin      = pol?.location?.name ?? pol?.location?.locode ?? "";
    const destination = pod?.location?.name ?? pod?.location?.locode ?? "";

    // Vessel from last LOAD/DEPA event
    const vesselEvent = [...events].reverse().find(
      (e: RawEvent) => e.vessel?.name && ["load", "depa", "arri"].includes(e.eventCode?.toLowerCase() ?? "")
    );
    const vessel = vesselEvent?.vessel?.name ?? "";
    const voyage = vesselEvent?.voyage ?? "";

    return {
      success:       true,
      provider:      this.name,
      trackingNumber,
      carrier,
      events:        events.map((e: RawEvent) => this.toProviderEvent(e)),
      eta:           etaDate,
      etd:           etdDate,
      origin:        origin || undefined,
      destination:   destination || undefined,
      vessel:        vessel || undefined,
      voyage:        voyage || undefined,
      rawData:       data,
    };
  }

  // ── Event parsing ───────────────────────────────────────────
  private parseEvents(rawEvents: RawEvent[]): RawEvent[] {
    return rawEvents
      .filter((e) => e.date) // skip events without dates
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
  }

  private toProviderEvent(e: RawEvent): ProviderEvent {
    // Use eventCode as rawStatus (DCSA standard code like GTIN, LOAD, DEPA...)
    // Fall back to description if no code
    const rawStatus = e.eventCode ?? e.description ?? "UNKNOWN";

    // Build location string
    const locName  = e.location?.name ?? e.facility?.name ?? "";
    const locCode  = e.location?.locode ?? "";
    const location = locName || locCode || "Unknown";

    // Description
    const description = e.description ?? rawStatus;

    return {
      rawStatus:   rawStatus.toLowerCase(),
      location,
      description,
      timestamp:   this.parseDate(e.date!) ?? new Date(),
    };
  }

  // ── Helpers ─────────────────────────────────────────────────
  private parseDate(dateStr: string | undefined): Date | undefined {
    if (!dateStr) return undefined;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? undefined : d;
  }

  private tryParseJson(text: string): Record<string, string> | null {
    try { return JSON.parse(text); } catch { return null; }
  }

  // ── Health check ────────────────────────────────────────────
  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(`${this.baseUrl}/sealines`, {
        headers: { "API_KEY": this.apiKey },
        signal:  AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

// ── Sinay response types ─────────────────────────────────────

interface SinayLocation {
  name?:        string;
  locode?:      string;
  country?:     string;
  countryCode?: string;
  coordinates?: { lat: number; lng: number };
}

interface SinayFacility {
  name?:        string;
  locode?:      string;
  countryCode?: string;
}

interface SinayVessel {
  name?: string;
  imo?:  number;
  mmsi?: number;
}

interface RawEvent {
  eventCode?:         string;   // DCSA code: GTIN, LOAD, DEPA, ARRI, DISC, GTOT ...
  description?:       string;
  date?:              string;   // ISO 8601
  isActual?:          boolean;
  location?:          SinayLocation;
  facility?:          SinayFacility;
  vessel?:            SinayVessel;
  voyage?:            string;
  transportType?:     string;   // VESSEL | TRUCK | RAIL | AIR
  routeType?:         string;   // SEA | LAND
  eventType?:         string;   // SHIPMENT | TRANSPORT | EQUIPMENT
  isAdditionalEvent?: boolean;
}

interface RoutePoint {
  location?: SinayLocation;
  date?:     string;
  actual?:   boolean;
}

interface SinayResponse {
  metadata?: {
    shipmentType?:    string;
    shipmentNumber?:  string;
    sealine?:         string;
    sealineName?:     string;
    shippingStatus?:  string;   // PLANNED | IN_TRANSIT | DELIVERED | UNKNOWN
    updatedAt?:       string;
    warnings?:        string[];
  };
  containers?: Array<{
    number?:   string;
    isoCode?:  string;
    sizeType?: string;
    status?:   string;          // PLANNED | IN_TRANSIT | DELIVERED | UNKNOWN
    events?:   RawEvent[];
  }>;
  route?: {
    prepol?: RoutePoint;
    pol?:    RoutePoint;
    pod?:    RoutePoint;
    postpod?: RoutePoint;
  };
  vessels?: Record<string, SinayVessel>;
  locations?: Record<string, SinayLocation>;
}
