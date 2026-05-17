import { NextRequest, NextResponse } from "next/server";
import {
  isEvolutionEnabled,
  parseEvolutionInbound,
  sendEvolutionText,
} from "@/backend/services/notifications/evolution";
import { isWhatsappBotEnabled, waAllowed } from "@/backend/services/notifications/wa-gate";

/**
 * Evolution API (WhatsApp Web bridge) inbound webhook — TEMPORARY
 * demo path, isolated from the official Meta webhook
 * (/api/webhooks/whatsapp). Only does anything when
 * EVOLUTION_ENABLED=true.
 */

export async function GET() {
  return NextResponse.json({ ok: true, service: "evolution-webhook" });
}

export async function POST(req: NextRequest) {
  if (!isEvolutionEnabled()) {
    return NextResponse.json({ ok: true, skipped: "evolution disabled" });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const inbound = parseEvolutionInbound(payload);
  if (!inbound) {
    return NextResponse.json({ ok: true });
  }

  if (!isWhatsappBotEnabled() || !waAllowed(inbound.from)) {
    return NextResponse.json({ ok: true, skipped: "gated" });
  }

  console.log(
    `[webhooks/evolution] inbound from=${inbound.from} text=${JSON.stringify(inbound.text)}`,
  );

  try {
    const { handleProTurn } = await import(
      "@/backend/services/whatsapp-bot/whatsapp-pro-bot"
    );
    const replies = await handleProTurn(inbound.from, inbound.text);
    console.log(`[webhooks/evolution] replying ${replies.length} msg(s)`);
    for (const body of replies) {
      await sendEvolutionText(inbound.from, body);
    }
  } catch (err) {
    console.error("[webhooks/evolution] bot error:", err);
  }

  return NextResponse.json({ ok: true });
}
