import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  averageTransitDays: number | null;
  currentTransitDays: number;
  predictedDelay: number; // positive = delayed, negative = ahead, 0 = on time
}

export function DelayPredictionCard({ averageTransitDays, currentTransitDays, predictedDelay }: Props) {
  if (averageTransitDays === null) {
    return (
      <div className="rounded-xl border border-navy-200 bg-white dark:border-navy-700 dark:bg-navy-900 p-4">
        <h3 className="text-sm font-semibold text-navy-900 dark:text-white mb-2">Delay Prediction</h3>
        <p className="text-xs text-navy-400 dark:text-navy-500">Not enough historical data for this route</p>
      </div>
    );
  }

  const status = predictedDelay > 2 ? "delayed" : predictedDelay < -1 ? "ahead" : "ontime";

  const config = {
    delayed: {
      icon: TrendingDown,
      label: `~${Math.abs(predictedDelay)} days behind average`,
      color: "text-orange-500 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-500/10",
      barColor: "bg-orange-500",
    },
    ahead: {
      icon: TrendingUp,
      label: `~${Math.abs(predictedDelay)} days ahead of average`,
      color: "text-teal-600 dark:text-teal-400",
      bg: "bg-teal-50 dark:bg-teal-500/10",
      barColor: "bg-teal-500",
    },
    ontime: {
      icon: Minus,
      label: "On schedule",
      color: "text-teal-600 dark:text-teal-400",
      bg: "bg-teal-50 dark:bg-teal-500/10",
      barColor: "bg-teal-500",
    },
  };

  const { icon: Icon, label, color, bg, barColor } = config[status];

  const progress = averageTransitDays > 0
    ? Math.min((currentTransitDays / averageTransitDays) * 100, 150)
    : 0;

  return (
    <div className="rounded-xl border border-navy-200 bg-white dark:border-navy-700 dark:bg-navy-900 p-4">
      <h3 className="text-sm font-semibold text-navy-900 dark:text-white mb-3">Delay Prediction</h3>

      <div className={cn("flex items-center gap-2 rounded-lg p-2 mb-3", bg)}>
        <Icon size={16} className={color} />
        <span className={cn("text-xs font-semibold", color)}>{label}</span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-navy-400 dark:text-navy-500">
          <span>Current: {currentTransitDays} days</span>
          <span>Avg: {averageTransitDays} days</span>
        </div>
        <div className="h-2 rounded-full bg-navy-100 dark:bg-navy-800 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", barColor)}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
