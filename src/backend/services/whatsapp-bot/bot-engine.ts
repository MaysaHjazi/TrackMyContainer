/**
 * PURE WhatsApp bot logic. No DB, no network — deterministic
 * (state, lang, text, data) → (replies, nextState, lang, action).
 * Side effects (DB, trackShipment, sending) live in bot-state.ts /
 * the webhook. Keep it pure so it's unit-tested in isolation.
 */

export type BotState = "MAIN" | "AWAIT_TRACK" | "AWAIT_SAVE";
export type Lang = "ar" | "en";

export interface BotReply {
  type: "text" | "buttons";
  body: string;
  buttons?: { id: string; title: string }[];
}

export interface TrackView {
  found: boolean;
  trackingNumber?: string;
  status?: string;
  location?: string;
  updatedAt?: string;
  eta?: string;
}

export interface BotInput {
  state: BotState;
  lang: Lang;
  text: string;
  savedShipments: { trackingNumber: string; lastStatus?: string | null }[];
  track?: TrackView;
}

export interface BotOutput {
  replies: BotReply[];
  nextState: BotState;
  lang: Lang;
  action?:
    | { kind: "NEED_TRACK"; trackingNumber: string }
    | { kind: "NEED_TRACK_THEN_SAVE"; trackingNumber: string }
    | { kind: "SAVE"; trackingNumber: string };
}

const AR = /[؀-ۿ]/;
// Control tokens (button IDs) and tracking-number-like strings are NOT
// natural language — they must not flip the user's selected language.
const CONTROL = /^(TRACK|ADD)$/i;
// Single token with no spaces that contains a digit or is all-uppercase:
// looks like a tracking/container number, not prose.
const TRACKING_LIKE = /^(?=\S+$)(?=.*\d|[A-Z]+$)[A-Za-z0-9]+$/;
function detectLang(text: string, current: Lang): Lang {
  if (AR.test(text)) return "ar";
  const trimmed = text.trim();
  if (CONTROL.test(trimmed) || TRACKING_LIKE.test(trimmed)) return current;
  if (/[a-zA-Z]/.test(text)) return "en";
  return current;
}

const T = {
  ar: {
    track: "📦 تتبع الشحنة",
    add: "➕ إضافة شحنة",
    askTrack: "📦 أرسل رقم الشحنة أو الكونتينر لتتبعها مباشرة.\n\nأو اكتب:\nمحفوظة\nلعرض شحناتك المحفوظة.",
    askSave: "➕ أرسل رقم الشحنة التي تريد حفظها للمتابعة.",
    saved: "✅ تم حفظ الشحنة بنجاح.\n\nسيتم إرسال التحديثات تلقائياً عند تغيّر حالة الشحنة.",
    notFound: "❌ لم أتمكن من العثور على الشحنة.\n\nيرجى التأكد من الرقم وإعادة المحاولة.",
    none: "ما عندك شحنات محفوظة بعد.",
    savedHdr: "📋 شحناتك المحفوظة:",
    support: "💬 يمكنك التواصل مع فريق الدعم:",
    foot: "━━━━━━━━━━━━\nاكتب:\n• \"محفوظة\" لعرض شحناتك\n• \"دعم\" للتواصل مع الدعم",
    info: "📦 معلومات الشحنة",
    fNum: "🔹 رقم الشحنة:", fStat: "🚢 الحالة الحالية:",
    fUpd: "📍 آخر تحديث:", fEta: "⏱️ الوصول المتوقع:",
  },
  en: {
    track: "📦 Track shipment",
    add: "➕ Add shipment",
    askTrack: "📦 Send the shipment or container number to track it.\n\nOr type:\nsaved\nto see your saved shipments.",
    askSave: "➕ Send the shipment number you want to save for follow-up.",
    saved: "✅ Shipment saved.\n\nYou'll get automatic updates when its status changes.",
    notFound: "❌ I couldn't find that shipment.\n\nPlease check the number and try again.",
    none: "You have no saved shipments yet.",
    savedHdr: "📋 Your saved shipments:",
    support: "💬 Reach our support team:",
    foot: "━━━━━━━━━━━━\nType:\n• \"saved\" for your shipments\n• \"support\" to contact support",
    info: "📦 Shipment details",
    fNum: "🔹 Number:", fStat: "🚢 Status:",
    fUpd: "📍 Last update:", fEta: "⏱️ ETA:",
  },
} as const;

