/**
 * HTML email templates for shipment notifications.
 * Kept inline (no external template engine) to keep the worker simple.
 *
 * Brand palette (matches tailwind.config.ts):
 *   navy   #1B2B5E    primary, header band
 *   navy-deep #08101E  gradient end
 *   orange #F5821F    CTA, accent
 *   teal   #00B4C4    positive / sea theme
 *
 * Every template shares the same chrome:
 *   1. Navy gradient header band with TrackMyContainer wordmark
 *   2. Status-typed card with brand-colored left border
 *   3. Orange CTA button → dashboard
 *   4. Footer with settings link
 */

// ── Brand tokens ────────────────────────────────────────────
const BRAND = {
  navy:       "#1B2B5E",
  navyDark:   "#08101E",
  orange:     "#F5821F",
  orangeDark: "#E06610",
  teal:       "#00B4C4",
  ink:        "#0F1933",
  body:       "#475569",
  card:       "#FFFFFF",
  page:       "#EEF1F9",   // very light navy tint
  border:     "#D4DBF0",
};

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

// ── Chrome ──────────────────────────────────────────────────

function shell(opts: { title: string; preheader: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${escHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.page};font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${BRAND.ink};">
  <span style="display:none;font-size:1px;color:${BRAND.page};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escHtml(opts.preheader)}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.page};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:${BRAND.card};border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(27,43,94,0.08);">

        <!-- Brand header band: navy gradient + wordmark -->
        <tr><td style="background:linear-gradient(135deg,${BRAND.navy} 0%,${BRAND.navyDark} 100%);padding:24px 32px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="vertical-align:middle;">
                <p style="margin:0;font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">
                  Track<span style="color:${BRAND.orange};">My</span>Container<span style="color:${BRAND.orange};">.</span>
                </p>
                <p style="margin:4px 0 0;font-size:11px;color:${BRAND.teal};letter-spacing:2px;text-transform:uppercase;font-weight:600;">Real-time shipment intelligence</p>
              </td>
            </tr>
          </table>
        </td></tr>

        ${opts.body}

        <!-- Footer -->
        <tr><td style="padding:24px 32px;border-top:1px solid ${BRAND.border};background:${BRAND.page};">
          <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">
            You're receiving this because email alerts are enabled for this shipment.
            Manage preferences in your
            <a href="https://trackmycontainer.info/dashboard/settings" style="color:${BRAND.navy};text-decoration:underline;font-weight:600;">dashboard settings</a>.
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:#94a3b8;">© TrackMyContainer · trackmycontainer.info</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

function ctaButton(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 0;">
    <tr><td style="background:linear-gradient(135deg,${BRAND.orange} 0%,${BRAND.orangeDark} 100%);border-radius:10px;box-shadow:0 4px 12px rgba(245,130,31,0.25);">
      <a href="${escHtml(href)}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.2px;">${escHtml(label)} →</a>
    </td></tr>
  </table>`;
}

function statusCard(opts: { accent: string; tint: string; rows: Array<{ label: string; value: string }> }): string {
  return `
    <tr><td style="padding:0 32px 24px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${opts.tint};border-left:4px solid ${opts.accent};border-radius:10px;padding:20px;">
        <tr><td>
          ${opts.rows.map((r, i) => `
            <p style="margin:${i === 0 ? "0" : "12px 0 0"};font-size:12px;color:${opts.accent};font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">${escHtml(r.label)}</p>
            <p style="margin:4px 0 0;font-size:${i === 0 ? "18px;font-family:monospace;font-weight:700" : "15px;font-weight:600"};color:${BRAND.ink};">${r.value}</p>
          `).join("")}
        </td></tr>
      </table>
    </td></tr>`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

// ─────────────────────────────────────────────────────────────
// DELAY ALERT
// ─────────────────────────────────────────────────────────────

interface DelayArgs extends BaseArgs {
  newEta:           Date;
  currentLocation?: string;
}

export function delayAlertEmail(args: DelayArgs): { subject: string; html: string } {
  const subject = `⚠️ ${args.trackingNumber} delayed — new ETA ${args.newEta.toLocaleDateString()}`;
  const rows: Array<{ label: string; value: string }> = [
    { label: "Container",              value: escHtml(args.trackingNumber) },
  ];
  if (args.currentLocation) rows.push({ label: "Current location", value: escHtml(args.currentLocation) });
  rows.push({ label: "Updated arrival estimate", value: escHtml(fmtDate(args.newEta)) });

  const body = `
    <tr><td style="padding:32px 32px 16px;">
      <h1 style="margin:0;font-size:24px;color:${BRAND.ink};font-weight:800;letter-spacing:-0.3px;">Delay detected</h1>
      <p style="margin:10px 0 0;font-size:15px;color:${BRAND.body};line-height:1.6;">Hi ${escHtml(args.name)}, your shipment has been delayed. The carrier issued a new arrival estimate.</p>
    </td></tr>
    ${statusCard({ accent: BRAND.orange, tint: "#FFF6ED", rows })}
    <tr><td style="padding:0 32px 32px;">${ctaButton(args.url, "View shipment")}</td></tr>`;
  return { subject, html: shell({ title: subject, preheader: `Delay detected on ${args.trackingNumber}`, body }) };
}

// ─────────────────────────────────────────────────────────────
// ARRIVAL NOTICE
// ─────────────────────────────────────────────────────────────

interface ArrivalArgs extends BaseArgs {
  location:  string;
  arrivedAt: Date;
}

export function arrivalNoticeEmail(args: ArrivalArgs): { subject: string; html: string } {
  const subject = `✓ ${args.trackingNumber} arrived at ${args.location}`;
  const body = `
    <tr><td style="padding:32px 32px 16px;">
      <h1 style="margin:0;font-size:24px;color:${BRAND.ink};font-weight:800;letter-spacing:-0.3px;">Arrived at destination</h1>
      <p style="margin:10px 0 0;font-size:15px;color:${BRAND.body};line-height:1.6;">Hi ${escHtml(args.name)}, your shipment has reached its destination port.</p>
    </td></tr>
    ${statusCard({
      accent: BRAND.teal,
      tint:   "#EDFCFE",
      rows: [
        { label: "Container",  value: escHtml(args.trackingNumber) },
        { label: "Arrived at", value: escHtml(args.location) },
        { label: "Date",       value: escHtml(fmtDate(args.arrivedAt)) },
      ],
    })}
    <tr><td style="padding:0 32px 32px;">${ctaButton(args.url, "View shipment")}</td></tr>`;
  return { subject, html: shell({ title: subject, preheader: `${args.trackingNumber} arrived at ${args.location}`, body }) };
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
    args.daysLeft <= 0   ? "today"     :
    args.daysLeft === 1  ? "tomorrow"  :
                           `in ${args.daysLeft} days`;

  const subject = `🚢 ${args.trackingNumber} arriving ${dayLabel}`;
  const body = `
    <tr><td style="padding:32px 32px 16px;">
      <h1 style="margin:0;font-size:24px;color:${BRAND.ink};font-weight:800;letter-spacing:-0.3px;">Arriving ${escHtml(dayLabel)}</h1>
      <p style="margin:10px 0 0;font-size:15px;color:${BRAND.body};line-height:1.6;">Hi ${escHtml(args.name)}, your shipment is on final approach. Time to coordinate pickup.</p>
    </td></tr>
    ${statusCard({
      accent: BRAND.orange,
      tint:   "#FFF6ED",
      rows: [
        { label: "Container",         value: escHtml(args.trackingNumber) },
        { label: "Estimated arrival", value: escHtml(fmtDate(args.etaDate)) },
      ],
    })}
    <tr><td style="padding:0 32px 32px;">${ctaButton(args.url, "View shipment")}</td></tr>`;
  return { subject, html: shell({ title: subject, preheader: `${args.trackingNumber} arriving ${dayLabel}`, body }) };
}

// ─────────────────────────────────────────────────────────────
// EVENT UPDATE — fired when one or more new tracking events appear
// during a poll cycle (and arrival/delay/imminent didn't already fire).
// Renders a compact timeline of every new event.
// ─────────────────────────────────────────────────────────────

interface EventUpdateArgs extends BaseArgs {
  currentStatus:   string;
  currentLocation: string | null;
  events: Array<{
    status:      string;
    location:    string | null;
    description: string | null;
    eventDate:   Date;
  }>;
}

const STATUS_LABELS: Record<string, string> = {
  IN_TRANSIT:    "In transit",
  AT_PORT:       "At port",
  TRANSSHIPMENT: "Transshipment",
  CUSTOMS_HOLD:  "Customs hold",
  DELIVERED:     "Delivered",
  DELAYED:       "Delayed",
  EXCEPTION:     "Exception",
  CREATED:       "Created",
};

function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s.replace(/_/g, " ").toLowerCase();
}

export function eventUpdateEmail(args: EventUpdateArgs): { subject: string; html: string } {
  const n = args.events.length;
  const subject = n === 1
    ? `${args.trackingNumber}: ${statusLabel(args.events[0].status)}${args.events[0].location ? ` — ${args.events[0].location}` : ""}`
    : `${args.trackingNumber}: ${n} new updates`;

  // Timeline: each event is a row with date dot + status label + description
  const timeline = args.events
    .slice() // copy
    .sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime()) // newest first
    .map((e) => `
      <tr><td style="padding:14px 0;border-top:1px solid ${BRAND.border};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="width:14px;vertical-align:top;padding-top:5px;"><span style="display:inline-block;width:9px;height:9px;background:${BRAND.teal};border-radius:50%;"></span></td>
            <td style="padding-left:12px;">
              <p style="margin:0;font-size:14px;color:${BRAND.ink};font-weight:700;">${escHtml(statusLabel(e.status))}${e.location ? ` <span style="color:${BRAND.body};font-weight:500;">· ${escHtml(e.location)}</span>` : ""}</p>
              ${e.description ? `<p style="margin:4px 0 0;font-size:13px;color:${BRAND.body};line-height:1.5;">${escHtml(e.description)}</p>` : ""}
              <p style="margin:6px 0 0;font-size:11px;color:#94a3b8;letter-spacing:0.3px;text-transform:uppercase;font-weight:600;">${escHtml(e.eventDate.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }))}</p>
            </td>
          </tr>
        </table>
      </td></tr>`).join("");

  const headline = n === 1 ? "New shipment update" : `${n} new updates`;

  const body = `
    <tr><td style="padding:32px 32px 16px;">
      <h1 style="margin:0;font-size:24px;color:${BRAND.ink};font-weight:800;letter-spacing:-0.3px;">${escHtml(headline)}</h1>
      <p style="margin:10px 0 0;font-size:15px;color:${BRAND.body};line-height:1.6;">Hi ${escHtml(args.name)}, here's the latest from your shipment.</p>
    </td></tr>
    ${statusCard({
      accent: BRAND.navy,
      tint:   BRAND.page,
      rows: [
        { label: "Container",      value: escHtml(args.trackingNumber) },
        { label: "Current status", value: escHtml(statusLabel(args.currentStatus)) + (args.currentLocation ? ` <span style="color:${BRAND.body};font-weight:500;">· ${escHtml(args.currentLocation)}</span>` : "") },
      ],
    })}
    <tr><td style="padding:0 32px 8px;">
      <p style="margin:0 0 4px;font-size:12px;color:${BRAND.navy};font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Timeline</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        ${timeline}
      </table>
    </td></tr>
    <tr><td style="padding:24px 32px 32px;">${ctaButton(args.url, "View full timeline")}</td></tr>`;
  return { subject, html: shell({ title: subject, preheader: `${args.trackingNumber} — ${headline.toLowerCase()}`, body }) };
}
