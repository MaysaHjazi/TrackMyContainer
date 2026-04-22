import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS } from "@/config/plans";
import { cn } from "@/lib/utils";

const CARD_STYLES = {
  free:     "border-[#E5E7EB] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] dark:border-navy-800 dark:bg-gradient-to-br dark:from-navy-900 dark:to-navy-950 dark:shadow-none",
  pro:      "border-[#FF6A00]/40 bg-white shadow-[0_10px_40px_rgba(255,106,0,0.12)] scale-[1.02] dark:border-orange-500/40 dark:bg-gradient-to-br dark:from-navy-900 dark:to-navy-950 dark:shadow-[0_0_30px_rgba(245,130,31,0.08)]",
  business: "border-[#3B82F6]/40 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] dark:border-teal-500/40 dark:bg-gradient-to-br dark:from-navy-900 dark:to-navy-950 dark:shadow-none",
};

const CTA_STYLES = {
  free:     "bg-[#F5F7FA] text-[#1F2937] border border-[#E5E7EB] hover:bg-[#EEF2F6] dark:bg-navy-700 dark:text-white dark:border-0 dark:hover:bg-navy-600",
  pro:      "bg-[#FF6A00] text-white hover:bg-[#FF7A1A] shadow-[0_4px_12px_rgba(255,106,0,0.25)] hover:shadow-[0_6px_18px_rgba(255,106,0,0.35)] dark:bg-gradient-to-r dark:from-orange-500 dark:to-orange-600 dark:hover:from-orange-600 dark:hover:to-orange-700 dark:shadow-lg dark:shadow-orange-500/20",
  business: "bg-[#3B82F6] text-white hover:bg-[#2563EB] shadow-[0_4px_12px_rgba(59,130,246,0.25)] hover:shadow-[0_6px_18px_rgba(59,130,246,0.35)] dark:bg-gradient-to-r dark:from-teal-500 dark:to-teal-600 dark:hover:from-teal-600 dark:hover:to-teal-700 dark:shadow-lg dark:shadow-teal-500/20",
};

export function PricingCards() {
  return (
    <section className="relative py-24 overflow-hidden
                        bg-[#EEF2F6] dark:bg-navy-950">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r
                      from-transparent via-[#E5E7EB] to-transparent
                      dark:via-navy-700" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold sm:text-4xl
                         text-[#1F2937] dark:text-white">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-[#6B7280] dark:text-navy-400">
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
                  "relative rounded-2xl border-2 p-8 flex flex-col gap-6 transition-shadow",
                  CARD_STYLES[styleKey],
                )}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full px-4 py-1 text-xs font-bold text-white
                                     bg-[#FF6A00] shadow-[0_4px_12px_rgba(255,106,0,0.35)]
                                     dark:bg-gradient-to-r dark:from-orange-500 dark:to-orange-600 dark:shadow-lg dark:shadow-orange-500/30">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-bold text-[#1F2937] dark:text-white">{plan.name}</h3>
                  <div className="mt-2 flex items-end gap-1">
                    <span className="text-4xl font-extrabold text-[#1F2937] dark:text-white">{plan.priceLabel}</span>
                    {plan.price > 0 && (
                      <span className="mb-1 text-sm text-[#6B7280] dark:text-navy-400">/month</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-[#6B7280] dark:text-navy-400">{plan.description}</p>
                </div>

                <ul className="flex flex-col gap-3">
                  {plan.highlights.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check size={16} className="mt-0.5 flex-shrink-0 text-[#10B981] dark:text-teal-400" />
                      <span className="text-sm text-[#374151] dark:text-navy-200">{feature}</span>
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

        <p className="mt-8 text-center text-sm text-[#9CA3AF] dark:text-navy-500">
          All paid plans include a 14-day free trial. No credit card required to start.
        </p>
      </div>
    </section>
  );
}
