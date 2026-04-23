/**
 * One-off helper: re-poll a single shipment against JSONCargo and persist
 * any new events. Reimplements the jsoncargo provider + event-normalizer
 * inline so the script is self-contained and doesn't fight tsx path aliases.
 *
 * Usage:
 *   npx tsx scripts/repoll-shipment.ts MAEU9184879
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Resolve .env.local relative to this script, not the shell's cwd
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

import { PrismaClient, ShipmentStatus } from "@prisma/client";

const PREFIX_TO_SHIPPING_LINE: Record<string, string> = {
  MAEU: "MAERSK", MRKU: "MAERSK", MSKU: "MAERSK", MSAU: "MAERSK",
  MSCU: "MSC",    MEDU: "MSC",
  CMAU: "CMA CGM", CGMU: "CMA CGM", APLU: "CMA CGM",
  HLCU: "HAPAG-LLOYD", HLXU: "HAPAG-LLOYD", UACU: "HAPAG-LLOYD",
  COSU: "COSCO", CCLU: "COSCO",
  EISU: "EVERGREEN", EMCU: "EVERGREEN", BMOU: "EVERGREEN",
};

function parseJCDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const normalized = raw.replace(";", "").replace(/\s+/, "T");
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

/** Map JSONCargo raw status → canonical ShipmentStatus. Kept minimal — just
 *  the statuses this script can emit from the 3 events it builds. */
function normalizeStatus(raw: string): ShipmentStatus {
  const s = raw.toUpperCase();
  if (/DEPART/.test(s))                 return "IN_TRANSIT";
  if (/IN[_ ]TRANSIT/.test(s))          return "IN_TRANSIT";
  if (/TRANSSHIP|DISCHARGE.*TRANS/.test(s)) return "TRANSSHIPMENT";
  if (/DISCHARGE|ARRIV|DELIVER/.test(s)) return "AT_PORT";
  return "IN_TRANSIT";
}

interface JCData {
  container_id?: string;
  container_status?: string;
  shipping_line_name?: string;
  shipped_from?: string;
  shipped_from_terminal?: string;
  shipped_to?: string;
  atd_origin?: string | null;
  eta_final_destination?: string | null;
  last_location?: string;
  last_location_terminal?: string;
  next_location?: string;
  atd_last_location?: string | null;
  timestamp_of_last_location?: string | null;
  last_movement_timestamp?: string | null;
  last_vessel_name?: string;
  last_voyage_number?: string;
  current_vessel_name?: string;
  current_voyage_number?: string;
  last_updated?: string;
}

interface Event {
  status:      ShipmentStatus;
  location:    string | undefined;
  description: string;
  eventDate:   Date;
  source:      string;
}

