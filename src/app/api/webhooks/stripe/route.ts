import { NextRequest, NextResponse } from "next/server";
import type Stripe                  from "stripe";
import { stripe }                   from "@/backend/lib/stripe";
import { prisma }                   from "@/backend/lib/db";
import { PLANS }                    from "@/config/plans";

/**
 * POST /api/webhooks/stripe
 * Handles Stripe subscription lifecycle events.
 * Keeps the DB `subscriptions` table in sync.
 */
export async function POST(req: NextRequest) {
  const body      = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("[Stripe webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {

      // ── Checkout completed → activate subscription ──────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );
        await syncSubscription(subscription);
        break;
      }

      // ── Subscription updated (upgrade / downgrade / trial end) ──
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(sub);
        break;
      }

      // ── Subscription deleted (canceled) ────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data:  {
            status:              "CANCELED",
            plan:                "FREE",
            stripeSubscriptionId: null,
            stripePriceId:       null,
            maxTrackedShipments: 5,   // FREE plan limit
            maxDailyQueries:     50,
            whatsappEnabled:     false,
            apiAccessEnabled:    false,
          },
        });
        break;
      }

      // ── Payment succeeded → ensure ACTIVE ──────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          // Extract billing period from invoice lines (most reliable source)
          const line        = (invoice.lines?.data?.[0] as unknown as { period?: { start?: number; end?: number } });
          const periodStart = line?.period?.start
            ? new Date(line.period.start * 1000)
            : undefined;
          const periodEnd   = line?.period?.end
            ? new Date(line.period.end * 1000)
            : undefined;

          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: invoice.subscription as string },
            data:  {
              status: "ACTIVE",
              ...(periodStart ? { currentPeriodStart: periodStart } : {}),
              ...(periodEnd   ? { currentPeriodEnd:   periodEnd   } : {}),
            },
          });
        }
        break;
      }

      // ── Payment failed → mark PAST_DUE ─────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: invoice.subscription as string },
            data:  { status: "PAST_DUE" },
          });
        }
        break;
      }

      default:
        // Ignore unhandled events
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Stripe webhook] Handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}

// ── Sync helper ───────────────────────────────────────────────
async function syncSubscription(sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price.id ?? null;

  // CUSTOM plan has no Stripe price — it's set manually by admin
  // Only PRO maps to a Stripe price ID
  let plan: "FREE" | "PRO" = "FREE";
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = "PRO";

  const planConfig = PLANS[plan];
  const features   = planConfig.features;

  await prisma.subscription.updateMany({
    where: { stripeCustomerId: sub.customer as string },
    data:  {
      stripeSubscriptionId:  sub.id,
      stripePriceId:         priceId,
      plan,
      status:                mapStripeStatus(sub.status),
      currentPeriodStart:    new Date(sub.current_period_start * 1000),
      currentPeriodEnd:      new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd:     sub.cancel_at_period_end,
      trialEnd:              sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      maxTrackedShipments:   features.maxTrackedShipments,
      maxDailyQueries:       features.maxDailyQueries,
      whatsappEnabled:       features.whatsappNotifications,
      apiAccessEnabled:      features.apiAccess,
      maxTeamMembers:        features.maxTeamMembers,
    },
  });
}

function mapStripeStatus(status: Stripe.Subscription.Status): "ACTIVE" | "TRIALING" | "PAST_DUE" | "UNPAID" | "CANCELED" | "INCOMPLETE" | "INCOMPLETE_EXPIRED" | "PAUSED" {
  const map: Record<string, "ACTIVE" | "TRIALING" | "PAST_DUE" | "UNPAID" | "CANCELED" | "INCOMPLETE" | "INCOMPLETE_EXPIRED" | "PAUSED"> = {
    active:              "ACTIVE",
    trialing:            "TRIALING",
    past_due:            "PAST_DUE",
    unpaid:              "UNPAID",
    canceled:            "CANCELED",
    incomplete:          "INCOMPLETE",
    incomplete_expired:  "INCOMPLETE_EXPIRED",
    paused:              "PAUSED",
  };
  return map[status] ?? "ACTIVE";
}
