/**
 * PURE WhatsApp bot logic. No DB, no network — deterministic
 * (state, text, data) → (replies, nextState, action).
 * Side effects (DB, trackShipment, sending) live in bot-state.ts /
 * the webhook. Keep it pure so it's unit-tested in isolation.
 *
 * English-only. (Arabic support was removed by product decision —
 * the assistant speaks English exclusively.)
 */

export type BotState = "MAIN" | "AWAIT_TRACK" | "AWAIT_SAVE";
/** Kept for back-compat with bot-state.ts; always "en". */
export type Lang = "en";

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
  lang?: Lang;
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

const T = {
  track: "📦 Track shipment",
  add: "➕ Add shipment",
  askTrack:
    "📦 Send the shipment or container number to track it.\n\nOr type:\nsaved\nto see your saved shipments.",
  askSave: "➕ Send the shipment number you want to save for follow-up.",
  saved:
    "✅ Shipment saved.\n\nYou'll get automatic updates on WhatsApp when its status changes.",
  notFound:
    "❌ I couldn't find that shipment.\n\nPlease check the number and try again.",
  none: "You have no saved shipments yet.",
  savedHdr: "📋 Your saved shipments:",
  support: "💬 Reach our support team:",
  foot:
    '━━━━━━━━━━━━\nType:\n• "saved" to see your shipments\n• "support" to contact support',
  info: "📦 Shipment details",
  fNum: "🔹 Number:",
  fStat: "🚢 Status:",
  fUpd: "📍 Last update:",
  fEta: "⏱️ ETA:",
} as const;

function mainButtons(): BotReply {
  return {
    type: "buttons",
    body: "How can I help you? 👋",
    buttons: [
      { id: "TRACK", title: T.track },
      { id: "ADD", title: T.add },
    ],
  };
}

function isKw(text: string, ...kws: string[]) {
  const t = text.trim().toLowerCase();
  return kws.some((k) => t === k);
}

function fmtTrack(v: TrackView): string {
  const lines = [
    T.info,
    "",
    T.fNum,
    v.trackingNumber ?? "—",
    "",
    T.fStat,
    v.status ?? "—",
  ];
  if (v.updatedAt) lines.push("", T.fUpd, v.updatedAt);
  if (v.eta) lines.push("", T.fEta, v.eta);
  lines.push("", T.foot);
  return lines.join("\n");
}

function fmtSaved(list: BotInput["savedShipments"]): string {
  if (list.length === 0) return T.none;
  const digits = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
  const rows = list
    .slice(0, 10)
    .map(
      (s, i) =>
        `${digits[i] ?? `${i + 1}.`} ${s.trackingNumber}\n${s.lastStatus ?? "—"}`,
    );
  return `${T.savedHdr}\n\n${rows.join("\n\n")}`;
}

export function runBot(input: BotInput): BotOutput {
  const lang: Lang = "en";
  const text = input.text.trim();
  const t = text.toLowerCase();

  if (isKw(text, "saved", "shipments")) {
    return {
      replies: [
        { type: "text", body: fmtSaved(input.savedShipments) },
        mainButtons(),
      ],
      nextState: "MAIN",
      lang,
    };
  }
  if (isKw(text, "support", "help")) {
    return {
      replies: [{ type: "text", body: T.support }, mainButtons()],
      nextState: "MAIN",
      lang,
    };
  }

  if (input.state === "AWAIT_TRACK") {
    if (!input.track)
      return {
        replies: [],
        nextState: "AWAIT_TRACK",
        lang,
        action: { kind: "NEED_TRACK", trackingNumber: text },
      };
    if (input.track.found)
      return {
        replies: [{ type: "text", body: fmtTrack(input.track) }],
        nextState: "MAIN",
        lang,
      };
    return {
      replies: [{ type: "text", body: T.notFound }, mainButtons()],
      nextState: "MAIN",
      lang,
    };
  }

  if (input.state === "AWAIT_SAVE") {
    if (!input.track)
      return {
        replies: [],
        nextState: "AWAIT_SAVE",
        lang,
        action: { kind: "NEED_TRACK_THEN_SAVE", trackingNumber: text },
      };
    if (input.track.found) {
      return {
        replies: [{ type: "text", body: T.saved }, mainButtons()],
        nextState: "MAIN",
        lang,
        action: {
          kind: "SAVE",
          trackingNumber: input.track.trackingNumber ?? text,
        },
      };
    }
    return {
      replies: [{ type: "text", body: T.notFound }, mainButtons()],
      nextState: "MAIN",
      lang,
    };
  }

  if (t === "track") return { replies: [{ type: "text", body: T.askTrack }], nextState: "AWAIT_TRACK", lang };
  if (t === "add") return { replies: [{ type: "text", body: T.askSave }], nextState: "AWAIT_SAVE", lang };

  return { replies: [mainButtons()], nextState: "MAIN", lang };
}
