/**
 * Simulate the dispatcher's exact query — confirms no shipments
 * will be enqueued on the next poll cycle.
 */
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const willPoll = await p.shipment.findMany({
    where: { isActive: true },
    select: { trackingNumber: true, currentStatus: true, currentLocation: true },
  });
  console.log(`Dispatcher will poll ${willPoll.length} shipment(s) next cycle:`);
  if (willPoll.length) console.table(willPoll);
  else                 console.log("  (none — no API calls will be made)");
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
