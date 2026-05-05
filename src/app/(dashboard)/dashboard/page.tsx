export const dynamic = "force-dynamic";

import { getAuthenticatedUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/backend/lib/db";
import { DashboardContent } from "@/frontend/components/dashboard/dashboard-content";
import { getCoordinates } from "@/lib/port-coordinates";

/**
 * Dashboard overview — real data from DB.
 * - World map (main content) with sea/air dots — PRO only
 * - Shipment Status panel (right sidebar)
 * - Stats cards at top
 *
 * The plan is checked SERVER-SIDE so it cannot be bypassed by caching.
 */
export default async function DashboardPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const plan = user.subscription?.plan ?? "FREE";
  const isPro = plan === "PRO" || plan === "CUSTOM";

  // ── Fetch user's shipments from DB, including their tracking events
  // so the map can draw the REAL multi-port route the container has
  // taken (Ningbo → Rotterdam → Algeciras → ...) rather than a fake
  // straight line from origin to destination. */
  const dbShipments = await prisma.shipment.findMany({
    where: { userId: user.id },
    orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }],
    take: 50,
    include: {
      events: {
        orderBy: { eventDate: "asc" },
        select: { location: true, eventDate: true },
      },
    },
  });

  // ── Convert to dashboard format with coordinates + route waypoints ──
  const shipments = dbShipments.map((s) => {
    // Use currentLocation > destination > origin to pick map position
    const coords = getCoordinates(s.currentLocation || s.destination || s.origin);

    // Build the actual route the container has travelled: walk through
    // tracking events in chronological order, keep each unique geocoded
    // location once (collapse consecutive duplicates), and bookend with
    // origin / destination if they're missing from the event stream.
    const seen = new Set<string>();
    const route: [number, number][] = [];
    const pushIfKnown = (loc: string | null | undefined) => {
      if (!loc) return;
      const key = loc.toLowerCase().trim();
      if (seen.has(key)) return;
      const c = getCoordinates(loc);
      if (c.lat === 0 && c.lng === 0) return;
      seen.add(key);
      route.push([c.lng, c.lat]);
    };
    pushIfKnown(s.origin);
    for (const ev of s.events) pushIfKnown(ev.location);
    pushIfKnown(s.destination);

    return {
      id: s.id,
      trackingNumber: s.trackingNumber,
      type: s.type,
      carrier: s.carrier ?? undefined,
      currentStatus: s.currentStatus,
      origin: s.origin ?? undefined,
      destination: s.destination ?? undefined,
      currentLocation: s.currentLocation ?? undefined,
      etaDate: s.etaDate?.toISOString() ?? null,   // serialize Date → string for client
      lat: coords.lat,
      lng: coords.lng,
      route,                                        // NEW: actual waypoints
    };
  });

  return <DashboardContent shipments={shipments} isPro={isPro} />;
}
