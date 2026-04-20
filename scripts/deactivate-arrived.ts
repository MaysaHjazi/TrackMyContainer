/**
 * Backfill: set isActive=false for shipments that have already arrived
 * (DELIVERED or AT_PORT). Run once after the policy change so existing
 * rows match the new rule without waiting for the next poll.
 */
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  const affected = await p.shipment.updateMany({
    where: {
      isActive:      true,
      currentStatus: { in: ["DELIVERED", "AT_PORT"] },
    },
    data: { isActive: false },
  });

  console.log(`Deactivated ${affected.count} arrived shipment(s)`);

  // Show final state
  const s = await p.shipment.findMany({
    select: {
      trackingNumber: true, currentStatus: true,
      currentLocation: true, isActive: true,
    },
  });
  console.table(s);

  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
