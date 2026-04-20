import Stripe from "stripe";

// Lazily instantiated so builds without STRIPE_SECRET_KEY don't throw
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return _stripe;
}

/** @deprecated use getStripe() — kept for legacy callers */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// ── Checkout ──────────────────────────────────────────────────
export async function createCheckoutSession({
  userId,
  stripeCustomerId,
  priceId,
  successUrl,
  cancelUrl,
}: {
  userId: string;
  stripeCustomerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    customer:   stripeCustomerId,
    mode:       "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url:  cancelUrl,
    metadata:   { userId },
    subscription_data: {
      trial_period_days: 14,
      metadata: { userId },
    },
  });
  return session.url!;
}

// ── Customer portal ───────────────────────────────────────────
export async function createPortalSession(
  stripeCustomerId: string,
  returnUrl: string,
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer:   stripeCustomerId,
    return_url: returnUrl,
  });
  return session.url;
}

// ── Create or get Stripe customer ─────────────────────────────
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string,
): Promise<string> {
  // Check for existing customer
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) {
    return existing.data[0].id;
  }

  const customer = await stripe.customers.create({
    email,
    name:     name ?? undefined,
    metadata: { userId },
  });
  return customer.id;
}