async function main() {
  const trackingNumber = process.argv[2]?.toUpperCase();
  if (!trackingNumber) {
    console.error("usage: tsx scripts/repoll-shipment.ts <TRACKING_NUMBER>");
    process.exit(1);
  }

  const apiKey = process.env.JSONCARGO_API_KEY;
  if (!apiKey) { console.error("JSONCARGO_API_KEY missing"); process.exit(1); }

  const prisma = new PrismaClient();

  const shipment = await prisma.shipment.findFirst({ where: { trackingNumber } });
  if (!shipment) {
    console.error(`[repoll] Shipment ${trackingNumber} not found`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const prefix       = trackingNumber.slice(0, 4);
  const shippingLine = PREFIX_TO_SHIPPING_LINE[prefix];
  const url          = new URL(`https://api.jsoncargo.com/api/v1/containers/${encodeURIComponent(trackingNumber)}`);
  if (shippingLine) url.searchParams.set("shipping_line", shippingLine);

  console.log(`[repoll] GET ${url.toString()}`);
  const res = await fetch(url.toString(), {
    headers: { "x-api-key": apiKey, Accept: "application/json" },
  });

  if (!res.ok) {
    console.error(`[repoll] HTTP ${res.status}: ${await res.text()}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const json = await res.json() as { data?: JCData };
  const d    = json.data;
  if (!d) { console.error("[repoll] No data in response"); await prisma.$disconnect(); process.exit(1); }

  // ── Build events with PAST-ONLY rule ───────────────────────────
  const now    = new Date();
  const isPast = (t: Date | null): t is Date => t !== null && t.getTime() <= now.getTime();
  const events: Event[] = [];

  const jcStatusRaw   = (d.container_status ?? "").trim();
  const jcStatusClean = jcStatusRaw.replace(/\s*\(.*\)\s*$/, "").trim();

  const isAtDestination = !!(d.last_location && d.shipped_to &&
    d.last_location.trim().toUpperCase() === d.shipped_to.trim().toUpperCase());

  // Event 1 — origin departure
  const departureTime = parseJCDate(d.atd_origin);
  if (isPast(departureTime) && d.shipped_from) {
    events.push({
      status:      "IN_TRANSIT",
      location:    d.shipped_from,
      description: `Departed from ${d.shipped_from}${d.shipped_from_terminal ? ` — ${d.shipped_from_terminal}` : ""}${d.last_vessel_name ? ` on ${d.last_vessel_name}${d.last_voyage_number ? ` (${d.last_voyage_number})` : ""}` : ""}`,
      eventDate:   departureTime,
      source:      "jsoncargo",
    });
  }

  // Event 2 — intermediate transshipment leg (NEW)
  const transitDeparture = parseJCDate(d.atd_last_location);
  if (
    isPast(transitDeparture) &&
    d.last_location &&
    (!departureTime || transitDeparture.getTime() !== departureTime.getTime())
  ) {
    const legVessel    = d.last_vessel_name;
    const vesselSuffix = legVessel
      ? ` on ${legVessel}${d.last_voyage_number ? ` (${d.last_voyage_number})` : ""}`
      : "";
    events.push({
      status:      "IN_TRANSIT",
      location:    d.last_location,
      description: `In transit bound for ${d.last_location}${vesselSuffix}`,
      eventDate:   transitDeparture,
      source:      "jsoncargo",
    });
  }

  // Event 3 — latest observation
  const lastMovement = parseJCDate(
    d.timestamp_of_last_location ?? d.last_movement_timestamp ?? d.last_updated,
  );
  if (isPast(lastMovement) && d.last_location) {
    let rawStatus: string;
    let description: string;
    const terminalSuffix = d.last_location_terminal ? ` — ${d.last_location_terminal}` : "";
    const vesselSuffix   = d.current_vessel_name
      ? ` (vessel: ${d.current_vessel_name}${d.current_voyage_number ? ` ${d.current_voyage_number}` : ""})`
      : "";

    if (isAtDestination) {
      rawStatus   = jcStatusClean && /discharge|arriv|deliver/i.test(jcStatusClean) ? jcStatusClean : "Arrived";
      description = `${rawStatus} at ${d.last_location}${terminalSuffix}${vesselSuffix}`;
    } else if (/discharge/i.test(jcStatusClean)) {
      rawStatus   = "Transshipment Discharge";
      description = `Discharged at transshipment port ${d.last_location}${terminalSuffix}${vesselSuffix}`;
    } else if (/load/i.test(jcStatusClean)) {
      rawStatus   = "Loaded on Transshipment";
      description = `Loaded for onward shipment at ${d.last_location}${terminalSuffix}${vesselSuffix}`;
    } else {
      rawStatus   = jcStatusClean || "In Transit";
      description = `${jcStatusClean || "Last seen at"} ${d.last_location}${terminalSuffix}${vesselSuffix}`;
    }

    events.push({
      status:      normalizeStatus(rawStatus),
      location:    d.last_location,
      description,
      eventDate:   lastMovement,
      source:      "jsoncargo",
    });
  }

  // Sort chronologically
  events.sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());

  console.log(`[repoll] Built ${events.length} events:`);
  for (const e of events) {
    console.log(`  • ${e.eventDate.toISOString()}  ${e.status.padEnd(14)}  ${e.location ?? ""}`);
    console.log(`     └─ ${e.description}`);
  }

  // Dedup vs. existing
  const existingDates = new Set(
    (await prisma.trackingEvent.findMany({
      where:  { shipmentId: shipment.id },
      select: { eventDate: true },
    })).map((e) => e.eventDate.toISOString()),
  );

  const newEvents = events.filter((e) => !existingDates.has(e.eventDate.toISOString()));

  if (newEvents.length === 0) {
    console.log("[repoll] No new events to insert.");
  } else {
    await prisma.trackingEvent.createMany({
      data: newEvents.map((e) => ({
        shipmentId:  shipment.id,
        status:      e.status,
        location:    e.location,
        description: e.description,
        eventDate:   e.eventDate,
        source:      e.source,
      })),
    });
    console.log(`[repoll] Inserted ${newEvents.length} new event(s).`);
  }

  // Update shipment summary from latest event
  const latest = events.at(-1);

  // ── Date mapping: estimated vs actual ─────────────────────────
  // atd_origin is ACTUAL (already happened), so it's ATD not ETD.
  // JSONCargo doesn't return a separate estimated-departure field.
  // eta_final_destination is JSONCargo's published estimate — but they
  // OVERWRITE it with the actual arrival date once arrived. To preserve
  // the original estimate for "ETA vs ATA" comparisons, we freeze the
  // saved eta once ata lands.
  const atdDate = parseJCDate(d.atd_origin);
  const rawEta  = parseJCDate(d.eta_final_destination);
  const ataDate = isAtDestination && isPast(lastMovement) ? lastMovement : null;

  // Detect redundant ETA = ATA from API (JSONCargo overwrites once arrived)
  const etaEqualsAta = !!(ataDate && rawEta && ataDate.getTime() === rawEta.getTime());

  let etaDate: Date | null;
  if (shipment.ataDate) {
    // already arrived — freeze existing, but clear if it's a redundant duplicate
    etaDate = (shipment.etaDate && shipment.ataDate.getTime() === shipment.etaDate.getTime())
      ? null
      : shipment.etaDate;
  } else if (ataDate) {
    // just arrived — keep the prior estimate only (no fallback to overwritten API value)
    etaDate = shipment.etaDate;
  } else {
    // in transit — refresh from API (unless API is obviously returning ATA as ETA)
    etaDate = etaEqualsAta ? null : rawEta;
  }

  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      currentStatus:   latest?.status ?? shipment.currentStatus,
      currentLocation: latest?.location ?? shipment.currentLocation,
      etdDate:         null,        // JSONCargo never provides a true ETD
      atdDate,
      etaDate,
      ataDate,
      vesselName:      d.current_vessel_name ?? d.last_vessel_name ?? shipment.vesselName,
      voyageNumber:    d.current_voyage_number ?? d.last_voyage_number ?? shipment.voyageNumber,
      lastPolledAt:    new Date(),
    },
  });

  const total = await prisma.trackingEvent.count({ where: { shipmentId: shipment.id } });
  console.log(`[repoll] Done. Shipment now has ${total} tracking event(s) total.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[repoll] ERROR:", err);
  process.exit(1);
});
