"use client";

import { useState, useEffect } from "react";
import { Clock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  etaDate: Date | string | null;
  compact?: boolean;
}

export function EtaCountdown({ etaDate, compact = false }: Props) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000); // update every minute
    return () => clearInterval(timer);
  }, []);

  if (!etaDate) {
    return (
      <div className={cn(
        "flex items-center gap-2 text-navy-400 dark:text-navy-500",
        compact ? "text-xs" : "text-sm"
      )}>
        <Clock size={compact ? 12 : 16} />
        <span>ETA unavailable</span>
      </div>
    );
  }

  const target = new Date(etaDate);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) {
    return (
      <div className={cn(
        "flex items-center gap-2 text-teal-600 dark:text-teal-400 font-semibold",
        compact ? "text-xs" : "text-sm"
      )}>
        <CheckCircle size={compact ? 12 : 16} />
        <span>Arrived</span>
      </div>
    );
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  const urgency = days <= 0 ? "red" : days <= 3 ? "orange" : "green";

  const colorMap = {
    red: "text-red-600 dark:text-red-400",
    orange: "text-orange-500 dark:text-orange-400",
    green: "text-teal-600 dark:text-teal-400",
  };

  const bgMap = {
    red: "bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/30",
    orange: "bg-orange-50 border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/30",
    green: "bg-teal-50 border-teal-200 dark:bg-teal-500/10 dark:border-teal-500/30",
  };

  if (compact) {
    return (
      <span className={cn("text-xs font-semibold", colorMap[urgency])}>
        {days > 0 && `${days}d `}{hours}h
      </span>
    );
  }

  return (
    <div className={cn("rounded-xl border p-4", bgMap[urgency])}>
      <div className="flex items-center gap-2 mb-3">
        <Clock size={16} className={colorMap[urgency]} />
        <span className={cn("text-sm font-semibold", colorMap[urgency])}>ETA Countdown</span>
      </div>
      <div className="flex items-baseline gap-1">
        {days > 0 && (
          <>
            <span className={cn("text-3xl font-extrabold", colorMap[urgency])}>{days}</span>
            <span className="text-xs text-navy-400 dark:text-navy-500 mr-2">days</span>
          </>
        )}
        <span className={cn("text-3xl font-extrabold", colorMap[urgency])}>{hours}</span>
        <span className="text-xs text-navy-400 dark:text-navy-500 mr-2">hrs</span>
        <span className={cn("text-3xl font-extrabold", colorMap[urgency])}>{minutes}</span>
        <span className="text-xs text-navy-400 dark:text-navy-500">min</span>
      </div>
    </div>
  );
}
