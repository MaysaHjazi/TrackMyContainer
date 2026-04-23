/**
 * Re-poll every SEA shipment in the DB so the ATD/ATA fix lands on all
 * pages, not just the one we tested on.
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

import { spawnSync } from "child_process";
import { PrismaClient } from "@prisma/client";

(async () => {
  const p = new PrismaClient();
  const shipments = await p.shipment.findMany({
    where:  { type: "SEA" },
    select: { trackingNumber: true },
  });
  await p.$disconnect();

  console.log(`Re-polling ${shipments.length} SEA shipment(s):`);
  for (const s of shipments) {
    console.log("");
    console.log("━".repeat(70));
    console.log(`▶ ${s.trackingNumber}`);
    console.log("━".repeat(70));
    const r = spawnSync(
      "node",
      [
        resolve(__dirname, "..", "node_modules", "tsx", "dist", "cli.mjs"),
        resolve(__dirname, "repoll-shipment.ts"),
        s.trackingNumber,
      ],
      { stdio: "inherit" },
    );
    if (r.status !== 0) {
      console.log(`⚠  ${s.trackingNumber} failed — continuing.`);
    }
  }
})();