function mainButtons(l: Lang): BotReply {
  return {
    type: "buttons",
    body: l === "ar" ? "كيف يمكنني مساعدتك؟ 👋" : "How can I help you? 👋",
    buttons: [
      { id: "TRACK", title: T[l].track },
      { id: "ADD", title: T[l].add },
    ],
  };
}

function isKw(text: string, ...kws: string[]) {
  const t = text.trim().toLowerCase();
  return kws.some((k) => t === k);
}

function fmtTrack(l: Lang, v: TrackView): string {
  const t = T[l];
  const lines = [
    t.info, "",
    t.fNum, v.trackingNumber ?? "—", "",
    t.fStat, v.status ?? "—",
  ];
  if (v.updatedAt) lines.push("", t.fUpd, v.updatedAt);
  if (v.eta) lines.push("", t.fEta, v.eta);
  lines.push("", t.foot);
  return lines.join("\n");
}

function fmtSaved(l: Lang, list: BotInput["savedShipments"]): string {
  if (list.length === 0) return T[l].none;
  const digits = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
  const rows = list.slice(0, 10).map((s, i) =>
    `${digits[i] ?? `${i + 1}.`} ${s.trackingNumber}\n${s.lastStatus ?? "—"}`,
  );
  return `${T[l].savedHdr}\n\n${rows.join("\n\n")}`;
}

export function runBot(input: BotInput): BotOutput {
  const lang = detectLang(input.text, input.lang);
  const text = input.text.trim();
  const t = text.toLowerCase();

  if (isKw(text, "محفوظة", "saved")) {
    return { replies: [{ type: "text", body: fmtSaved(lang, input.savedShipments) }, mainButtons(lang)], nextState: "MAIN", lang };
  }
  if (isKw(text, "دعم", "support")) {
    return { replies: [{ type: "text", body: T[lang].support }, mainButtons(lang)], nextState: "MAIN", lang };
  }

  if (input.state === "AWAIT_TRACK") {
    if (!input.track) return { replies: [], nextState: "AWAIT_TRACK", lang, action: { kind: "NEED_TRACK", trackingNumber: text } };
    if (input.track.found) return { replies: [{ type: "text", body: fmtTrack(lang, input.track) }], nextState: "MAIN", lang };
    return { replies: [{ type: "text", body: T[lang].notFound }, mainButtons(lang)], nextState: "MAIN", lang };
  }

  if (input.state === "AWAIT_SAVE") {
    if (!input.track) return { replies: [], nextState: "AWAIT_SAVE", lang, action: { kind: "NEED_TRACK_THEN_SAVE", trackingNumber: text } };
    if (input.track.found) {
      return { replies: [{ type: "text", body: T[lang].saved }, mainButtons(lang)], nextState: "MAIN", lang, action: { kind: "SAVE", trackingNumber: input.track.trackingNumber ?? text } };
    }
    return { replies: [{ type: "text", body: T[lang].notFound }, mainButtons(lang)], nextState: "MAIN", lang };
  }

  if (t === "track") return { replies: [{ type: "text", body: T[lang].askTrack }], nextState: "AWAIT_TRACK", lang };
  if (t === "add")   return { replies: [{ type: "text", body: T[lang].askSave }], nextState: "AWAIT_SAVE", lang };

  return { replies: [mainButtons(lang)], nextState: "MAIN", lang };
}
