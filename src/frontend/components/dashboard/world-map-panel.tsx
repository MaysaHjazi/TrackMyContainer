// @ts-nocheck – react-simple-maps v3 API types differ from installed version
"use client";

import { useState, useCallback, useEffect } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Line,
  ZoomableGroup,
} from "react-simple-maps";
import { motion, AnimatePresence } from "framer-motion";
import { Ship, Plane, X, ZoomIn, ZoomOut, Maximize2, MapPin, ArrowRight } from "lucide-react";
import type { ShipmentStatus, ShipmentType } from "@prisma/client";
import { getCoordinates } from "@/lib/port-coordinates";

/* ── World topology URL (Natural Earth 110m) ── */
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

/* ── Types ── */
interface ShipmentDot {
  id: string;
  trackingNumber: string;
  type: ShipmentType;
  carrier?: string;
  currentStatus: ShipmentStatus;
  origin?: string;
  destination?: string;
  currentLocation?: string;
  lat: number;
  lng: number;
  /** Port-level waypoints derived from tracking events (geocoded ports
   *  in chronological order). Used as marker positions. */
  route?: [number, number][];
  /** Dense maritime polyline computed server-side via `searoute-ts`.
   *  Each consecutive pair of port waypoints is expanded into the
   *  actual ocean path (around continents, through Suez, along
   *  coastlines), so SEA shipments don't render straight lines that
   *  cut across land. AIR shipments leave this undefined and fall back
   *  to the great-circle line between port waypoints. */
  routePolyline?: [number, number][];
  /** Index into `routePolyline` corresponding to the container's
   *  current position. Vertices ≤ progressIndex are the *travelled*
   *  leg (solid line); vertices ≥ progressIndex are the *remaining*
   *  leg (dashed). Lets the map mirror ShipsGo's progress style. */
  progressIndex?: number;
}

interface Props {
  shipments: ShipmentDot[];
}

/** Convert location string → [lng, lat] tuple, or null if unknown. */
function toLngLat(loc: string | null | undefined): [number, number] | null {
  if (!loc) return null;
  const { lat, lng } = getCoordinates(loc);
  if (lat === 0 && lng === 0) return null;
  return [lng, lat];
}

/* ── Major port markers ── */
const PORTS: { name: string; coords: [number, number] }[] = [
  { name: "Shanghai", coords: [121.5, 31.2] },
  { name: "Singapore", coords: [103.8, 1.3] },
  { name: "Rotterdam", coords: [4.5, 51.9] },
  { name: "Dubai", coords: [55.3, 25.3] },
  { name: "Los Angeles", coords: [-118.2, 33.9] },
  { name: "Busan", coords: [129.0, 35.1] },
  { name: "Hamburg", coords: [9.9, 53.5] },
  { name: "New York", coords: [-74.0, 40.7] },
  { name: "Mumbai", coords: [72.9, 19.1] },
  { name: "Sydney", coords: [151.2, -33.9] },
  { name: "Santos", coords: [-46.3, -23.9] },
  { name: "Tokyo", coords: [139.7, 35.7] },
];

