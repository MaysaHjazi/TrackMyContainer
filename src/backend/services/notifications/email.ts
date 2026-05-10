import { Resend } from "resend";
import { prisma } from "@/backend/lib/db";
import { recordEvent } from "@/lib/audit-log";
import type { NotificationType } from "@prisma/client";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM ?? "TrackMyContainer <onboarding@resend.dev>";

interface SendEmailOpts {
  userId:           string;
  shipmentId?:      string;
  to:               string;
  subject:          string;
  html:             string;
  notificationType: NotificationType;
  /** Optional plain-text summary surfaced in the in-app bell.
   *  When omitted we fall back to `subject`, which is short, human
   *  readable, and already carries the key facts ("MAEU... delayed
   *  by N days — new ETA …"). The raw HTML is still sent via Resend
   *  but never stored in the Notification row's body — that field
   *  is what the bell renders. */
  summary?:         string;
}

/**
 * Send an email via Resend AND record it in the notifications table.
 * Always creates a Notification row — gives admin visibility regardless
 * of whether Resend is configured/working.
 */
export async function sendEmail({
  userId,
  shipmentId,
  to,
  subject,
  html,
  notificationType,
  summary,
}: SendEmailOpts): Promise<void> {
  // The bell + notifications page render `body` directly. Store a
  // clean text summary there — never the raw HTML. Subject is a
  // good default ("⚠️ MAEU... delayed by 18 days — new ETA …").
  // Trim any leading emoji/symbol so the bell line reads naturally.
  const bellBody = (summary ?? subject).replace(/^[^\w(]+\s*/, "").trim();

  // Create pending notification record
  const record = await prisma.notification.create({
    data: {
      userId,
      shipmentId: shipmentId ?? null,
      channel:    "EMAIL",
      type:       notificationType,
      subject,
      body:       bellBody,
      status:     "PENDING",
    },
  });

  if (!resend) {
    await prisma.notification.update({
      where: { id: record.id },
      data:  { status: "FAILED", error: "RESEND_API_KEY not configured", failedAt: new Date() },
    });
    console.warn("[email] Resend not configured — notification queued but not sent");
    return;
  }

  try {
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) throw new Error(error.message);

    await prisma.notification.update({
      where: { id: record.id },
      data:  {
        status:     "SENT",
        sentAt:     new Date(),
        externalId: data?.id ?? null,
      },
    });
    void recordEvent({
      type:    "notification.sent",
      message: `EMAIL · ${notificationType} → ${to}`,
      userId,
      metadata: { channel: "EMAIL", notificationType, to },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await prisma.notification.update({
      where: { id: record.id },
      data:  { status: "FAILED", error: msg, failedAt: new Date() },
    });
    console.error("[email] failed to send:", msg);
    void recordEvent({
      type:    "notification.failed",
      level:   "error",
      message: `EMAIL · ${notificationType} → ${to}: ${msg}`,
      userId,
      metadata: { channel: "EMAIL", notificationType, to, error: msg },
    });
    throw err;
  }
}
