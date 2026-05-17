/**
 * PRO-only, READ-ONLY WhatsApp assistant (UltraMsg transport).
 *
 * - Identity: inbound phone → User.phone (digits) where plan != FREE.
 * - Scope: the user's OWN account shipments only. No external tracking,
 *   no ADD, NO backend writes — pure reads of the Shipment table.
 * - FREE / unknown numbers: one polite "PRO feature" line.
 * - English, warm sentence style, no buttons/menus.
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

// One token, has a digit, ≥ 6 chars → looks like a tracking number.
const TRACKING_LIKE = /^(?=[A-Za-z0-9-]{6,}$)(?=.*\d)[A-Za-z0-9-]+$/;

function digits(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

function daysTo(d: Date | null | undefined): number | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.ceil((t - Date.now()) / 86_400_000));
}

type ShipmentRow = {
  trackingNumber: string;
  currentStatus: ShipmentStatus;
  currentLocation: string | null;
  etaDate: Date | null;
  updatedAt: Date;
  trackingEvents: { eventDate: Date }[];
};

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
  // Number on its own line (bold) so it's easy to read & copy,
  // detail indented below, each shipment separated by a blank line.
  return `${i}.  *${s.trackingNumber}*\n     ${status}${where}${eta}`;
}

function detailCard(s: ShipmentRow): string {
  const status = getStatusLabel(s.currentStatus);
  const lastEvent = s.trackingEvents[0]?.eventDate ?? s.updatedAt;
  const seen = `last updated ${formatDate(lastEvent)}`;
  const loc = s.currentLocation ? `, last seen at ${s.currentLocation}` : "";
  const lines = [
    `📦  ${s.trackingNumber}`,
    "",
    `Currently ${status}${loc} — ${seen}.`,
  ];
  if (s.etaDate) {
    const n = daysTo(s.etaDate);
    const tail =
      n == null
        ? `Expected on ${formatDate(s.etaDate)}.`
        : n === 0
          ? `Expected to arrive today (${formatDate(s.etaDate)}). 🗓`
          : `Expected to arrive on ${formatDate(s.etaDate)} — about ${n} ${n === 1 ? "day" : "days"} away. 🗓`;
    lines.push("", tail);
  }
  return lines.join("\n");
}

// Treat the conversation as "fresh" (show the welcome) if we haven't
// heard from this number in the last 6 hours. Uses the isolated
// WhatsappSession table only — never touches business data.
const FRESH_MS = 6 * 60 * 60 * 1000;

async function isFreshConversation(phone: string): Promise<boolean> {
  const s = await prisma.whatsappSession.findUnique({
    where: { phoneNumber: phone },
    select: { lastMessageAt: true },
  });
  const fresh =
    !s?.lastMessageAt ||
    Date.now() - new Date(s.lastMessageAt).getTime() > FRESH_MS;
  await prisma.whatsappSession.upsert({
    where: { phoneNumber: phone },
    update: { lastMessageAt: new Date(), messageCount: { increment: 1 } },
    create: {
      phoneNumber: phone,
      state: "MAIN",
      lang: "en",
      lastMessageAt: new Date(),
      messageCount: 1,
    },
  });
  return fresh;
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
      name: true,
      phone: true,
      shipments: {
        orderBy: [{ etaDate: "asc" }, { createdAt: "desc" }],
        take: 200,
        select: {
          trackingNumber: true,
          currentStatus: true,
          currentLocation: true,
          etaDate: true,
          updatedAt: true,
          trackingEvents: {
            orderBy: { eventDate: "desc" },
            take: 1,
            select: { eventDate: true },
          },
        },
      },
    },
  });
  return (
    candidates.find((u) => u.phone && digits(u.phone) === want) ?? null
  );
}

/**
 * Handle one inbound turn. Returns the reply text(s) to send back.
 * Read-only — never writes to the DB.
 */
