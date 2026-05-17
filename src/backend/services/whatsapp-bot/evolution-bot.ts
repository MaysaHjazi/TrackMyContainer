/**
 * Arabic numbered-menu WhatsApp bot for the TEMPORARY Evolution API
 * (WhatsApp Web) integration. Completely separate from the official
 * English Meta bot (bot-engine.ts / bot-state.ts) — different
 * transport, different language, different entrypoint. Reuses the
 * existing trackShipment orchestrator and WhatsappTrackedShipment
 * table so saved shipments / proactive updates stay consistent.
 */

import { prisma } from "@/backend/lib/db";
import { trackShipment } from "@/backend/services/tracking";
import { formatDate, getStatusLabel } from "@/lib/utils";

const MENU =
  "مرحباً بك في Track My Container 👋\n\n" +
  "كيف يمكنني مساعدتك؟\n\n" +
  "1️⃣ تتبع شحنة\n" +
  "2️⃣ شحناتي المحفوظة\n" +
  "3️⃣ آخر التحديثات\n\n" +
  "أرسل رقم الخيار، أو أرسل رقم الكونتينر / الشحنة مباشرة.";

const ASK_TRACK =
  "📦 أرسل رقم الشحنة أو الكونتينر أو الـ BL أو AWB لتتبعها مباشرة.";

const NOT_FOUND =
  "❌ لم أتمكن من العثور على الشحنة.\n\nيرجى التأكد من الرقم وإعادة المحاولة.";

// Looks like a tracking identifier: one token, letters+digits, has a
// digit, length ≥ 8 (container/BL/AWB). Keeps plain words out.
const TRACKING_LIKE = /^(?=[A-Za-z0-9-]{8,}$)(?=.*\d)[A-Za-z0-9-]+$/;

type TrackResult = Awaited<ReturnType<typeof trackShipment>>;

function fmtResult(r: TrackResult): string {
  const lines = [
    "📦 معلومات الشحنة",
    "",
    "🔹 رقم الشحنة:",
    r.trackingNumber,
    "",
    "🚢 الحالة الحالية:",
    getStatusLabel(r.currentStatus),
  ];
  if (r.currentLocation) lines.push("", "📍 آخر موقع:", r.currentLocation);
  if (r.events?.length)
    lines.push("", "📅 آخر تحديث:", formatDate(r.events[r.events.length - 1].eventDate));
  if (r.etaDate) lines.push("", "⏱️ الوصول المتوقع:", formatDate(r.etaDate));
  lines.push("", "━━━━━━━━━━━━", "اكتب \"قائمة\" للرجوع للقائمة الرئيسية.");
  return lines.join("\n");
}

async function getState(phone: string): Promise<string> {
  const s = await prisma.whatsappSession.findUnique({ where: { phoneNumber: phone } });
  return s?.state ?? "MAIN";
}

async function setState(phone: string, state: string) {
  await prisma.whatsappSession.upsert({
    where: { phoneNumber: phone },
    update: { state, lang: "ar", lastMessageAt: new Date(), messageCount: { increment: 1 } },
    create: { phoneNumber: phone, state, lang: "ar", lastMessageAt: new Date(), messageCount: 1 },
  });
}

async function saveTracked(phone: string, r: TrackResult) {
  await prisma.whatsappTrackedShipment.upsert({
    where: { phoneNumber_trackingNumber: { phoneNumber: phone, trackingNumber: r.trackingNumber } },
    update: { lastStatus: getStatusLabel(r.currentStatus) },
    create: {
      phoneNumber: phone,
      trackingNumber: r.trackingNumber,
      trackingType: r.type,
      lastStatus: getStatusLabel(r.currentStatus),
    },
  });
}

async function listSaved(phone: string): Promise<string> {
  const rows = await prisma.whatsappTrackedShipment.findMany({
    where: { phoneNumber: phone },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  if (rows.length === 0) return "ما عندك شحنات محفوظة بعد.\n\nاكتب \"قائمة\" للرجوع.";
  const d = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
  const body = rows
    .map((r, i) => `${d[i] ?? `${i + 1}.`} ${r.trackingNumber}\n${r.lastStatus ?? "—"}`)
    .join("\n\n");
  return `📋 شحناتك المحفوظة:\n\n${body}`;
}

async function trackAndReply(phone: string, num: string): Promise<string> {
  try {
    const r = await trackShipment(num.trim());
    await saveTracked(phone, r);
    return fmtResult(r);
  } catch {
    return NOT_FOUND;
  }
}

/**
 * Drive one inbound turn. Returns the Arabic reply text(s) to send
 * back via Evolution.
 */
export async function handleEvolutionTurn(
  phone: string,
  text: string,
): Promise<string[]> {
  const t = text.trim();
  const low = t.toLowerCase();

  // Global escapes back to the menu.
  if (["قائمة", "القائمة", "menu", "start", "ابدأ", "رجوع"].includes(low)) {
    await setState(phone, "MAIN");
    return [MENU];
  }

  const state = await getState(phone);

  // Awaiting a tracking number after option 1.
  if (state === "AWAIT_TRACK") {
    await setState(phone, "MAIN");
    const reply = await trackAndReply(phone, t);
    return [reply, MENU];
  }

  // Option 1 — track a shipment.
  if (t === "1" || /تتبع/.test(t)) {
    await setState(phone, "AWAIT_TRACK");
    return [ASK_TRACK];
  }

  // Option 2 — saved shipments.
  if (t === "2" || /محفوظ/.test(t)) {
    await setState(phone, "MAIN");
    return [await listSaved(phone)];
  }

  // Option 3 — latest updates (status of saved shipments).
  if (t === "3" || /تحديث|اخر|آخر/.test(t)) {
    await setState(phone, "MAIN");
    const rows = await prisma.whatsappTrackedShipment.findMany({
      where: { phoneNumber: phone },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    if (rows.length === 0)
      return ["لا توجد تحديثات — ما عندك شحنات محفوظة بعد.\n\nاكتب \"قائمة\" للرجوع."];
    const body = rows
      .map((r) => `📦 ${r.trackingNumber}\n🚢 ${r.lastStatus ?? "—"}`)
      .join("\n\n");
    return [`🔔 آخر التحديثات:\n\n${body}`];
  }

  // Direct tracking-number detection.
  if (TRACKING_LIKE.test(t)) {
    await setState(phone, "MAIN");
    return [await trackAndReply(phone, t)];
  }

  // Anything else (greeting / unknown) → main menu.
  await setState(phone, "MAIN");
  return [MENU];
}
