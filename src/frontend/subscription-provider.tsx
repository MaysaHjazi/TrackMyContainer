"use client";

import { createContext, useContext } from "react";

export type PlanTier = "FREE" | "PRO" | "CUSTOM";

export interface SubscriptionInfo {
  plan: PlanTier;
  maxTrackedShipments: number;
  maxDailyQueries: number;
  whatsappEnabled: boolean;
  apiAccessEnabled: boolean;
  maxTeamMembers: number;
}

const DEFAULT_FREE: SubscriptionInfo = {
  plan: "FREE",
  maxTrackedShipments: 0,
  maxDailyQueries: 5,
  whatsappEnabled: false,
  apiAccessEnabled: false,
  maxTeamMembers: 1,
};

const SubscriptionContext = createContext<SubscriptionInfo>(DEFAULT_FREE);

export function SubscriptionProvider({
  subscription,
  children,
}: {
  subscription: SubscriptionInfo | null;
  children: React.ReactNode;
}) {
  return (
    <SubscriptionContext.Provider value={subscription ?? DEFAULT_FREE}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}

/** Quick check helpers */
export function isPro(sub: SubscriptionInfo) {
  return sub.plan === "PRO" || sub.plan === "CUSTOM";
}

export function isBusiness(sub: SubscriptionInfo) {
  return sub.plan === "CUSTOM";
}
