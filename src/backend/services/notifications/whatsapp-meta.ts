/**
 * Meta WhatsApp Cloud API client.
 *
 * Only used when WHATSAPP_PROVIDER=meta. The Twilio path in
 * whatsapp.ts is left fully intact as the default so nothing breaks
 * until the Meta side (registered number, permanent token, approved
 * templates) is completely ready.
 *
 * Env:
 *   WHATSAPP_PROVIDER=meta            ← cutover switch (default: twilio)
 *   WHATSAPP_ACCESS_TOKEN             ← permanent System User token
 *   WHATSAPP_PHONE_NUMBER_ID          ← the production number's ID
 *   WHATSAPP_VERIFY_TOKEN             ← any secret; same value in Meta webhook config
 *   WHATSAPP_GRAPH_VERSION (optional) ← defaults to v21.0
 */

const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0"}`;

export function isMetaProvider(): boolean {
  return (
    (process.env.WHATSAPP_PROVIDER ?? "twilio").toLowerCase() === "meta" &&
    !!process.env.WHATSAPP_ACCESS_TOKEN &&
    !!process.env.WHATSAPP_PHONE_NUMBER_ID
  );
}

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };
}

/** wa.me / API wants the number WITHOUT '+' or 'whatsapp:' prefix. */
function normalizeTo(raw: string): string {
  return raw.replace(/^whatsapp:/i, "").replace(/[^\d]/g, "");
}

/**
 * Send an approved template message (business-initiated notification).
 * Returns the Meta message id on success; throws on failure.
 */
export async function sendMetaTemplate(opts: {
  to: string;
  templateName: string;
  language: string;
  bodyParams: string[];
}): Promise<string> {
  const res = await fetch(
    `${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: authHeaders(),
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizeTo(opts.to),
        type: "template",
        template: {
          name: opts.templateName,
          language: { code: opts.language },
          components: [
            {
              type: "body",
              parameters: opts.bodyParams.map((t) => ({ type: "text", text: t })),
            },
          ],
        },
      }),
    },
  );

  const json = (await res.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { message?: string };
  };
  if (!res.ok || !json.messages?.[0]?.id) {
    throw new Error(
      `Meta WhatsApp template send failed (${res.status}): ${
        json.error?.message ?? JSON.stringify(json).slice(0, 200)
      }`,
    );
  }
  return json.messages[0].id;
}

/**
 * Send a plain text message. Only delivered inside the 24h customer
 * service window (i.e. replies to inbound messages) — used by the
 * webhook responder, not by proactive notifications.
 */
export async function sendMetaText(to: string, body: string): Promise<string> {
  const res = await fetch(
    `${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: authHeaders(),
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizeTo(to),
        type: "text",
        text: { preview_url: true, body },
      }),
    },
  );
  const json = (await res.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { message?: string };
  };
  if (!res.ok || !json.messages?.[0]?.id) {
    throw new Error(
      `Meta WhatsApp text send failed (${res.status}): ${
        json.error?.message ?? JSON.stringify(json).slice(0, 200)
      }`,
    );
  }
  return json.messages[0].id;
}

/** Webhook GET verification (Meta calls this once when you save the URL). */
export function verifyWebhook(params: URLSearchParams): string | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (
    mode === "subscribe" &&
    token &&
    token === process.env.WHATSAPP_VERIFY_TOKEN &&
    challenge
  ) {
    return challenge;
  }
  return null;
}

/** Extract the first inbound text message from a Meta webhook payload. */
export function parseInboundMessage(
  payload: unknown,
): { from: string; text: string } | null {
  try {
    const p = payload as {
      entry?: {
        changes?: {
          value?: {
            messages?: { from?: string; text?: { body?: string }; type?: string }[];
          };
        }[];
      }[];
    };
    const msg = p.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg?.from || msg.type !== "text" || !msg.text?.body) return null;
    return { from: msg.from, text: msg.text.body };
  } catch {
    return null;
  }
}
