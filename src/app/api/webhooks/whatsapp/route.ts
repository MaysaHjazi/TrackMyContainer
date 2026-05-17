import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhook,
  parseInboundMessage,
  sendMetaText,
  sendMetaButtons,
  isMetaProvider,
} from "@/backend/services/notifications/whatsapp-meta";

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
  if (!isMetaProvider()) {
    return NextResponse.json({ ok: true, skipped: "provider!=meta" });
  }
  let payload: unknown;
  try { payload = await req.json(); } catch { return NextResponse.json({ ok: true }); }

  const inbound = parseInboundMessage(payload);
  if (!inbound) {
    console.log("[webhooks/whatsapp] inbound ignored (no parseable message)");
    return NextResponse.json({ ok: true });
  }

  console.log(`[webhooks/whatsapp] inbound from=${inbound.from} text=${JSON.stringify(inbound.text)}`);

  try {
    const { handleBotTurn } = await import("@/backend/services/whatsapp-bot/bot-state");
    const msgs = await handleBotTurn(inbound.from, inbound.text);
    console.log(`[webhooks/whatsapp] replying ${msgs.length} msg(s): ${msgs.map((m) => m.type).join(",")}`);
    for (const m of msgs) {
      if (m.type === "buttons" && m.buttons?.length) {
        await sendMetaButtons(inbound.from, m.body, m.buttons);
      } else {
        await sendMetaText(inbound.from, m.body);
      }
    }
  } catch (err) {
    console.error("[webhooks/whatsapp] bot error:", err);
  }
  return NextResponse.json({ ok: true });
}
