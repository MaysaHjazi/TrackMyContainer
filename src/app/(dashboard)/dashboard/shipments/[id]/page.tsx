import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Ship,
  Plane,
  Star,
  Share2,
  Pencil,
  Trash2,
  MapPin,
  Calendar,
  Clock,
  Anchor,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Package,
} from "lucide-react";
import { prisma } from "@/backend/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  cn,
  getStatusColor,
  getStatusLabel,
  getTypeLabel,
  formatDate,
  daysUntil,
} from "@/lib/utils";
import type { ShipmentStatus } from "@prisma/client";
import { ShipmentActions } from "./shipment-actions";
import { RouteMap } from "@/frontend/components/dashboard/route-map";
import { RouteVisualization } from "@/frontend/components/dashboard/route-visualization";
import { FreeShipmentSummary } from "@/frontend/components/dashboard/free-shipment-summary";
import { LiveEtaCountdown } from "@/frontend/components/dashboard/live-eta-countdown";
import { AutoRefresh } from "@/frontend/components/dashboard/auto-refresh";

// Refresh server-rendered data every 60 seconds so live tracking
// updates (worker polls every 30 min, ShipsGo webhooks fire instantly)
// surface in the UI without a manual refresh.
export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    select: { trackingNumber: true },
  });
  return {
    title: shipment
      ? `${shipment.trackingNumber} — TrackMyContainer`
      : "Shipment — TrackMyContainer",
  };
}

/* ── Timeline event icon ──────────────────────────────────── */

function EventIcon({ status }: { status: ShipmentStatus }) {
  const map: Record<string, { icon: typeof CheckCircle2; color: string }> = {
    DELIVERED:        { icon: CheckCircle2,  color: "text-green-500 dark:text-green-400" },
    DELAYED:          { icon: AlertTriangle, color: "text-orange-500 dark:text-orange-400" },
    EXCEPTION:        { icon: AlertTriangle, color: "text-red-500 dark:text-red-400" },
    IN_TRANSIT:       { icon: Navigation,    color: "text-teal-500 dark:text-teal-400" },
    TRANSSHIPMENT:    { icon: Anchor,        color: "text-blue-500 dark:text-blue-400" },
    AT_PORT:          { icon: Anchor,        color: "text-blue-500 dark:text-blue-400" },
    CUSTOMS_HOLD:     { icon: Package,       color: "text-yellow-600 dark:text-yellow-400" },
    OUT_FOR_DELIVERY: { icon: Navigation,    color: "text-teal-500 dark:text-teal-400" },
  };

  const entry = map[status] ?? { icon: MapPin, color: "text-navy-400 dark:text-navy-500" };
  const Icon = entry.icon;
  return <Icon size={16} className={entry.color} />;
}

/* ── ETA Countdown ────────────────────────────────────────── */

