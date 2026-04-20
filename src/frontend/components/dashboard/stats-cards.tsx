import { Ship, Plane, AlertTriangle, Clock } from "lucide-react";
import type { ShipmentStatus, ShipmentType } from "@prisma/client";
import { daysUntil } from "@/lib/utils";

interface ShipmentForStats {
  id:            string;
  type:          ShipmentType;
  currentStatus: ShipmentStatus;
  etaDate?:      Date | string | null;
}

interface Props {
  shipments: ShipmentForStats[];
}

export function StatsCards({ shipments }: Props) {
  const inTransit  = shipments.filter((s) => ["IN_TRANSIT", "TRANSSHIPMENT", "BOOKED", "PICKED_UP"].includes(s.currentStatus)).length;
  const delayed    = shipments.filter((s) => s.currentStatus === "DELAYED" || s.currentStatus === "EXCEPTION").length;
  const arrivingSoon = shipments.filter((s) => s.etaDate && daysUntil(s.etaDate) <= 3 && daysUntil(s.etaDate) >= 0).length;
  const total      = shipments.length;

  const cards = [
    {
      label: "Total Tracked", value: total, icon: Ship,
      light: "bg-white border-navy-200",
      dark:  "dark:bg-navy-800 dark:border-navy-700",
      iconBg: "bg-navy-100 dark:bg-navy-700",
      iconColor: "text-navy-600 dark:text-navy-200",
    },
    {
      label: "In Transit", value: inTransit, icon: Plane,
      light: "bg-white border-teal-200",
      dark:  "dark:bg-teal-500/10 dark:border-teal-500/30",
      iconBg: "bg-teal-50 dark:bg-teal-500/20",
      iconColor: "text-teal-600 dark:text-teal-400",
    },
    {
      label: "Arriving ≤ 3 days", value: arrivingSoon, icon: Clock,
      light: "bg-white border-orange-200",
      dark:  "dark:bg-orange-500/10 dark:border-orange-500/30",
      iconBg: "bg-orange-50 dark:bg-orange-500/20",
      iconColor: "text-orange-500 dark:text-orange-400",
    },
    {
      label: "Delayed / Exception", value: delayed, icon: AlertTriangle,
      light: delayed > 0 ? "bg-white border-orange-300" : "bg-white border-navy-200",
      dark:  delayed > 0 ? "dark:bg-orange-500/10 dark:border-orange-500/30" : "dark:bg-navy-800 dark:border-navy-700",
      iconBg: delayed > 0 ? "bg-orange-50 dark:bg-orange-500/20" : "bg-navy-50 dark:bg-navy-700",
      iconColor: delayed > 0 ? "text-orange-500 dark:text-orange-400" : "text-navy-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, light, dark, iconBg, iconColor }) => (
        <div key={label} className={`rounded-xl border px-4 py-3 flex items-center gap-3 shadow-sm ${light} ${dark}`}>
          <div className={`flex-shrink-0 h-9 w-9 rounded-lg ${iconBg} flex items-center justify-center`}>
            <Icon size={18} className={iconColor} />
          </div>
          <div>
            <div className="text-xl font-extrabold text-navy-900 dark:text-white">{value}</div>
            <div className="text-xs text-navy-400">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