/* ── Status label helper ── */
function getStatusText(status: ShipmentStatus): string {
  const map: Record<string, string> = {
    IN_TRANSIT: "In Transit", DELAYED: "Delayed", DELIVERED: "Delivered",
    AT_PORT: "Arrived", EXCEPTION: "Exception", CUSTOMS_HOLD: "Customs Hold",
    OUT_FOR_DELIVERY: "Out for Delivery", TRANSSHIPMENT: "Transshipment",
    UNKNOWN: "Unknown",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

/* ── Per-shipment colour palettes ──
 * Picked for HIGH visual contrast between adjacent shipments — the
 * earlier teal/sky/cyan combination read as a single colour at map
 * scale. Sea routes still skew cool, air routes still skew warm. */
const SEA_PALETTE = [
  "#00B4C4", // bright teal       — brand
  "#6366F1", // indigo-violet
  "#0EA5E9", // sky bright
  "#A855F7", // purple
  "#1E3A8A", // deep navy
  "#10B981", // emerald
];
const AIR_PALETTE = [
  "#F5821F", // brand orange
  "#DC2626", // red
  "#F59E0B", // amber
  "#DB2777", // rose
  "#EA580C", // burnt orange
  "#B45309", // brown amber
];

function shipmentColor(type: "SEA" | "AIR", index: number): string {
  const palette = type === "SEA" ? SEA_PALETTE : AIR_PALETTE;
  return palette[index % palette.length];
}

/* All map colours — including the panel background gradient — now
 * live in globals.css under `.world-map-panel` and `.dark .world-map-panel`.
 * CSS variables flip the moment the dark class toggles on <html>, so
 * the panel background swaps with the rest of the dashboard instead of
 * being stuck on the React-state default until hydration completes
 * (which is what caused the "mixed mode" flash on dashboard refresh).
 */

export function WorldMapPanel({ shipments }: Props) {
  const [mounted, setMounted] = useState(false);
  const [activeShipment, setActiveShipment] = useState<ShipmentDot | null>(null);
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [10, 10],
    zoom: 1,
  });

  useEffect(() => { setMounted(true); }, []);

  /* Stable colour assignment per shipment id — so each SEA shipment
     gets its own blue shade and each AIR shipment its own orange,
     and the colour doesn't change as shipments enter/leave the map. */
  const colorById = (() => {
    const map = new Map<string, string>();
    let seaIdx = 0;
    let airIdx = 0;
    for (const s of shipments) {
      if (s.currentStatus === "DELIVERED" || s.currentStatus === "AT_PORT") continue;
      if (s.type === "SEA") {
        map.set(s.id, shipmentColor("SEA", seaIdx++));
      } else {
        map.set(s.id, shipmentColor("AIR", airIdx++));
      }
    }
    return map;
  })();

  const handleZoomIn = useCallback(() => {
    setPosition((pos) => ({ ...pos, zoom: Math.min(pos.zoom * 1.5, 8) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setPosition((pos) => ({ ...pos, zoom: Math.max(pos.zoom / 1.5, 1) }));
  }, []);

  const handleReset = useCallback(() => {
    setPosition({ coordinates: [10, 10], zoom: 1 });
  }, []);

  const handleMoveEnd = useCallback((pos: { coordinates: [number, number]; zoom: number }) => {
    setPosition(pos);
  }, []);

  /* Zoom to a shipment */
  const handleZoomToShipment = useCallback((s: ShipmentDot) => {
    setActiveShipment(s);
    setPosition({ coordinates: [s.lng, s.lat], zoom: 4 });
  }, []);

  /* Scale dots inversely with zoom so they stay visible */
  const dotScale = 1 / Math.sqrt(position.zoom);

  return (
    <div className="world-map-panel relative w-full h-full overflow-hidden flex items-center justify-center">
      {/* Grid removed by design — keep the map clean and let the shipment
          dots and routes be the only visual rhythm on the canvas. */}

      {/* ── Map with Zoom & Pan ── */}
      <ComposableMap
        width={800}
        height={450}
        style={{ width: "100%", maxHeight: "100%" }}
        {...({ projection: "geoNaturalEarth1", projectionConfig: { scale: 150, center: [10, 5] } } as Record<string, unknown>)}
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          onMoveEnd={handleMoveEnd}
          minZoom={1}
          maxZoom={8}
        >
          {/* Countries */}
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rpiD || geo.properties?.name || Math.random()}
                  geography={geo}
                  fill="var(--wm-land)"
                  stroke="var(--wm-border)"
                  strokeWidth={0.5 / position.zoom}
                  style={{
                    default: { outline: "none" },
                    hover:   { fill: "var(--wm-land-hover)", outline: "none", cursor: "grab" },
                    pressed: { outline: "none", cursor: "grabbing" },
                  }}
                />
              ))
            }
          </Geographies>

          {/* ── Real shipment routes ─────────
              For SEA shipments we render the dense `routePolyline`
              computed server-side via searoute-ts — that's the actual
              ocean path that hugs coastlines and routes through Suez /
              around the Cape, like ShipsGo's visualisation.
              For AIR shipments (and as a fallback) we render
              great-circle arcs between the port-level waypoints. */}
          {mounted &&
            shipments
              .filter((s) => s.currentStatus !== "DELIVERED" && s.currentStatus !== "AT_PORT")
              .flatMap((s) => {
                const stroke = colorById.get(s.id) ?? (s.type === "SEA" ? "#00B4C4" : "#F5821F");

                // Prefer the dense maritime polyline (SEA only) when
                // available — it's many short segments approximating
                // the real ocean route. Segments BEFORE progressIndex
                // are travelled (solid); segments AFTER are remaining
                // (dashed) — mirrors ShipsGo's progress visualisation.
                if (s.routePolyline && s.routePolyline.length >= 2) {
                  const poly = s.routePolyline;
                  const progress = s.progressIndex ?? poly.length - 1;
                  return poly.slice(1).map((to, i) => {
                    const segmentEndIdx = i + 1;
                    const isTravelled = segmentEndIdx <= progress;
                    return (
                      <Line
                        key={`route-${s.id}-${i}`}
                        from={poly[i]}
                        to={to}
                        stroke={stroke}
                        strokeWidth={1.5 / position.zoom}
                        strokeLinecap="round"
                        strokeDasharray={isTravelled ? undefined : "6 5"}
                        opacity={isTravelled ? 0.95 : 0.55}
                      />
                    );
                  });
                }

                // Fallback: stitch great-circles between port waypoints
                // (used by AIR shipments and by SEA shipments where
                // searoute couldn't resolve a path). For these we treat
                // the leg ending at the current location (best-match by
                // string) as the boundary between travelled and remaining.
                const waypoints: [number, number][] = (s.route && s.route.length >= 2)
                  ? s.route
                  : (() => {
                      const a = toLngLat(s.origin);
                      const b = toLngLat(s.destination);
                      return a && b ? [a, b] : [];
                    })();

                if (waypoints.length < 2) return [];

                // Find the waypoint nearest to current location → split point.
                const cur = toLngLat(s.currentLocation) ?? [s.lng, s.lat];
                let cutIdx = waypoints.length - 1;
                if (cur && (cur[0] !== 0 || cur[1] !== 0)) {
                  let best = Infinity;
                  for (let i = 0; i < waypoints.length; i++) {
                    const dlng = waypoints[i][0] - cur[0];
                    const dlat = waypoints[i][1] - cur[1];
                    const d = dlng * dlng + dlat * dlat;
                    if (d < best) { best = d; cutIdx = i; }
                  }
                }

                return waypoints.slice(1).map((to, i) => {
                  const segmentEndIdx = i + 1;
                  const isTravelled = segmentEndIdx <= cutIdx;
                  return (
                    <Line
                      key={`route-${s.id}-${i}`}
                      from={waypoints[i]}
                      to={to}
                      stroke={stroke}
                      strokeWidth={1.5 / position.zoom}
                      strokeLinecap="round"
                      strokeDasharray={isTravelled ? undefined : "8 4"}
                      opacity={isTravelled ? 0.95 : 0.55}
                    />
                  );
                });
              })}

          {/* ── Intermediate waypoint dots ──
              Every transshipment / port-of-call between origin and
              destination gets a small dot in the shipment's colour
              so the reader can see the actual leg-by-leg path. */}
          {mounted &&
            shipments
              .filter((s) => s.currentStatus !== "DELIVERED" && s.currentStatus !== "AT_PORT")
              .flatMap((s) => {
                const route = s.route ?? [];
                if (route.length < 3) return []; // need at least one intermediate waypoint
                const color = colorById.get(s.id) ?? (s.type === "SEA" ? "#00B4C4" : "#F5821F");
                // Drop first + last (those are origin / destination, drawn separately below)
                return route.slice(1, -1).map((pt, i) => (
                  <Marker key={`wp-${s.id}-${i}`} coordinates={pt}>
                    <circle r={3 * dotScale} fill={color} opacity={0.55} />
                    <circle r={1.4 * dotScale} fill={color} stroke="#fff" strokeWidth={0.8 * dotScale} />
                  </Marker>
                ));
              })}

          {/* ── Origin & destination labels per shipment ──
              A solid filled square marks the origin port and a hollow
              ringed marker marks the destination, both in the shipment's
              own colour with the port name and "Origin"/"Destination"
              labels. Makes "where is this shipment going?" obvious at
              a glance — no more guessing which end of the dashed arc
              is the start. */}
          {mounted &&
            shipments
              .filter((s) => s.currentStatus !== "DELIVERED" && s.currentStatus !== "AT_PORT")
              .map((s) => {
                const from = toLngLat(s.origin);
                const to   = toLngLat(s.destination);
                const color = colorById.get(s.id) ?? (s.type === "SEA" ? "#00B4C4" : "#F5821F");
                return (
                  <g key={`endpoints-${s.id}`}>
                    {/* Origin — solid filled square */}
                    {from && s.origin && (
                      <Marker coordinates={from}>
                        <rect
                          x={-4 * dotScale}
                          y={-4 * dotScale}
                          width={8 * dotScale}
                          height={8 * dotScale}
                          fill={color}
                          stroke="#fff"
                          strokeWidth={1 * dotScale}
                          rx={1 * dotScale}
                        />
                        <text
                          textAnchor="middle"
                          y={-9 * dotScale}
                          style={{
                            fontFamily: "Inter, sans-serif",
                            fontSize: `${8 * dotScale}px`,
                            fontWeight: 700,
                            fill: color,
                            paintOrder: "stroke",
                            stroke: "rgba(0,0,0,0.65)",
                            strokeWidth: `${2 * dotScale}px`,
                            strokeLinejoin: "round",
                          }}
                        >
                          {s.origin.toUpperCase()}
                        </text>
                      </Marker>
                    )}
                    {/* Destination — hollow ring + dot */}
                    {to && s.destination && (
                      <Marker coordinates={to}>
                        <circle
                          r={6 * dotScale}
                          fill="none"
                          stroke={color}
                          strokeWidth={2 * dotScale}
                        />
                        <circle r={2 * dotScale} fill={color} />
                        <text
                          textAnchor="middle"
                          y={-10 * dotScale}
                          style={{
                            fontFamily: "Inter, sans-serif",
                            fontSize: `${8 * dotScale}px`,
                            fontWeight: 700,
                            fill: color,
                            paintOrder: "stroke",
                            stroke: "rgba(0,0,0,0.65)",
                            strokeWidth: `${2 * dotScale}px`,
                            strokeLinejoin: "round",
                          }}
                        >
                          {s.destination.toUpperCase()}
                        </text>
                      </Marker>
                    )}
                  </g>
                );
              })}

          {/* ── Reference port markers — kept very faint so they don't
              compete with the actual shipment endpoints above. */}
          {PORTS.map((port) => (
            <Marker key={port.name} coordinates={port.coords}>
              <circle r={3 * dotScale} fill="var(--wm-port-dot)" opacity={0.1} />
              <circle r={1.5 * dotScale} fill="var(--wm-port-dot)" opacity={0.4} />
              {/* Show port name when zoomed in */}
              {position.zoom >= 2 && (
                <text
                  textAnchor="middle"
                  y={-6 * dotScale}
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize:   `${8 * dotScale}px`,
                    fill:       "var(--wm-port-label)",
                    fontWeight: 600,
                  }}
                >
                  {port.name}
                </text>
              )}
            </Marker>
          ))}

          {/* ── Shipment markers ── */}
          {/* DELIVERED and AT_PORT (= arrived at destination) are
              excluded from the map. Everything else (IN_TRANSIT,
              TRANSSHIPMENT, DELAYED, EXCEPTION, CUSTOMS_HOLD,
              OUT_FOR_DELIVERY) is still in flight and earns a marker. */}
          {shipments
            .filter((s) => s.currentStatus !== "DELIVERED" && s.currentStatus !== "AT_PORT")
            .map((s) => {
            const isDelayed = s.currentStatus === "DELAYED" || s.currentStatus === "EXCEPTION";
            const isActive = activeShipment?.id === s.id;

            // Per-shipment palette colour. Delayed/exception always
            // turns red so it stands out regardless of palette index.
            const baseColor = colorById.get(s.id) ?? (s.type === "SEA" ? "#00B4C4" : "#F5821F");
            const dotColor = isDelayed ? "#EF4444" : baseColor;
            const glowColor = isDelayed ? "rgba(239,68,68,0.6)" : `${baseColor}99`;

            // Pick the best coordinate we can: the geocoded current
            // position if we have one, otherwise the midpoint between
            // origin and destination, otherwise whichever endpoint is
            // known. This guarantees every newly-added shipment shows
            // up on the map even before the worker fills in lat/lng.
            let markerCoords: [number, number] | null = null;
            if (s.lng !== 0 || s.lat !== 0) {
              markerCoords = [s.lng, s.lat];
            } else {
              const originPt = toLngLat(s.origin);
              const destPt   = toLngLat(s.destination);
              if (originPt && destPt) {
                markerCoords = [(originPt[0] + destPt[0]) / 2, (originPt[1] + destPt[1]) / 2];
              } else if (originPt) {
                markerCoords = originPt;
              } else if (destPt) {
                markerCoords = destPt;
              }
            }
            if (!markerCoords) return null;

            return (
              <Marker
                key={s.id}
                coordinates={markerCoords}
                onClick={() => handleZoomToShipment(s)}
                onMouseEnter={() => setActiveShipment(s)}
                onMouseLeave={() => setActiveShipment(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Outer pulse ring */}
                <motion.circle
                  fill="none"
                  stroke={dotColor}
                  strokeWidth={1.5 * dotScale}
                  initial={{ r: 6 * dotScale, opacity: 0.8 }}
                  animate={{ r: 24 * dotScale, opacity: 0 }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
                />

                {/* Second pulse ring (offset) */}
                <motion.circle
                  fill="none"
                  stroke={dotColor}
                  strokeWidth={1 * dotScale}
                  initial={{ r: 6 * dotScale, opacity: 0.5 }}
                  animate={{ r: 20 * dotScale, opacity: 0 }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay: 1.1 }}
                />

                {/* Extra ring when active */}
                {isActive && (
                  <motion.circle
                    r={16 * dotScale}
                    fill="none"
                    stroke={dotColor}
                    strokeWidth={2 * dotScale}
                    strokeDasharray={`${3 * dotScale} ${2 * dotScale}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.7 }}
                  />
                )}

                {/* Glow */}
                <circle r={10 * dotScale} fill={glowColor} opacity={isActive ? 0.6 : 0.4} />

                {/* Main dot */}
                <circle
                  r={6 * dotScale}
                  fill={dotColor}
                  stroke="var(--wm-dot-stroke)"
                  strokeWidth={2 * dotScale}
                />

                {/* Container ID always visible next to the live dot —
                    that's how the user identifies which arc on the map
                    belongs to which row in the sidebar. Colour-matched
                    to the shipment so it ties back to its endpoints. */}
                <text
                  textAnchor="start"
                  x={9 * dotScale}
                  y={3 * dotScale}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: `${8 * dotScale}px`,
                    fontWeight: 800,
                    fill: dotColor,
                    paintOrder: "stroke",
                    stroke: "rgba(0,0,0,0.7)",
                    strokeWidth: `${2.4 * dotScale}px`,
                    strokeLinejoin: "round",
                  }}
                >
                  {s.trackingNumber}
                </text>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {/* ── Zoom controls ── */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-10">
        <button
          onClick={handleZoomIn}
          className="h-9 w-9 rounded-lg bg-navy-900/80 backdrop-blur-sm border border-white/10
                     flex items-center justify-center text-white/70 hover:text-white hover:bg-navy-800/90
                     transition-all active:scale-95"
          title="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={handleZoomOut}
          className="h-9 w-9 rounded-lg bg-navy-900/80 backdrop-blur-sm border border-white/10
                     flex items-center justify-center text-white/70 hover:text-white hover:bg-navy-800/90
                     transition-all active:scale-95"
          title="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={handleReset}
          className="h-9 w-9 rounded-lg bg-navy-900/80 backdrop-blur-sm border border-white/10
                     flex items-center justify-center text-white/70 hover:text-white hover:bg-navy-800/90
                     transition-all active:scale-95"
          title="Reset view"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* ── Zoom level indicator ── */}
      {position.zoom > 1 && (
        <div className="absolute bottom-4 right-16 rounded-lg bg-navy-900/80 backdrop-blur-sm border border-white/10 px-2.5 py-1.5 z-10">
          <span className="text-[10px] font-mono text-white/50">{position.zoom.toFixed(1)}x</span>
        </div>
      )}

      {/* ── Active shipment detail card ── */}
      <AnimatePresence>
        {activeShipment && (
          <motion.div
            key={activeShipment.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-20
                       rounded-xl bg-navy-900/95 backdrop-blur-md
                       border border-white/10 shadow-2xl overflow-hidden
                       min-w-[300px]"
          >
            {/* Colored top bar */}
            <div
              className="h-1"
              style={{
                background: activeShipment.currentStatus === "DELAYED" || activeShipment.currentStatus === "EXCEPTION"
                  ? "#EF4444"
                  : activeShipment.type === "SEA" ? "#00B4C4" : "#F5821F",
              }}
            />

            <div className="px-5 py-4">
              <button
                onClick={() => setActiveShipment(null)}
                className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>

              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                {activeShipment.type === "SEA" ? (
                  <div className="h-10 w-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                    <Ship size={20} className="text-teal-400" />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                    <Plane size={20} className="text-orange-400" />
                  </div>
                )}
                <div>
                  <div className="font-mono text-sm font-bold text-white tracking-wide">
                    {activeShipment.trackingNumber}
                  </div>
                  {activeShipment.carrier && (
                    <div className="text-xs text-navy-300 mt-0.5">{activeShipment.carrier}</div>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                    activeShipment.currentStatus === "DELAYED" || activeShipment.currentStatus === "EXCEPTION"
                      ? "bg-red-500/20 text-red-400"
                      : activeShipment.currentStatus === "DELIVERED"
                        ? "bg-green-500/20 text-green-400"
                        : activeShipment.type === "SEA"
                          ? "bg-teal-500/20 text-teal-400"
                          : "bg-orange-500/20 text-orange-400"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                  {getStatusText(activeShipment.currentStatus)}
                </span>
                <span className="text-[10px] text-navy-500 uppercase tracking-wider font-semibold">
                  {activeShipment.type === "SEA" ? "Sea Freight" : "Air Cargo"}
                </span>
              </div>

              {/* Current Location — highlighted */}
              {activeShipment.currentLocation && (
                <div className="p-3 rounded-lg bg-white/5 border border-white/5 mb-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-navy-500 mb-1.5">
                    Current Location
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-orange-400 flex-shrink-0 mt-0.5" />
                    <span className="text-xs font-semibold text-white leading-relaxed">
                      {activeShipment.currentLocation}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-navy-500 font-mono">
                    <span>{activeShipment.lat.toFixed(2)}°{activeShipment.lat >= 0 ? "N" : "S"}</span>
                    <span>·</span>
                    <span>{Math.abs(activeShipment.lng).toFixed(2)}°{activeShipment.lng >= 0 ? "E" : "W"}</span>
                  </div>
                </div>
              )}

              {/* Route */}
              {(activeShipment.origin || activeShipment.destination) && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 border border-white/5">
                  {activeShipment.origin && (
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                      <span className="text-xs font-medium text-white">{activeShipment.origin}</span>
                    </div>
                  )}
                  {activeShipment.origin && activeShipment.destination && (
                    <ArrowRight size={12} className="text-navy-500 flex-shrink-0" />
                  )}
                  {activeShipment.destination && (
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                      <span className="text-xs font-medium text-white">{activeShipment.destination}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Legend ──
          Two parts:
          1) Marker key — what the square / pulse / ring on the map mean.
          2) Shipment list — every active shipment, colour-matched to its
             arc on the map, so the user can read "this purple line is
             MSCU5165329 going from Ningbo to Itapoa." */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2.5 rounded-xl bg-navy-900/85 px-4 py-3 backdrop-blur-md border border-white/5 z-10 max-w-[260px]">
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">
          Live Tracking
        </div>

        {/* Marker key — origin (square), current (pulse), destination (ring) */}
        <div className="flex items-center gap-3 text-[10px] text-white/60">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-white/70" />
            Origin
          </span>
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/70 opacity-50" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white/80" />
            </span>
            Live
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border-[1.5px] border-white/70" />
            Destination
          </span>
        </div>

        {/* Per-shipment colour swatches */}
        {shipments.filter((s) => s.currentStatus !== "DELIVERED" && s.currentStatus !== "AT_PORT").length > 0 && (
          <>
            <div className="h-px bg-white/10" />
            <div className="flex flex-col gap-1.5">
              {shipments
                .filter((s) => s.currentStatus !== "DELIVERED" && s.currentStatus !== "AT_PORT")
                .map((s) => {
                  const color = colorById.get(s.id) ?? (s.type === "SEA" ? "#00B4C4" : "#F5821F");
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleZoomToShipment(s)}
                      className="flex items-center gap-2 text-left hover:bg-white/5 rounded px-1 py-0.5 transition-colors"
                    >
                      <span
                        className="h-2.5 w-3 rounded-sm shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-mono text-[10px] font-bold text-white/90 truncate">
                        {s.trackingNumber}
                      </span>
                      <span className="text-[10px] text-white/45 truncate">
                        {(s.origin || "?").slice(0, 8)} → {(s.destination || "?").slice(0, 8)}
                      </span>
                    </button>
                  );
                })}
            </div>
          </>
        )}
      </div>

      {/* ── Shipment count badge (matches what's actually on the map) ── */}
      <div className="absolute top-4 right-4 flex items-center gap-3 rounded-xl bg-navy-900/80 px-4 py-2.5 backdrop-blur-sm border border-white/5 z-10">
        <div className="flex items-center gap-1.5">
          <Ship size={14} className="text-teal-400" />
          <span className="text-sm font-bold text-white">
            {shipments.filter((s) => s.type === "SEA" && s.currentStatus !== "DELIVERED" && s.currentStatus !== "AT_PORT").length}
          </span>
        </div>
        <div className="w-px h-4 bg-white/15" />
        <div className="flex items-center gap-1.5">
          <Plane size={14} className="text-orange-400" />
          <span className="text-sm font-bold text-white">
            {shipments.filter((s) => s.type === "AIR" && s.currentStatus !== "DELIVERED" && s.currentStatus !== "AT_PORT").length}
          </span>
        </div>
      </div>

      {/* ── Interaction hint ── */}
      {position.zoom === 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute bottom-14 right-4 rounded-lg bg-navy-900/60 px-3 py-1.5 z-10"
        >
          <span className="text-[10px] text-white/30">Scroll to zoom · Drag to pan · Click dot for details</span>
        </motion.div>
      )}
    </div>
  );
}
