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

function listLine(s: ShipmentRow): string {
  const status = getStatusLabel(s.currentStatus);
  const where = s.currentLocation ? `, ${s.currentLocation}` : "";
  const eta = s.etaDate ? ` — ${etaPhrase(s.etaDate)}` : "";
  return `•  ${s.trackingNumber} — ${status}${where}${eta}`;
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
        take: 20,
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

  const ships = user.shipments as ShipmentRow[];
  const t = text.trim();

  // A specific shipment number?
  if (TRACKING_LIKE.test(t) && !/^my\b/i.test(t)) {
    const hit = ships.find(
      (s) => s.trackingNumber.toUpperCase() === t.toUpperCase(),
    );
    if (hit) return [detailCard(hit)];
    return [
      `That shipment isn't in your account.\n\n` +
        `Send "my shipments" to see what you're tracking. 🚢`,
    ];
  }

  // Otherwise → the shipments overview.
  if (ships.length === 0) {
    return [
      `${BRAND}\n\n` +
        `You don't have any shipments yet.\n` +
        `Add one from your dashboard → trackmycontainer.info`,
    ];
  }

  const body = ships.slice(0, 15).map(listLine).join("\n");
  return [
    `${BRAND}\n\n` +
      `Welcome back. Here's where your shipments stand:\n\n` +
      `${body}\n\n` +
      `Send a shipment number for the full story.`,
  ];
}
