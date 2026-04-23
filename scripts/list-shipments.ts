import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });
import { PrismaClient } from "@prisma/client";

(async () => {
  const p = new PrismaClient();
  const rows = await p.shipment.findMany({
    select: { id: true, trackingNumber: true, currentStatus: true, user: { select: { email: true } } },
  });
  console.log(`Total shipments: ${rows.length}`);
  for (const s of rows) {
    console.log(`  ${s.trackingNumber.padEnd(16)} ${s.currentStatus.padEnd(15)} /dashboard/shipments/${s.id}  (owner: ${s.user.email})`);
  }
  await p.$disconnect();
})();
