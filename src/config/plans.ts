export const PLANS = {
  FREE: {
    id:             "free" as const,
    name:           "Free",
    price:          0,
    priceLabel:     "$0",
    stripePriceId:  null,
    description:    "Track up to 5 containers, no updates",
    badge:          null,
    // Provider routing — used by API layer when adding shipments
    provider:       "jsoncargo",
    liveTracking:   false,
    features: {
      maxTrackedShipments:    5,
      maxDailyQueries:        50,
      whatsappNotifications:  false,
      messengerNotifications: false,
      emailNotifications:     false,
      dashboardAccess:        true,
      apiAccess:              false,
      exportReports:          false,
      maxTeamMembers:         1,
      map:                    false,
      routeVisualization:     false,
      eventHistory:           false,
      autoUpdates:            false,
    },
    highlights: [
      "5 containers — lifetime total",
      "One-time lookup via JSONCargo",
      "Location, status, ETA/ATA dates",
      "Sea container & air AWB support",
    ],
    cta:   "Start for Free",
    color: "navy",
  },

  PRO: {
    id:            "pro" as const,
    name:          "Pro",
    price:         3500,          // cents — $35/month
    priceLabel:    "$35",
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
    description:   "10 containers/month, ShipsGo, live updates every 6h",
    badge:         "Most Popular",
    provider:      "shipsgo",
    liveTracking:  true,
    features: {
      maxTrackedShipments:    10,
      maxDailyQueries:        500,
      whatsappNotifications:  false,
      messengerNotifications: false,
      emailNotifications:     true,
      dashboardAccess:        true,
      apiAccess:              false,
      exportReports:          true,
      maxTeamMembers:         1,
      map:                    true,
      routeVisualization:     true,
      eventHistory:           true,
      autoUpdates:            true,
    },
    highlights: [
      "10 containers per billing period",
      "ShipsGo live tracking (updates every 6h)",
      "Interactive world map & route visualization",
      "Full event history timeline",
      "Auto-updates — never stale",
    ],
    cta:   "Subscribe Now",
    color: "orange",
  },

  CUSTOM: {
    id:            "custom" as const,
    name:          "Custom",
    price:         null,          // negotiated — no fixed price
    priceLabel:    "Custom",
    stripePriceId: null,
    description:   "Unlimited containers, dedicated support",
    badge:         null,
    provider:      "shipsgo",
    liveTracking:  true,
    features: {
      maxTrackedShipments:    2147483647,
      maxDailyQueries:        2147483647,
      whatsappNotifications:  true,
      messengerNotifications: true,
      emailNotifications:     true,
      dashboardAccess:        true,
      apiAccess:              true,
      exportReports:          true,
      maxTeamMembers:         99,
      map:                    true,
      routeVisualization:     true,
      eventHistory:           true,
      autoUpdates:            true,
    },
    highlights: [
      "Unlimited containers — never blocked",
      "ShipsGo live tracking (updates every 6h)",
      "All PRO features included",
      "Dedicated account manager",
    ],
    cta:   "Contact Us",
    color: "teal",
  },
} as const;

export type PlanKey = keyof typeof PLANS;
export type Plan    = (typeof PLANS)[PlanKey];

export function getPlanById(id: string): Plan | null {
  const key = id.toUpperCase() as PlanKey;
  return PLANS[key] ?? null;
}

export function getProviderForPlan(plan: PlanKey): string {
  return PLANS[plan].provider;
}

export function planAllows(plan: PlanKey, feature: keyof Plan["features"]): boolean {
  const value = PLANS[plan].features[feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number")  return (value as number) !== 0;
  return false;
}
