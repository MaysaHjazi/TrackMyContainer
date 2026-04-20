import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS } from "@/config/plans";
import { cn } from "@/lib/utils";

const CARD_STYLES = {
  free:     "border-navy-800 bg-gradient-to-br from-navy-900 to-navy-950",
  pro:      "border-orange-500/40 bg-gradient-to-br from-navy-900 to-navy-950 shadow-[0_0_30px_rgba(245,130,31,0.08)] scale-[1.02]",
  business: "border-teal-500/40 bg-gradient-to-br from-navy-900 to-navy-950",
};

const CTA_STYLES = {
  free:     "bg-navy-700 text-white hover:bg-navy-600",
  pro:      "bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/20",
  business: "bg-gradient-to-r from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700 shadow-lg shadow-teal-500/20",
};

export function PricingCards() {
  return (
    <section className="relative py-24 bg-navy-950 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-navy-700 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-navy-400">
            Start free, upgrade when you need more.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3 lg:items-center">
          {Object.entries(PLANS).map(([key, plan]) => {
            const styleKey = key.toLowerCase() as keyof typeof CARD_STYLES;
            return (
              <div
                key={key}
                className={cn(
                  "relative rounded-2xl border-2 p-8 flex flex-col gap-6",
                  CARD_STYLES[styleKey],
                )}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-1 text-xs font-bold text-white shadow-lg shadow-orange-500/30">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <div className="mt-2 flex items-end gap-1">
                    <span className="text-4xl font-extrabold text-white">{plan.priceLabel}</span>
                    {plan.price > 0 && (
                      <span className="mb-1 text-sm text-navy-400">/month</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-navy-400">{plan.description}</p>
                </div>

                <ul className="flex flex-col gap-3">
                  {plan.highlights.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check size={16} className="mt-0.5 flex-shrink-0 text-teal-400" />
                      <span className="text-sm text-navy-200">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.price === 0 ? "/track" : "/register"}
                  className={cn(
                    "mt-auto block rounded-xl px-6 py-3 text-center text-sm font-bold transition-all",
                    CTA_STYLES[styleKey],
                  )}
                >
                  {plan.cta}
                </Link>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-navy-500">
          All paid plans include a 14-day free trial. No credit card required to start.
        </p>
      </div>
    </section>
  );
}
