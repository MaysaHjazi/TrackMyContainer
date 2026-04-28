import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db";
import { recordEvent } from "@/lib/audit-log";
import { Resend } from "resend";

function escHtml(s: string | null | undefined): string {
  return String(s ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// POST /api/contact — Save a custom plan enquiry and notify admin
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, email, phone, containersCount, message } = body as Record<string, unknown>;

  // ── Validation ─────────────────────────────────────────────
  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (
    containersCount === undefined ||
    typeof containersCount !== "number" ||
    !Number.isInteger(containersCount) ||
    containersCount < 1
  ) {
    return NextResponse.json(
      { error: "containersCount must be a positive integer" },
      { status: 400 },
    );
  }

  // ── Persist ────────────────────────────────────────────────
  let contact;
  try {
    contact = await prisma.contactRequest.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        phone: phone && typeof phone === "string" ? phone.trim() : undefined,
        containersCount,
        message:
          message && typeof message === "string" ? message.trim() : undefined,
      },
    });
  } catch (err) {
    console.error("[contact] DB error:", err);
    return NextResponse.json({ error: "Failed to save contact request" }, { status: 500 });
  }

  void recordEvent({
    type:    "contact.received",
    message: `${contact.name} (${contact.email}) — ${contact.containersCount} containers/mo`,
    metadata: { contactRequestId: contact.id, email: contact.email, containersCount: contact.containersCount },
  });

  // ── Admin email notification (best-effort) ─────────────────
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    const adminEmail = process.env.ADMIN_EMAIL ?? "admin@trackmycontainer.info";

    const htmlBody = `
      <h2>New Custom Plan Request</h2>
      <table>
        <tr><td><strong>Name</strong></td><td>${escHtml(name.trim())}</td></tr>
        <tr><td><strong>Email</strong></td><td>${escHtml(email.trim())}</td></tr>
        <tr><td><strong>Phone</strong></td><td>${escHtml((phone as string | undefined)?.trim())}</td></tr>
        <tr><td><strong>Containers Count</strong></td><td>${escHtml(String(containersCount))}</td></tr>
        <tr><td><strong>Message</strong></td><td>${escHtml((message as string | undefined)?.trim())}</td></tr>
      </table>
    `;

    try {
      const resend = new Resend(resendApiKey);
      await resend.emails.send({
        from: "TrackMyContainer <noreply@trackmycontainer.info>",
        to: adminEmail,
        subject: `New Custom Plan Request from ${name.trim()}`,
        html: htmlBody,
      });
    } catch (err) {
      // Non-fatal — log and continue
      console.error("[contact] Resend error:", err);
    }
  }

  return NextResponse.json({ success: true, id: contact.id }, { status: 201 });
}
