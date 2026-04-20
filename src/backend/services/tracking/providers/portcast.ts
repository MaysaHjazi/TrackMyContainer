import type { TrackingProvider, ProviderResult } from "./types";
import type { ShipmentType } from "@prisma/client";

/**
 * Portcast Container Tracking API
 * Docs: https://portcast.io/docs
 * Sign up FREE at: https://portcast.io → Dashboard → API Keys
 * Free plan: 1,000 API calls/month. No credit card needed.
 * Set PORTCAST_API_KEY in .env.local
 */
export class PortcastProvider implements TrackingProvider {
  readonly name    = "portcast";
  readonly supports: ShipmentType[] = ["SEA"];

  private get apiKey()  { return process.env.PORTCAST_API_KEY ?? ""; }
  private get baseUrl() { return process.env.PORTCAST_BASE_URL ?? "https://api.portcast.io"; }

  async track(trackingNumber: string): Promise<ProviderResult> {
    if (!this.apiKey) {
      return { success: false, provider: this.name, trackingNumber, events: [], error: "Portcast API key not configured" };
    }
    try {
      // Step 1: Create/register the tracking (idempotent — safe to call multiple times)
      const createRes = await fetch(`${this.baseUrl}/api/v1/cn/bookmarks`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "x-api-token":   this.apiKey,
        },
        body: JSON.stringify({ container_nos: [trackingNumber] }),
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 0 },
      });

      if (!createRes.ok && createRes.status !== 409) {
        throw new Error(`Portcast register failed: ${createRes.status}`);
      }

      // Step 2: Fetch tracking events
      const eventsRes = await fetch(
        `${this.baseUrl}/api/v1/cn/bookmarks/${encodeURIComponent(trackingNumber)}/events`,
        {
          headers: {
            "x-api-token": this.apiKey,
            "Accept":      "application/json",
          },
          signal: AbortSignal.timeout(8000),
          next: { revalidate: 0 },
        },
      );

      if (!eventsRes.ok) {
        throw new Error(`Portcast events fetch failed: ${eventsRes.status}`);
      }

      const data = await eventsRes.json();
      console.log(`[portcast] Response for ${trackingNumber}:`, JSON.stringify(data).slice(0, 400));
      return this.parse(trackingNumber, data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Portcast request failed";
      console.error(`[portcast] Error tracking ${trackingNumber}:`, msg);
      return { success: false, provider: this.name, trackingNumber, events: [], error: msg };
    }
  }

  private parse(trackingNumber: string, data: Record<string, unknown>): ProviderResult {
    // Portcast response shape: { container_no, shipping_line, events: [...], pod, pol, eta, vessel }
    const rawEvents = (data.events as unknown[]) ?? [];

    if (rawEvents.length === 0) {
      return { success: false, provider: this.name, trackingNumber, events: [], error: "No events from Portcast" };
    }

    const events = rawEvents.map((e: unknown) => {
      const evt = e as Record<string, unknown>;
      return {
        rawStatus:   String(evt.status ?? evt.event_type ?? evt.description ?? ""),
        location:    String(evt.location ?? evt.port ?? evt.port_name ?? ""),
        description: String(evt.description ?? evt.event_description ?? evt.status ?? ""),
        timestamp:   new Date(String(evt.actual_time ?? evt.expected_time ?? evt.event_time ?? "")),
      };
    });

    return {
      success:       true,
      provider:      this.name,
      trackingNumber,
      carrier:       String(data.shipping_line ?? data.carrier ?? ""),
      events,
      eta:           data.eta ? new Date(String(data.eta)) : undefined,
      origin:        String(data.pol ?? data.origin ?? ""),
      destination:   String(data.pod ?? data.destination ?? ""),
      vessel:        String(data.vessel ?? data.vessel_name ?? ""),
      voyage:        String(data.voyage ?? data.voyage_number ?? ""),
      rawData:       data,
    };
  }
}
