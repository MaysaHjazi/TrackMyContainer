# WhatsApp Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bilingual (Arabic+English, auto-detected) WhatsApp assistant with 2 reply buttons (تتبع/إضافة), `محفوظة|saved` / `دعم|support` keywords, phone-number identity, and additive auto-updates — fully gated behind `WHATSAPP_PROVIDER=meta`.

**Architecture:** A pure state-machine engine (`bot-engine.ts`, no I/O) decides replies + next state from `{ state, lang, text, savedShipments?, trackResult? }`. A thin `bot-state.ts` loads/saves `WhatsappSession` + `WhatsappTrackedShipment` and calls the existing `trackShipment` orchestrator. The existing `/api/webhooks/whatsapp` POST drives them and sends via existing `sendMetaText` + a new `sendMetaButtons`. A new additive worker pass polls tracked shipments and pushes WhatsApp updates. Nothing runs unless `WHATSAPP_PROVIDER=meta`.

**Tech Stack:** Next.js 15 API route, Prisma/PostgreSQL, BullMQ worker, Meta WhatsApp Cloud API, Vitest.

**Schema note:** `WhatsappSession` already has `state` (reuse as bot state), `context Json?`, `lastMessageAt`. We only ADD a `lang` column + the new `WhatsappTrackedShipment` model. Reuse `state` and `lastMessageAt` — do NOT add `botState`/`lastInteractionAt`.

---

### Task 1: Schema — `lang` column + `WhatsappTrackedShipment`

**Files:**
- Modify: `prisma/schema.prisma` (WhatsappSession block ~line 416; add model after it)
- Prod migration: `ALTER TABLE` (additive, non-destructive)

- [ ] **Step 1: Add `lang` to WhatsappSession**

In `prisma/schema.prisma`, inside `model WhatsappSession`, after the `state` line add:

```prisma
  lang          String    @default("ar")  // "ar" | "en" — auto-detected, sticky
```

- [ ] **Step 2: Add the new model** (immediately after the WhatsappSession closing `}` / before `@@map` stays inside it — add as a new top-level model)

```prisma
model WhatsappTrackedShipment {
  id             String       @id @default(cuid())
  phoneNumber    String       // E.164 digits, no '+'
  trackingNumber String
  trackingType   ShipmentType
  lastStatus     String?
  createdAt      DateTime     @default(now())

  @@unique([phoneNumber, trackingNumber])
  @@index([phoneNumber])
  @@map("whatsapp_tracked_shipments")
}
```

- [ ] **Step 3: Regenerate client**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(wa): WhatsappSession.lang + WhatsappTrackedShipment model"
```

- [ ] **Step 6: Apply additive migration on prod DB** (non-destructive, mirrors the etaInitialDate approach)

```bash
ssh tmc "docker exec supabase-db psql -U postgres -d postgres -c \"ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'ar';\""
ssh tmc "docker exec supabase-db psql -U postgres -d postgres -c \"CREATE TABLE IF NOT EXISTS whatsapp_tracked_shipments (id text PRIMARY KEY, \\\"phoneNumber\\\" text NOT NULL, \\\"trackingNumber\\\" text NOT NULL, \\\"trackingType\\\" \\\"ShipmentType\\\" NOT NULL, \\\"lastStatus\\\" text, \\\"createdAt\\\" timestamp(3) NOT NULL DEFAULT now(), UNIQUE(\\\"phoneNumber\\\",\\\"trackingNumber\\\"));\""
ssh tmc "docker exec supabase-db psql -U postgres -d postgres -c 'CREATE INDEX IF NOT EXISTS whatsapp_tracked_shipments_phone_idx ON whatsapp_tracked_shipments (\"phoneNumber\");'"
```
Expected: `ALTER TABLE`, `CREATE TABLE`, `CREATE INDEX`.

---

### Task 2: Pure bot engine

**Files:**
- Create: `src/backend/services/whatsapp-bot/bot-engine.ts`
- Test: `src/__tests__/whatsapp-bot-engine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { runBot, type BotState } from "@/backend/services/whatsapp-bot/bot-engine";

const base = { savedShipments: [], track: undefined };

