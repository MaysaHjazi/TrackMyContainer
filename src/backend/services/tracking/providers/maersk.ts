import type { TrackingProvider, ProviderResult } from "./types";
import type { ShipmentType } from "@prisma/client";

/**
 * Maersk Developer API — Track & Trace
 * Docs: https://developer.maersk.com/api-catalogue
 *
 * Two modes:
 *  1. Consumer Key only (simple) — set MAERSK_CONSUMER_KEY
 *     GET /track/v1/events?containerNum=... with Consumer-Key header
 *     No OAuth, no customer code required. Free on developer.maersk.com
 *
 *  2. Full OAuth2 — set MAERSK_CLIENT_ID + MAERSK_CLIENT_SECRET
 *     Used for advanced supply-chain APIs (requires customer code)
 */
export class MaerskProvider implements TrackingProvider {
  readonly name    = "maersk";
  readonly supports: ShipmentType[] = ["SEA"];

  private get consumerKey()  { return process.env.MAERSK_CONSUMER_KEY ?? process.env.MAERSK_CLIENT_ID ?? ""; }
  private get clientSecret() { return process.env.MAERSK_CLIENT_SECRET ?? ""; }
  private get baseUrl()      { return process.env.MAERSK_BASE_URL ?? "https://api.maersk.com"; }

  /** True if we only have a Consumer Key (no OAuth secret) */
  private get simpleMode() {
    return !!(this.consumerKey && !this.clientSecret);
  }

  private accessToken: string | null = null;
  private tokenExpiry: Date   | null = null;

  // ── OAuth token management (full mode only) ──────────────────
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    const res = await fetch(`${this.baseUrl}/oauth2/access_token`, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     this.consumerKey,
        client_secret: this.clientSecret,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`Maersk OAuth failed: ${res.status}`);

    const json = await res.json() as { access_token: string; expires_in: number };
    this.accessToken = json.access_token;
    this.tokenExpiry = new Date(Date.now() + (json.expires_in - 60) * 1000);
    return this.accessToken;
  }

  // ── Track container ─────────────────────────────────────────
  async track(trackingNumber: string): Promise<ProviderResult> {
    if (!this.consumerKey) {
      return { success: false, provider: this.name, trackingNumber, events: [], error: "Maersk Consumer Key not configured" };
    }
    try {
      let res: Response;

      if (this.simpleMode) {
        // Simple mode: Consumer Key only, no OAuth
        res = await fetch(
          `${this.baseUrl}/track/v1/events?containerNum=${trackingNumber}`,
          {
            headers: {
              "Consumer-Key": this.consumerKey,
              "Accept":       "application/json",
            },
            signal: AbortSignal.timeout(8000),
            next: { revalidate: 0 },
          },
        );
      } else {
        // Full OAuth2 mode
        const token = await this.getAccessToken();
        res = await fetch(
          `${this.baseUrl}/track/v1/events?containerNum=${trackingNumber}`,
          {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Consumer-Key":  this.consumerKey,
              "Accept":        "application/json",
            },
            signal: AbortSignal.timeout(8000),
            next: { revalidate: 0 },
          },
        );
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Maersk tracking failed: ${res.status} ${body.slice(0, 200)}`);
      }

      const data = await res.json();
      console.log(`[maersk] Response for ${trackingNumber}:`, JSON.stringify(data).slice(0, 400));
      return this.parse(trackingNumber, data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Maersk request failed";
      console.error(`[maersk] Error tracking ${trackingNumber}:`, msg);
      return { success: false, provider: this.name, trackingNumber, events: [], error: msg };
    }
  }

  private parse(trackingNumber: string, data: Record<string, unknown>): ProviderResult {
    const rawEvents = (data.events as unknown[]) ?? [];

    if (rawEvents.length === 0) {
      return { success: false, provider: this.name, trackingNumber, events: [], error: "No events returned" };
    }

    const events = rawEvents.map((e: unknown) => {
      const evt = e as Record<string, unknown>;
      return {
        rawStatus:   String(evt.eventType ?? evt.transportEventTypeCode ?? ""),
        location:    this.extractLocation(evt),
        description: String(evt.description ?? evt.eventType ?? ""),
        timestamp:   new Date(String(evt.eventDateTime ?? evt.eventDate ?? "")),
      };
    });

    const firstTransport = rawEvents.find(
      (e: unknown) => (e as Record<string, unknown>).eventClassifierCode === "PLN"
    ) as Record<string, unknown> | undefined;

    return {
      success:       true,
      provider:      this.name,
      trackingNumber,
      carrier:       "Maersk",
      events,
      eta:           data.plannedArrivalDate ? new Date(String(data.plannedArrivalDate)) : undefined,
      origin:        String(data.originPortCode ?? ""),
      destination:   String(data.destinationPortCode ?? ""),
      vessel:        String(firstTransport?.vesselName ?? ""),
      voyage:        String(firstTransport?.carrierVoyageNumber ?? ""),
      rawData:       data,
    };
  }

  private extractLocation(event: Record<string, unknown>): string {
    const loc = event.location as Record<string, unknown> | undefined;
    if (!loc) return String(event.portCode ?? event.locationCode ?? "");
    return String(loc.locationName ?? loc.portCode ?? "");
  }
}
