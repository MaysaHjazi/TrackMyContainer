/**
 * UltraMsg (hosted unofficial WhatsApp Web gateway) client.
 *
 * TEMPORARY demo integration — separate from the official Meta
 * WhatsApp Cloud API path. Active only when ULTRAMSG_ENABLED=true.
 * Sends proactive ShipsGo updates with NO Meta template / 24h-window
 * limit, until official Meta templates are approved.
 *
 * Env:
 *   ULTRAMSG_ENABLED=true
 *   ULTRAMSG_INSTANCE=instance175950
 *   ULTRAMSG_TOKEN=<token>
 *   ULTRAMSG_API_URL=https://api.ultramsg.com   (optional override)
 */

export function isUltraMsgEnabled(): boolean {
  return (
    (process.env.ULTRAMSG_ENABLED ?? "").toLowerCase() === "true" &&
    !!process.env.ULTRAMSG_INSTANCE &&
    !!process.env.ULTRAMSG_TOKEN
  );
}

function base() {
  return {
    url: (process.env.ULTRAMSG_API_URL ?? "https://api.ultramsg.com").replace(/\/+$/, ""),
    instance: process.env.ULTRAMSG_INSTANCE!,
    token: process.env.ULTRAMSG_TOKEN!,
  };
}

/** Digits only — strip '+', 'whatsapp:', '@c.us', spaces. */
export function umNormalize(raw: string): string {
  return raw
    .replace(/^whatsapp:/i, "")
    .replace(/@c\.us$/i, "")
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/[^\d]/g, "");
}

/**
 * Send a plain WhatsApp text via UltraMsg. Returns the message id on
 * success; throws on failure.
 */
export async function sendUltraMsgText(to: string, text: string): Promise<string> {
  const { url, instance, token } = base();
  const res = await fetch(`${url}/${instance}/messages/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ token, to: umNormalize(to), body: text }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    sent?: string | boolean;
    id?: string | number;
    message?: string;
    error?: unknown;
  };
  const ok =
    res.ok && (json.sent === true || json.sent === "true" || json.id != null);
  if (!ok) {
    throw new Error(
      `UltraMsg sendText failed (${res.status}): ${JSON.stringify(json).slice(0, 200)}`,
    );
  }
  return String(json.id ?? `um_${Date.now()}`);
}

/**
 * Parse an UltraMsg webhook payload into { from, text }. Ignores
 * outbound / non-chat / group messages.
 *
 * Shape: { event_type: "message_received",
 *          data: { from: "9627...@c.us", body, type, fromMe } }
 */
export function parseUltraMsgInbound(
  payload: unknown,
): { from: string; text: string } | null {
  try {
    const p = payload as {
      event_type?: string;
      data?: {
        from?: string;
        body?: string;
        type?: string;
        fromMe?: boolean;
        self?: boolean;
      };
    };
    if (p.event_type && p.event_type !== "message_received") return null;
    const d = p.data;
    if (!d || d.fromMe === true || d.self === true) return null;
    const from = d.from ?? "";
    // ignore groups (@g.us) / status
    if (!from.endsWith("@c.us")) return null;
    if (d.type && d.type !== "chat") return null;
    const phone = umNormalize(from);
    const text = (d.body ?? "").trim();
    if (!phone || !text) return null;
    return { from: phone, text };
  } catch {
    return null;
  }
}