export async function handleProTurn(
  phone: string,
  text: string,
): Promise<string[]> {
  const user = await findProUser(phone);
  if (!user) return [FREE_MSG];

  const fresh = await isFreshConversation(phone);
  const ships = user.shipments as ShipmentRow[];
  const t = text.trim();
  // Anything that *means* "show me my shipments / all of them" —
  // English or Arabic — counts, not just the literal word "list".
  const wantsList =
    /\b(hi|hello|hey|start|menu|list|all|every|everything|shipments?|containers?|status|update[s]?|track(ing)?|show|give|see|where)\b/i.test(
      t,
    ) ||
    /(شحن|الكل|كل|تتبع|وين|اعطيني|أعطيني|ورّيني|وريني|قائمة|حالة|تحديث)/.test(
      t,
    );
  // A report / summary request.
  const wantsReport =
    /\b(report|summary|overview|digest)\b/i.test(t) ||
    /(تقرير|ملخص|ملخّص|نظرة عامة)/.test(t);

  // 1) A shipment number mentioned ANYWHERE in the message
  //    ("what about MAEU9184879", "MAEU9184879?", "track CAIU2444270").
  const tokens = t.split(/[^A-Za-z0-9-]+/).filter(Boolean);
  const numToken = tokens.find(
    (tok) => /\d/.test(tok) && /^[A-Za-z0-9-]{6,}$/.test(tok),
  );
  if (numToken) {
    const hit = ships.find(
      (s) => s.trackingNumber.toUpperCase() === numToken.toUpperCase(),
    );
    if (hit) return [detailCard(hit)];
    return [
      `That shipment isn't in your account.\n\n` +
        `Type *list* to see what you're tracking. 🚢`,
    ];
  }

  // 2) A list position mentioned ANYWHERE ("2", "and 1 ?",
  //    "what about 3", "number 2 please") — not when asking for the list.
  if (!wantsList) {
    const m = t.match(/\b(\d{1,2})\b/);
    if (m) {
      const idx = parseInt(m[1], 10) - 1;
      if (idx >= 0 && idx < ships.length) return [detailCard(ships[idx])];
      if (ships.length)
        return [
          `You only have ${ships.length} shipment${ships.length === 1 ? "" : "s"}. ` +
            `Type *list* to see them. 🚢`,
        ];
    }
  }

  if (ships.length === 0) {
    return [
      `${BRAND}\n\n` +
        `You don't have any shipments yet.\n` +
        `Add one from your dashboard → trackmycontainer.info`,
    ];
  }

  // Show the full welcome + list ONLY on a fresh conversation or when
  // the user explicitly asks for it. Mid-conversation, an
  // unrecognized message gets a short nudge — no repeated welcome.
  if (fresh || wantsList || wantsReport) {
    // Show ALL of the user's shipments. WhatsApp caps a single
    // message (~4096 chars), so split into multiple messages when
    // the list is long — the user still gets every shipment.
    let head: string;
    if (wantsReport) {
      const label = (s: ShipmentRow) => getStatusLabel(s.currentStatus).toLowerCase();
      const delayed = ships.filter((s) => label(s).includes("delay")).length;
      const arrived = ships.filter(
        (s) => label(s).includes("arriv") || label(s).includes("deliver"),
      ).length;
      const moving = ships.length - delayed - arrived;
      const future = ships
        .map((s) => s.etaDate)
        .filter((d): d is Date => !!d && new Date(d).getTime() > Date.now())
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      const next =
        future.length > 0
          ? `Next arrival: ${formatDate(future[0])} (in ${daysTo(future[0])} days).`
          : `No upcoming arrivals.`;
      head =
        `📊  Shipments report\n\n` +
        `Total: ${ships.length}  ·  In transit: ${moving}  ·  ` +
        `Delayed: ${delayed}  ·  Arrived: ${arrived}\n` +
        `${next}\n\n` +
        `Details:`;
    } else {
      head = fresh
        ? `${BRAND}\n\nHere are your shipments:`
        : `Your shipments:`;
    }
    const footer =
      `Reply with a list number (e.g. 1) or the full shipment number for details.`;
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

  return [
    `Send a shipment number or its list position for details.\n` +
      `Type *list* to see all your shipments. 🚢`,
  ];
}
