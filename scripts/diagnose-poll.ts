/**
 * Diagnostic dump for tracking polling.
 *
 * Run on the VPS:
 *   docker compose -f docker-compose.prod.yml exec -T worker npx tsx scripts/diagnose-poll.ts
 *
 * Prints:
 *   - Each shipment's state (status, isActive, isLiveTracking, lastPolledAt, age)
 *   - How many events each shipment has, plus the latest one
 *   - Last 30 tracking-related audit log entries
 *   - BullMQ queue stats (pending / active / failed)
 */
import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import IORedis from "ioredis";

function fmt(d: Date | null | undefined) {
  if (!d) return "—";
  const ago = Date.now() - d.getTime();
  const min = Math.round(ago / 60_000);
  const h   = (min / 60).toFixed(1);
  return `${d.toISOString()} (${min < 90 ? min + "min" : h + "h"} ago)`;
}

async function main() {
  const prisma = new PrismaClient();

  // ─── Shipments ──────────────────────────────────────────────
  console.log("\n══════════════════════════ SHIPMENTS ══════════════════════════");
  const ships = await prisma.shipment.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { trackingEvents: true } },
      trackingEvents: { orderBy: { eventDate: "desc" }, take: 1 },
      user:           { select: { email: true } },
    },
  });
  for (const s of ships) {
    console.log(`\n  ${s.trackingNumber}  (${s.type})  user=${s.user?.email}`);
    console.log(`    provider:        ${s.trackingProvider}    plan-live?  ${s.isLiveTracking}`);
    console.log(`    currentStatus:   ${s.currentStatus}        active?     ${s.isActive}`);
    console.log(`    location:        ${s.currentLocation ?? "—"}`);
    console.log(`    eta / atd / ata: ${s.etaDate?.toISOString() ?? "—"} / ${s.atdDate?.toISOString() ?? "—"} / ${s.ataDate?.toISOString() ?? "—"}`);
    console.log(`    notifyEmail:     ${s.notifyEmail}      notifyWhatsapp: ${s.notifyWhatsapp}`);
    console.log(`    events:          ${s._count.trackingEvents}    lastPolled: ${fmt(s.lastPolledAt)}`);
    console.log(`    updatedAt:       ${fmt(s.updatedAt)}`);
    if (s.trackingEvents[0]) {
      const e = s.trackingEvents[0];
      console.log(`    latestEvent:     ${e.status} @ ${e.eventDate.toISOString()}  ${e.location ?? ""}  — ${e.description ?? ""}`);
    }
  }

  // ─── Audit log ──────────────────────────────────────────────
  console.log("\n══════════════════════════ AUDIT LOG (last 30) ══════════════════════════");
  const logs = await prisma.auditLog.findMany({
    where:   { type: { startsWith: "tracking." } },
    orderBy: { createdAt: "desc" },
    take:    30,
  });
  for (const l of logs) {
    console.log(`  ${l.createdAt.toISOString()}  [${l.level}] ${l.type}  ${l.message}`);
  }
  if (logs.length === 0) console.log("  (no tracking.* entries — worker has not logged anything)");

  // ─── Notifications ──────────────────────────────────────────
  console.log("\n══════════════════════════ RECENT NOTIFICATIONS (last 20) ══════════════════════════");
  const notifs = await prisma.notification.findMany({
    orderBy: { sentAt: "desc" },
    take:    20,
  });
  for (const n of notifs) {
    console.log(`  ${n.sentAt?.toISOString() ?? "queued"}  ${n.channel}  ${n.type}  status=${n.status}  ship=${n.shipmentId}`);
  }
  if (notifs.length === 0) console.log("  (no notifications in DB at all)");

  // ─── Queue state ────────────────────────────────────────────
  console.log("\n══════════════════════════ BULLMQ QUEUES ══════════════════════════");
  const redis = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null, enableReadyCheck: false });
  const queues = ["tracking-poll", "tracking-dispatcher", "notification-send"];
  for (const name of queues) {
    const q = new Queue(name, { connection: redis });
    const counts = await q.getJobCounts("waiting", "active", "delayed", "failed", "completed");
    console.log(`  ${name.padEnd(22)}  waiting=${counts.waiting}  active=${counts.active}  delayed=${counts.delayed}  failed=${counts.failed}  completed=${counts.completed}`);
    const failed = await q.getFailed(0, 4);
    for (const f of failed) {
      console.log(`    ↳ failed  id=${f.id}  reason=${(f.failedReason ?? "").slice(0, 200)}`);
    }
    await q.close();
  }
  await redis.quit();

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
