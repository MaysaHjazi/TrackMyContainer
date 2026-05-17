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
      trackingEvents: {
        orderBy: { eventDate: "asc" },
        select: { location: true, eventDate: true },
      },
    },
  });

  // ── Convert to dashboard format with coordinates + route waypoints ──
  const shipments = dbShipments.map((s) => {
    // Use currentLocation > destination > origin to pick map position
    const coords = getCoordinates(s.currentLocation || s.destination || s.origin);

    // Build the actual route the container has travelled.
    //
    // Rules (per the user's spec):
    //   1. Use the full tracking history events.
    //   2. Sort by date ASC — already done by the Prisma query above.
    //   3. Extract the location sequence from events.
    //   4. Remove ONLY *consecutive* duplicates (Algeciras-arrived then
    //      Algeciras-departed = one stop). Do NOT global-dedup —
    //      a true A→B→A→C path must keep both A entries.
    //   5. Bookend with origin / destination if they aren't already
    //      the first / last entries in the event stream.
    //   6. Skip locations we can't geocode.
    const route: [number, number][] = [];
    const routeLabels: string[] = []; // mirrors `route`, used to detect consecutive dupes
    const pushIfKnown = (loc: string | null | undefined) => {
      if (!loc) return;
      const normalized = loc.toLowerCase().trim();
      // Collapse only when the previous entry is the same port.
      if (routeLabels[routeLabels.length - 1] === normalized) return;
      const c = getCoordinates(loc);
      if (c.lat === 0 && c.lng === 0) return;
      routeLabels.push(normalized);
      route.push([c.lng, c.lat]);
    };
    pushIfKnown(s.origin);
    for (const ev of s.trackingEvents) pushIfKnown(ev.location);
    pushIfKnown(s.destination);

    // The `route` waypoints are a faithful sequence of the ports the
    // container has actually been reported at (origin + tracking event
    // locations + destination, deduped). The map draws straight legs
    // between consecutive waypoints — we deliberately do NOT try to
    // synthesise a "real maritime path" client-side, because anything
    // we generate locally would diverge from what ShipsGo actually
    // tracks. The events themselves are the source of truth.

    // Find the index of the waypoint corresponding to the current
    // location so the map can render the leg already travelled (origin
    // → currentLocation) as a solid line and the remaining leg as dashed.
    let progressIndex: number | undefined;
    if (route.length >= 2 && s.currentLocation) {
      const target = s.currentLocation.toLowerCase().trim();
      const labelIdx = routeLabels.indexOf(target);
      if (labelIdx >= 0) progressIndex = labelIdx;
    }
    // Fallback: nearest waypoint to the worker-filled lat/lng.
    if (progressIndex === undefined && route.length >= 2 && (coords.lat !== 0 || coords.lng !== 0)) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < route.length; i++) {
        const [plng, plat] = route[i];
        const dlng = plng - coords.lng;
        const dlat = plat - coords.lat;
        const d = dlng * dlng + dlat * dlat;
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      progressIndex = bestIdx;
    }

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
      route,                                        // port waypoints (origin + events + destination, deduped)
      routeLabels,                                  // matching port name per waypoint (for tooltips)
      progressIndex,                                // index into `route` = current waypoint
    };
  });

  return <DashboardContent shipments={shipments} isPro={isPro} />;
}
