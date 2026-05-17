/**
 * PRO-only, READ-ONLY WhatsApp assistant (UltraMsg transport).
 *
 * - Identity: inbound phone → User.phone (digits) where plan != FREE.
 * - Scope: the user's OWN account shipments only. No external tracking,
 *   no ADD, NO backend writes to business data — pure reads of the
 *   Shipment table. (The isolated WhatsappSession table is used only
 *   for lightweight conversation state.)
 * - FREE / unknown numbers: one polite "PRO feature" line.
 * - English, warm sentence style, no native buttons.
 *
 * Flow: the assistant first asks what the user wants —
 *   1) full details for a specific shipment, or
 *   2) a report on all shipments.
 * Sending a tracking number anytime is a shortcut to full details.
 *
 * Gating (master switch + test allowlist) is enforced by the webhook
 * before this is ever called — see wa-gate.ts.
 */

import type { ShipmentStatus } from "@prisma/client";
import { prisma } from "@/backend/lib/db";
import { formatDate, getStatusLabel } from "@/lib/utils";

const BRAND = "Track My Container 🚢";

const FREE_MSG =
  `${BRAND}\n\n` +
  "WhatsApp shipment tracking is a PRO feature.\n" +
  "Learn more → trackmycontainer.info";

function digits(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

function daysTo(d: Date | null | undefined): number | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.ceil((t - Date.now()) / 86_400_000));
}

type EventRow = {
  status: string;
  location: string | null;
  description: string | null;
  eventDate: Date;
};

type ShipmentRow = {
  trackingNumber: string;
  type: string;
  currentStatus: ShipmentStatus;
  currentLocation: string | null;
  carrier: string | null;
  origin: string | null;
  destination: string | null;
  vesselName: string | null;
  voyageNumber: string | null;
  flightNumber: string | null;
  etdDate: Date | null;
  atdDate: Date | null;
  etaDate: Date | null;
  ataDate: Date | null;
  updatedAt: Date;
  nickname: string | null;
  trackingEvents: EventRow[];
};

const SHIP_SELECT = {
  trackingNumber: true,
  type: true,
  currentStatus: true,
  currentLocation: true,
  carrier: true,
  origin: true,
  destination: true,
  vesselName: true,
  voyageNumber: true,
  flightNumber: true,
  etdDate: true,
  atdDate: true,
  etaDate: true,
  ataDate: true,
  updatedAt: true,
  nickname: true,
  trackingEvents: {
    orderBy: { eventDate: "desc" as const },
    take: 1,
    select: {
      status: true,
      location: true,
      description: true,
      eventDate: true,
    },
  },
} as const;

function etaPhrase(eta: Date | null): string {
  if (!eta) return "ETA not available yet";
  const d = formatDate(eta);
  const n = daysTo(eta);
  if (n == null) return `arriving ${d}`;
  if (n === 0) return `arriving today (${d})`;
  return `arriving in ~${n} ${n === 1 ? "day" : "days"} (${d})`;
}

function listEntry(s: ShipmentRow, i: number): string {
  const status = getStatusLabel(s.currentStatus);
  const where = s.currentLocation ? ` · ${s.currentLocation}` : "";
  const eta = s.etaDate ? `\n     ${etaPhrase(s.etaDate)}` : "";
  return `${i}.  *${s.trackingNumber}*\n     ${status}${where}${eta}`;
}

/** Full, detailed card — every field we have, only if present. */
function detailCard(s: ShipmentRow): string {
  const L: string[] = [`📦  *${s.trackingNumber}*`];
  if (s.nickname) L.push(`“${s.nickname}”`);
  L.push("");

  L.push(`📍  Status:  ${getStatusLabel(s.currentStatus)}`);
  if (s.currentLocation) L.push(`📌  Location:  ${s.currentLocation}`);
  L.push(`🚢  Mode:  ${s.type === "AIR" ? "Air cargo" : "Sea container"}`);
  if (s.carrier) L.push(`🏷️  Carrier:  ${s.carrier}`);
  if (s.origin || s.destination)
    L.push(`🗺️  Route:  ${s.origin ?? "—"}  →  ${s.destination ?? "—"}`);
  if (s.vesselName)
    L.push(
      `⚓  Vessel:  ${s.vesselName}${s.voyageNumber ? ` (voyage ${s.voyageNumber})` : ""}`,
    );
  if (s.flightNumber) L.push(`✈️  Flight:  ${s.flightNumber}`);

  L.push("");
  if (s.etdDate) L.push(`🛫  Departed (planned):  ${formatDate(s.etdDate)}`);
  if (s.atdDate) L.push(`🛫  Departed (actual):  ${formatDate(s.atdDate)}`);
  if (s.ataDate) {
    L.push(`🛬  Arrived:  ${formatDate(s.ataDate)} ✅`);
  } else if (s.etaDate) {
    const n = daysTo(s.etaDate);
    const tail =
      n == null
        ? formatDate(s.etaDate)
        : n === 0
          ? `${formatDate(s.etaDate)} — today 🗓`
          : `${formatDate(s.etaDate)} — about ${n} ${n === 1 ? "day" : "days"} to go 🗓`;
    L.push(`🛬  ETA:  ${tail}`);
  }

  const ev = s.trackingEvents[0];
  if (ev) {
    L.push("");
    const evWhere = ev.location ? ` at ${ev.location}` : "";
    const evDesc = ev.description ? ` — ${ev.description}` : "";
    L.push(
      `🕒  Last update (${formatDate(ev.eventDate)}):\n     ${ev.status}${evWhere}${evDesc}`,
    );
  }

  L.push("", `━━━━━━━━━━━━`, `Send another number, or “report” for all.`);
  return L.join("\n");
}