function EtaCountdown({
  etaDate,
  status,
}: {
  etaDate: Date | null;
  status: ShipmentStatus;
}) {
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

  const days = daysUntil(etaDate);
  const isOverdue = days < 0;
  const isUrgent = days <= 3 && days >= 0;

  return (
    <div
      className={cn(
        "rounded-xl border p-5 text-center",
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

/* ── Page ──────────────────────────────────────────────────── */

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const shipment = await prisma.shipment.findFirst({
    where: { id, userId: user.id },
    include: {
      trackingEvents: { orderBy: { eventDate: "desc" } },
    },
  });

  if (!shipment) notFound();

  const isFreePlan = user.subscription?.plan === "FREE" || !user.subscription;

  const TypeIcon = shipment.type === "SEA" ? Ship : Plane;
  const typeColorClass =
    shipment.type === "SEA"
      ? "text-teal-600 dark:text-teal-400"
      : "text-orange-500 dark:text-orange-400";

  return (
    <div className="flex h-full">
      {/* Quietly re-fetches server data every 60s — keeps live status,
          ETA, events and map in sync with worker polls + webhooks. */}
      <AutoRefresh intervalMs={60_000} />
      {/* ── Left: Main content ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Back */}
        <Link
          href="/shipments"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-500
                     transition-colors hover:text-navy-700 dark:text-navy-400 dark:hover:text-navy-200"
        >
          <ArrowLeft size={16} />
          Back to Shipments
        </Link>

        {/* ── Shipment Info Card ──────────────────────────────── */}
        <div className="rounded-xl border border-navy-200 bg-white p-6 shadow-sm dark:border-navy-800 dark:bg-navy-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0",
                  shipment.type === "SEA"
                    ? "bg-teal-50 dark:bg-teal-500/15"
                    : "bg-orange-50 dark:bg-orange-500/15",
                )}
              >
                <TypeIcon size={24} className={typeColorClass} />
              </div>
              <div>
                <h1 className="font-mono text-xl font-extrabold text-navy-900 dark:text-white">
                  {shipment.trackingNumber}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-bold",
                      shipment.type === "SEA"
                        ? "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300"
                        : "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
                    )}
                  >
                    {getTypeLabel(shipment.type)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-bold",
                      getStatusColor(shipment.currentStatus),
                    )}
                  >
                    {getStatusLabel(shipment.currentStatus)}
                  </span>
                </div>
                {shipment.nickname && (
                  <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
                    {shipment.nickname}
                  </p>
                )}
              </div>
            </div>

            {/* Carrier + vessel/flight */}
            {(shipment.carrier || shipment.vesselName || shipment.flightNumber) && (
              <div className="text-right">
                {shipment.carrier && (
                  <p className="text-sm font-semibold text-navy-700 dark:text-navy-200">
                    {shipment.carrier}
                  </p>
                )}
                {shipment.vesselName && (
                  <p className="text-xs text-navy-400 dark:text-navy-500">
                    {shipment.vesselName}
                    {shipment.voyageNumber ? ` / ${shipment.voyageNumber}` : ""}
                  </p>
                )}
                {shipment.flightNumber && (
                  <p className="text-xs text-navy-400 dark:text-navy-500">
                    Flight {shipment.flightNumber}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Route Visualization ──────────────────────────────────
            FREE: clear "where is my container?" summary card.
            PRO/CUSTOM: full animated route visualization.        */}
        {isFreePlan ? (
          <FreeShipmentSummary
            type={shipment.type}
            currentLocation={shipment.currentLocation}
            origin={shipment.origin}
            destination={shipment.destination}
            currentStatus={shipment.currentStatus}
            etaDate={shipment.etaDate}
            ataDate={shipment.ataDate}
          />
        ) : (
          <RouteVisualization
            origin={shipment.origin}
            destination={shipment.destination}
            type={shipment.type}
            currentStatus={shipment.currentStatus}
            atdDate={shipment.atdDate}
            etdDate={shipment.etdDate}
            etaDate={shipment.etaDate}
            ataDate={shipment.ataDate}
          />
        )}

        {/* ── Dates Card ──────────────────────────────────────── */}
        {/* Only render cards for dates we actually have — carriers like
            JSONCargo don't provide ETD, so showing an empty "ETD: —" just
            confuses the user. Hide missing fields; keep the meaningful ones. */}
        {(() => {
          // Show only one date per pair: actual takes priority over
          // estimated. Once a vessel actually departs (ATD set), the
          // ETD becomes irrelevant noise; same for ATA over ETA.
          // If neither is set yet, show nothing for that pair.
          const departureDate = shipment.atdDate ?? shipment.etdDate;
          const departureLabel = shipment.atdDate ? "ATD" : "ETD";
          const arrivalDate    = shipment.ataDate ?? shipment.etaDate;
          const arrivalLabel   = shipment.ataDate ? "ATA" : "ETA";

          const dateFields = [
            { label: departureLabel, date: departureDate, icon: Calendar },
            { label: arrivalLabel,   date: arrivalDate,   icon: Clock    },
          ].filter((f) => f.date);

          if (dateFields.length === 0) return null;

          return (
            <div className="rounded-xl border border-navy-200 bg-white p-6 shadow-sm dark:border-navy-800 dark:bg-navy-900">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-navy-400 dark:text-navy-500">
                Key Dates
              </h3>
              <div className={cn(
                "grid gap-4",
                dateFields.length === 1 && "grid-cols-1",
                dateFields.length === 2 && "grid-cols-2",
                dateFields.length === 3 && "grid-cols-3",
                dateFields.length === 4 && "grid-cols-2 sm:grid-cols-4",
              )}>
                {dateFields.map(({ label, date, icon: Icon }) => (
                  <div
                    key={label}
                    className="rounded-lg border border-navy-100 bg-navy-50/50 p-3 dark:border-navy-800 dark:bg-navy-800/50"
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon size={12} className="text-navy-400 dark:text-navy-500" />
                      <span className="text-xs font-bold uppercase text-navy-400 dark:text-navy-500">
                        {label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-navy-900 dark:text-white">
                      {formatDate(date!)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Tracking Events Timeline ────────────────────────── */}
        <div className="rounded-xl border border-navy-200 bg-white p-6 shadow-sm dark:border-navy-800 dark:bg-navy-900">
          <h3 className="mb-5 text-sm font-bold uppercase tracking-wider text-navy-400 dark:text-navy-500">
            Tracking History
          </h3>

          {isFreePlan ? (
            <div>
              {/* Show only the latest event for FREE users */}
              {shipment.trackingEvents.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <Clock size={28} className="text-navy-300 dark:text-navy-600" />
                  <p className="mt-2 text-sm text-navy-500 dark:text-navy-400">
                    No tracking events yet. Updates will appear once the carrier reports movement.
                  </p>
                </div>
              ) : (
                <div className="relative ml-4">
                  <div className="relative flex gap-4 pl-6">
                    <div className="absolute -left-2 top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-teal-500 bg-white dark:border-teal-400 dark:bg-navy-900">
                      <div className="h-1.5 w-1.5 rounded-full bg-teal-500 dark:bg-teal-400" />
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <EventIcon status={shipment.trackingEvents[0].status} />
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-bold",
                              getStatusColor(shipment.trackingEvents[0].status),
                            )}
                          >
                            {getStatusLabel(shipment.trackingEvents[0].status)}
                          </span>
                        </div>
                        <time className="flex-shrink-0 text-xs text-navy-400 dark:text-navy-500">
                          {formatDate(shipment.trackingEvents[0].eventDate, "MMM d, yyyy HH:mm")}
                        </time>
                      </div>
                      <p className="mt-1 text-sm text-navy-700 dark:text-navy-300">
                        {shipment.trackingEvents[0].description}
                      </p>
                      {shipment.trackingEvents[0].location && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-navy-400 dark:text-navy-500">
                          <MapPin size={10} />
                          {shipment.trackingEvents[0].location}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Upgrade prompt — single, friendly, non-blocking */}
              <div className="mt-6 rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-5 dark:border-orange-500/30 dark:from-orange-500/10 dark:to-amber-500/10">
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <p className="font-bold text-navy-900 dark:text-white">
                      See every port and vessel movement
                    </p>
                    <p className="mt-1 text-sm text-navy-600 dark:text-navy-300">
                      Full timeline, live world map, and 6-hour auto-updates with PRO.
                    </p>
                  </div>
                  <Link
                    href="/dashboard/billing"
                    className="flex-shrink-0 rounded-xl bg-[#FF6A00] px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_12px_rgba(255,106,0,0.25)] transition-all hover:bg-[#FF7A1A] hover:shadow-[0_6px_18px_rgba(255,106,0,0.35)]"
                  >
                    Upgrade to PRO — $35/mo
                  </Link>
                </div>
              </div>
            </div>
          ) : shipment.trackingEvents.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Clock size={28} className="text-navy-300 dark:text-navy-600" />
              <p className="mt-2 text-sm text-navy-500 dark:text-navy-400">
                No tracking events yet. Updates will appear once the carrier reports movement.
              </p>
            </div>
          ) : (
            <div className="relative ml-4">
              {/* Timeline line */}
              <div className="absolute left-0 top-2 bottom-2 w-px bg-navy-200 dark:bg-navy-700" />

              <div className="space-y-6">
                {shipment.trackingEvents.map((event, idx) => (
                  <div key={event.id} className="relative flex gap-4 pl-6">
                    {/* Dot */}
                    <div
                      className={cn(
                        "absolute -left-2 top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-white dark:bg-navy-900",
                        idx === 0
                          ? "border-teal-500 dark:border-teal-400"
                          : "border-navy-300 dark:border-navy-600",
                      )}
                    >
                      <div
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          idx === 0
                            ? "bg-teal-500 dark:bg-teal-400"
                            : "bg-navy-300 dark:bg-navy-600",
                        )}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <EventIcon status={event.status} />
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-bold",
                              getStatusColor(event.status),
                            )}
                          >
                            {getStatusLabel(event.status)}
                          </span>
                        </div>
                        <time className="flex-shrink-0 text-xs text-navy-400 dark:text-navy-500">
                          {formatDate(event.eventDate, "MMM d, yyyy HH:mm")}
                        </time>
                      </div>
                      <p className="mt-1 text-sm text-navy-700 dark:text-navy-300">
                        {event.description}
                      </p>
                      {event.location && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-navy-400 dark:text-navy-500">
                          <MapPin size={10} />
                          {event.location}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right Sidebar ───────────────────────────────────── */}
      <aside className="hidden w-72 flex-shrink-0 border-l border-navy-200 bg-white dark:border-navy-800 dark:bg-navy-950 lg:flex lg:flex-col overflow-y-auto">
        <div className="p-5 space-y-5">
          {/* ETA Countdown */}
          <LiveEtaCountdown etaDate={shipment.etaDate} status={shipment.currentStatus} />

          {/* Actions */}
          <ShipmentActions
            shipmentId={shipment.id}
            trackingNumber={shipment.trackingNumber}
            nickname={shipment.nickname}
            isFavorite={shipment.isFavorite}
          />

          {/* Current location — only in sidebar for PRO/CUSTOM
              (FREE users see it prominently in the main content). */}
          {!isFreePlan && shipment.currentLocation && (
            <div className="rounded-xl border border-navy-200 bg-navy-50/50 p-4 dark:border-navy-800 dark:bg-navy-800/50">
              <h4 className="text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-navy-500 mb-2">
                Current Location
              </h4>
              <div className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 flex-shrink-0 text-teal-500 dark:text-teal-400" />
                <p className="text-sm text-navy-700 dark:text-navy-300">{shipment.currentLocation}</p>
              </div>
            </div>
          )}

          {/* Route map — PRO/CUSTOM only.
              FREE users get a friendly upgrade nudge under tracking history,
              not a locked map overlay. */}
          {!isFreePlan && (
            <RouteMap
              origin={shipment.origin}
              destination={shipment.destination}
              currentLocation={shipment.currentLocation}
            />
          )}

          {/* Shipment details */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-navy-400 dark:text-navy-500">
              <span>Reference</span>
              <span className="font-semibold text-navy-700 dark:text-navy-300">
                {shipment.reference ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-navy-400 dark:text-navy-500">
              <span>Created</span>
              <span className="font-semibold text-navy-700 dark:text-navy-300">
                {formatDate(shipment.createdAt)}
              </span>
            </div>
            {!isFreePlan && (
              <div className="flex items-center justify-between text-navy-400 dark:text-navy-500">
                <span>Last updated</span>
                <span className="font-semibold text-navy-700 dark:text-navy-300">
                  {shipment.lastPolledAt ? formatDate(shipment.lastPolledAt) : "—"}
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
