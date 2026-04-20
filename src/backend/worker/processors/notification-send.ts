import type { Job } from "bullmq";
import type { NotificationJobData } from "@/backend/lib/queue";
import { sendWhatsApp }             from "@/backend/services/notifications/whatsapp";

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
    // case "EMAIL":    await handleEmail(...);    break;
    // case "MESSENGER": await handleMessenger(...); break;
    default:
      console.warn(`[notification-send] Unknown channel: ${channel}`);
  }
}

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
