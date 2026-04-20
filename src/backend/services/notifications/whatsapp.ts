import twilio from "twilio";
import { WHATSAPP_TEMPLATES, type TemplateKey } from "./templates";
import { prisma } from "@/backend/lib/db";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

const FROM = process.env.TWILIO_WHATSAPP_NUMBER!; // "whatsapp:+1..."

/**
 * Send a WhatsApp message to a user's phone number.
 * Logs the notification in the DB.
 */
export async function sendWhatsApp({
  userId,
  shipmentId,
  toPhone,
  templateKey,
  templateArgs,
  notificationType,
}: {
  userId:         string;
  shipmentId?:    string;
  toPhone:        string;
  templateKey:    TemplateKey;
  templateArgs:   Parameters<typeof WHATSAPP_TEMPLATES[TemplateKey]["body"]>[0];
  notificationType: string;
}): Promise<void> {
  const template = WHATSAPP_TEMPLATES[templateKey];
  // @ts-expect-error dynamic args
  const body = template.body(templateArgs);

  // Create notification record (PENDING)
  const notification = await prisma.notification.create({
    data: {
      userId,
      shipmentId,
      channel:  "WHATSAPP",
      type:     notificationType as never,
      body,
      status:   "PENDING",
    },
  });

  try {
    const message = await client.messages.create({
      from: FROM,
      to:   `whatsapp:${toPhone}`,
      body,
    });

    await prisma.notification.update({
      where: { id: notification.id },
      data:  {
        status:     "SENT",
        externalId: message.sid,
        sentAt:     new Date(),
      },
    });
  } catch (err) {
    await prisma.notification.update({
      where: { id: notification.id },
      data:  {
        status:   "FAILED",
        failedAt: new Date(),
        error:    err instanceof Error ? err.message : "Unknown error",
      },
    });
    throw err;
  }
}

/**
 * Handle incoming WhatsApp messages (webhook from Twilio).
 * Supports: plain container/AWB lookup, OPT IN, STOP.
 */
export async function handleIncomingWhatsApp({
  from,
  body,
}: {
  from: string;    // "whatsapp:+12125551234"
  body: string;
}): Promise<string | null> {
  const phone   = from.replace("whatsapp:", "");
  const message = body.trim().toUpperCase();

  // Opt-out
  if (["STOP", "UNSUBSCRIBE", "OPT OUT"].includes(message)) {
    await prisma.whatsappSession.upsert({
      where:  { phoneNumber: phone },
      update: { isOptedIn: false, optOutAt: new Date() },
      create: { phoneNumber: phone, isOptedIn: false, optOutAt: new Date() },
    });
    return "You've been unsubscribed from TrackMyContainer.ai alerts. Reply START to re-subscribe.";
  }

  // Opt-in
  if (["START", "YES", "SUBSCRIBE"].includes(message)) {
    await prisma.whatsappSession.upsert({
      where:  { phoneNumber: phone },
      update: { isOptedIn: true, optInAt: new Date() },
      create: { phoneNumber: phone, isOptedIn: true, optInAt: new Date() },
    });
    return (
      "Welcome back to TrackMyContainer.ai! 🚢✈️\n\n" +
      "Send a container number (e.g. MAEU1234567) or AWB (e.g. 157-12345678) to track your shipment."
    );
  }

  // Tracking query — delegate to tracking orchestrator
  return null; // caller handles routing to trackShipment()
}
