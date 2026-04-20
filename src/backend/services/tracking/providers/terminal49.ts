import type { TrackingProvider, ProviderResult } from "./types";
import type { ShipmentType } from "@prisma/client";

/**
 * Terminal49 Container Tracking API (v2)
 * Docs: https://terminal49.com/docs/api-docs/
 *
 * Flow:
 *   POST /v2/tracking_requests {request_type, request_number, scac} → creates async tracking
 *   GET  /v2/tracking_requests/{id}                                 → poll for status=succeeded
 *   GET  /v2/shipments/{id}?include=containers.transport_events    → full data
 *
 * NOTE: Some Terminal49 API keys have WRITE-ONLY permissions
 *   (can create tracking_requests, but cannot read shipments/containers).
 *   If the key only supports POST, this provider will return success=false
 *   so the orchestrator falls back to the next provider (e.g., Shipsgo).
 */
export class Terminal49Provider implements TrackingProvider {
  readonly name    = "terminal49";
  readonly supports: ShipmentType[] = ["SEA"];

  private get apiKey()  { return process.env.TERMINAL49_API_KEY ?? ""; }
  private get baseUrl() { return process.env.TERMINAL49_BASE_URL ?? "https://api.terminal49.com/v2"; }

  private readonly POLL_MAX_MS   = 25_000;
  private readonly POLL_INTERVAL = 3_500;

  async track(trackingNumber: string): Promise<ProviderResult> {
    if (!this.apiKey) {
      return this.fail(trackingNumber, "Terminal49 API key not configured");
    }
    try {
      const scac = trackingNumber.slice(0, 4).toUpperCase();

      // Step 1: POST tracking_request. Use bill_of_lading since 'container' type
      //         validates the check-digit which rejects many real containers.
      const createRes = await fetch(`${this.baseUrl}/tracking_requests`, {
        method:  "POST",
        headers: this.headers(),
        body: JSON.stringify({
          data: {
            type: "tracking_request",
            attributes: {
              request_type:   "bill_of_lading",
              request_number: trackingNumber,
              scac,
            },
          },
        }),
        signal: AbortSignal.timeout(10_000),
        next: { revalidate: 0 },
      });

      let trackingRequestId: string | null = null;

      if (createRes.ok) {
        const json = await createRes.json() as { data?: { id?: string } };
        trackingRequestId = json.data?.id ?? null;
      } else if (createRes.status === 422) {
        // Likely duplicate; extract the existing tracking_request_id from error
        const errJson = await createRes.json().catch(() => ({})) as {
          errors?: Array<{ meta?: { tracking_request_id?: string }; code?: string }>;
        };
        const dup = errJson.errors?.find((e) => e.code === "duplicate");
        trackingRequestId = dup?.meta?.tracking_request_id ?? null;
      } else {
        const body = await createRes.text().catch(() => "");
        throw new Error(`Terminal49 create failed: ${createRes.status} ${body.slice(0, 200)}`);
      }

      if (!trackingRequestId) {
        return this.fail(trackingNumber, "Terminal49: could not obtain tracking_request id");
      }

      // Step 2: poll for shipment (may fail if key is write-only → graceful fallback)
      const shipmentId = await this.pollForShipment(trackingRequestId);
      if (!shipmentId) {
        return this.fail(trackingNumber, "Terminal49: pending (key may be write-only or data not ready)");
      }

      // Step 3: fetch shipment with containers + transport_events
      const shipmentRes = await fetch(
        `${this.baseUrl}/shipments/${shipmentId}?include=containers,containers.transport_events,shipping_line,port_of_lading,port_of_discharge`,
        { headers: this.headers(), signal: AbortSignal.timeout(10_000), next: { revalidate: 0 } },
      );
      if (!shipmentRes.ok) {
        return this.fail(trackingNumber, `Terminal49 shipment fetch failed: ${shipmentRes.status}`);
      }
      const shipmentJson = await shipmentRes.json();
      return this.parse(trackingNumber, shipmentJson);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Terminal49 request failed";
      console.error(`[terminal49] Error tracking ${trackingNumber}:`, msg);
      return this.fail(trackingNumber, msg);
    }
  }

