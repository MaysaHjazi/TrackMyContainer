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

    // ── Maritime polyline (SEA only) ──────────────────────────────
    // The `route` waypoints (ports) are the SOURCE OF TRUTH straight
    // from ShipsGo tracking events. ShipsGo does NOT give us the
    // vessel's GPS breadcrumbs, so the *shape* of the line between two
    // real consecutive ports is computed with searoute-ts — a maritime
    // routing lib whose explicit purpose is "realistic-looking
    // searoutes for visualizations". This bends the path around
    // continents / through canals instead of cutting straight over
    // land. AIR shipments keep the great-circle (planes fly straight).
    let routePolyline: [number, number][] | undefined;
    let polylineProgressIndex: number | undefined;
    if (s.type === "SEA" && route.length >= 2) {
      const dense: [number, number][] = [];
      for (let i = 0; i < route.length - 1; i++) {
        const a = route[i];
        const b = route[i + 1];
        try {
          const f = seaRoute(
            { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: a } },
            { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: b } },
          );
          const seg = f?.geometry?.coordinates as [number, number][] | undefined;
          if (seg && seg.length > 1) {
            if (dense.length === 0) dense.push(...seg);
            else dense.push(...seg.slice(1)); // skip duplicated junction
          } else {
            if (dense.length === 0) dense.push(a);
            dense.push(b);
          }
        } catch {
          if (dense.length === 0) dense.push(a);
          dense.push(b);
        }
      }
      if (dense.length >= 2) {
        routePolyline = dense;
        // Map current location onto the dense polyline so travelled
        // (solid) vs remaining (dashed) splits at the live position.
        const cur = s.currentLocation ? getCoordinates(s.currentLocation) : { lat: coords.lat, lng: coords.lng };
        if (cur.lat !== 0 || cur.lng !== 0) {
          let bi = 0;
          let bd = Infinity;
          for (let i = 0; i < dense.length; i++) {
            const dl = dense[i][0] - cur.lng;
            const dt = dense[i][1] - cur.lat;
            const d = dl * dl + dt * dt;
            if (d < bd) { bd = d; bi = i; }
          }
          polylineProgressIndex = bi;
        }
      }
    }

    // Find the index of the waypoint (port marker) corresponding to the
    // current location — used for the marker-level travelled/remaining
    // split when there is no dense polyline (AIR / fallback).
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
      routePolyline,                                // dense maritime path (SEA) — searoute between real ports
      polylineProgressIndex,                        // index into routePolyline = live position
    };
  });

  return <DashboardContent shipments={shipments} isPro={isPro} />;
}
