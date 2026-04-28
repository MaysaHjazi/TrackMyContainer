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
import { useTheme } from "@/frontend/theme-provider";
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
    AT_PORT: "At Port", EXCEPTION: "Exception", CUSTOMS_HOLD: "Customs Hold",
    OUT_FOR_DELIVERY: "Out for Delivery", TRANSSHIPMENT: "Transshipment",
    UNKNOWN: "Unknown",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

/* Map colours live in globals.css under `.world-map-panel` and
 * `.dark .world-map-panel` — CSS variables flip the moment the dark
 * class toggles on <html>, which is what the View Transitions API
 * captures. Doing this in JS would race the snapshot.
 *
 * The only thing we still derive in JS is the panel background — it's
 * a multi-stop gradient, easier as inline style and theme-keyed below.
 */
const PANEL_BG = {
  dark:  "linear-gradient(180deg, #0A1428 0%, #060E1E 50%, #040A16 100%)",
  light: "linear-gradient(180deg, #FAFCFF 0%, #F1F6FC 50%, #E9F1FA 100%)",
} as const;

export function WorldMapPanel({ shipments }: Props) {
  const [mounted, setMounted] = useState(false);
  const [activeShipment, setActiveShipment] = useState<ShipmentDot | null>(null);
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [10, 10],
    zoom: 1,
  });
  const { theme } = useTheme();

  useEffect(() => { setMounted(true); }, []);
  const panelBg = theme === "dark" ? PANEL_BG.dark : PANEL_BG.light;

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
    <div
      className="world-map-panel relative w-full h-full overflow-hidden flex items-center justify-center"
      style={{
        background: panelBg,
      }}
    >
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

          {/* ── Real shipment routes (origin → destination) ─────────
              ONE line per active shipment that has both an origin and a
              destination we can geocode. Sea = teal dashes, Air = orange
              dashes. No decorative/random arcs — only what's actually
              moving in your account. */}
          {mounted &&
            shipments
              .filter((s) => s.currentStatus !== "DELIVERED" && s.currentStatus !== "AT_PORT")
              .map((s) => {
                const from = toLngLat(s.origin);
                const to   = toLngLat(s.destination);
                if (!from || !to) return null;
                return (
                  <Line
                    key={`route-${s.id}`}
                    from={from}
                    to={to}
                    stroke={s.type === "SEA" ? "var(--wm-sea-route)" : "var(--wm-air-route)"}
                    strokeWidth={1.5 / position.zoom}
                    strokeLinecap="round"
                    strokeDasharray="8 4"
                  />
                );
              })}

          {/* ── Port markers with labels at higher zoom ── */}
          {PORTS.map((port) => (
            <Marker key={port.name} coordinates={port.coords}>
              <circle r={3 * dotScale} fill="var(--wm-port-dot)" opacity={0.2} />
              <circle r={1.5 * dotScale} fill="var(--wm-port-dot)" opacity={0.8} />
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
          {/* Arrived shipments (DELIVERED or AT_PORT at destination) are
              excluded from the map — they still appear in stats and the right
              sidebar, but we don't waste a dot on them (and the dispatcher
              stops polling them once isActive=false). */}
          {shipments.filter((s) => s.currentStatus !== "DELIVERED" && s.currentStatus !== "AT_PORT").map((s) => {
            const isDelayed = s.currentStatus === "DELAYED" || s.currentStatus === "EXCEPTION";
            const isSea = s.type === "SEA";
            const isActive = activeShipment?.id === s.id;

            const dotColor = isDelayed ? "#EF4444" : isSea ? "#00B4C4" : "#F5821F";
            const glowColor = isDelayed
              ? "rgba(239,68,68,0.6)"
              : isSea ? "rgba(0,180,196,0.6)" : "rgba(245,130,31,0.6)";

            return (
              <Marker
                key={s.id}
                coordinates={[s.lng, s.lat]}
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

                {/* Carrier label when zoomed in — CSS-driven text colour */}
                {position.zoom >= 3 && (
                  <text
                    textAnchor="start"
                    x={8 * dotScale}
                    y={3 * dotScale}
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize:   `${7 * dotScale}px`,
                      fill:       "var(--wm-label-text)",
                      fontWeight: 700,
                    }}
                  >
                    {s.trackingNumber}
                  </text>
                )}
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

      {/* ── Legend ── */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2 rounded-xl bg-navy-900/80 px-4 py-3 backdrop-blur-sm border border-white/5 z-10">
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-0.5">
          Live Tracking
        </div>
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-40" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-400 shadow-[0_0_6px_rgba(0,180,196,0.8)]" />
          </span>
          <span className="text-xs text-white/80">Sea Freight</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-40" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-400 shadow-[0_0_6px_rgba(245,130,31,0.8)]" />
          </span>
          <span className="text-xs text-white/80">Air Cargo</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-40" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
          </span>
          <span className="text-xs text-white/80">Delayed</span>
        </div>
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
