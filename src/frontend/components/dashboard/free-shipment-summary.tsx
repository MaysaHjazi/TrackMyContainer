import {
  MapPin,
  Ship,
  Plane,
  ArrowRight,
  Clock,
  CheckCircle2,
} from "lucide-react";
import type { ShipmentStatus, ShipmentType } from "@prisma/client";
import {
  cn,
  formatDate,
  daysUntil,
  getStatusColor,
  getStatusLabel,
} from "@/lib/utils";

interface Props {
  type:            ShipmentType;
  currentLocation: string | null;
  origin:          string | null;
  destination:     string | null;
  currentStatus:   ShipmentStatus;
  etaDate:         Date | null;
  ataDate:         Date | null;
}

/**
 * Big, clear "where is my container right now?" card for FREE users.
 * Replaces the locked Route Visualization with the actual answer to the
 * user's #1 question — surfaced front and center instead of buried.
 */
export function FreeShipmentSummary({
  type,
  currentLocation,
  origin,
  destination,
  currentStatus,
  etaDate,
  ataDate,
}: Props) {
  const TypeIcon = type === "SEA" ? Ship : Plane;
  const arrived =
    currentStatus === "DELIVERED" ||
    currentStatus === "AT_PORT" ||
    currentStatus === "OUT_FOR_DELIVERY" ||
    !!ataDate;
  const days = etaDate ? daysUntil(etaDate) : null;

  return (
    <div className="rounded-xl border border-navy-200 bg-white p-6 shadow-sm dark:border-navy-800 dark:bg-navy-900">
      <h3 className="mb-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-navy-400 dark:text-navy-500">
        <MapPin size={14} />
        Current Location
      </h3>

      {/* ── Big current location hero ─────────────────────── */}
      <div
        className={cn(
          "mb-6 rounded-2xl border p-8 text-center",
          arrived
            ? "border-green-200 bg-gradient-to-br from-green-50 to-teal-50 dark:border-green-500/30 dark:from-green-500/10 dark:to-teal-500/10"
            : "border-teal-200 bg-gradient-to-br from-teal-50 to-blue-50 dark:border-teal-500/30 dark:from-teal-500/10 dark:to-blue-500/10",
        )}
      >
        <TypeIcon
          size={36}
          className={cn(
            "mx-auto mb-3",
            arrived
              ? "text-green-500 dark:text-green-400"
              : "text-teal-600 dark:text-teal-400",
          )}
        />
        <p className="text-3xl font-extrabold text-navy-900 dark:text-white">
          {currentLocation ?? "Awaiting carrier update"}
        </p>
        <span
          className={cn(
            "mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold",
            getStatusColor(currentStatus),
          )}
        >
          {getStatusLabel(currentStatus)}
        </span>
      </div>

      {/* ── Route: from → to ──────────────────────────────── */}
      {(origin || destination) && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-navy-100 bg-navy-50/50 p-4 dark:border-navy-800 dark:bg-navy-800/30">
          <div className="flex-1 min-w-0 text-center">
            <div className="text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-navy-500">
              From
            </div>
            <div className="mt-1 truncate text-base font-semibold text-navy-900 dark:text-white">
              {origin ?? "—"}
            </div>
          </div>
          <ArrowRight
            size={20}
            className="flex-shrink-0 text-navy-300 dark:text-navy-600"
          />
          <div className="flex-1 min-w-0 text-center">
            <div className="text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-navy-500">
              To
            </div>
            <div className="mt-1 truncate text-base font-semibold text-navy-900 dark:text-white">
              {destination ?? "—"}
            </div>
          </div>
        </div>
      )}

      {/* ── Arrival / ETA pill ────────────────────────────── */}
      {arrived ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-500/30 dark:bg-green-500/10">
          <CheckCircle2
            size={18}
            className="text-green-500 dark:text-green-400"
          />
          <span className="text-sm font-bold text-green-700 dark:text-green-300">
            Arrived at destination
          </span>
        </div>
      ) : days !== null ? (
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-navy-200 bg-navy-50 p-3 dark:border-navy-700 dark:bg-navy-800">
          <Clock size={18} className="text-navy-500 dark:text-navy-400" />
          <span className="text-sm">
            <span className="font-bold text-navy-900 dark:text-white">
              {days < 0
                ? "Overdue"
                : days === 0
                  ? "Arriving today"
                  : days === 1
                    ? "1 day to arrival"
                    : `${days} days to arrival`}
            </span>
            <span className="text-navy-500 dark:text-navy-400">
              {" · ETA "}
              {formatDate(etaDate!)}
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