describe("runBot", () => {
  it("greeting → 2 buttons, Arabic by default", () => {
    const r = runBot({ state: "MAIN", lang: "ar", text: "مرحبا", ...base });
    expect(r.nextState).toBe("MAIN");
    expect(r.replies[0].type).toBe("buttons");
    expect(r.replies[0].buttons!.map(b => b.id)).toEqual(["TRACK", "ADD"]);
    expect(r.replies[0].buttons!.map(b => b.title)).toEqual(["📦 تتبع الشحنة", "➕ إضافة شحنة"]);
  });

  it("English text → English buttons + lang switch", () => {
    const r = runBot({ state: "MAIN", lang: "ar", text: "hello", ...base });
    expect(r.lang).toBe("en");
    expect(r.replies[0].buttons!.map(b => b.title)).toEqual(["📦 Track shipment", "➕ Add shipment"]);
  });

  it("TRACK button → ask for number, state AWAIT_TRACK", () => {
    const r = runBot({ state: "MAIN", lang: "ar", text: "TRACK", ...base });
    expect(r.nextState).toBe("AWAIT_TRACK");
    expect(r.replies[0].type).toBe("text");
    expect(r.replies[0].body).toContain("أرسل رقم الشحنة");
  });

  it("ADD button → ask for number, state AWAIT_SAVE", () => {
    const r = runBot({ state: "MAIN", lang: "ar", text: "ADD", ...base });
    expect(r.nextState).toBe("AWAIT_SAVE");
    expect(r.replies[0].body).toContain("تريد حفظها");
  });

  it("AWAIT_TRACK + found → formatted status, back to MAIN", () => {
    const r = runBot({
      state: "AWAIT_TRACK", lang: "ar", text: "MRKU4711130", savedShipments: [],
      track: { found: true, trackingNumber: "MRKU4711130", status: "وصلت ميناء جدة", updatedAt: "اليوم 3:42 PM", eta: "18 مايو" },
    });
    expect(r.nextState).toBe("MAIN");
    expect(r.replies[0].body).toContain("معلومات الشحنة");
    expect(r.replies[0].body).toContain("MRKU4711130");
    expect(r.replies[0].body).toContain("وصلت ميناء جدة");
  });

  it("AWAIT_TRACK + not found → friendly error, MAIN", () => {
    const r = runBot({ state: "AWAIT_TRACK", lang: "ar", text: "BAD1", savedShipments: [], track: { found: false } });
    expect(r.nextState).toBe("MAIN");
    expect(r.replies[0].body).toContain("لم أتمكن");
  });

  it("AWAIT_SAVE + valid → success copy", () => {
    const r = runBot({ state: "AWAIT_SAVE", lang: "ar", text: "CAIU2444270", savedShipments: [], track: { found: true, trackingNumber: "CAIU2444270", status: "x" } });
    expect(r.nextState).toBe("MAIN");
    expect(r.action).toEqual({ kind: "SAVE", trackingNumber: "CAIU2444270" });
    expect(r.replies[0].body).toContain("تم حفظ الشحنة");
  });

  it("keyword محفوظة → list", () => {
    const r = runBot({ state: "MAIN", lang: "ar", text: "محفوظة",
      savedShipments: [{ trackingNumber: "MRKU4711130", lastStatus: "وصلت" }], track: undefined });
    expect(r.replies[0].body).toContain("شحناتك المحفوظة");
    expect(r.replies[0].body).toContain("MRKU4711130");
  });

  it("keyword saved (en) → English list", () => {
    const r = runBot({ state: "MAIN", lang: "en", text: "saved",
      savedShipments: [{ trackingNumber: "X1", lastStatus: "In transit" }], track: undefined });
    expect(r.replies[0].body.toLowerCase()).toContain("your saved shipments");
  });

  it("keyword دعم → support info", () => {
    const r = runBot({ state: "MAIN", lang: "ar", text: "دعم", ...base });
    expect(r.replies[0].body).toContain("الدعم");
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `npx vitest run src/__tests__/whatsapp-bot-engine.test.ts`
Expected: FAIL — `Cannot find module ... bot-engine`.

- [ ] **Step 3: Implement the engine**

Create `src/backend/services/whatsapp-bot/bot-engine.ts`:

```ts
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
  /** Side-effect the caller must perform after replying. */
  action?:
    | { kind: "NEED_TRACK"; trackingNumber: string }
    | { kind: "NEED_TRACK_THEN_SAVE"; trackingNumber: string }
    | { kind: "SAVE"; trackingNumber: string };
}

const AR = /[؀-ۿ]/;
function detectLang(text: string, current: Lang): Lang {
  if (AR.test(text)) return "ar";
  if (/[a-zA-Z]/.test(text)) return "en";
  return current; // digits / emoji only → keep current
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

  // Keywords work from any state.
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

  // MAIN: button taps
  if (t === "track") return { replies: [{ type: "text", body: T[lang].askTrack }], nextState: "AWAIT_TRACK", lang };
  if (t === "add")   return { replies: [{ type: "text", body: T[lang].askSave }], nextState: "AWAIT_SAVE", lang };

  // Anything else → main buttons.
  return { replies: [mainButtons(lang)], nextState: "MAIN", lang };
}
```

- [ ] **Step 4: Run tests — verify pass**

Run: `npx vitest run src/__tests__/whatsapp-bot-engine.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/backend/services/whatsapp-bot/bot-engine.ts src/__tests__/whatsapp-bot-engine.test.ts
git commit -m "feat(wa): pure bilingual bot engine + tests"
```

---

### Task 3: Interactive-buttons sender

**Files:**
- Modify: `src/backend/services/notifications/whatsapp-meta.ts` (append a new export)

- [ ] **Step 1: Add `sendMetaButtons`**

Append to `whatsapp-meta.ts` (after `sendMetaText`):

```ts
/**
 * Interactive reply-buttons message (max 3 buttons; we use 2). Only
 * delivered inside the 24h window — fine, the user always initiates.
 */
export async function sendMetaButtons(
  to: string,
  body: string,
  buttons: { id: string; title: string }[],
): Promise<string> {
  const res = await fetch(
    `${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: authHeaders(),
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/^whatsapp:/i, "").replace(/[^\d]/g, ""),
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: body },
          action: {
            buttons: buttons.slice(0, 3).map((b) => ({
              type: "reply",
              reply: { id: b.id, title: b.title.slice(0, 20) },
            })),
          },
        },
      }),
    },
  );
  const json = (await res.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { message?: string };
  };
  if (!res.ok || !json.messages?.[0]?.id) {
    throw new Error(
      `Meta buttons send failed (${res.status}): ${
        json.error?.message ?? JSON.stringify(json).slice(0, 200)
      }`,
    );
  }
  return json.messages[0].id;
}
```

> Note: `parseInboundMessage` currently only returns text messages. Button taps arrive as `type:"interactive"`. Extend it in Task 5.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/backend/services/notifications/whatsapp-meta.ts
git commit -m "feat(wa): sendMetaButtons (interactive reply buttons)"
```

