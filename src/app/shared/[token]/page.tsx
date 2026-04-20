import { prisma } from "@/backend/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Ship, Plane, MapPin, Calendar, Clock, ArrowRight } from "lucide-react";
import { getStatusLabel, getStatusColor, formatDate, daysUntil } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const shipment = await prisma.shipment.findUnique({
    where: { shareToken: token },
    select: { trackingNumber: true },
  });
  return {
    title: shipment ? `Tracking ${shipment.trackingNumber} — Container Tracking` : "Shared Tracking",
  };
}

export default async function SharedTrackingPage({ params }: Props) {
  const { token } = await params;
  const shipment = await prisma.shipment.findUnique({
    where: { shareToken: token },
    include: {
      trackingEvents: { orderBy: { eventDate: "desc" } },
    },
  });

  if (!shipment) notFound();

  const TypeIcon = shipment.type === "SEA" ? Ship : Plane;
  const days = shipment.etaDate ? daysUntil(shipment.etaDate) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-50 to-white dark:from-navy-950 dark:to-navy-900">
      {/* Header bar */}
      <div className="border-b border-navy-200 dark:border-navy-800 bg-white/80 dark:bg-navy-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            <span className="text-navy-900 dark:text-white">Container</span>
            <span className="text-orange-500"> Tracking</span>
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-orange-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
          >
            Sign Up Free
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Shipment header */}
        <div className="rounded-xl border border-navy-200 bg-white dark:border-navy-700 dark:bg-navy-900 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TypeIcon size={18} className={shipment.type === "SEA" ? "text-teal-500" : "text-orange-500"} />
                <span className="text-xs font-semibold uppercase text-navy-400 dark:text-navy-500">
                  {shipment.type === "SEA" ? "Sea Freight" : "Air Cargo"}
                </span>
              </div>
              <h1 className="text-2xl font-extrabold font-mono text-navy-900 dark:text-white">
                {shipment.trackingNumber}
              </h1>
              {shipment.carrier && (
                <p className="text-sm text-navy-400 dark:text-navy-500 mt-1">{shipment.carrier}</p>
              )}
            </div>
            <span className={cn("rounded-full px-3 py-1 text-sm font-bold", getStatusColor(shipment.currentStatus))}>
              {getStatusLabel(shipment.currentStatus)}
            </span>
          </div>

          {/* Route */}
          <div className="flex items-center gap-3 text-sm text-navy-600 dark:text-navy-300">
            <MapPin size={14} className="text-teal-500 flex-shrink-0" />
            <span>{shipment.origin || "—"}</span>
            <ArrowRight size={14} className="text-navy-300" />
            <span>{shipment.destination || "—"}</span>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-navy-100 dark:border-navy-800">
            {shipment.etdDate && (
              <div>
                <div className="text-xs text-navy-400 dark:text-navy-500">Departure</div>
                <div className="text-sm font-semibold text-navy-900 dark:text-white">{formatDate(shipment.etdDate)}</div>
              </div>
            )}
            {shipment.etaDate && (
              <div>
                <div className="text-xs text-navy-400 dark:text-navy-500">ETA</div>
                <div className="text-sm font-semibold text-navy-900 dark:text-white">{formatDate(shipment.etaDate)}</div>
              </div>
            )}
            {days !== null && days >= 0 && (
              <div>
                <div className="text-xs text-navy-400 dark:text-navy-500">Arrives in</div>
                <div className={cn(
                  "text-sm font-bold",
                  days <= 1 ? "text-red-500" : days <= 3 ? "text-orange-500" : "text-teal-600 dark:text-teal-400"
                )}>
                  {days} days
                </div>
              </div>
            )}
            {shipment.vesselName && (
              <div>
                <div className="text-xs text-navy-400 dark:text-navy-500">Vessel</div>
                <div className="text-sm font-semibold text-navy-900 dark:text-white">{shipment.vesselName}</div>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-xl border border-navy-200 bg-white dark:border-navy-700 dark:bg-navy-900 p-6">
          <h2 className="text-base font-bold text-navy-900 dark:text-white mb-4">Tracking History</h2>
          <div className="space-y-0">
            {shipment.trackingEvents.map((event, i) => (
              <div key={event.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "h-3 w-3 rounded-full border-2 flex-shrink-0",
                    i === 0
                      ? "border-orange-500 bg-orange-500"
                      : "border-navy-300 bg-navy-100 dark:border-navy-600 dark:bg-navy-800"
                  )} />
                  {i < shipment.trackingEvents.length - 1 && (
                    <div className="w-px flex-1 bg-navy-200 dark:bg-navy-700 min-h-[2rem]" />
                  )}
                </div>
                <div className="pb-6">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-bold",
                      getStatusColor(event.status)
                    )}>
                      {getStatusLabel(event.status)}
                    </span>
                    <span className="text-xs text-navy-400 dark:text-navy-500">
                      {formatDate(event.eventDate, "MMM d, HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm text-navy-600 dark:text-navy-300 mt-1">{event.description}</p>
                  {event.location && (
                    <p className="text-xs text-navy-400 dark:text-navy-500 mt-0.5 flex items-center gap-1">
                      <MapPin size={10} /> {event.location}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-8">
          <p className="text-sm text-navy-400 dark:text-navy-500 mb-3">
            Want real-time alerts for your shipments?
          </p>
          <Link
            href="/register"
            className="inline-block rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-orange-600 transition-colors"
          >
            Sign Up Free — Track Unlimited
          </Link>
        </div>
      </div>
    </div>
  );
}
