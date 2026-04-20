import { getAuthenticatedUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BillingClient } from "@/frontend/components/dashboard/billing-client";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const plan = user.subscription?.plan ?? "FREE";
  const status = user.subscription?.status ?? "ACTIVE";
  const trialEnd = user.subscription?.trialEnd?.toISOString() ?? null;
  const currentPeriodEnd = user.subscription?.currentPeriodEnd?.toISOString() ?? null;
  const hasStripeCustomer = !!user.subscription?.stripeCustomerId && !user.subscription.stripeCustomerId.startsWith("free_");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <BillingClient
        currentPlan={plan}
        status={status}
        trialEnd={trialEnd}
        currentPeriodEnd={currentPeriodEnd}
        hasStripeCustomer={hasStripeCustomer}
      />
    </div>
  );
}
