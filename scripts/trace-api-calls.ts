/**
 * Show the last 30 tracking_queries entries with timestamps + provider
 * + cacheHit so we can prove exactly when calls happen and what they
 * cost.
 */
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const rows = await p.trackingQuery.findMany({
    where:   { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take:    30,
    include: { user: { select: { email: true } } },
  });

  // Group by provider
  const byProvider: Record<string, number> = {};
  const cacheHits: Record<string, number> = {};
  for (const r of rows) {
    byProvider[(r.provider ?? "unknown")] = (byProvider[(r.provider ?? "unknown")] ?? 0) + 1;
    if (r.cacheHit) cacheHits[(r.provider ?? "unknown")] = (cacheHits[(r.provider ?? "unknown")] ?? 0) + 1;
  }

  console.log("\n══════════════ TODAY's API CALLS ══════════════");
  console.log(`Total today: ${rows.length}`);
  for (const [prov, n] of Object.entries(byProvider)) {
    const hits = cacheHits[prov] ?? 0;
    console.log(`  ${prov.padEnd(12)} ${n.toString().padStart(3)} calls  (${hits} from cache, ${n - hits} hit the provider)`);
  }

  console.log("\n══════════════ LAST 30 ENTRIES ══════════════");
  console.log("time              provider     tracking#       cache?  user");
  console.log("────────────────  ──────────   ──────────────  ──────  ─────────────────────");
  for (const r of rows) {
    const t = r.createdAt.toLocaleTimeString("en-GB", { hour12: false });
    const date = r.createdAt.toISOString().slice(5, 10);
    console.log(
      `${date} ${t}  ${(r.provider ?? "unknown").padEnd(11)}  ${r.trackingNumber.padEnd(14)}  ${r.cacheHit ? "✓ HIT" : "  call"}  ${r.user?.email ?? "(anonymous /api/track)"}`,
    );
  }

  // Count by hour-bucket to expose cadence
  console.log("\n══════════════ CADENCE — calls per hour today ══════════════");
  const perHour: Record<string, { shipsgo: number; jsoncargo: number }> = {};
  const allToday = await p.trackingQuery.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, provider: true },
  });
  for (const r of allToday) {
    const h = r.createdAt.toISOString().slice(11, 13) + ":00";
    if (!perHour[h]) perHour[h] = { shipsgo: 0, jsoncargo: 0 };
    if ((r.provider ?? "unknown") === "shipsgo")   perHour[h].shipsgo++;
    if ((r.provider ?? "unknown") === "jsoncargo") perHour[h].jsoncargo++;
  }
  for (const [h, c] of Object.entries(perHour).sort()) {
    const bar = "█".repeat(c.shipsgo + c.jsoncargo);
    console.log(`  ${h}  shipsgo=${c.shipsgo}  jsoncargo=${c.jsoncargo}  ${bar}`);
  }

  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
