/**
 * Verify what the tracking history UI will show for a shipment.
 * Queries the DB exactly like the detail page does.
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

import { PrismaClient } from "@prisma/client";

async function main() {
  const trackingNumber = process.argv[2]?.toUpperCase() ?? "MAEU9184879";
  const prisma = new PrismaClient();

  const shipment = await prisma.shipment.findFirst({
    where: { trackingNumber },
    include: { trackingEvents: { orderBy: { eventDate: "desc" } } },
  });

  if (!shipment) {
    console.error(`Shipment ${trackingNumber} not found`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log("━".repeat(70));
  console.log(`SHIPMENT: ${shipment.trackingNumber}`);
  console.log("━".repeat(70));
  console.log(`Status:           ${shipment.currentStatus}`);
  console.log(`Current Location: ${shipment.currentLocation ?? "—"}`);
  console.log(`Origin:           ${shipment.origin ?? "—"}`);
  console.log(`Destination:      ${shipment.destination ?? "—"}`);
  console.log(`Vessel:           ${shipment.vesselName ?? "—"} ${shipment.voyageNumber ?? ""}`);
  console.log(`ETD:              ${shipment.etdDate?.toISOString() ?? "—"}`);
  console.log(`ATD:              ${shipment.atdDate?.toISOString() ?? "—  (JSONCargo doesn't return this)"}`);
  console.log(`ETA:              ${shipment.etaDate?.toISOString() ?? "—"}`);
  console.log(`ATA:              ${shipment.ataDate?.toISOString() ?? "—  (shown once container arrives)"}`);
  console.log(`Last Polled:      ${shipment.lastPolledAt?.toISOString() ?? "—"}`);
  console.log();
  console.log(`TRACKING HISTORY (${shipment.trackingEvents.length} events, newest first):`);
  console.log("─".repeat(70));

  const now = new Date();
  let futureCount = 0;

  for (let i = 0; i < shipment.trackingEvents.length; i++) {
    const e = shipment.trackingEvents[i];
    const isFuture = e.eventDate.getTime() > now.getTime();
    const marker = i === 0 ? "●" : "○";
    const label  = isFuture ? " ⚠ FUTURE!" : "";
    if (isFuture) futureCount++;
    console.log(`${marker} [${e.status.padEnd(13)}] ${e.eventDate.toISOString()}${label}`);
    console.log(`   Location:    ${e.location ?? "—"}`);
    console.log(`   Description: ${e.description}`);
    console.log();
  }

  console.log("━".repeat(70));
  console.log("VERIFICATION CHECKS:");
  console.log("━".repeat(70));
  console.log(`  Event count        = ${shipment.trackingEvents.length}  ${shipment.trackingEvents.length >= 3 ? "✅" : "❌"}`);
  console.log(`  No future events   = ${futureCount === 0 ? "✅ (0 future events — past-only rule working)" : `❌ (${futureCount} future events leaked!)`}`);
  console.log(`  ETA still set      = ${shipment.etaDate ? "✅ (in Key Dates panel only, not as event)" : "⚠  no ETA"}`);
  console.log(`  Current location   = ${shipment.currentLocation === "ALGECIRAS" ? "✅ ALGECIRAS" : `⚠  ${shipment.currentLocation}`}`);
  console.log(`  Vessel updated     = ${shipment.vesselName ? `✅ ${shipment.vesselName}` : "⚠  no vessel"}`);
  console.log();

  const status = futureCount === 0 && shipment.trackingEvents.length >= 3 ? "✅ PASS" : "❌ FAIL";
  console.log(`OVERALL: ${status}`);

  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
