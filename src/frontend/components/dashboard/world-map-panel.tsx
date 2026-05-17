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
  /** Port waypoints derived ONLY from real tracking events (origin +
   *  ShipsGo events + destination, consecutive duplicates removed).
   *  Each is geocoded `[lng, lat]`. The map draws great-circle legs
   *  between consecutive entries. We never synthesise extra path
   *  detail client-side — the events are the single source of truth. */
  route?: [number, number][];
  /** Matching port name per waypoint, used for hover tooltips. */
  routeLabels?: string[];
  /** Index into `route` for the container's current waypoint. Legs
   *  ENDING at index ≤ progressIndex render solid (travelled), the
   *  rest render dashed (remaining) — mirrors ShipsGo's progress
   *  visualisation. */
  progressIndex?: number;
  /** Dense maritime polyline (SEA only): searoute-ts run between the
   *  REAL consecutive port waypoints so the line follows ocean lanes
   *  (around capes, through canals) instead of cutting across land.
   *  The ports are 100% from ShipsGo events; only the curve shape
   *  between two real ports is computed (ShipsGo gives no GPS track). */
  routePolyline?: [number, number][];
  /** Index into `routePolyline` at the live position — splits the
   *  polyline into travelled (solid) vs remaining (dashed). */
  polylineProgressIndex?: number;
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
// AIR: shades of the PROJECT BRAND ORANGE (#F5821F) only — every air
// shipment stays recognisably "brand orange", just lighter/darker per
// shipment for separation. No off-brand reds/roses.
const AIR_PALETTE = [
  "#F5821F", // brand orange (canonical)
  "#FFA04D", // brand +tint
  "#D96A12", // brand -shade
  "#FFB877", // brand ++tint
  "#B85410", // brand --shade
  "#FF922E", // brand light
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
        {/* SVG <defs> — reusable filter / gradient definitions used by
            every shipment route, marker, and the live pulse. Defining
            them once at the top is markedly more efficient than inlining
            per-element filters and gives the route lines a soft
            chromatic glow that matches dashboards like Linear/Vercel. */}
        <defs>
          <filter id="wm-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="wm-glow-strong" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

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

          {/* ── Shipment routes ─────────
              SEA: dense maritime polyline (searoute between the REAL
              ShipsGo event ports) so the line hugs coastlines / rounds
              capes / transits canals instead of slicing across land.
              AIR / fallback: great-circle between port waypoints.
              In both cases the segment up to the live position renders
              solid + glow (travelled) and the rest dashed + faded
              (remaining), mirroring ShipsGo's progress style. */}
          {mounted &&
            shipments
              .filter((s) => s.currentStatus !== "DELIVERED" && s.currentStatus !== "AT_PORT")
              .flatMap((s) => {
                const stroke = colorById.get(s.id) ?? (s.type === "SEA" ? "#00B4C4" : "#F5821F");
                const baseW = 1.6 / position.zoom;

                // Choose the densest path we have: maritime polyline
                // (SEA) → port waypoints → origin/destination fallback.
                let path: [number, number][];
                let progress: number;
                if (s.routePolyline && s.routePolyline.length >= 2) {
                  path = s.routePolyline;
                  progress = s.polylineProgressIndex ?? (path.length - 1);
                } else {
                  path = (s.route && s.route.length >= 2)
                    ? s.route
                    : (() => {
                        const a = toLngLat(s.origin);
                        const b = toLngLat(s.destination);
                        return a && b ? [a, b] : [];
                      })();
                  progress = s.progressIndex ?? (path.length - 1);
                }
                if (path.length < 2) return [];

                return path.slice(1).flatMap((to, i) => {
                  const segmentEndIdx = i + 1;
                  const isTravelled = segmentEndIdx <= progress;
                  if (isTravelled) {
                    return [
                      <Line
                        key={`route-${s.id}-${i}-glow`}
                        from={path[i]}
                        to={to}
                        stroke={stroke}
                        strokeWidth={baseW * 2.4}
                        strokeLinecap="round"
                        opacity={0.16}
                      />,
                      <Line
                        key={`route-${s.id}-${i}`}
                        from={path[i]}
                        to={to}
                        stroke={stroke}
                        strokeWidth={baseW}
                        strokeLinecap="round"
                        opacity={0.95}
                      />,
                    ];
                  }
                  return (
                    <Line
                      key={`route-${s.id}-${i}`}
                      from={path[i]}
                      to={to}
                      stroke={stroke}
                      strokeWidth={baseW * 0.85}
                      strokeLinecap="round"
                      strokeDasharray={`${4 / position.zoom} ${3 / position.zoom}`}
                      opacity={0.45}
                    />
                  );
                });
              })}

          {/* ── Intermediate transshipment dots ──
              Each port-of-call between origin and destination gets a
              small ringed dot in the shipment's colour. */}
          {mounted &&
            shipments
              .filter((s) => s.currentStatus !== "DELIVERED" && s.currentStatus !== "AT_PORT")
              .flatMap((s) => {
                const route = s.route ?? [];
                if (route.length < 3) return [];
                const labels = s.routeLabels ?? [];
                const color = colorById.get(s.id) ?? (s.type === "SEA" ? "#00B4C4" : "#F5821F");
                return route.slice(1, -1).map((pt, i) => (
                  <Marker key={`wp-${s.id}-${i}`} coordinates={pt}>
                    {/* Soft halo */}
                    <circle r={5 * dotScale} fill={color} opacity={0.18} />
                    {/* Outer ring + inner dot — small "transshipment" marker */}
                    <circle r={2.6 * dotScale} fill="rgba(10,15,30,0.95)" stroke={color} strokeWidth={1.3 * dotScale} />
                    <circle r={1.1 * dotScale} fill={color} />
                    {/* Label only when zoomed in to avoid clutter */}
                    {position.zoom >= 2 && labels[i + 1] && (
                      <text
                        textAnchor="middle"
                        y={-6 * dotScale}
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: `${6 * dotScale}px`,
                          fontWeight: 600,
                          letterSpacing: `${0.3 * dotScale}px`,
                          fill: color,
                          paintOrder: "stroke",
                          stroke: "rgba(6,11,26,0.85)",
                          strokeWidth: `${1.4 * dotScale}px`,
                          strokeLinejoin: "round",
                          textTransform: "uppercase",
                        }}
                      >
                        {labels[i + 1].toUpperCase()}
                      </text>
                    )}
                  </Marker>
                ));
              })}

          {/* ── Origin & destination ──
              Origin reads as a small "departure" chip — a filled
              rounded-square pin in the shipment colour with a darker
              core, anchored by an UPPERCASE port label.
              Destination reads as a "target" — a hollow concentric
              ring set with a small centre dot. */}
          {mounted &&
            shipments
              .filter((s) => s.currentStatus !== "DELIVERED" && s.currentStatus !== "AT_PORT")
              .map((s) => {
                const from = toLngLat(s.origin);
                const to   = toLngLat(s.destination);
                const color = colorById.get(s.id) ?? (s.type === "SEA" ? "#00B4C4" : "#F5821F");
                return (
                  <g key={`endpoints-${s.id}`}>
                    {/* Origin — refined departure pin */}
                    {from && s.origin && (
                      <Marker coordinates={from}>
                        {/* Soft drop shadow halo */}
                        <circle r={7 * dotScale} fill={color} opacity={0.2} />
                        {/* Outer chip */}
                        <rect
                          x={-4.5 * dotScale}
                          y={-4.5 * dotScale}
                          width={9 * dotScale}
                          height={9 * dotScale}
                          fill={color}
                          rx={1.6 * dotScale}
                        />
                        {/* Inner darker core to give the chip depth */}
                        <rect
                          x={-2 * dotScale}
                          y={-2 * dotScale}
                          width={4 * dotScale}
                          height={4 * dotScale}
                          fill="rgba(6,11,26,0.55)"
                          rx={0.6 * dotScale}
                        />
                        <text
                          textAnchor="middle"
                          y={-10 * dotScale}
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: `${7 * dotScale}px`,
                            fontWeight: 700,
                            letterSpacing: `${0.4 * dotScale}px`,
                            fill: color,
                            paintOrder: "stroke",
                            stroke: "rgba(6,11,26,0.9)",
                            strokeWidth: `${2 * dotScale}px`,
                            strokeLinejoin: "round",
                            textTransform: "uppercase",
                          }}
                        >
                          {s.origin.toUpperCase()}
                        </text>
                      </Marker>
                    )}
                    {/* Destination — concentric target ring */}
                    {to && s.destination && (
                      <Marker coordinates={to}>
                        {/* Outer faint halo */}
                        <circle r={9 * dotScale} fill={color} opacity={0.14} />
                        {/* Outer ring */}
                        <circle
                          r={6.5 * dotScale}
                          fill="none"
                          stroke={color}
                          strokeWidth={1.6 * dotScale}
                          opacity={0.95}
                        />
                        {/* Inner ring */}
                        <circle
                          r={3.5 * dotScale}
                          fill="none"
                          stroke={color}
                          strokeWidth={1 * dotScale}
                          opacity={0.55}
                        />
                        {/* Centre dot */}
                        <circle r={1.6 * dotScale} fill={color} />
                        <text
                          textAnchor="middle"
                          y={-11 * dotScale}
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: `${7 * dotScale}px`,
                            fontWeight: 700,
                            letterSpacing: `${0.4 * dotScale}px`,
                            fill: color,
                            paintOrder: "stroke",
                            stroke: "rgba(6,11,26,0.9)",
                            strokeWidth: `${2 * dotScale}px`,
                            strokeLinejoin: "round",
                            textTransform: "uppercase",
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
                {/* Three staggered pulse rings — gives the live position
                    a calm, dashboard-grade pulse rather than a noisy
                    flicker. Lower opacity, longer duration. */}
                <motion.circle
                  fill="none"
                  stroke={dotColor}
                  strokeWidth={1 * dotScale}
                  initial={{ r: 5 * dotScale, opacity: 0.6 }}
                  animate={{ r: 22 * dotScale, opacity: 0 }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut" }}
                />
                <motion.circle
                  fill="none"
                  stroke={dotColor}
                  strokeWidth={0.8 * dotScale}
                  initial={{ r: 5 * dotScale, opacity: 0.4 }}
                  animate={{ r: 18 * dotScale, opacity: 0 }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut", delay: 0.9 }}
                />
                <motion.circle
                  fill="none"
                  stroke={dotColor}
                  strokeWidth={0.6 * dotScale}
                  initial={{ r: 5 * dotScale, opacity: 0.3 }}
                  animate={{ r: 14 * dotScale, opacity: 0 }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut", delay: 1.7 }}
                />

                {/* Extra ring when active (hover/focus state) */}
                {isActive && (
                  <motion.circle
                    r={12 * dotScale}
                    fill="none"
                    stroke={dotColor}
                    strokeWidth={1.4 * dotScale}
                    strokeDasharray={`${2 * dotScale} ${2 * dotScale}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.9, rotate: 360 }}
                    transition={{ rotate: { duration: 14, repeat: Infinity, ease: "linear" } }}
                  />
                )}

                {/* Soft chromatic halo behind the dot for depth */}
                <circle r={8 * dotScale} fill={glowColor} opacity={isActive ? 0.55 : 0.35} filter="url(#wm-glow-strong)" />

                {/* Outer ring — dashboard-style "live" indicator */}
                <circle
                  r={5.5 * dotScale}
                  fill="none"
                  stroke={dotColor}
                  strokeWidth={1.2 * dotScale}
                  opacity={0.8}
                />
                {/* Inner core — solid coloured dot with crisp white seam */}
                <circle r={3.5 * dotScale} fill={dotColor} stroke="rgba(255,255,255,0.95)" strokeWidth={0.8 * dotScale} />

                {/* Container ID — refined floating label */}
                <g transform={`translate(${10 * dotScale}, ${3.5 * dotScale})`}>
                  {/* Subtle backing pill so the ID stays legible over land/sea */}
                  <rect
                    x={-1.5 * dotScale}
                    y={-5 * dotScale}
                    width={s.trackingNumber.length * 4.2 * dotScale + 4 * dotScale}
                    height={7 * dotScale}
                    rx={1.5 * dotScale}
                    fill="rgba(6,11,26,0.78)"
                    stroke={dotColor}
                    strokeWidth={0.4 * dotScale}
                    opacity={0.85}
                  />
                  <text
                    textAnchor="start"
                    x={0.5 * dotScale}
                    y={-0.4 * dotScale}
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: `${5.5 * dotScale}px`,
                      fontWeight: 700,
                      letterSpacing: `${0.3 * dotScale}px`,
                      fill: dotColor,
                    }}
                  >
                    {s.trackingNumber}
                  </text>
                </g>
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
          Glass card, dashboard-style. Three blocks separated by hairline
          dividers:
            1. Status header with live indicator pip
            2. Marker key (origin chip / live pulse / destination ring)
            3. Per-shipment list with coloured progress bars — click to
               zoom to that shipment on the map. */}
      <div className="absolute bottom-4 left-4 z-10 flex w-[280px] flex-col gap-0
                      rounded-xl bg-navy-950/85 backdrop-blur-xl
                      ring-1 ring-white/[0.07] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.6)]
                      overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
              Live Tracking
            </span>
          </div>
          <span className="font-mono text-[10px] font-semibold text-white/35">
            {shipments.filter(s => s.currentStatus !== "DELIVERED" && s.currentStatus !== "AT_PORT").length} active
          </span>
        </div>

        {/* Marker key */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5
                        border-y border-white/[0.06] bg-white/[0.015]">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px] bg-white/85" />
            <span className="font-mono text-[9px] uppercase tracking-wider text-white/45">Origin</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white/85" />
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-white/45">Live</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border-[1.5px] border-white/85" />
            <span className="font-mono text-[9px] uppercase tracking-wider text-white/45">Destination</span>
          </div>
        </div>

        {/* Per-shipment list */}
        {shipments.filter(s => s.currentStatus !== "DELIVERED" && s.currentStatus !== "AT_PORT").length > 0 && (
          <div className="flex flex-col py-1.5 max-h-[180px] overflow-y-auto">
            {shipments
              .filter(s => s.currentStatus !== "DELIVERED" && s.currentStatus !== "AT_PORT")
              .map(s => {
                const color = colorById.get(s.id) ?? (s.type === "SEA" ? "#00B4C4" : "#F5821F");
                const total = (s.route?.length ?? 0);
                const done  = (s.progressIndex ?? 0) + 1;
                const pct   = total >= 2 ? Math.round((done / Math.max(total - 0, 1)) * 100) : 0;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleZoomToShipment(s)}
                    className="group relative flex flex-col gap-1.5 px-4 py-2 text-left
                               transition-colors hover:bg-white/[0.04]"
                  >
                    {/* Coloured leading bar */}
                    <span
                      className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full
                                 transition-all group-hover:w-1"
                      style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}66` }}
                    />
                    <div className="flex items-center justify-between pl-1">
                      <span className="font-mono text-[11px] font-bold tracking-tight"
                            style={{ color }}>
                        {s.trackingNumber}
                      </span>
                      <span className="font-mono text-[9px] tabular-nums text-white/45">
                        {pct}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 pl-1 text-[10px] text-white/55">
                      <span className="truncate uppercase tracking-wider">
                        {(s.origin || "—").slice(0, 12)}
                      </span>
                      <svg width="10" height="6" viewBox="0 0 10 6" className="shrink-0 opacity-50">
                        <path d="M0 3 H8 M5 0 L9 3 L5 6" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="truncate uppercase tracking-wider">
                        {(s.destination || "—").slice(0, 12)}
                      </span>
                    </div>
                    {/* Progress track */}
                    <div className="ml-1 h-[2px] w-full rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(2, pct))}%`,
                          backgroundColor: color,
                          boxShadow: `0 0 6px ${color}99`,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
          </div>
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
