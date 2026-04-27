import type { Job } from "bullmq";
import type { NotificationJobData } from "@/backend/lib/queue";
import { sendWhatsApp } from "@/backend/services/notifications/whatsapp";
import { sendEmail } from "@/backend/services/notifications/email";
import {
  delayAlertEmail,
  arrivalNoticeEmail,
  etaImminentEmail,
} from "@/backend/services/notifications/email-templates";

/**
 * Routes notification jobs to the correct channel handler.
 */
export async function notificationProcessor(
  job: Job<NotificationJobData>,
): Promise<void> {
  const { userId, shipmentId, channel, type, payload } = job.data;

  switch (channel) {
    case "WHATSAPP":
      await handleWhatsApp(userId, shipmentId, type, payload);
      break;
    case "EMAIL":
      await handleEmail(userId, shipmentId, type, payload);
      break;
    // case "MESSENGER": await handleMessenger(...); break;
    default:
      console.warn(`[notification-send] Unknown channel: ${channel}`);
  }
}

// ─────────────────────────────────────────────────────────────
// WhatsApp
// ─────────────────────────────────────────────────────────────

async function handleWhatsApp(
  userId: string,
  shipmentId: string | undefined,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const phone = payload.phone as string;
  if (!phone) throw new Error("Missing phone in WhatsApp notification payload");

  const templateKeyMap: Record<string, string> = {
    ARRIVAL_NOTICE: "ARRIVAL_NOTICE",
    DELAY_ALERT:    "DELAY_ALERT",
    ETA_IMMINENT:   "ETA_IMMINENT",
    STATUS_CHANGE:  "STATUS_CHANGE",
    CUSTOMS_HOLD:   "CUSTOMS_HOLD",
    WELCOME:        "WELCOME",
  };

  const templateKey = templateKeyMap[type];
  if (!templateKey) throw new Error(`No WhatsApp template for type: ${type}`);

  await sendWhatsApp({
    userId,
    shipmentId,
    toPhone:          phone,
    templateKey:      templateKey as never,
    templateArgs:     payload as never,
    notificationType: type,
  });
}

// ─────────────────────────────────────────────────────────────
// Email
// ─────────────────────────────────────────────────────────────

async function handleEmail(
  userId: string,
  shipmentId: string | undefined,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const to = payload.email as string;
  if (!to) throw new Error("Missing email in EMAIL notification payload");

  let rendered: { subject: string; html: string };

  switch (type) {
    case "DELAY_ALERT":
      rendered = delayAlertEmail({
        name:            (payload.name as string) ?? "there",
        trackingNumber:  payload.number as string,
        newEta:          new Date(payload.newEta as string | number),
        currentLocation: payload.location as string | undefined,
        url:             payload.url as string,
      });
      break;

    case "ARRIVAL_NOTICE":
      rendered = arrivalNoticeEmail({
        name:           (payload.name as string) ?? "there",
        trackingNumber: payload.number as string,
        location:       (payload.location as string) ?? "destination",
        arrivedAt:      new Date(payload.arrivedAt as string | number),
        url:            payload.url as string,
      });
      break;

    case "ETA_IMMINENT": {
      const etaDate = new Date(payload.etaDate as string | number);
      const daysLeft = Math.max(
        0,
        Math.ceil((etaDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      );
      rendered = etaImminentEmail({
        name:           (payload.name as string) ?? "there",
        trackingNumber: payload.number as string,
        etaDate,
        daysLeft,
        url:            payload.url as string,
      });
      break;
    }

    default:
      throw new Error(`No email template for notification type: ${type}`);
  }

  await sendEmail({
    userId,
    shipmentId,
    to,
    subject:          rendered.subject,
    html:             rendered.html,
    notificationType: type as never,
  });
}
