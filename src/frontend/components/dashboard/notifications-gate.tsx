"use client";

import { useState } from "react";
import { Lock, Zap, Bell, MessageCircle, Mail, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function NotificationsGate() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/upgrade", { method: "POST" });
      const data = await res.json();
      if (data.plan === "PRO" || data.plan === "CUSTOM") {
        router.refresh();
      } else {
        alert(data.error || "Upgrade failed");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center text-center">
        <div className="h-20 w-20 rounded-3xl bg-orange-500/15 flex items-center justify-center mb-6">
          <Lock size={40} className="text-orange-400" />
        </div>

        <h2 className="text-3xl font-bold text-navy-900 dark:text-white mb-3">
          Smart Notifications
        </h2>
        <p className="text-lg text-navy-500 dark:text-navy-400 mb-10 max-w-md">
          Never miss a shipment update. Get instant alerts via WhatsApp, Messenger, and Email when your shipments move.
        </p>

        {/* Feature preview cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 w-full max-w-lg">
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
            <MessageCircle size={24} className="text-green-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-white">WhatsApp</p>
            <p className="text-xs text-navy-400 mt-1">Instant alerts</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
            <Bell size={24} className="text-blue-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Messenger</p>
            <p className="text-xs text-navy-400 mt-1">Facebook bot</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
            <Mail size={24} className="text-orange-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Email</p>
            <p className="text-xs text-navy-400 mt-1">Daily digest</p>
          </div>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 p-5 mb-10 max-w-md w-full text-left">
          <p className="text-sm font-bold text-white mb-3">You&apos;ll get alerts for:</p>
          <ul className="space-y-2 text-sm text-navy-300">
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-teal-400" /> ETA ≤ 3 days — shipment arriving soon</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Delay detected — carrier reported delay</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-green-400" /> Arrived — shipment delivered</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-orange-400" /> Status change — any movement update</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-yellow-400" /> Customs hold — stuck at customs</li>
          </ul>
        </div>

        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600
                     px-8 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/25
                     hover:from-orange-400 hover:to-orange-500 transition-all active:scale-95
                     disabled:opacity-50"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
          Upgrade to Pro
        </button>

        <p className="text-sm text-navy-500 mt-3">Starting at $29/month · 14-day free trial</p>
      </div>
    </div>
  );
}