  private async pollForShipment(trackingRequestId: string): Promise<string | null> {
    const deadline = Date.now() + this.POLL_MAX_MS;
    while (Date.now() < deadline) {
      const res = await fetch(`${this.baseUrl}/tracking_requests/${trackingRequestId}`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(8_000),
        next: { revalidate: 0 },
      });
      if (res.status === 401) {
        // Write-only key — we cannot read tracking_request status.
        // Return null so the caller can fall back to another provider.
        return null;
      }
      if (!res.ok) return null;

      const json = await res.json() as {
        data?: {
          attributes?: { status?: string };
          relationships?: { tracked_object?: { data?: { id?: string; type?: string } } };
        };
      };
      const status = json.data?.attributes?.status ?? "";
      const shipmentId = json.data?.relationships?.tracked_object?.data?.id ?? null;

      if (status === "succeeded" && shipmentId) return shipmentId;
      if (status === "failed") return null;

      await sleep(this.POLL_INTERVAL);
    }
    return null;
  }

  private parse(trackingNumber: string, data: Record<string, unknown>): ProviderResult {
    const shipment = data.data as Record<string, unknown> | undefined;
    if (!shipment) return this.fail(trackingNumber, "Terminal49: empty shipment response");

    const attrs = (shipment.attributes ?? {}) as Record<string, unknown>;
    const included = (data.included as unknown[]) ?? [];

    // Collect tracking_events from included (per container)
    const rawEvents = included.filter(
      (item: unknown) => (item as Record<string, unknown>).type === "transport_event"
                       || (item as Record<string, unknown>).type === "tracking_event",
    );
    const events = rawEvents.map((e: unknown) => {
      const item  = e as Record<string, unknown>;
      const evtAt = (item.attributes ?? {}) as Record<string, unknown>;
      return {
        rawStatus:   String(evtAt.event ?? evtAt.status ?? evtAt.event_type ?? ""),
        location:    this.extractLocation(evtAt),
        description: String(evtAt.description ?? evtAt.event ?? evtAt.status ?? ""),
        timestamp:   new Date(String(evtAt.timestamp ?? evtAt.event_time ?? evtAt.voyage_number ?? "")),
      };
    }).filter((e) => !Number.isNaN(e.timestamp.getTime()));

    // Carrier from included shipping_line
    const shippingLine = included.find(
      (item: unknown) => (item as Record<string, unknown>).type === "shipping_line",
    ) as Record<string, unknown> | undefined;
    const carrierName = shippingLine
      ? String((shippingLine.attributes as Record<string, unknown> | undefined)?.name ?? "")
      : String(attrs.shipping_line ?? "");

    return {
      success:        events.length > 0,
      provider:       this.name,
      trackingNumber,
      carrier:        carrierName,
      events,
      eta:            attrs.pod_eta_at ? new Date(String(attrs.pod_eta_at))  : undefined,
      etd:            attrs.pol_etd_at ? new Date(String(attrs.pol_etd_at))  : undefined,
      origin:         String(attrs.pol_name ?? attrs.origin ?? ""),
      destination:    String(attrs.pod_name ?? attrs.destination ?? ""),
      vessel:         String(attrs.vessel_name ?? ""),
      voyage:         String(attrs.voyage_number ?? ""),
      rawData:        data,
    };
  }

  private extractLocation(evt: Record<string, unknown>): string {
    const loc = evt.location as Record<string, unknown> | undefined;
    if (loc) return String(loc.name ?? loc.city ?? loc.country ?? "");
    return String(evt.port_name ?? evt.location_name ?? evt.location ?? "");
  }

  private headers() {
    return {
      "Authorization": `Token ${this.apiKey}`,
      "Content-Type":  "application/vnd.api+json",
      "Accept":        "application/vnd.api+json",
    };
  }

  private fail(trackingNumber: string, error: string): ProviderResult {
    return { success: false, provider: this.name, trackingNumber, events: [], error };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