function isArrived(s: ShipmentRow): boolean {
  const l = getStatusLabel(s.currentStatus).toLowerCase();
  return !!s.ataDate || l.includes("arriv") || l.includes("deliver");
}

/**
 * Report = every shipment that has NOT arrived yet (still on the way),
 * each shown with its list position so the user can ask for full
 * details. The summary line still counts ALL shipments.
 */
function buildReport(ships: ShipmentRow[]): string[] {
  const label = (s: ShipmentRow) =>
    getStatusLabel(s.currentStatus).toLowerCase();
  const delayed = ships.filter((s) => label(s).includes("delay")).length;
  const arrived = ships.filter(isArrived).length;
  const moving = ships.length - arrived;

  // Keep original positions so "2" maps to the same shipment as the
  // pick-list / shortcut.
  const pending = ships
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !isArrived(s));

  const future = pending
    .map(({ s }) => s.etaDate)
    .filter((d): d is Date => !!d && new Date(d).getTime() > Date.now())
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const next =
    future.length > 0
      ? `Next arrival: ${formatDate(future[0])} (in ${daysTo(future[0])} days).`
      : `No upcoming arrivals.`;

  const head =
    `📊  Shipments report\n\n` +
    `Total: ${ships.length}  ·  On the way: ${moving}  ·  ` +
    `Delayed: ${delayed}  ·  Arrived: ${arrived}\n` +
    `${next}\n\n` +
    (pending.length === 0
      ? `🎉 All your shipments have arrived.`
      : `Still on the way (${pending.length}):`);

  if (pending.length === 0) return [head];

  const footer = `Reply with a number (e.g. 2) or a shipment number for full details.`;
  const MAX = 3500;
  const msgs: string[] = [];
  let cur = head;
  pending.forEach(({ s, i }) => {
    const entry = `\n\n${listEntry(s, i + 1)}`;
    if (cur.length + entry.length > MAX) {
      msgs.push(cur);
      cur = entry.trimStart();
    } else {
      cur += entry;
    }
  });
  cur += `\n\n${footer}`;
  msgs.push(cur);
  return msgs;
}

function buildPickList(ships: ShipmentRow[]): string[] {
  const head = `Your shipments — pick one for full details:`;
  const footer = `Reply with a number (e.g. 2) for the full details.`;
  const MAX = 3500;
  const msgs: string[] = [];
  let cur = head;
  ships.forEach((s, i) => {
    const entry = `\n\n${listEntry(s, i + 1)}`;
    if (cur.length + entry.length > MAX) {
      msgs.push(cur);
      cur = entry.trimStart();
    } else {
      cur += entry;
    }
  });
  cur += `\n\n${footer}`;
  msgs.push(cur);
  return msgs;
}

function chooser(fresh: boolean): string {
  return (
    `${fresh ? `${BRAND}\n\n` : ""}` +
    `How can I help you?\n\n` +
    `1️⃣  Full details for a specific shipment\n` +
    `2️⃣  A report on all your shipments\n\n` +
    `Reply *1* or *2* — or just send a shipment number anytime.`
  );
}

// ── Session (isolated WhatsappSession table only) ────────────────
const FRESH_MS = 6 * 60 * 60 * 1000;

async function loadSession(phone: string): Promise<{ fresh: boolean; state: string }> {
  const s = await prisma.whatsappSession.findUnique({
    where: { phoneNumber: phone },
    select: { lastMessageAt: true, state: true },
  });
  const fresh =
    !s?.lastMessageAt ||
    Date.now() - new Date(s.lastMessageAt).getTime() > FRESH_MS;
  return { fresh, state: s?.state ?? "MENU" };
}

