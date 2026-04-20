import { NextRequest, NextResponse } from "next/server";
import twilio                        from "twilio";
import { handleIncomingWhatsApp }   from "@/backend/services/notifications/whatsapp";
import { trackShipment, TrackingError } from "@/backend/services/tracking";
import { parseTrackingIdentifier }  from "@/backend/services/tracking/identifier-parser";
import { getStatusLabel }           from "@/lib/utils";
import { formatDate }               from "@/lib/utils";

/**
 * POST /api/webhooks/twilio
 * Handles incoming WhatsApp messages via Twilio.
 */
export async function POST(req: NextRequest) {
  // ── Validate Twilio signature ────────────────────────────────
  const signature = req.headers.get("x-twilio-signature") ?? "";
  const url       = req.url;

  const body      = await req.formData();
  const params    = Object.fromEntries(body.entries()) as Record<string, string>;

  // Validate signature in production
  if (process.env.NODE_ENV === "production") {
    const valid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN!,
      signature,
      url,
      params,
    );
    if (!valid) {
      return new NextResponse("Unauthorized", { status: 403 });
    }
  }

  const from    = params.From ?? "";     // "whatsapp:+12125551234"
  const msgBody = params.Body?.trim() ?? "";

  // ── Handle opt-in / opt-out ──────────────────────────────────
  const specialResponse = await handleIncomingWhatsApp({ from, body: msgBody });
  if (specialResponse) {
    return twimlResponse(specialResponse);
  }

  // ── Try to track as shipment number ─────────────────────────
  const parsed = parseTrackingIdentifier(msgBody.toUpperCase());

  if (!parsed.valid) {
    return twimlResponse(
      `I couldn't recognize "${msgBody}" as a container or AWB number.\n\n` +
      `📦 Container: MAEU1234567\n✈️ AWB: 157-12345678\n\n` +
      `Visit trackmycontainer.info to learn more.`
    );
  }

  try {
    const result = await trackShipment(msgBody.toUpperCase());
    const latest = result.events.at(-1);
    const url    = `${process.env.NEXT_PUBLIC_APP_URL}/track/${encodeURIComponent(result.trackingNumber)}`;

    const lines = [
      `*${result.trackingNumber}*`,
      result.carrier ? `Carrier: ${result.carrier}` : null,
      `Status: *${getStatusLabel(result.currentStatus)}*`,
      latest?.location ? `Location: ${latest.location}` : null,
      result.etaDate ? `ETA: *${formatDate(result.etaDate)}*` : null,
      ``,
      `🔗 Full details: ${url}`,
      ``,
      `💡 Get automatic alerts — sign up free at trackmycontainer.info`,
    ].filter(Boolean).join("\n");

    return twimlResponse(lines);
  } catch (err) {
    const msg = err instanceof TrackingError ? err.message : "Could not retrieve tracking data. Please try again.";
    return twimlResponse(`❌ ${msg}`);
  }
}

// ── TwiML text response ───────────────────────────────────────
function twimlResponse(message: string): NextResponse {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Message>
</Response>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "text/xml" },
  });
}
