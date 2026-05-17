# WhatsApp Assistant — Design Spec

**Date:** 2026-05-17
**Status:** Approved (user-authored spec)
**Provider:** Meta WhatsApp Cloud API (already integrated, env-gated; Twilio remains default until `WHATSAPP_PROVIDER=meta`)

---

## 1. Goal

A premium, extremely simple Arabic WhatsApp assistant for Track My
Container. Users reach it by tapping the WhatsApp button in the site
corner (opens a chat to the business number). **Any** inbound message
always returns the same 2 interactive reply buttons. Two primary
actions only — no numbered text menus, no large menus.

## 2. UX Rules

- **Bilingual (Arabic + English) with auto-detect.** Detect script of
  the user's message: Arabic characters → reply fully in Arabic
  (buttons, body, keywords); otherwise → reply fully in English.
  The detected language is stored on the session
  (`WhatsappSession.lang`, default `ar`) so the whole conversation
  stays consistent; it switches if the user clearly changes language.
  Keywords accept both forms: `محفوظة`/`saved`, `دعم`/`support`.
  Button payloads are language-neutral ids; only `title` is localized.
- Short, clean, premium. Minimal emojis. Mobile-first.
- Never reveal it's a bot/AI. No technical explanations.
- Any unknown / greeting / emoji / random text → re-send the 2 main
  buttons (never spam, never repeat a sentence back-to-back).
- Never invent shipment data. Missing fields → show only what exists.

## 3. Main Menu (always)

Interactive **Reply Buttons** (WhatsApp max 3 → we use 2). Works
because the user always initiates the chat (button in site corner →
opens 24h window), so interactive messages are allowed.

```
[ 📦 تتبع الشحنة ]   [ ➕ إضافة شحنة ]
```

## 4. Button 1 — تتبع الشحنة

Bot reply:
```
📦 أرسل رقم الشحنة أو الكونتينر لتتبعها مباشرة.

أو اكتب:
محفوظة
لعرض شحناتك المحفوظة.
```
User then sends a number → detect Container / BL / AWB via the
existing `parseTrackingIdentifier` + `trackShipment` orchestrator →
return:
```
📦 معلومات الشحنة

🔹 رقم الشحنة:
{trackingNumber}

🚢 الحالة الحالية:
{currentStatus (Arabic label)}

📍 آخر تحديث:
{lastEvent date/time}

⏱️ الوصول المتوقع:
{ETA}

━━━━━━━━━━━━
اكتب:
• "محفوظة" لعرض شحناتك
• "دعم" للتواصل مع الدعم
```
Not found → friendly Arabic error:
```
❌ لم أتمكن من العثور على الشحنة.
يرجى التأكد من الرقم وإعادة المحاولة.
```
(Then the 2 main buttons.)

## 5. Button 2 — إضافة شحنة

Bot reply:
```
➕ أرسل رقم الشحنة التي تريد حفظها للمتابعة.
```
User sends number → validate it resolves via `trackShipment` →
save row in `WhatsappTrackedShipment` keyed by phone number, store
latest known status → confirm:
```
✅ تم حفظ الشحنة بنجاح.
سيتم إرسال التحديثات تلقائياً عند تغيّر حالة الشحنة.
```
If the number doesn't resolve → same friendly not-found error, not
saved.

## 6. Keywords (typed, no buttons)

- **`محفوظة`** → list saved shipments for that phone:
```
📋 شحناتك المحفوظة:

1️⃣ MRKU4711130
🚢 وصلت ميناء جدة

2️⃣ CAIU2444270
🟡 قيد النقل
```
  Empty → friendly "ما عندك شحنات محفوظة بعد" + 2 buttons.
- **`دعم`** → support info from `siteConfig.contact`
  (WhatsApp number + `trackmycontainer.info`).

## 7. Architecture

Three isolated units:

- **`src/backend/services/whatsapp-bot/bot-engine.ts`** — PURE
  conversation logic. Input: `{ state, text, savedShipments?,
  trackResult? }`. Output: `{ replies: BotReply[], nextState }`.
  No DB, no network → unit-testable in isolation.
- **`src/backend/services/whatsapp-bot/bot-state.ts`** — reads/writes
  `WhatsappSession.botState` + `WhatsappTrackedShipment`; calls
  `trackShipment` when the engine asks for a lookup.
- **Existing `/api/webhooks/whatsapp`** — parses inbound, calls
  bot-state→bot-engine, sends `replies` via existing `sendMetaText` /
  a new interactive-buttons sender in `whatsapp-meta.ts`.

`BotReply` is one of: `{ type: "text", body }` or
`{ type: "buttons", body, buttons: {id,title}[] }`.

State enum: `MAIN` (default) · `AWAIT_TRACK` · `AWAIT_SAVE`.
Unknown/greeting in any state → reset to `MAIN` + 2 buttons.

## 8. Database (Prisma — additive only)

`WhatsappSession` (exists) — add:
- `botState String @default("MAIN")`
- `lang String @default("ar")`  // "ar" | "en" — auto-detected, sticky
- `lastInteractionAt DateTime?`

New `WhatsappTrackedShipment`:
- `id String @id @default(cuid())`
- `phoneNumber String`
- `trackingNumber String`
- `trackingType ShipmentType`
- `lastStatus String?`
- `createdAt DateTime @default(now())`
- `@@unique([phoneNumber, trackingNumber])`
- `@@index([phoneNumber])`

Migration applied via `ALTER TABLE` on prod (additive, non-destructive,
no data loss — same approach used for `etaInitialDate`).

## 9. Auto Updates

The existing worker dispatcher gains an **additional, isolated** pass:
1. Group `WhatsappTrackedShipment` by trackingNumber.
2. Reuse `trackShipment` (respects existing provider routing /
   credit rules — JSONCargo/ShipsGo unchanged).
3. If `currentStatus !== lastStatus` → send a short Arabic WhatsApp
   update, update `lastStatus`.
- Runs only when `WHATSAPP_PROVIDER=meta` is set.
- **Does NOT touch** existing Shipment polling, email, delay
  detection, or notification logic — purely additive.

## 10. Out of Scope (YAGNI)

- No account linking (phone number = identity, no login).
- No interactive Lists (only 2 reply buttons needed).
- Bilingual = Arabic + English only (auto-detected). No third
  language, no manual language menu.
- No payments, no media messages.
- No opt-in/out redesign (existing STOP/START still works).

## 11. Risk / Safety

- Bot path active only when `WHATSAPP_PROVIDER=meta`. Until then the
  webhook + worker addition are inert; Twilio + all current
  notifications keep running byte-for-byte unchanged.
- DB change is additive (new table + 2 nullable/defaulted columns).
- `bot-engine.ts` is pure → covered by unit tests before wiring.
