/**
 * Evolution API (unofficial WhatsApp Web bridge) client.
 *
 * TEMPORARY demo integration — completely separate from the official
 * Meta WhatsApp Cloud API path (whatsapp-meta.ts). Active only when
 * EVOLUTION_ENABLED=true. Lets WhatsApp send proactive ShipsGo
 * updates without Meta templates / 24h window, until the official
 * Meta WhatsApp Business approval (templates) is ready.
 *
 * Env:
 *   EVOLUTION_ENABLED=true
 *   EVOLUTION_API_URL=http://evolution-api:8080   (internal docker net)
 *   EVOLUTION_API_KEY=<global apikey>
 *   EVOLUTION_INSTANCE=tmc
 */

export function isEvolutionEnabled(): boolean {
  return (
    (process.env.EVOLUTION_ENABLED ?? "").toLowerCase() === "true" &&
    !!process.env.EVOLUTION_API_URL &&
    !!process.env.EVOLUTION_API_KEY &&
    !!process.env.EVOLUTION_INSTANCE
  );
}

function base() {
  return {
    url: process.env.EVOLUTION_API_URL!.replace(/\/+$/, ""),
    key: process.env.EVOLUTION_API_KEY!,
    instance: process.env.EVOLUTION_INSTANCE!,
  };
}

/** Evolution wants the number as digits only (no '+', no 'whatsapp:'). */
export function evoNormalize(raw: string): string {
  return raw.replace(/^whatsapp:/i, "").replace(/@s\.whatsapp\.net$/i, "").replace(/[^\d]/g, "");
}

/**
 * Send a plain WhatsApp text via Evolution. Returns the message id on
 * success; throws on failure. No templates, no 24h window — this is
 * WhatsApp Web under the hood.
 */
export async function sendEvolutionText(to: string, text: string): Promise<string> {
  const { url, key, instance } = base();
  const res = await fetch(`${url}/message/sendText/${instance}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ number: evoNormalize(to), text }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    key?: { id?: string };
    message?: unknown;
    error?: unknown;
  };
  if (!res.ok || !json.key?.id) {
    throw new Error(
      `Evolution sendText failed (${res.status}): ${JSON.stringify(json).slice(0, 200)}`,
    );
  }
  return json.key.id;
}

/**
 * Parse an Evolution `messages.upsert` webhook payload into a simple
 * { from, text } pair. Returns null for non-text / outbound / group
 * messages we should ignore.
 */
export function parseEvolutionInbound(
  payload: unknown,
): { from: string; text: string } | null {
  try {
    const p = payload as {
      event?: string;
      data?: {
        key?: { remoteJid?: string; fromMe?: boolean };
        message?: {
          conversation?: string;
          extendedTextMessage?: { text?: string };
        };
      };
    };
    if (p.event && p.event !== "messages.upsert") return null;
    const d = p.data;
    if (!d?.key || d.key.fromMe) return null;
    const jid = d.key.remoteJid ?? "";
    // ignore groups / status / broadcast
    if (!jid.endsWith("@s.whatsapp.net")) return null;
    const from = evoNormalize(jid);
    const text =
      d.message?.conversation ??
      d.message?.extendedTextMessage?.text ??
      "";
    if (!from || !text.trim()) return null;
    return { from, text: text.trim() };
  } catch {
    return null;
  }
}
