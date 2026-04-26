"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Lock, Zap } from "lucide-react";
import { PLANS } from "@/config/plans";

interface Props {
  feature: string;
  description: string;
  children: ReactNode;
}

/**
 * Wraps a PRO-only feature with a blurred overlay + upgrade CTA.
 * Children are rendered but blurred and non-interactive.
 * Clicking "Upgrade" navigates to the billing page.
 */
export function UpgradeOverlay({ feature, description, children }: Props) {
  const router = useRouter();

  return (
    <div className="relative">
      {/* Blurred content behind */}
      <div aria-hidden="true" className="pointer-events-none select-none blur-[6px] opacity-50">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center z-20">
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-navy-900/90 backdrop-blur-md border border-white/10 px-8 py-8 shadow-2xl max-w-sm text-center">
          <div className="h-14 w-14 rounded-2xl bg-orange-500/20 flex items-center justify-center">
            <Lock size={28} className="text-orange-400" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-white mb-1">{feature}</h3>
            <p className="text-sm text-navy-300 leading-relaxed">{description}</p>
          </div>

          <button
            onClick={() => router.push("/dashboard/billing")}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600
                       px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25
                       hover:from-orange-400 hover:to-orange-500 transition-all active:scale-95"
          >
            <Zap size={16} />
            Upgrade to PRO — {PLANS.PRO.priceLabel}/month
          </button>

          <p className="text-[11px] text-navy-500">Cancel anytime · ShipsGo live tracking</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Small inline upgrade badge for individual features.
 */
export function ProBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-400 uppercase tracking-wider">
      <Zap size={10} />
      Pro
    </span>
  );
}