async function saveSession(phone: string, state: string): Promise<void> {
  await prisma.whatsappSession.upsert({
    where: { phoneNumber: phone },
    update: { state, lang: "en", lastMessageAt: new Date(), messageCount: { increment: 1 } },
    create: {
      phoneNumber: phone,
      state,
      lang: "en",
      lastMessageAt: new Date(),
      messageCount: 1,
    },
  });
}

async function findProUser(phone: string) {
  const want = digits(phone);
  if (!want) return null;
  const candidates = await prisma.user.findMany({
    where: {
      phone: { not: null },
      subscription: { plan: { in: ["PRO", "CUSTOM"] } },
    },
    select: {
      id: true,
      phone: true,
      shipments: {
        orderBy: [{ etaDate: "asc" }, { createdAt: "desc" }],
        take: 200,
        select: SHIP_SELECT,
      },
    },
  });
  return candidates.find((u) => u.phone && digits(u.phone) === want) ?? null;
}

const RE_GREET = /\b(hi|hello|hey|start|menu|main)\b/i;
const RE_GREET_AR = /(مرحبا|مرحبًا|هلا|السلام|اهلا|أهلا|قائمة|ابدأ)/;
const RE_REPORT = /\b(report|summary|overview|digest)\b/i;
const RE_REPORT_AR = /(تقرير|ملخص|ملخّص|نظرة عامة)/;
const RE_ALL =
  /\b(all|everything|every|list|shipments?|containers?)\b/i;
const RE_ALL_AR = /(كل|الكل|شحنات|قائمة)/;

/**
 * Handle one inbound turn. Returns the reply text(s) to send back.
 * Reads business data only; writes only the isolated session row.
 */
export async function handleProTurn(
  phone: string,
  text: string,
): Promise<string[]> {
  const user = await findProUser(phone);
  if (!user) return [FREE_MSG];

  const { fresh, state } = await loadSession(phone);
  const ships = user.shipments as unknown as ShipmentRow[];
  const t = text.trim();
  const low = t.toLowerCase();

  if (ships.length === 0) {
    await saveSession(phone, "MENU");
    return [
      `${BRAND}\n\nYou don't have any shipments yet.\n` +
        `Add one from your dashboard → trackmycontainer.info`,
    ];
  }

  // Shortcut: an explicit tracking number anywhere → full details.
  const tokens = t.split(/[^A-Za-z0-9-]+/).filter(Boolean);
  const numToken = tokens.find(
    (tok) => /\d/.test(tok) && /^[A-Za-z0-9-]{6,}$/.test(tok),
  );
  if (numToken) {
    const hit = ships.find(
      (s) => s.trackingNumber.toUpperCase() === numToken.toUpperCase(),
    );
    await saveSession(phone, "LISTED");
    if (hit) return [detailCard(hit)];
    return [
      `That shipment isn't in your account.\n\n` +
        `Reply *2* for a report on all your shipments. 🚢`,
    ];
  }

  // Explicit report request.
  if (RE_REPORT.test(low) || RE_REPORT_AR.test(t)) {
    await saveSession(phone, "LISTED");
    return buildReport(ships);
  }

  // Greeting / fresh / "menu" → the chooser.
  if (fresh || RE_GREET.test(low) || RE_GREET_AR.test(t)) {
    await saveSession(phone, "MENU");
    return [chooser(fresh)];
  }

  // In the chooser: 1 = details mode, 2 = report.
  if (state === "MENU") {
    if (t === "1") {
      await saveSession(phone, "LISTED");
      return buildPickList(ships);
    }
    if (t === "2") {
      await saveSession(phone, "LISTED");
      return buildReport(ships);
    }
    if (RE_ALL.test(low) || RE_ALL_AR.test(t)) {
      await saveSession(phone, "LISTED");
      return buildReport(ships);
    }
    await saveSession(phone, "MENU");
    return [chooser(false)];
  }

  // Picking a shipment by list position (after option 1 or a report).
  const m = t.match(/\b(\d{1,3})\b/);
  if (m) {
    const idx = parseInt(m[1], 10) - 1;
    await saveSession(phone, "LISTED");
    if (idx >= 0 && idx < ships.length) return [detailCard(ships[idx])];
    return [
      `You have ${ships.length} shipment${ships.length === 1 ? "" : "s"}. ` +
        `Reply *2* to see the full report. 🚢`,
    ];
  }

  // "all my shipments" etc.
  if (RE_ALL.test(low) || RE_ALL_AR.test(t)) {
    await saveSession(phone, "LISTED");
    return buildReport(ships);
  }

  // Anything else → re-offer the two clear choices.
  await saveSession(phone, "MENU");
  return [chooser(false)];
}
