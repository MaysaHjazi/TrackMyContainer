import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhook,
  parseInboundMessage,
  sendMetaText,
  isMetaProvider,
} from "@/backend/services/notifications/whatsapp-meta";
import { handleIncomingWhatsApp } from "@/backend/services/notifications/whatsapp";
import { trackShipment, TrackingError } from "@/backend/services/tracking";
import { getStatusLabel, formatDate } from "@/lib/utils";

/**
 * Meta WhatsApp Cloud API webhook.
 *
 *  GET  → one-time verification handshake (hub.challenge echo)
 *  POST → inbound user messages: OPT IN/OUT or a tracking lookup
 *
 * Mirrors the Twilio webhook's behaviour but for Meta's payload
 * shape. Only does anything when WHATSAPP_PROVIDER=meta.
 */

export async function GET(req: NextRequest) {
  const challenge = verifyWebhook(req.nextUrl.searchParams);
  if (challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  // Always 200 fast so Meta doesn't retry; process inline but guard all.
  if (!isMetaProvider()) {
    return NextResponse.json({ ok: true, skipped: "provider!=meta" });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const inbound = parseInboundMessage(payload);
  if (!inbound) return NextResponse.json({ ok: true });

  try {
    const from = inbound.from; // E.164 digits, no '+'
    const text = inbound.text;

    // OPT IN / OUT / welcome are handled here; null = tracking query.
    const canned = await handleIncomingWhatsApp({
      from: `whatsapp:+${from}`,
      body: text,
    });

    if (canned) {
      await sendMetaText(from, canned);
      return NextResponse.json({ ok: true });
    }

    // Otherwise treat the message as a tracking number / AWB.
    try {
      const result = await trackShipment(text.trim());
      const latest = result.events?.[result.events.length - 1];
      const reply =
        `📦 *${result.trackingNumber}*\n` +
        `Status: *${getStatusLabel(result.currentStatus)}*\n` +
        (result.currentLocation ? `Location: ${result.currentLocation}\n` : "") +
        (result.etaDate ? `ETA: ${formatDate(result.etaDate)}\n` : "") +
        (latest?.description ? `\nLatest: ${latest.description}` : "");
      await sendMetaText(from, reply);
    } catch (err) {
      const msg =
        err instanceof TrackingError
          ? err.message
          : "Couldn't find that shipment. Send a container number (e.g. MAEU1234567) or AWB (e.g. 157-12345678).";
      await sendMetaText(from, msg);
    }
  } catch (err) {
    console.error("[webhooks/whatsapp] handler error:", err);
  }

  return NextResponse.json({ ok: true });
}
