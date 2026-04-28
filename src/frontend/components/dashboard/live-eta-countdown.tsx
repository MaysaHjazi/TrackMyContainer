"use client";

import { useEffect, useState } from "react";
import { Clock, CheckCircle2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { ShipmentStatus } from "@prisma/client";

interface Props {
  etaDate: Date | null;
  status: ShipmentStatus;
}

/**
 * Live ETA countdown — recomputes "X days to arrival" once a minute so
 * the badge stays accurate without a page refresh. The count is purely
 * derived from etaDate vs. now, so the user sees the number tick down
 * naturally as the clock moves.
 *
 * Sealed, AT_PORT (at destination), or DELIVERED → freeze on "Arrived".
 */
export function LiveEtaCountdown({ etaDate, status }: Props) {
  // Server render → use a stable value to avoid hydration mismatch.
  // Client takes over after mount and updates every minute.
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    setNow(Date.now()); // immediate sync on mount
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (status === "DELIVERED" || status === "AT_PORT" || status === "OUT_FOR_DELIVERY") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center dark:border-green-500/30 dark:bg-green-500/10">
        <CheckCircle2 size={32} className="mx-auto text-green-500 dark:text-green-400" />
        <p className="mt-2 text-lg font-extrabold text-green-700 dark:text-green-300">Arrived</p>
        <p className="text-sm text-green-600 dark:text-green-400">Shipment has reached its destination</p>
      </div>
    );
  }

  if (!etaDate) {
    return (
      <div className="rounded-xl border border-navy-200 bg-navy-50 p-5 text-center dark:border-navy-700 dark:bg-navy-800">
        <Clock size={32} className="mx-auto text-navy-400" />
        <p className="mt-2 text-sm font-semibold text-navy-500 dark:text-navy-400">ETA unavailable</p>
      </div>
    );
  }

  const ms = etaDate.getTime() - now;
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  const isOverdue = days < 0;
  const isUrgent = days <= 3 && days >= 0;

  return (
    <div
      className={cn(
        "rounded-xl border p-5 text-center transition-colors",
        isOverdue
          ? "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
          : isUrgent
            ? "border-orange-200 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10"
            : "border-teal-200 bg-teal-50 dark:border-teal-500/30 dark:bg-teal-500/10",
      )}
    >
      <Clock
        size={32}
        className={cn(
          "mx-auto",
          isOverdue
            ? "text-red-500 dark:text-red-400"
            : isUrgent
              ? "text-orange-500 dark:text-orange-400"
              : "text-teal-500 dark:text-teal-400",
        )}
      />
      <p
        className={cn(
          "mt-2 text-3xl font-extrabold",
          isOverdue
            ? "text-red-600 dark:text-red-400"
            : isUrgent
              ? "text-orange-600 dark:text-orange-400"
              : "text-teal-700 dark:text-teal-300",
        )}
      >
        {isOverdue ? "Overdue" : days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`}
      </p>
      <p
        className={cn(
          "text-sm",
          isOverdue
            ? "text-red-500 dark:text-red-400"
            : isUrgent
              ? "text-orange-500 dark:text-orange-400"
              : "text-teal-600 dark:text-teal-400",
        )}
      >
        {isOverdue ? `Expected ${formatDate(etaDate)}` : `ETA ${formatDate(etaDate)}`}
      </p>
    </div>
  );
}
