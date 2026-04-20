import Link from "next/link";
import { Ship, Plane, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import type { ShipmentStatus, ShipmentType } from "@prisma/client";
import { getStatusLabel, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ShipmentSummary {
  id:             string;
  trackingNumber: string;
  type:           ShipmentType;
  carrier?:       string;
  currentStatus:  ShipmentStatus;
  origin?:        string;
  destination?:   string;
  etaDate?:       Date | string | null;
}

interface Props {
  shipments: ShipmentSummary[];
}

function StatusIcon({ status, type }: { status: ShipmentStatus; type: ShipmentType }) {
  if (status === "DELAYED" || status === "EXCEPTION") {
    return (
      <div className="h-10 w-10 rounded-full bg-orange-50 dark:bg-orange-500/15 flex items-center justify-center flex-shrink-0">
        <AlertTriangle size={18} className="text-orange-500 dark:text-orange-400" />
      </div>
    );
  }
  if (status === "DELIVERED") {
    return (
      <div className="h-10 w-10 rounded-full bg-teal-50 dark:bg-teal-500/15 flex items-center justify-center flex-shrink-0">
        <CheckCircle size={18} className="text-teal-500 dark:text-teal-400" />
      </div>
    );
  }
  return (
    <div className="h-10 w-10 rounded-full bg-navy-50 dark:bg-navy-800 flex items-center justify-center flex-shrink-0">
      {type === "SEA"
        ? <Ship size={18} className="text-teal-600 dark:text-teal-400" />
        : <Plane size={18} className="text-orange-500 dark:text-orange-400" />
      }
    </div>
  );
}

export function ShipmentStatusPanel({ shipments }: Props) {
  return (
    <aside className="w-72 flex-shrink-0 border-l border-navy-200 bg-white dark:border-navy-800 dark:bg-navy-950 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="border-b border-navy-100 dark:border-navy-800 px-5 py-4">
        <h2 className="text-base font-bold text-navy-900 dark:text-white">Shipment Status</h2>
        <p className="text-xs text-navy-400 dark:text-navy-300 mt-0.5">{shipments.length} tracked shipments</p>
      </div>

      {/* Shipment list */}
      <div className="flex-1 overflow-y-auto divide-y divide-navy-100 dark:divide-navy-800">
        {shipments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="h-12 w-12 rounded-full bg-navy-50 dark:bg-navy-800 flex items-center justify-center mb-3">
              <Ship size={22} className="text-navy-300 dark:text-navy-500" />
            </div>
            <p className="text-sm font-medium text-navy-900 dark:text-white">No shipments tracked</p>
            <p className="mt-1 text-xs text-navy-400 dark:text-navy-300">Add a container or AWB to get started</p>
            <Link
              href="/dashboard/shipments/new"
              className="mt-4 rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 transition-colors"
            >
              + Add Shipment
            </Link>
          </div>
        ) : (
          shipments.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/shipments/${s.id}`}
              className="flex items-start gap-3 px-5 py-4 hover:bg-navy-50 dark:hover:bg-navy-900 transition-colors"
            >
              <StatusIcon status={s.currentStatus} type={s.type} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-navy-500 dark:text-navy-300 truncate">
                    {s.type === "SEA" ? "Container:" : "AWB:"}
                  </span>
                  <span className={cn(
                    "flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
                    s.currentStatus === "DELAYED"    ? "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300"
                    : s.currentStatus === "DELIVERED"  ? "bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300"
                    : s.currentStatus === "IN_TRANSIT" ? "bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300"
                    : "bg-navy-50 text-navy-500 dark:bg-navy-800 dark:text-navy-300"
                  )}>
                    {getStatusLabel(s.currentStatus)}
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-sm font-bold text-navy-900 dark:text-white truncate">
                  {s.trackingNumber}
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs text-navy-400 dark:text-navy-300">
                  <span className={cn(
                    "font-semibold",
                    s.type === "SEA" ? "text-teal-600 dark:text-teal-400" : "text-orange-500 dark:text-orange-400"
                  )}>
                    ({s.type === "SEA" ? "Sea" : "Air"})
                  </span>
                  {s.carrier && <span>· {s.carrier}</span>}
                </div>
                {s.etaDate && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-navy-400 dark:text-navy-300">
                    <Clock size={10} />
                    <span>ETA: {formatDate(s.etaDate)}</span>
                  </div>
                )}
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Footer CTA */}
      <div className="border-t border-navy-100 dark:border-navy-800 p-4">
        <Link
          href="/dashboard/shipments/new"
          className="flex w-full items-center justify-center gap-2 rounded-xl
                     bg-orange-500 py-2.5 text-sm font-bold text-white
                     hover:bg-orange-600 transition-colors shadow-sm"
        >
          + Add Shipment
        </Link>
      </div>
    </aside>
  );
}
