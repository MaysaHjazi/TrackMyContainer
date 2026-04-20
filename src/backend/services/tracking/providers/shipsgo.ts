import type { TrackingProvider, ProviderResult, ProviderEvent } from "./types";
import type { ShipmentType } from "@prisma/client";

/**
 * Shipsgo v2 API — Ocean + Air Tracking
 * Docs: https://api.shipsgo.com/docs/v2/
 *
 * Auth: Header `X-Shipsgo-User-Token: <SHIPSGO_API_KEY>`
 *
 * Flow (async):
 *   1. POST /v2/ocean/shipments  {container_number, carrier}  → returns shipment.id
 *   2. GET  /v2/ocean/shipments/{id}                          → poll until status != NEW/INPROGRESS
 *   3. Parse shipment.containers[*].movements into ProviderEvents
 *
 * Same flow for air: POST /v2/air/shipments {awb_number} → GET /v2/air/shipments/{id}
 */

// ── Ocean event codes (OceanMovement.event enum) ────────────
const OCEAN_EVENT_DESC: Record<string, string> = {
  EMSH: "Empty container released to shipper",
  GTIN: "Gate in at port",
  LOAD: "Loaded on vessel",
  DEPA: "Vessel departed",
  ARRV: "Vessel arrived",
  DISC: "Discharged from vessel",
  GTOT: "Gate out from port",
  EMRT: "Empty container returned",
};

// ── Air event codes (AirMovement.event enum) ────────────────
const AIR_EVENT_DESC: Record<string, string> = {
  RCS: "Received from shipper",
  MAN: "Manifested",
  DEP: "Departed",
  ARR: "Arrived",
  RCF: "Received from flight",
  DLV: "Delivered",
};

interface ShipsgoOceanMovement {
  event: string;              // EMSH|GTIN|LOAD|DEPA|ARRV|DISC|GTOT|EMRT
  status: "EST" | "ACT";
  location?: { code?: string; name?: string; country?: { code?: string; name?: string } } | null;
  vessel?: { imo?: number | null; name?: string } | null;
  voyage?: string | null;
  timestamp: string;
}

interface ShipsgoAirMovement {
  event: string;              // RCS|MAN|DEP|ARR|RCF|DLV
  status: "EST" | "ACT";
  location?: { iata?: string; name?: string } | null;
  flight?: { number?: string; airline?: { iata?: string } } | null;
  timestamp: string;
}

export class ShipsgoProvider implements TrackingProvider {
  readonly name     = "shipsgo";
  readonly supports: ShipmentType[] = ["SEA", "AIR"];

  private get apiKey()  { return process.env.SHIPSGO_API_KEY ?? ""; }
  private get baseUrl() { return process.env.SHIPSGO_BASE_URL ?? "https://api.shipsgo.com/v2"; }

  // Poll config
  private readonly POLL_MAX_MS    = 35_000;   // total budget for async wait
  private readonly POLL_INTERVAL  = 4_000;    // between polls

  async track(trackingNumber: string, type: ShipmentType): Promise<ProviderResult> {
    if (!this.apiKey) {
      return this.fail(trackingNumber, "Shipsgo API key not configured");
    }
    return type === "AIR"
      ? this.trackAir(trackingNumber)
      : this.trackOcean(trackingNumber);
  }

  // ── OCEAN ──────────────────────────────────────────────────
  private async trackOcean(containerNumber: string): Promise<ProviderResult> {
    try {
      const scac = containerNumber.slice(0, 4).toUpperCase();

      // Step 1: create or re-use shipment
      const id = await this.createOrGetOceanShipment(containerNumber, scac);
      if (!id) return this.fail(containerNumber, "Failed to create Shipsgo shipment");

      // Step 2: poll until ready or timeout
      const shipment = await this.pollOcean(id);
      if (!shipment) return this.fail(containerNumber, "Shipsgo shipment not found after creation");

      return this.parseOcean(containerNumber, shipment);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Shipsgo request failed";
      console.error(`[shipsgo] Ocean error for ${containerNumber}:`, msg);
      return this.fail(containerNumber, msg);
    }
  }