---

### Task 4: bot-state (DB + tracking glue)

**Files:**
- Create: `src/backend/services/whatsapp-bot/bot-state.ts`

- [ ] **Step 1: Implement**

```ts
import { prisma } from "@/backend/lib/db";
import { trackShipment } from "@/backend/services/tracking";
import { formatDate, getStatusLabel } from "@/lib/utils";
import { runBot, type BotState, type Lang, type TrackView } from "./bot-engine";

/** Load session (state+lang); default MAIN/ar. */
async function loadSession(phone: string) {
  const s = await prisma.whatsappSession.findUnique({ where: { phoneNumber: phone } });
  const state = (s?.state as BotState) ?? "MAIN";
  const lang = (s?.lang as Lang) ?? "ar";
  return {
    state: (["MAIN", "AWAIT_TRACK", "AWAIT_SAVE"].includes(state) ? state : "MAIN") as BotState,
    lang: (lang === "en" ? "en" : "ar") as Lang,
  };
}

async function saveSession(phone: string, state: BotState, lang: Lang) {
  await prisma.whatsappSession.upsert({
    where: { phoneNumber: phone },
    update: { state, lang, lastMessageAt: new Date(), messageCount: { increment: 1 } },
    create: { phoneNumber: phone, state, lang, lastMessageAt: new Date(), messageCount: 1 },
  });
}

async function getSaved(phone: string) {
  const rows = await prisma.whatsappTrackedShipment.findMany({
    where: { phoneNumber: phone },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return rows.map((r) => ({ trackingNumber: r.trackingNumber, lastStatus: r.lastStatus }));
}

async function doTrack(lang: Lang, num: string): Promise<TrackView> {
  try {
    const r = await trackShipment(num.trim());
    return {
      found: true,
      trackingNumber: r.trackingNumber,
      status: getStatusLabel(r.currentStatus),
      location: r.currentLocation ?? undefined,
      updatedAt: r.events?.length ? formatDate(r.events[r.events.length - 1].eventDate) : undefined,
      eta: r.etaDate ? formatDate(r.etaDate) : undefined,
    };
  } catch {
    return { found: false };
  }
}

export interface OutMsg {
  type: "text" | "buttons";
  body: string;
  buttons?: { id: string; title: string }[];
}

/**
 * Full turn: returns the messages to send. Performs all side effects
 * (track lookups, saving, session persistence). The webhook just sends
 * `OutMsg[]` in order.
 */
export async function handleBotTurn(phone: string, text: string): Promise<OutMsg[]> {
  const { state, lang } = await loadSession(phone);
  let track: TrackView | undefined;

  // First pass — engine may ask for a lookup.
  let out = runBot({ state, lang, text, savedShipments: await getSaved(phone) });

  if (out.action?.kind === "NEED_TRACK" || out.action?.kind === "NEED_TRACK_THEN_SAVE") {
    track = await doTrack(out.lang, out.action.trackingNumber);
    out = runBot({ state, lang: out.lang, text, savedShipments: await getSaved(phone), track });
  }

  if (out.action?.kind === "SAVE" && track?.found) {
    const r = await trackShipment(out.action.trackingNumber).catch(() => null);
    if (r) {
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
  }

  await saveSession(phone, out.nextState, out.lang);
  return out.replies.map((rp) => ({ type: rp.type, body: rp.body, buttons: rp.buttons }));
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (If `trackShipment` result lacks `.type`, use `r.type` — it exists on `TrackingResult`.)

- [ ] **Step 3: Commit**

```bash
git add src/backend/services/whatsapp-bot/bot-state.ts
git commit -m "feat(wa): bot-state (session + saved shipments + tracking glue)"
```

---

### Task 5: Wire into the webhook

**Files:**
- Modify: `src/app/api/webhooks/whatsapp/route.ts` (replace POST body)
- Modify: `src/backend/services/notifications/whatsapp-meta.ts` (`parseInboundMessage` to also read button replies)

- [ ] **Step 1: Extend `parseInboundMessage`**

Replace the `parseInboundMessage` body so it also returns interactive button replies (the button `id`, e.g. `TRACK`/`ADD`):

```ts
export function parseInboundMessage(
  payload: unknown,
): { from: string; text: string } | null {
  try {
    const p = payload as {
      entry?: { changes?: { value?: { messages?: {
        from?: string; type?: string;
        text?: { body?: string };
        interactive?: { button_reply?: { id?: string }; list_reply?: { id?: string } };
      }[] } }[] }[];
    };
    const m = p.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!m?.from) return null;
    if (m.type === "text" && m.text?.body) return { from: m.from, text: m.text.body };
    const id = m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id;
    if (id) return { from: m.from, text: id };
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Replace the POST handler**

`src/app/api/webhooks/whatsapp/route.ts` — keep GET + imports; replace POST with:

```ts
export async function POST(req: NextRequest) {
  if (!isMetaProvider()) {
    return NextResponse.json({ ok: true, skipped: "provider!=meta" });
  }
  let payload: unknown;
  try { payload = await req.json(); } catch { return NextResponse.json({ ok: true }); }

  const inbound = parseInboundMessage(payload);
  if (!inbound) return NextResponse.json({ ok: true });

  try {
    const { handleBotTurn } = await import("@/backend/services/whatsapp-bot/bot-state");
    const msgs = await handleBotTurn(inbound.from, inbound.text);
    for (const m of msgs) {
      if (m.type === "buttons" && m.buttons?.length) {
        await sendMetaButtons(inbound.from, m.body, m.buttons);
      } else {
        await sendMetaText(inbound.from, m.body);
      }
    }
  } catch (err) {
    console.error("[webhooks/whatsapp] bot error:", err);
  }
  return NextResponse.json({ ok: true });
}
```

Remove the now-unused imports (`handleIncomingWhatsApp`, `trackShipment`, `TrackingError`, `getStatusLabel`, `formatDate`) and add `sendMetaButtons` to the `whatsapp-meta` import.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/webhooks/whatsapp/route.ts" src/backend/services/notifications/whatsapp-meta.ts
git commit -m "feat(wa): drive webhook via bilingual bot pipeline"
```

---

### Task 6: Additive auto-update worker pass

**Files:**
- Create: `src/backend/worker/processors/whatsapp-updates.ts`
- Modify: `src/backend/worker/processors/tracking-dispatch.ts` (call the new pass at the end — additive, guarded)

- [ ] **Step 1: Implement the pass**

```ts
import { prisma } from "@/backend/lib/db";
import { trackShipment } from "@/backend/services/tracking";
import { getStatusLabel } from "@/lib/utils";
import { isMetaProvider, sendMetaText } from "@/backend/services/notifications/whatsapp-meta";

/**
 * Additive: poll WhatsApp-saved shipments, push an Arabic/English
 * update when status changes. Inert unless WHATSAPP_PROVIDER=meta.
 * NEVER touches Shipment/email/delay logic.
 */
export async function runWhatsappUpdates(): Promise<void> {
  if (!isMetaProvider()) return;

  const rows = await prisma.whatsappTrackedShipment.findMany({ take: 200 });
  // De-dup lookups across phones tracking the same number.
  const byNumber = new Map<string, typeof rows>();
  for (const r of rows) {
    const a = byNumber.get(r.trackingNumber) ?? [];
    a.push(r); byNumber.set(r.trackingNumber, a);
  }

  for (const [num, list] of byNumber) {
    let statusLabel: string;
    try {
      const t = await trackShipment(num);
      statusLabel = getStatusLabel(t.currentStatus);
    } catch { continue; }

    for (const row of list) {
      if (row.lastStatus === statusLabel) continue;
      const ar = `📦 تحديث: شحنتك ${num}\n🚢 الحالة: ${statusLabel}`;
      try {
        await sendMetaText(row.phoneNumber, ar);
        await prisma.whatsappTrackedShipment.update({
          where: { id: row.id },
          data: { lastStatus: statusLabel },
        });
      } catch (e) {
        console.error(`[wa-updates] ${row.phoneNumber}/${num}:`, e);
      }
    }
  }
}
```

- [ ] **Step 2: Call it from the dispatcher (additive, last line, guarded)**

In `tracking-dispatch.ts`, add the import at top and call at the very end of `trackingDispatchProcessor`, after existing logic:

```ts
import { runWhatsappUpdates } from "./whatsapp-updates";
// ... existing code unchanged ...
  // Additive WhatsApp pass — no-ops unless WHATSAPP_PROVIDER=meta.
  await runWhatsappUpdates().catch((e) =>
    console.error("[tracking-dispatch] whatsapp pass:", e),
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/backend/worker/processors/whatsapp-updates.ts src/backend/worker/processors/tracking-dispatch.ts
git commit -m "feat(wa): additive worker pass for WhatsApp auto-updates"
```

---

### Task 7: Deploy + go live for the demo

**Files:** none (ops)

- [ ] **Step 1: Push**

```bash
git push origin HEAD:main
```

- [ ] **Step 2: Pull + apply schema migration on prod** (Task 1 Step 6 commands if not yet run)

- [ ] **Step 3: Set provider + rebuild**

```bash
ssh tmc "cd /opt/trackmycontainer && grep -q '^WHATSAPP_PROVIDER=' .env.production && sed -i 's|^WHATSAPP_PROVIDER=.*|WHATSAPP_PROVIDER=meta|' .env.production || echo 'WHATSAPP_PROVIDER=meta' >> .env.production"
ssh tmc "cd /opt/trackmycontainer && git pull && docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build --force-recreate next-app worker"
```

- [ ] **Step 4: Smoke test**

From WhatsApp on `0771051556`, message the test number `+1 555 630 5622`:
- send "hi" → expect 2 Arabic buttons
- tap 📦 تتبع الشحنة → send `MAEU9184879` → expect formatted status
- tap ➕ إضافة شحنة → send `CAIU2444270` → expect ✅ تم حفظ
- send `محفوظة` → expect the saved list
- send "hello" → expect 2 English buttons

Expected: each step replies correctly in the matching language.

- [ ] **Step 5: Commit (env doc only — no secrets)**

No code commit; ops change recorded in this plan's checklist.

---

## Self-Review

**Spec coverage:** §3 main buttons → T2/T3/T5. §4 track → T2(runBot AWAIT_TRACK)/T4(doTrack). §5 add → T2/T4(SAVE upsert). §6 keywords محفوظة/saved/دعم/support → T2. §2 bilingual auto-detect+sticky → T2(detectLang)+T4(loadSession/saveSession lang). §7 architecture (engine/state/webhook) → T2/T4/T5. §8 DB → T1 (note: reused existing `state`/`lastMessageAt`, only added `lang` + new table — documented). §9 auto-updates additive+gated → T6. §11 gating (`isMetaProvider`) → T5/T6. All covered.

**Placeholder scan:** none — every step has full code/commands.

**Type consistency:** `BotState`/`Lang`/`BotReply`/`TrackView`/`BotInput`/`BotOutput` defined in T2, consumed unchanged in T4. `handleBotTurn`→`OutMsg[]` consumed in T5. `runWhatsappUpdates` defined T6, imported T6. `parseInboundMessage` signature unchanged (still `{from,text}`), only internals extended in T5. `whatsappTrackedShipment` composite unique used as `phoneNumber_trackingNumber` (matches `@@unique([phoneNumber, trackingNumber])`). Consistent.
