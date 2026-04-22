import { Ship, Plane, MapPin, Calendar, Clock, ArrowRight } from "lucide-react";
import type { TrackingResult as TResult } from "@/backend/services/tracking/providers/types";
import { StatusTimeline } from "./status-timeline";
import { getStatusLabel, getStatusColor, formatDate, relativeDate, cn } from "@/lib/utils";
import Link from "next/link";

interface Props {
  result: TResult;
}

export function TrackingResult({ result }: Props) {
  const isSea = result.type === "SEA";
  const latestEvent = result.events.at(-1);

  return (
    <div className="space-y-4">

      {/* ── Status card ── */}
      <div className="rounded-2xl overflow-hidden shadow-sm border
                      border-navy-100 bg-white
                      dark:border-navy-800 dark:bg-navy-900 dark:shadow-none">

        {/* Color bar */}
        <div className={`h-1.5 w-full ${
          result.currentStatus === "DELIVERED" ? "bg-green-400"
          : result.currentStatus === "DELAYED" ? "bg-orange-500"
          : result.currentStatus === "EXCEPTION" ? "bg-red-500"
          : isSea ? "bg-teal-400" : "bg-orange-400"
        }`} />

        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              {/* Type badge */}
              <div className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                isSea
                  ? "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300"
                  : "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300"
              }`}>
                {isSea ? <Ship size={12}/> : <Plane size={12}/>}
                {isSea ? "Sea Freight" : "Air Cargo"}
              </div>

              {/* Tracking number */}
              <h1 className="font-mono text-2xl font-extrabold tracking-widest
                             text-navy-600 dark:text-white">
                {result.trackingNumber}
              </h1>

              {result.carrier && (
                <p className="mt-1 text-sm text-navy-400 dark:text-navy-300">{result.carrier}</p>
              )}
            </div>

            {/* Current status badge */}
            <span className={cn(
              "flex-shrink-0 rounded-xl px-3 py-1.5 text-sm font-bold",
              getStatusColor(result.currentStatus)
            )}>
              {getStatusLabel(result.currentStatus)}
            </span>
          </div>

          {/* Route */}
          {(result.origin || result.destination) && (
            <div className="mt-4 flex items-center gap-2 text-sm
                            text-navy-600 dark:text-navy-100">
              <MapPin size={14} className="text-navy-300 dark:text-navy-500 flex-shrink-0"/>
              <span className="font-medium">{result.origin ?? "—"}</span>
              <ArrowRight size={14} className="text-navy-300 dark:text-navy-500 flex-shrink-0"/>
              <span className="font-medium">{result.destination ?? "—"}</span>
            </div>
          )}

          {/* ETA / Vessel / Flight */}
          <div className="mt-4 flex flex-wrap gap-4">
            {result.etaDate && (
              <div className="flex items-center gap-1.5 text-sm">
                <Calendar size={14} className="text-navy-300 dark:text-navy-500"/>
                <span className="text-navy-400 dark:text-navy-400">ETA:</span>
                <span className="font-semibold text-navy-600 dark:text-white">{formatDate(result.etaDate)}</span>
              </div>
            )}
            {result.vesselName && (
              <div className="flex items-center gap-1.5 text-sm">
                <Ship size={14} className="text-teal-500 dark:text-teal-400"/>
                <span className="font-semibold text-navy-600 dark:text-white">{result.vesselName}</span>
                {result.voyageNumber && <span className="text-navy-400 dark:text-navy-400">Voyage {result.voyageNumber}</span>}
              </div>
            )}
            {result.flightNumber && (
              <div className="flex items-center gap-1.5 text-sm">
                <Plane size={14} className="text-orange-500 dark:text-orange-400"/>
                <span className="font-semibold text-navy-600 dark:text-white">{result.flightNumber}</span>
              </div>
            )}
            {result.polledAt && (
              <div className="flex items-center gap-1.5 text-sm ml-auto">
                <Clock size={14} className="text-navy-300 dark:text-navy-500"/>
                <span className="text-navy-400 dark:text-navy-400">Updated {relativeDate(result.polledAt)}</span>
                {result.cachedAt && <span className="text-xs text-navy-300 dark:text-navy-500">(cached)</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Timeline ── */}
      <div className="rounded-2xl p-6 shadow-sm border
                      border-navy-100 bg-white
                      dark:border-navy-800 dark:bg-navy-900 dark:shadow-none">
        <h2 className="mb-6 text-base font-bold text-navy-600 dark:text-white">Tracking History</h2>
        <StatusTimeline events={result.events} type={result.type} />
      </div>

      {/* ── Upgrade CTA (for free tier users) ── */}
      <div className="rounded-2xl p-6 text-center border
                      border-orange-200 bg-orange-50
                      dark:border-orange-500/25 dark:bg-orange-500/10">
        <p className="text-sm font-semibold text-navy-600 dark:text-white">
          Want automatic updates for this shipment?
        </p>
        <p className="mt-1 text-xs text-navy-400 dark:text-navy-300">
          Get WhatsApp alerts when ETA changes, delays occur, or your shipment arrives.
        </p>
        <Link
          href="/register"
          className="mt-4 inline-block rounded-xl bg-orange-500 hover:bg-orange-600 px-6 py-2.5 text-sm font-bold text-white transition-colors"
        >
          Start Free Trial →
        </Link>
      </div>
    </div>
  );
}
