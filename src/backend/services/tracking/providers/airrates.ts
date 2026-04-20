import type { TrackingProvider, ProviderResult } from "./types";
import type { ShipmentType } from "@prisma/client";

/**
 * AirRates Air Cargo Tracking API
 * Docs: https://www.airrates.com/integrations/api-air-cargo-tracking/
 * Covers 75+ airlines with AWB-based tracking.
 */
export class AirRatesProvider implements TrackingProvider {
  readonly name    = "airrates";
  readonly supports: ShipmentType[] = ["AIR"];

  private readonly apiKey  = process.env.AIRRATES_API_KEY!;
  private readonly baseUrl = process.env.AIRRATES_BASE_URL ?? "https://api.airrates.com";

  async track(awbNumber: string): Promise<ProviderResult> {
    try {
      // Normalize AWB: remove dash for API call
      const cleanAwb = awbNumber.replace("-", "");

      const res = await fetch(
        `${this.baseUrl}/v1/track/${cleanAwb}`,
        {
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type":  "application/json",
          },
          next: { revalidate: 0 },
        },
      );

      if (!res.ok) {
        throw new Error(`AirRates tracking failed: ${res.status}`);
      }

      const data = await res.json();
      return this.parse(awbNumber, data);
    } catch (err) {
      return {
        success:  false,
        provider: this.name,
        trackingNumber: awbNumber,
        events:   [],
        error:    err instanceof Error ? err.message : "AirRates request failed",
      };
    }
  }

  private parse(awbNumber: string, data: Record<string, unknown>): ProviderResult {
    const rawEvents = (data.events as unknown[]) ?? (data.trackingEvents as unknown[]) ?? [];

    const events = rawEvents.map((e: unknown) => {
      const evt = e as Record<string, unknown>;
      return {
        rawStatus:   String(evt.statusCode ?? evt.status ?? ""),
        location:    String(evt.location ?? evt.station ?? evt.airport ?? ""),
        description: String(evt.description ?? evt.statusDescription ?? evt.status ?? ""),
        timestamp:   new Date(String(evt.eventDate ?? evt.timestamp ?? evt.date ?? "")),
      };
    });

    return {
      success:       true,
      provider:      this.name,
      trackingNumber: awbNumber,
      carrier:       String(data.airline ?? data.carrier ?? ""),
      events,
      eta:           data.eta ? new Date(String(data.eta)) : undefined,
      origin:        String(data.origin ?? data.departureAirport ?? ""),
      destination:   String(data.destination ?? data.arrivalAirport ?? ""),
      flight:        String(data.flightNumber ?? data.flight ?? ""),
      rawData:       data,
    };
  }
}
