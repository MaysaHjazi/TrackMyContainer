export const PLANS = {
  FREE: {
    id: "free" as const,
    name: "Free",
    price: 0,
    priceLabel: "$0",
    stripePriceId: null,
    description: "Single container or AWB lookup",
    badge: null,
    features: {
      maxDailyQueries: 5,
      maxTrackedShipments: 3,      // Up to 3 tracked shipments
      whatsappNotifications: false,
      messengerNotifications: false,
      emailNotifications: false,
      dashboardAccess: true,
      apiAccess: false,
      exportReports: false,
      maxTeamMembers: 1,
    },
    highlights: [
      "5 tracking lookups per day",
      "Track up to 3 shipments",
      "Sea container & air AWB support",
      "160+ shipping carriers",
    ],
    cta: "Start for Free",
    color: "navy",
  },

  PRO: {
    id: "pro" as const,
    name: "Pro",
    price: 2900,                    // cents
    priceLabel: "$29",
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
    description: "Dashboard, 50 shipments, WhatsApp alerts",
    badge: "Most Popular",
    features: {
      maxDailyQueries: 200,
      maxTrackedShipments: 50,
      whatsappNotifications: true,
      messengerNotifications: true,
      emailNotifications: true,
      dashboardAccess: true,
      apiAccess: false,
      exportReports: true,
      maxTeamMembers: 1,
    },
    highlights: [
      "200 tracking lookups per day",
      "Track up to 50 shipments",
      "Real-time dashboard with world map",
      "WhatsApp notifications (ETA, delays, arrivals)",
      "Email & Messenger alerts",
      "CSV export",
    ],
    cta: "Start Pro Trial",
    color: "orange",
  },

  BUSINESS: {
    id: "business" as const,
    name: "Business",
    price: 9900,                    // cents
    priceLabel: "$99",
    stripePriceId: process.env.STRIPE_BUSINESS_PRICE_ID,
    description: "Unlimited shipments, API access, team members",
    badge: null,
    features: {
      maxDailyQueries: -1,          // unlimited
      maxTrackedShipments: -1,      // unlimited
      whatsappNotifications: true,
      messengerNotifications: true,
      emailNotifications: true,
      dashboardAccess: true,
      apiAccess: true,
      exportReports: true,
      maxTeamMembers: 10,
    },
    highlights: [
      "Unlimited tracking lookups",
      "Unlimited tracked shipments",
      "REST API access",
      "10 team member seats",
      "Priority support",
      "All Pro features",
    ],
    cta: "Contact Sales",
    color: "teal",
  },
} as const;

export type PlanId = keyof typeof PLANS;
export type Plan   = (typeof PLANS)[PlanId];

export function getPlanById(id: string): Plan | null {
  const key = id.toUpperCase() as PlanId;
  return PLANS[key] ?? null;
}

export function planAllows(plan: PlanId, feature: keyof Plan["features"]): boolean {
  const value = PLANS[plan].features[feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number")  return (value as number) !== 0;
  return false;
}
