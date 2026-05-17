# WhatsApp PRO Assistant (UltraMsg) — Design Spec

**Date:** 2026-05-17
**Status:** Approved (in-conversation, multi-round)
**Transport:** UltraMsg (WhatsApp Web gateway). No native buttons — text only.
**Isolation:** Fully separate from Meta / email / site. Gated by a master
switch. Does not modify the working Meta or notification backend beyond
the WhatsApp-send branch and the proactive copy.

---

## 1. Goal

Two things for **PRO/CUSTOM** account owners only:

1. **Proactive alert (the core):** when ShipsGo reports *any* update on a
   shipment that exists in the user's account, automatically send a
   WhatsApp message — unprompted — to the phone number the user set in
   their account settings. Mirrors the website notification.
2. **Scoped interactive assistant:** the same user can message the bot
   and ask about *their own account shipments only*, and can **add** a
   new shipment from WhatsApp (consuming credit, respecting plan limits,
   appearing on the dashboard exactly like a dashboard add).

FREE / unknown numbers: **blocked** — one polite "PRO feature" line, no
querying, no tracking, no support flow.

## 2. Identity

Inbound WhatsApp phone (digits) is matched against `User.phone` (the
number set in account settings) where `subscription.plan != FREE`.
- Match → PRO assistant.
- No match / FREE → blocked message.

## 3. Master Switch (always-on, but controllable)

`WHATSAPP_BOT_ENABLED` env, **default `false`**. Gates BOTH:
- inbound replies (webhook returns ok+skip when off — random people who
  message get **no reply**), and
- proactive WhatsApp sends (the send branch no-ops when off).

When off, the bot is 100% dormant. Testing protocol: enable → test →
disable.

Reliability: containers `restart: unless-stopped`; a watchdog (worker
cron, only when enabled) re-asserts the UltraMsg webhook URL + checks
instance connection every 10 min and self-heals.

## 4. Proactive Alert (🔔) — sentence style, with countdown

Fires from the existing poller path (tracking-poll → notification-send →
WhatsApp send) on any status/location change for a PRO user's account
shipment. Sent to `User.phone`. Copy:

```
🔔  Update on your shipment

📦  MAEU9184879 just moved — it Arrived at port
in Jeddah, Saudi Arabia (today, 09:10).

Now expected on 24 May 2026 — about 6 days to go.

Full timeline → trackmycontainer.info/dashboard
```

Countdown = ETA date **and** "about N days to go" together.

## 5. Interactive Assistant (PRO only) — scoped to account shipments

No native buttons. English. Natural sentence style (no label/value
tables).

- **Any greeting / unknown / "my shipments"** → list the user's account
  shipments with status + ETA + countdown, plus the ADD hint:
  ```
  Track My Container 🚢

  Welcome back. Here's where your shipments stand:

  •  MAEU9184879 — In Transit, arriving in ~7 days (24 May)
  •  CAIU2444270 — Arrived in Jeddah ✅

  • Send a shipment number for the full story
  • To track a new one, send:  add <number>
  ```
- **Sends a number that IS in their account** → detail card:
  ```
  📦  MAEU9184879

  On the move — currently In Transit, last seen at
  Port Said, Egypt on 17 May, 14:20.

  Arriving on 24 May 2026 — about 7 days away. 🗓
  ```
- **Sends a number NOT in their account (no `add`)**:
  ```
  That shipment isn't in your account.
  To start tracking it, send:  add TEMU1234567
  ```
- **`add <number>`** → "Checking … ⏳" then reuse the **existing
  add-shipment backend** (same credit consumption, plan-limit checks,
  provider routing, validation as the dashboard). Outcomes:
  - Success → confirmation; shipment now in account + on dashboard +
    enrolled in proactive alerts.
  - Not found → nothing added, ask to re-check.
  - Plan limit reached → limit message + dashboard link.

## 6. FREE / unknown

```
Track My Container 🚢
WhatsApp shipment tracking is a PRO feature.
Learn more → trackmycontainer.info
```
No querying, no tracking, no support flow.

## 7. Critical Correctness Requirements

- **ADD MUST reuse the exact existing add-shipment service** used by the
  dashboard / `POST /api/shipments` so ShipsGo is hit correctly, credit
  is consumed, plan limits enforced, and the shipment shows on the
  dashboard. This is the highest-risk item — verify end-to-end.
- Interactive scope = `User.shipments` (the Shipment table), NOT the old
  free-form trackShipment + WhatsappTrackedShipment model. The old
  Arabic free-tracking bot logic is replaced for this path.
- Proactive path already enqueues for `plan != FREE && user.phone`;
  only the copy/countdown and the master-switch gate are added.

## 8. Out of Scope (YAGNI)

- No buttons/lists (WhatsApp Web can't).
- No FREE-tier interaction at all.
- No external/arbitrary tracking via the bot (account shipments only).
- No Arabic (English only).
- Meta path, email, site, providers — untouched.

## 9. Testing Protocol

One feature at a time, **proactive 🔔 first**. For each: flip
`WHATSAPP_BOT_ENABLED=true`, run the controlled test, verify, then flip
back to `false`. Never leave it enabled between tests (random inbound
must not get replies).
