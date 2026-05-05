export const dynamic = "force-dynamic";

import { getAuthenticatedUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/backend/lib/db";
import { DashboardContent } from "@/frontend/components/dashboard/dashboard-content";
import { getCoordinates } from "@/lib/port-coordinates";
import { seaRoute } from "searoute-ts";

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

    // For SEA shipments, expand each pair of consecutive port stops
    // into the actual maritime path using `searoute-ts` — a great-circle
    // approximation routed around continents. The result is a polyline
    // that follows real ocean lanes (around the Cape, through Suez,
    // along the coast) instead of cutting straight across land.
    //
    // AIR shipments stay on the great-circle path — flights actually
    // do go in straight arcs, so the existing rendering is correct.
    let routePolyline: [number, number][] | undefined;
    if (s.type === "SEA" && route.length >= 2) {
      const polyline: [number, number][] = [];
      for (let i = 0; i < route.length - 1; i++) {
        const a = route[i];
        const b = route[i + 1];
        try {
          const feature = seaRoute(
            { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: a } },
            { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: b } },
          );
          const segCoords = feature?.geometry?.coordinates as [number, number][] | undefined;
          if (segCoords && segCoords.length > 1) {
            // Append, but skip the duplicated junction point between segments
            if (polyline.length === 0) polyline.push(...segCoords);
            else polyline.push(...segCoords.slice(1));
          } else {
            // searoute couldn't resolve — fall back to straight pair
            if (polyline.length === 0) polyline.push(a);
            polyline.push(b);
          }
        } catch {
          if (polyline.length === 0) polyline.push(a);
          polyline.push(b);
        }
      }
      routePolyline = polyline;
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
      route,                                        // port-level waypoints (markers)
      routePolyline,                                // dense maritime path (the line)
    };
  });

  return <DashboardContent shipments={shipments} isPro={isPro} />;
}
