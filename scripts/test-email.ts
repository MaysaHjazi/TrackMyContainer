/**
 * Send a test ARRIVAL NOTICE email so you can preview how branded
 * notifications look in your inbox without waiting for a real shipment
 * to arrive.
 *
 * Usage on the VPS:
 *   docker exec tmc-worker npx tsx /app/scripts/test-email.ts you@example.com
 *
 * If no recipient is given, falls back to the first user in the DB.
 *
 * Note: when RESEND_FROM points at the Resend sandbox
 * (`onboarding@resend.dev`), Resend will only accept recipients that
 * own the API key. Verify the trackmycontainer.info domain in Resend
 * to send to anyone.
 */
import { Resend } from "resend";
import { PrismaClient } from "@prisma/client";
import { arrivalNoticeEmail } from "../src/backend/services/notifications/email-templates";

async function main() {
  const argTo = process.argv[2];
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.RESEND_FROM ?? "TrackMyContainer <onboarding@resend.dev>";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://trackmycontainer.info";

  if (!apiKey) {
    console.error("✗ RESEND_API_KEY missing — cannot send.");
    process.exit(1);
  }

  // Resolve recipient
  const prisma = new PrismaClient();
  let to = argTo;
  let name = "there";
  if (!to) {
    const u = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
    if (!u?.email) {
      console.error("✗ No recipient given and no user found in DB.");
      process.exit(1);
    }
    to   = u.email;
    name = u.name ?? "there";
  } else {
    const u = await prisma.user.findUnique({ where: { email: to } });
    name = u?.name ?? "there";
  }
  await prisma.$disconnect();

  // Build the same template the worker uses for ARRIVAL_NOTICE
  const { subject, html } = arrivalNoticeEmail({
    name,
    trackingNumber: "MAEU9184879",
    location:       "Aqaba, Jordan",
    arrivedAt:      new Date(),
    url:            `${appUrl}/dashboard/shipments`,
  });

  console.log(`→ Sending ARRIVAL_NOTICE preview`);
  console.log(`  from:    ${from}`);
  console.log(`  to:      ${to}`);
  console.log(`  subject: ${subject}`);

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({ from, to, subject, html });

  if (error) {
    console.error(`✗ Send failed: ${error.message}`);
    process.exit(1);
  }
  console.log(`✓ Sent — Resend id: ${data?.id}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
