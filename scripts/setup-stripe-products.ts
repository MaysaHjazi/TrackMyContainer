/**
 * Run once to create the Stripe product + price for the PRO plan.
 * Usage: npx tsx scripts/setup-stripe-products.ts
 * Then copy the resulting price ID into your .env.local
 *
 * Note: CUSTOM plan has no Stripe price — it's contact-us only.
 */

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

async function setup() {
  console.log("Setting up Stripe products for TrackMyContainer.ai...\n");

  // ── Product ──────────────────────────────────────────────────
  const product = await stripe.products.create({
    name:        "TrackMyContainer.ai",
    description: "Global sea and air freight tracking platform",
    images:      ["https://trackmycontainer.ai/images/og-image.png"],
    metadata:    { app: "trackmycontainer" },
  });

  console.log(`✅ Product created: ${product.id}`);

  // ── Pro Plan — $35/month ──────────────────────────────────────
  const proPrice = await stripe.prices.create({
    product:    product.id,
    currency:   "usd",
    unit_amount: 3500,
    recurring:  { interval: "month" },
    nickname:   "Pro Monthly",
    metadata:   { plan: "PRO" },
  });

  console.log(`✅ Pro price created: ${proPrice.id}`);

  console.log("\n─────────────────────────────────────────────────");
  console.log("Add this to your .env.local:");
  console.log(`STRIPE_PRO_PRICE_ID=${proPrice.id}`);
  console.log("─────────────────────────────────────────────────");
  console.log("\nCUSTOM plan: no Stripe price — handled via /contact form.\n");
}

setup().catch(console.error);
