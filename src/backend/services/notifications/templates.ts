import type { ShipmentType } from "@prisma/client";
import { formatDate } from "@/lib/utils";

/**
 * WhatsApp message templates.
 * These must be pre-registered and approved via Twilio/Meta.
 * Template SIDs are set in Twilio console after approval.
 */

export const WHATSAPP_TEMPLATES = {
  ETA_IMMINENT: {
    sid:  "HX_eta_imminent",  // Replace with actual Twilio template SID
    body: (args: { name: string; number: string; type: ShipmentType; etaDate: Date; url: string }) =>
      `Hello ${args.name}! 📦 Your ${args.type === "SEA" ? "container" : "air shipment"} *${args.number}* ` +
      `is arriving in *3 days* — ETA: *${formatDate(args.etaDate)}*.\n\n` +
      `Track it here: ${args.url}`,
  },

  DELAY_ALERT: {
    sid:  "HX_delay_alert",
    body: (args: { name: string; number: string; newEta: Date; reason?: string; url: string }) =>
      `⚠️ Delay Alert: Your shipment *${args.number}* has been delayed.\n` +
      `New estimated arrival: *${formatDate(args.newEta)}*.\n` +
      (args.reason ? `Reason: ${args.reason}\n` : "") +
      `\nTrack: ${args.url}`,
  },

  ARRIVAL_NOTICE: {
    sid:  "HX_arrival_notice",
    body: (args: { name: string; number: string; location: string; arrivedAt: Date; url: string }) =>
      `✅ Great news, ${args.name}! Your shipment *${args.number}* has arrived at *${args.location}* ` +
      `on ${formatDate(args.arrivedAt)}.\n\nView details: ${args.url}`,
  },

  STATUS_CHANGE: {
    sid:  "HX_status_change",
    body: (args: { name: string; number: string; status: string; location: string; url: string }) =>
      `📍 Update for *${args.number}*: Status changed to *${args.status}*${args.location ? ` at ${args.location}` : ""}.\n\n` +
      `Track: ${args.url}`,
  },

  CUSTOMS_HOLD: {
    sid:  "HX_customs_hold",
    body: (args: { name: string; number: string; url: string }) =>
      `🛃 Important: Your shipment *${args.number}* is currently on *Customs Hold*.\n` +
      `Please contact your customs broker.\n\nTrack: ${args.url}`,
  },

  WELCOME: {
    sid:  "HX_welcome",
    body: (args: { name: string }) =>
      `Welcome to *TrackMyContainer.ai*, ${args.name}! 🚢✈️\n\n` +
      `You can now track containers and air waybills via WhatsApp.\n` +
      `Just send me a container number or AWB number anytime.\n\n` +
      `Example: MAEU1234567 or 157-12345678`,
  },
} as const;

export type TemplateKey = keyof typeof WHATSAPP_TEMPLATES;

/**
 * Meta WhatsApp Cloud API template mapping.
 *
 * Business-initiated WhatsApp messages MUST use a template that was
 * pre-approved in Meta WhatsApp Manager. Each entry below declares the
 * approved template `name` + `language` and an ordered `params()` that
 * returns the body variables ({{1}}, {{2}}, ...) in the SAME order the
 * approved template expects.
 *
 * ⚠️ The template body text you submit for approval in Meta must match
 * the structure here. Recommended bodies (create these in WhatsApp
 * Manager → Message Templates, category = UTILITY, language = en):
 *
 *  tmc_eta_imminent   "Hi {{1}} 📦 Shipment {{2}} is arriving on {{3}}. Track: {{4}}"
 *  tmc_delay_alert    "⚠️ Shipment {{1}} delayed. New ETA {{2}}. Track: {{3}}"
 *  tmc_arrival_notice "✅ Shipment {{1}} arrived at {{2}} on {{3}}. Details: {{4}}"
 *  tmc_status_change  "📍 {{1}}: status is now {{2}}{{3}}. Track: {{4}}"
 *  tmc_customs_hold   "🛃 Shipment {{1}} is on customs hold. Track: {{2}}"
 *  tmc_welcome        "Welcome to TrackMyContainer, {{1}}! Send a container or AWB number to track it."
 *
 * The Twilio path (WHATSAPP_TEMPLATES above) is untouched — this map is
 * only read when WHATSAPP_PROVIDER=meta.
 */
export const META_WHATSAPP_TEMPLATES: Record<
  TemplateKey,
  { name: string; language: string; params: (a: Record<string, unknown>) => string[] }
> = {
  ETA_IMMINENT: {
    name: "tmc_eta_imminent",
    language: "en",
    params: (a) => [
      String(a.name ?? "there"),
      String(a.number ?? ""),
      a.etaDate ? formatDate(new Date(a.etaDate as string)) : "",
      String(a.url ?? ""),
    ],
  },
  DELAY_ALERT: {
    name: "tmc_delay_alert",
    language: "en",
    params: (a) => [
      String(a.number ?? ""),
      a.newEta ? formatDate(new Date(a.newEta as string)) : "",
      String(a.url ?? ""),
    ],
  },
  ARRIVAL_NOTICE: {
    name: "tmc_arrival_notice",
    language: "en",
    params: (a) => [
      String(a.number ?? ""),
      String(a.location ?? ""),
      a.arrivedAt ? formatDate(new Date(a.arrivedAt as string)) : "",
      String(a.url ?? ""),
    ],
  },
  STATUS_CHANGE: {
    name: "tmc_status_change",
    language: "en",
    params: (a) => [
      String(a.number ?? ""),
      String(a.status ?? ""),
      a.location ? ` at ${a.location}` : "",
      String(a.url ?? ""),
    ],
  },
  CUSTOMS_HOLD: {
    name: "tmc_customs_hold",
    language: "en",
    params: (a) => [String(a.number ?? ""), String(a.url ?? "")],
  },
  WELCOME: {
    name: "tmc_welcome",
    language: "en",
    params: (a) => [String(a.name ?? "there")],
  },
};
