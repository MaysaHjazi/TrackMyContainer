import { NextRequest, NextResponse } from "next/server";
import {
  isUltraMsgEnabled,
  parseUltraMsgInbound,
  sendUltraMsgText,
} from "@/backend/services/notifications/ultramsg";

/**
 * UltraMsg (WhatsApp Web gateway) inbound webhook — TEMPORARY demo
 * path, isolated from the official Meta webhook. Reuses the Arabic
 * numbered-menu bot. Only active when ULTRAMSG_ENABLED=true.
 *
 * Set this URL in the UltraMsg dashboard → Webhook, event
 * "message_received": https://trackmycontainer.info/api/webhooks/ultramsg
 */

export async function GET() {
  return NextResponse.json({ ok: true, service: "ultramsg-webhook" });
}

export async function POST(req: NextRequest) {
  if (!isUltraMsgEnabled()) {
    return NextResponse.json({ ok: true, skipped: "ultramsg disabled" });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const inbound = parseUltraMsgInbound(payload);
  if (!inbound) {
    return NextResponse.json({ ok: true });
  }

  console.log(
    `[webhooks/ultramsg] inbound from=${inbound.from} text=${JSON.stringify(inbound.text)}`,
  );

  try {
    const { handleEvolutionTurn } = await import(
      "@/backend/services/whatsapp-bot/evolution-bot"
    );
    const replies = await handleEvolutionTurn(inbound.from, inbound.text);
    console.log(`[webhooks/ultramsg] replying ${replies.length} msg(s)`);
    for (const body of replies) {
      await sendUltraMsgText(inbound.from, body);
    }
  } catch (err) {
    console.error("[webhooks/ultramsg] bot error:", err);
  }

  return NextResponse.json({ ok: true });
}