  private async createOrGetOceanShipment(containerNumber: string, scac: string): Promise<number | null> {
    // ── Step 1: Search existing (FREE — no credits consumed) ──
    const listRes = await fetch(
      `${this.baseUrl}/ocean/shipments?container_number=${encodeURIComponent(containerNumber)}&limit=10`,
      { headers: this.headers(), signal: AbortSignal.timeout(10_000), next: { revalidate: 0 } },
    );
    if (listRes.ok) {
      const listData = await listRes.json() as { shipments?: Array<{ id: number; container_number?: string }> };
      // Exact match on container_number (case-insensitive)
      const exact = (listData.shipments ?? []).find(
        (s) => (s.container_number ?? "").toUpperCase() === containerNumber.toUpperCase()
      );
      if (exact?.id) {
        console.log(`[shipsgo] Found existing shipment ${exact.id} for ${containerNumber}`);
        return exact.id;
      }
    }

    // ── Step 2: Create new shipment (costs 1 credit) ───────────
    const createRes = await fetch(`${this.baseUrl}/ocean/shipments`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ container_number: containerNumber, carrier: scac }),
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 0 },
    });

    if (createRes.ok) {
      const data = await createRes.json() as { shipment?: { id: number } };
      if (data.shipment?.id) return data.shipment.id;
    }

    // Check if failure is due to insufficient credits
    if (!createRes.ok) {
      const body = await createRes.text().catch(() => "");
      const parsed = this.tryParseJson(body);
      if (parsed?.message === "NOT_ENOUGH_CREDITS") {
        throw new Error(
          "Shipsgo credits exhausted. " +
          "Register a new free account at app.shipsgo.com to get fresh credits, " +
          "or use a different provider."
        );
      }
    }

    return null;
  }

  private tryParseJson(text: string): Record<string, string> | null {
    try { return JSON.parse(text); } catch { return null; }
  }

  private async pollOcean(id: number): Promise<Record<string, unknown> | null> {
    const deadline = Date.now() + this.POLL_MAX_MS;
    let lastShipment: Record<string, unknown> | null = null;

    while (Date.now() < deadline) {
      const res = await fetch(`${this.baseUrl}/ocean/shipments/${id}`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(8_000),
        next: { revalidate: 0 },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Shipsgo poll failed: ${res.status} ${body.slice(0, 200)}`);
      }
      const data = await res.json() as { shipment?: Record<string, unknown> };
      lastShipment = data.shipment ?? null;

      const status = String((lastShipment as { status?: string } | null)?.status ?? "");
      // If we have real data already, return immediately
      const containers = (lastShipment as { containers?: unknown[] } | null)?.containers ?? [];
      if (containers.length > 0 || !["NEW", "INPROGRESS"].includes(status)) {
        return lastShipment;
      }
      // Wait before next poll
      await sleep(this.POLL_INTERVAL);
    }

    // Timeout — return last snapshot so caller sees status/carrier at least
    return lastShipment;
  }

  private parseOcean(containerNumber: string, shipment: Record<string, unknown>): ProviderResult {
    const carrier = shipment.carrier as { scac?: string; name?: string } | null;
    const route = shipment.route as {
      port_of_loading?: { location?: { name?: string; code?: string }; date_of_loading?: string };
      port_of_discharge?: { location?: { name?: string; code?: string }; date_of_discharge?: string };
    } | null;
    const containers = (shipment.containers as Array<Record<string, unknown>>) ?? [];

    // Use movements from the FIRST matching container (or the first container if only one)
    const target = containers.find((c) => String(c.number ?? "").toUpperCase() === containerNumber.toUpperCase())
                  ?? containers[0];
    const movements = (target?.movements as ShipsgoOceanMovement[] | undefined) ?? [];

    const events: ProviderEvent[] = movements
      .filter((m) => m.timestamp)
      .map((m) => ({
        rawStatus:   m.event,  // EMSH|GTIN|LOAD|DEPA|ARRV|DISC|GTOT|EMRT
        location:    m.location?.name ?? m.location?.code ?? "",
        description: OCEAN_EVENT_DESC[m.event] ?? m.event,
        timestamp:   new Date(m.timestamp),
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Pull vessel+voyage from the most recent LOAD/DEPA movement (if any)
    const transport = [...movements].reverse().find((m) => m.vessel?.name);

    const status = String(shipment.status ?? "");
    const hasData = events.length > 0 || !!route?.port_of_loading || !!route?.port_of_discharge;

    if (!hasData) {
      return this.fail(
        containerNumber,
        status === "UNTRACKED"
          ? "Shipsgo: shipment not trackable (invalid number or carrier has no public tracking)"
          : `Shipsgo: no data yet (status=${status || "unknown"}). Will populate within ~5 minutes.`,
      );
    }

    return {
      success:        true,
      provider:       this.name,
      trackingNumber: containerNumber,
      carrier:        carrier?.name ?? "",
      events,
      eta:            route?.port_of_discharge?.date_of_discharge
                       ? new Date(route.port_of_discharge.date_of_discharge)
                       : undefined,
      etd:            route?.port_of_loading?.date_of_loading
                       ? new Date(route.port_of_loading.date_of_loading)
                       : undefined,
      origin:         route?.port_of_loading?.location?.name ?? "",
      destination:    route?.port_of_discharge?.location?.name ?? "",
      vessel:         transport?.vessel?.name ?? "",
      voyage:         transport?.voyage ?? "",
      rawData:        shipment,
    };
  }

  // ── AIR ────────────────────────────────────────────────────
  private async trackAir(awbNumber: string): Promise<ProviderResult> {
    try {
      const id = await this.createOrGetAirShipment(awbNumber);
      if (!id) return this.fail(awbNumber, "Failed to create Shipsgo air shipment");

      const shipment = await this.pollAir(id);
      if (!shipment) return this.fail(awbNumber, "Shipsgo air shipment not found");

      return this.parseAir(awbNumber, shipment);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Shipsgo air request failed";
      console.error(`[shipsgo] Air error for ${awbNumber}:`, msg);
      return this.fail(awbNumber, msg);
    }
  }

  private async createOrGetAirShipment(awbNumber: string): Promise<number | null> {
    // ── Step 1: Search existing (FREE — no credits consumed) ──
    const listRes = await fetch(
      `${this.baseUrl}/air/shipments?awb_number=${encodeURIComponent(awbNumber)}&limit=10`,
      { headers: this.headers(), signal: AbortSignal.timeout(10_000), next: { revalidate: 0 } },
    );
    if (listRes.ok) {
      const listData = await listRes.json() as { shipments?: Array<{ id: number; awb_number?: string }> };
      const exact = (listData.shipments ?? []).find(
        (s) => (s.awb_number ?? "").replace(/-/g, "") === awbNumber.replace(/-/g, ""),
      );
      if (exact?.id) {
        console.log(`[shipsgo] Found existing air shipment ${exact.id} for ${awbNumber}`);
        return exact.id;
      }
    }

    // ── Step 2: Create new shipment (costs 1 credit) ──────────
    const createRes = await fetch(`${this.baseUrl}/air/shipments`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ awb_number: awbNumber }),
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 0 },
    });
    if (createRes.ok) {
      const data = await createRes.json() as { shipment?: { id: number } };
      if (data.shipment?.id) return data.shipment.id;
    }

    // Check for insufficient credits
    if (!createRes.ok) {
      const body = await createRes.text().catch(() => "");
      const parsed = this.tryParseJson(body);
      if (parsed?.message === "NOT_ENOUGH_CREDITS") {
        throw new Error("Shipsgo credits exhausted. Register a new free account at app.shipsgo.com.");
      }
    }

    return null;
  }

  private async pollAir(id: number): Promise<Record<string, unknown> | null> {
    const deadline = Date.now() + this.POLL_MAX_MS;
    let last: Record<string, unknown> | null = null;
    while (Date.now() < deadline) {
      const res = await fetch(`${this.baseUrl}/air/shipments/${id}`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(8_000),
        next: { revalidate: 0 },
      });
      if (!res.ok) throw new Error(`Shipsgo air poll failed: ${res.status}`);
      const data = await res.json() as { shipment?: Record<string, unknown> };
      last = data.shipment ?? null;
      const status = String((last as { status?: string } | null)?.status ?? "");
      const movements = ((last as { movements?: unknown[] } | null)?.movements ?? []) as unknown[];
      if (movements.length > 0 || !["NEW", "INPROGRESS"].includes(status)) return last;
      await sleep(this.POLL_INTERVAL);
    }
    return last;
  }

  private parseAir(awbNumber: string, shipment: Record<string, unknown>): ProviderResult {
    const airline = shipment.airline as { iata?: string; name?: string } | null;
    const route = shipment.route as {
      airport_of_departure?: { location?: { iata?: string; name?: string }; date_of_departure?: string };
      airport_of_arrival?:   { location?: { iata?: string; name?: string }; date_of_arrival?: string };
    } | null;
    const movements = (shipment.movements as ShipsgoAirMovement[] | undefined) ?? [];

    const events: ProviderEvent[] = movements
      .filter((m) => m.timestamp)
      .map((m) => ({
        rawStatus:   m.event,
        location:    m.location?.name ?? m.location?.iata ?? "",
        description: AIR_EVENT_DESC[m.event] ?? m.event,
        timestamp:   new Date(m.timestamp),
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const transport = [...movements].reverse().find((m) => m.flight?.number);
    const status = String(shipment.status ?? "");

    if (events.length === 0 && !route?.airport_of_departure) {
      return this.fail(
        awbNumber,
        status === "UNTRACKED"
          ? "Shipsgo: AWB not trackable (invalid number or airline unsupported)"
          : `Shipsgo: no data yet (status=${status || "unknown"}).`,
      );
    }

    return {
      success:        true,
      provider:       this.name,
      trackingNumber: awbNumber,
      carrier:        airline?.name ?? "",
      events,
      eta:            route?.airport_of_arrival?.date_of_arrival
                       ? new Date(route.airport_of_arrival.date_of_arrival)
                       : undefined,
      etd:            route?.airport_of_departure?.date_of_departure
                       ? new Date(route.airport_of_departure.date_of_departure)
                       : undefined,
      origin:         route?.airport_of_departure?.location?.name ?? "",
      destination:    route?.airport_of_arrival?.location?.name ?? "",
      flight:         transport?.flight?.number ?? "",
      rawData:        shipment,
    };
  }

  // ── Helpers ────────────────────────────────────────────────
  private headers() {
    return {
      "X-Shipsgo-User-Token": this.apiKey,
      "Content-Type":         "application/json",
      "Accept":               "application/json",
    };
  }

  private fail(trackingNumber: string, error: string): ProviderResult {
    return { success: false, provider: this.name, trackingNumber, events: [], error };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/ocean/carriers?limit=1`, { headers: this.headers() });
      return res.ok;
    } catch {
      return false;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
