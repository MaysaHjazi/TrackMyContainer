/**
 * WhatsApp (UltraMsg) safety gate + proactive message formatter.
 *
 * TWO independent safety controls, both default-SAFE:
 *  1. WHATSAPP_BOT_ENABLED  — master on/off. Default OFF: the bot
 *     never replies and proactive sends no-op until explicitly "true".
 *  2. WHATSAPP_TEST_NUMBER   — optional test allowlist. When set, ONLY
 *     that number gets replies / proactive alerts; everyone else is
 *     ignored silently (random people who message get nothing).
 *
 * Read-only: no DB writes, no backend mutation.
 */

function digits(raw: string): string {
  return raw
    .replace(/^whatsapp:/i, "")
    .replace(/@c\.us$/i, "")
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/[^\d]/g, "");
}

export function isWhatsappBotEnabled(): boolean {
  return (process.env.WHATSAPP_BOT_ENABLED ?? "").toLowerCase() === "true";
}

/**
 * True if this phone is allowed to interact / receive proactive alerts.
 * When WHATSAPP_TEST_NUMBER is set, only that exact number passes.
 * When it's unset (production), all numbers pass.
 */
export function waAllowed(phone: string): boolean {
  const test = process.env.WHATSAPP_TEST_NUMBER;
  if (!test) return true;
  return digits(phone) === digits(test);
}

/** Combined gate used by both inbound (webhook) and outbound (proactive). */
export function waGateOpen(phone: string): boolean {
  return isWhatsappBotEnabled() && waAllowed(phone);
}

// ── Proactive alert copy — warm sentence style + countdown ───────

function daysTo(d: Date | null): number | null {
  if (!d) return null;
  const ms = d.getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function fmtDate(d: Date | null): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function etaLine(rawEta: unknown): string | null {
  const d = rawEta ? new Date(rawEta as string | number) : null;
  const ds = fmtDate(d);
  if (!ds) return null;
  const n = daysTo(d);
  return n != null
    ? `Now expected on ${ds} — about ${n} ${n === 1 ? "day" : "days"} to go.`
    : `Now expected on ${ds}.`;
}

/**
 * Build the proactive WhatsApp body for a notification. `type` is the
 * notification type, `a` the BullMQ payload. Always returns a friendly
 * sentence-style message (never a label/value table).
 */
export function formatProactiveBody(
  type: string,
  a: Record<string, unknown>,
): string {
  const num = String(a.number ?? "your shipment");
  const url = String(a.url ?? "https://trackmycontainer.info/dashboard");
  const loc =
    (a.currentLocation as string | null | undefined) ??
    (a.location as string | null | undefined) ??
    null;
  const status =
    (a.currentStatus as string | undefined) ??
    (a.status as string | undefined) ??
    null;

  let lead: string;
  switch (type) {
    case "ARRIVAL_NOTICE":
      lead = `📦  ${num} just arrived${loc ? ` at ${loc}` : ""} — it's reached its destination. 🎉`;
      break;
    case "DELAY_ALERT": {
      const eta = etaLine(a.newEta ?? a.etaDate);
      return [
        "🔔  Update on your shipment",
        "",
        `📦  ${num} has been delayed.`,
        eta ?? "",
        "",
        `Full timeline → ${url}`,
      ]
        .filter((l) => l !== "")
        .join("\n");
    }
    case "ETA_IMMINENT": {
      const eta = etaLine(a.etaDate);
      return [
        "🔔  Update on your shipment",
        "",
        `📦  ${num} is arriving soon.`,
        eta ?? "",
        "",
        `Full timeline → ${url}`,
      ]
        .filter((l) => l !== "")
        .join("\n");
    }
    default: // STATUS_CHANGE / anything else
      lead = `📦  ${num} just moved${status ? ` — it's now ${status}` : ""}${loc ? ` in ${loc}` : ""}.`;
  }

  const eta = etaLine(a.etaDate ?? a.newEta);
  return [
    "🔔  Update on your shipment",
    "",
    lead,
    eta ?? "",
    "",
    `Full timeline → ${url}`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}
