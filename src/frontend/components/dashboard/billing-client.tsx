"use client";

import { useState } from "react";
import { Check, Zap, Crown, Building2, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  currentPlan: string;
  status: string;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  hasStripeCustomer: boolean;
}

const PLANS = [
  {
    id: "FREE",
    name: "Free",
    price: "$0",
    period: "",
    icon: Zap,
    color: "navy",
    description: "5 containers lifetime, JSONCargo lookup",
    features: [
      "5 containers — lifetime total",
      "One-time tracking lookup",
      "Location, status & ETA/ATA dates",
      "Sea container & air AWB support",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    price: "$35",
    period: "/month",
    icon: Crown,
    color: "orange",
    badge: "Most Popular",
    description: "10 containers/month, ShipsGo, live updates",
    features: [
      "10 containers per billing period",
      "ShipsGo live tracking (every 6h)",
      "Interactive world map & route viz",
      "Full event history timeline",
      "Auto-updates — never stale",
    ],
  },
  {
    id: "CUSTOM",
    name: "Custom",
    price: "Custom",
    period: "",
    icon: Building2,
    color: "teal",
    description: "Unlimited containers, dedicated support",
    features: [
      "Unlimited containers — never blocked",
      "ShipsGo live tracking (every 6h)",
      "All PRO features included",
      "Dedicated account manager",
    ],
  },
];

export function BillingClient({ currentPlan, status, trialEnd, currentPeriodEnd, hasStripeCustomer }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (planId: string) => {
    setLoading(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to start checkout");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setLoading("manage");
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to open billing portal");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const isTrialing = status === "TRIALING" && trialEnd;
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
          Billing & Plans
        </h2>
        <p className="text-navy-500 dark:text-navy-400">
          {currentPlan === "FREE"
            ? "Upgrade to unlock all features"
            : `You're on the ${currentPlan} plan`}
        </p>

        {/* Trial banner */}
        {isTrialing && (
          <div className="mt-4 rounded-xl bg-orange-500/10 border border-orange-500/20 px-4 py-3 flex items-center gap-3">
            <Zap size={18} className="text-orange-400 flex-shrink-0" />
            <p className="text-sm text-orange-300">
              <span className="font-bold">{trialDaysLeft} days left</span> on your free trial.
              {currentPeriodEnd && ` Billing starts ${new Date(currentPeriodEnd).toLocaleDateString()}.`}
            </p>
          </div>
        )}

        {/* Manage billing button for paying users */}
        {hasStripeCustomer && currentPlan !== "FREE" && (
          <button
            onClick={handleManageBilling}
            disabled={loading === "manage"}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-4 py-2
                       text-sm font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            {loading === "manage" ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
            Manage Billing
          </button>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isCustom  = plan.id === "CUSTOM";
          const isUpgrade = currentPlan === "FREE" && plan.id === "PRO";
          const Icon = plan.icon;

          return (
            <div
              key={plan.id}
              className={cn(
                "relative rounded-2xl border p-6 flex flex-col",
                isCurrent
                  ? "border-orange-500/50 bg-orange-500/5 ring-1 ring-orange-500/20"
                  : "border-white/10 bg-white/[0.02]",
              )}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white">
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Current badge */}
              {isCurrent && (
                <div className="absolute -top-3 right-4">
                  <span className="rounded-full bg-teal-500 px-3 py-1 text-xs font-bold text-white">
                    Current
                  </span>
                </div>
              )}

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={20} className={cn(
                    plan.color === "orange" ? "text-orange-400" :
                    plan.color === "teal" ? "text-teal-400" : "text-navy-400"
                  )} />
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  {plan.period && <span className="text-sm text-navy-400">{plan.period}</span>}
                </div>
                <p className="text-sm text-navy-400 mt-1">{plan.description}</p>
              </div>

              {/* Features */}
              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="text-teal-400 flex-shrink-0 mt-0.5" />
                    <span className="text-navy-300">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {isCurrent ? (
                <button
                  disabled
                  className="w-full rounded-xl py-3 text-sm font-bold text-navy-400 bg-white/5 border border-white/10 cursor-default"
                >
                  Current Plan
                </button>
              ) : isCustom ? (
                <a
                  href="/contact"
                  className="block w-full rounded-xl py-3 text-center text-sm font-bold text-white
                             bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500
                             shadow-lg shadow-teal-500/25 transition-all"
                >
                  Contact Us
                </a>
              ) : isUpgrade ? (
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={loading === plan.id}
                  className={cn(
                    "w-full rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50",
                    plan.color === "orange"
                      ? "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 shadow-lg shadow-orange-500/25"
                      : "bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 shadow-lg shadow-teal-500/25",
                  )}
                >
                  {loading === plan.id ? (
                    <Loader2 size={16} className="animate-spin mx-auto" />
                  ) : (
                    <>Upgrade to {plan.name}</>
                  )}
                </button>
              ) : (
                <button
                  disabled
                  className="w-full rounded-xl py-3 text-sm font-bold text-navy-500 bg-white/5 border border-white/10 cursor-default"
                >
                  {plan.id === "FREE" ? "Free Forever" : "Not Available"}
                </button>
              )}

              {/* Trial note — only for PRO upgrade CTA */}
              {isUpgrade && plan.id === "PRO" && (
                <p className="text-center text-[11px] text-navy-500 mt-2">Cancel anytime</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
