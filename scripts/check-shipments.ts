import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const s = await p.shipment.findMany({
    select: {
      trackingNumber:  true,
      type:            true,
      currentStatus:   true,
      currentLocation: true,
      isActive:        true,
      etaDate:         true,
      lastPolledAt:    true,
    },
  });
  console.table(s);
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
