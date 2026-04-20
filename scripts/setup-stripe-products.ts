/**
 * Run once to create Stripe products and prices.
 * Usage: npx tsx scripts/setup-stripe-products.ts
 * Then copy the resulting price IDs into your .env.local
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

  // ── Pro Plan — $29/month ──────────────────────────────────────
  const proPrice = await stripe.prices.create({
    product:    product.id,
    currency:   "usd",
    unit_amount: 2900,
    recurring:  { interval: "month" },
    nickname:   "Pro Monthly",
    metadata:   { plan: "PRO" },
  });

  console.log(`✅ Pro price created:      ${proPrice.id}`);

  // ── Business Plan — $99/month ─────────────────────────────────
  const businessPrice = await stripe.prices.create({
    product:    product.id,
    currency:   "usd",
    unit_amount: 9900,
    recurring:  { interval: "month" },
    nickname:   "Business Monthly",
    metadata:   { plan: "BUSINESS" },
  });

  console.log(`✅ Business price created: ${businessPrice.id}`);

  console.log("\n─────────────────────────────────────────────────");
  console.log("Add these to your .env.local:");
  console.log(`STRIPE_PRO_PRICE_ID=${proPrice.id}`);
  console.log(`STRIPE_BUSINESS_PRICE_ID=${businessPrice.id}`);
  console.log("─────────────────────────────────────────────────");
}

setup().catch(console.error);
