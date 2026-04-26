import Link from "next/link";
import { Lock, Zap, BarChart3, TrendingUp, PieChart } from "lucide-react";

export function AnalyticsGate() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center text-center">
        <div className="h-20 w-20 rounded-3xl bg-orange-500/15 flex items-center justify-center mb-6">
          <Lock size={40} className="text-orange-400" />
        </div>

        <h2 className="text-3xl font-bold text-navy-900 dark:text-white mb-3">
          Analytics Dashboard
        </h2>
        <p className="text-lg text-navy-500 dark:text-navy-400 mb-10 max-w-md">
          Get detailed insights into your shipping operations with charts, carrier performance, and delivery metrics.
        </p>

        {/* Feature preview cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 w-full max-w-lg">
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
            <BarChart3 size={24} className="text-teal-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Status Breakdown</p>
            <p className="text-xs text-navy-400 mt-1">By shipment status</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
            <TrendingUp size={24} className="text-orange-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Carrier Performance</p>
            <p className="text-xs text-navy-400 mt-1">Compare carriers</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
            <PieChart size={24} className="text-purple-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Delivery Metrics</p>
            <p className="text-xs text-navy-400 mt-1">Average transit time</p>
          </div>
        </div>

        <Link
          href="/dashboard/billing"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600
                     px-8 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/25
                     hover:from-orange-400 hover:to-orange-500 transition-all active:scale-95"
        >
          <Zap size={18} />
          Upgrade to Pro
        </Link>

        <p className="text-sm text-navy-500 mt-3">$35/month · Cancel anytime</p>
      </div>
    </div>
  );
}
