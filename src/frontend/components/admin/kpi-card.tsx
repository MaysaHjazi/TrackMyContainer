import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon:     LucideIcon;
  label:    string;
  primary:  string;
  secondary?: string;
  tone?:    "navy" | "orange" | "teal" | "red" | "green";
}

const TONES: Record<NonNullable<Props["tone"]>, { ring: string; iconBg: string; iconText: string }> = {
  navy:   { ring: "ring-navy-200 dark:ring-navy-800",       iconBg: "bg-navy-100 dark:bg-navy-800",       iconText: "text-navy-700 dark:text-navy-200" },
  orange: { ring: "ring-orange-200 dark:ring-orange-500/30", iconBg: "bg-orange-100 dark:bg-orange-500/15", iconText: "text-orange-700 dark:text-orange-300" },
  teal:   { ring: "ring-teal-200 dark:ring-teal-500/30",     iconBg: "bg-teal-100 dark:bg-teal-500/15",     iconText: "text-teal-700 dark:text-teal-300" },
  red:    { ring: "ring-red-200 dark:ring-red-500/30",       iconBg: "bg-red-100 dark:bg-red-500/15",       iconText: "text-red-700 dark:text-red-300" },
  green:  { ring: "ring-green-200 dark:ring-green-500/30",   iconBg: "bg-green-100 dark:bg-green-500/15",   iconText: "text-green-700 dark:text-green-300" },
};

export function KpiCard({ icon: Icon, label, primary, secondary, tone = "navy" }: Props) {
  const t = TONES[tone];
  return (
    <div className={cn(
      "rounded-2xl bg-white p-5 shadow-sm ring-1 dark:bg-navy-900",
      t.ring,
    )}>
      <div className="flex items-start justify-between">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", t.iconBg)}>
          <Icon size={18} className={t.iconText} />
        </div>
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-navy-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold text-navy-900 dark:text-white">{primary}</p>
      {secondary && (
        <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">{secondary}</p>
      )}
    </div>
  );
}
