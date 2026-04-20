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
