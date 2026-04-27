/**
 * HTML email templates for shipment notifications.
 * Kept inline (no external template engine) to keep the worker simple.
 *
 * All templates follow the same structure:
 *   - Header with branded color band
 *   - Shipment summary card
 *   - Primary CTA button to view in dashboard
 *   - Footer with unsubscribe note
 */

interface BaseArgs {
  name:           string;
  trackingNumber: string;
  url:            string;
}

function escHtml(s: string | null | undefined): string {
  return String(s ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function shell(opts: { title: string; preheader: string; accentColor: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${escHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <span style="display:none;font-size:1px;color:#f5f7fa;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escHtml(opts.preheader)}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f7fa;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.05);">
        <tr><td style="background:${opts.accentColor};height:6px;"></td></tr>
        <tr><td style="padding:32px 32px 8px;">
          <p style="margin:0;font-size:13px;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;font-weight:600;">TrackMyContainer</p>
        </td></tr>
        ${opts.body}
        <tr><td style="padding:24px 32px;border-top:1px solid #e5e7eb;background:#f9fafb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
            You're receiving this because email notifications are enabled for this shipment.
            Manage preferences in your <a href="${escHtml(opts.body.includes("https://") ? "" : "")}/dashboard/settings" style="color:#6b7280;text-decoration:underline;">dashboard settings</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function ctaButton(href: string, label: string, color: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 0;">
    <tr><td style="background:${color};border-radius:10px;">
      <a href="${escHtml(href)}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;">${escHtml(label)}</a>
    </td></tr>
  </table>`;
}

// ─────────────────────────────────────────────────────────────
// DELAY ALERT
// ─────────────────────────────────────────────────────────────

interface DelayArgs extends BaseArgs {
  newEta:           Date;
  currentLocation?: string;
}

export function delayAlertEmail(args: DelayArgs): { subject: string; html: string } {
  const subject = `Shipment ${args.trackingNumber} delayed — new ETA ${args.newEta.toLocaleDateString()}`;
  const body = `
    <tr><td style="padding:8px 32px 16px;">
      <h1 style="margin:0;font-size:22px;color:#1f2937;font-weight:700;">⚠️ Delay detected</h1>
      <p style="margin:8px 0 0;font-size:15px;color:#4b5563;line-height:1.6;">Hi ${escHtml(args.name)}, your shipment has been delayed.</p>
    </td></tr>
    <tr><td style="padding:0 32px 24px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fef3f2;border-left:4px solid #f97316;border-radius:8px;padding:20px;">
        <tr><td>
          <p style="margin:0;font-size:13px;color:#92400e;font-weight:600;">Container</p>
          <p style="margin:4px 0 0;font-size:18px;color:#1f2937;font-weight:700;font-family:monospace;">${escHtml(args.trackingNumber)}</p>
          ${args.currentLocation ? `<p style="margin:12px 0 0;font-size:13px;color:#92400e;font-weight:600;">Current location</p><p style="margin:4px 0 0;font-size:14px;color:#1f2937;">${escHtml(args.currentLocation)}</p>` : ""}
          <p style="margin:12px 0 0;font-size:13px;color:#92400e;font-weight:600;">Updated arrival estimate</p>
          <p style="margin:4px 0 0;font-size:16px;color:#1f2937;font-weight:600;">${escHtml(args.newEta.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }))}</p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:0 32px 32px;">${ctaButton(args.url, "View Shipment", "#f97316")}</td></tr>`;
  return { subject, html: shell({ title: subject, preheader: `Delay detected on ${args.trackingNumber}`, accentColor: "#f97316", body }) };
}

// ─────────────────────────────────────────────────────────────
// ARRIVAL NOTICE
// ─────────────────────────────────────────────────────────────

interface ArrivalArgs extends BaseArgs {
  location:  string;
  arrivedAt: Date;
}

export function arrivalNoticeEmail(args: ArrivalArgs): { subject: string; html: string } {
  const subject = `✓ Shipment ${args.trackingNumber} arrived at ${args.location}`;
  const body = `
    <tr><td style="padding:8px 32px 16px;">
      <h1 style="margin:0;font-size:22px;color:#1f2937;font-weight:700;">✓ Arrived at destination</h1>
      <p style="margin:8px 0 0;font-size:15px;color:#4b5563;line-height:1.6;">Hi ${escHtml(args.name)}, your shipment has reached its destination.</p>
    </td></tr>
    <tr><td style="padding:0 32px 24px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ecfdf5;border-left:4px solid #10b981;border-radius:8px;padding:20px;">
        <tr><td>
          <p style="margin:0;font-size:13px;color:#065f46;font-weight:600;">Container</p>
          <p style="margin:4px 0 0;font-size:18px;color:#1f2937;font-weight:700;font-family:monospace;">${escHtml(args.trackingNumber)}</p>
          <p style="margin:12px 0 0;font-size:13px;color:#065f46;font-weight:600;">Arrived at</p>
          <p style="margin:4px 0 0;font-size:16px;color:#1f2937;font-weight:600;">${escHtml(args.location)}</p>
          <p style="margin:12px 0 0;font-size:13px;color:#065f46;font-weight:600;">Date</p>
          <p style="margin:4px 0 0;font-size:14px;color:#1f2937;">${escHtml(args.arrivedAt.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }))}</p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:0 32px 32px;">${ctaButton(args.url, "View Shipment", "#10b981")}</td></tr>`;
  return { subject, html: shell({ title: subject, preheader: `${args.trackingNumber} arrived at ${args.location}`, accentColor: "#10b981", body }) };
}

// ─────────────────────────────────────────────────────────────
// ETA IMMINENT (≤ 3 days)
// ─────────────────────────────────────────────────────────────

interface EtaImminentArgs extends BaseArgs {
  etaDate:  Date;
  daysLeft: number;
}

export function etaImminentEmail(args: EtaImminentArgs): { subject: string; html: string } {
  const dayLabel =
    args.daysLeft <= 0 ? "today" :
    args.daysLeft === 1 ? "tomorrow" :
    `in ${args.daysLeft} days`;

  const subject = `Shipment ${args.trackingNumber} arriving ${dayLabel}`;
  const body = `
    <tr><td style="padding:8px 32px 16px;">
      <h1 style="margin:0;font-size:22px;color:#1f2937;font-weight:700;">🚢 Arriving ${escHtml(dayLabel)}</h1>
      <p style="margin:8px 0 0;font-size:15px;color:#4b5563;line-height:1.6;">Hi ${escHtml(args.name)}, your shipment is on final approach.</p>
    </td></tr>
    <tr><td style="padding:0 32px 24px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:8px;padding:20px;">
        <tr><td>
          <p style="margin:0;font-size:13px;color:#1e3a8a;font-weight:600;">Container</p>
          <p style="margin:4px 0 0;font-size:18px;color:#1f2937;font-weight:700;font-family:monospace;">${escHtml(args.trackingNumber)}</p>
          <p style="margin:12px 0 0;font-size:13px;color:#1e3a8a;font-weight:600;">Estimated arrival</p>
          <p style="margin:4px 0 0;font-size:16px;color:#1f2937;font-weight:600;">${escHtml(args.etaDate.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }))}</p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:0 32px 32px;">${ctaButton(args.url, "View Shipment", "#3b82f6")}</td></tr>`;
  return { subject, html: shell({ title: subject, preheader: `${args.trackingNumber} arriving ${dayLabel}`, accentColor: "#3b82f6", body }) };
}
