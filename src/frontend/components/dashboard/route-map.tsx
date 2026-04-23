"use client";

import { useEffect, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, Line } from "react-simple-maps";
import { Navigation, Ship } from "lucide-react";
import { getCoordinates } from "@/lib/port-coordinates";
import { useTheme } from "@/frontend/theme-provider";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

/** Convert `{ lat, lng }` → `[lng, lat]` (react-simple-maps tuple order).
 *  Returns null if the lookup didn't match (0,0 sentinel). */
function toTuple(location: string | undefined | null): [number, number] | null {
  if (!location) return null;
  const { lat, lng } = getCoordinates(location);
  if (lat === 0 && lng === 0) return null;
  return [lng, lat];
}

/** Average a list of points for projection centering. */
function centerOf(points: [number, number][]): [number, number] {
  if (!points.length) return [20, 20];
  const lng = points.reduce((s, p) => s + p[0], 0) / points.length;
  const lat = points.reduce((s, p) => s + p[1], 0) / points.length;
  return [lng, lat];
}

interface Props {
  origin?:          string | null;
  destination?:     string | null;
  currentLocation?: string | null;
}

export function RouteMap({ origin, destination, currentLocation }: Props) {
  const { theme } = useTheme();
  const isDark    = theme === "dark";

  // react-simple-maps computes SVG path `d` attributes using d3-geo, which
  // can produce floating-point strings that differ between the server and
  // the client (different Node/V8 vs. browser rounding). To avoid a React
  // hydration mismatch, we render a lightweight placeholder until after
  // the component has mounted in the browser, then upgrade to the real map.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const originCoords  = toTuple(origin);
  const destCoords    = toTuple(destination);
  const currentCoords = toTuple(currentLocation);

  const anchors = [originCoords, currentCoords, destCoords].filter(
    (c): c is [number, number] => c !== null,
  );

  // Empty / unknown locations → small placeholder card
  if (anchors.length === 0) {
    return (
      <div className="rounded-xl border p-6 text-center
                      border-navy-200 bg-navy-50
                      dark:border-navy-700 dark:bg-navy-800">
        <Navigation size={24} className="mx-auto mb-2 text-navy-300 dark:text-navy-600" />
        <p className="text-sm text-navy-400 dark:text-navy-500">Route map unavailable</p>
      </div>
    );
  }

  // Theme-specific palette
  const palette = isDark
    ? {
        container:  "bg-navy-950 border-navy-800",
        headerBg:   "border-navy-800 bg-navy-900/50",
        headerText: "text-navy-200",
        landFill:   "#1e3a5f",   // deep blue
        landStroke: "#2a4d7a",
        ocean:      "transparent",
        legendBg:   "border-navy-800 bg-navy-900/50 text-navy-400",
      }
    : {
        container:  "bg-white border-navy-200",
        headerBg:   "border-navy-100 bg-navy-50/60",
        headerText: "text-navy-700",
        landFill:   "#E6EAF2",   // soft grey-blue
        landStroke: "#C9D1E0",
        ocean:      "transparent",
        legendBg:   "border-navy-100 bg-navy-50/60 text-navy-500",
      };

  // Accent colors — same for both themes (brand palette)
  const ORIGIN_C  = "#00B4C4";  // teal
  const CURRENT_C = "#F5821F";  // orange
  const DEST_C    = "#22C55E";  // green

  // Determine projection: focus on the midpoint between known anchors.
  const center  = centerOf(anchors);
  // Scale inversely to longitude span (rough heuristic): tighter routes zoom more.
  const lngSpan = Math.max(...anchors.map(a => a[0])) - Math.min(...anchors.map(a => a[0]));
  const latSpan = Math.max(...anchors.map(a => a[1])) - Math.min(...anchors.map(a => a[1]));
  const span    = Math.max(lngSpan, latSpan, 40);   // floor at 40° to avoid over-zoom
  const scale   = Math.max(110, Math.min(220, 8000 / span));

  return (
    <div className={`rounded-xl border overflow-hidden shadow-sm ${palette.container}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 px-4 py-2 border-b ${palette.headerBg}`}>
        <Navigation size={14} className="text-orange-500 dark:text-orange-400" />
        <span className={`text-xs font-bold uppercase tracking-wider ${palette.headerText}`}>
          Route Map
        </span>
      </div>

      {/* Placeholder until mounted — prevents SSR/client SVG path mismatch */}
      {!mounted ? (
        <div
          className="w-full flex items-center justify-center bg-navy-50 dark:bg-navy-900/40 animate-pulse"
          style={{ aspectRatio: "500 / 280" }}
          aria-label="Loading route map"
        />
      ) : (
      <ComposableMap
        projectionConfig={{ scale, center }}
        width={500}
        height={280}
        style={{ width: "100%", height: "auto", background: palette.ocean }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={palette.landFill}
                stroke={palette.landStroke}
                strokeWidth={0.4}
              />
            ))
          }
        </Geographies>

        {/* ── Traveled leg: origin → current (solid orange) ── */}
        {originCoords && currentCoords && (
          <Line
            from={originCoords}
            to={currentCoords}
            stroke={CURRENT_C}
            strokeWidth={2}
            strokeLinecap="round"
          />
        )}

        {/* ── Remaining leg: current → destination (dashed green) ── */}
        {currentCoords && destCoords && (
          <Line
            from={currentCoords}
            to={destCoords}
            stroke={DEST_C}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            strokeLinecap="round"
          />
        )}

        {/* Fallback: no current → straight line origin → destination */}
        {!currentCoords && originCoords && destCoords && (
          <Line
            from={originCoords}
            to={destCoords}
            stroke={CURRENT_C}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            strokeLinecap="round"
          />
        )}

        {/* ── Origin marker ── */}
        {originCoords && (
          <Marker coordinates={originCoords}>
            <circle r={5} fill={ORIGIN_C} stroke="#fff" strokeWidth={1.5} />
            {origin && (
              <text
                y={-10}
                textAnchor="middle"
                fill={ORIGIN_C}
                fontSize={7}
                fontWeight="bold"
                style={{ pointerEvents: "none" }}
              >
                {origin}
              </text>
            )}
          </Marker>
        )}

        {/* ── Current location: pulsing orange + ship icon ── */}
        {currentCoords && (
          <Marker coordinates={currentCoords}>
            <circle r={5} fill={CURRENT_C} opacity={0.3}>
              <animate attributeName="r" from="5" to="14" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.45" to="0" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <circle r={4.5} fill={CURRENT_C} stroke="#fff" strokeWidth={1.5} />
            {currentLocation && (
              <text
                y={-10}
                textAnchor="middle"
                fill={CURRENT_C}
                fontSize={7}
                fontWeight="bold"
                style={{ pointerEvents: "none" }}
              >
                {currentLocation}
              </text>
            )}
          </Marker>
        )}

        {/* ── Destination marker ── */}
        {destCoords && (
          <Marker coordinates={destCoords}>
            <circle r={5} fill={DEST_C} stroke="#fff" strokeWidth={1.5} />
            {destination && (
              <text
                y={-10}
                textAnchor="middle"
                fill={DEST_C}
                fontSize={7}
                fontWeight="bold"
                style={{ pointerEvents: "none" }}
              >
                {destination}
              </text>
            )}
          </Marker>
        )}
      </ComposableMap>
      )}

      {/* Legend */}
      <div className={`flex flex-wrap items-center gap-3 px-4 py-2 border-t text-xs ${palette.legendBg}`}>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ORIGIN_C }} />
          Origin
        </span>
        <span className="flex items-center gap-1.5">
          <Ship size={10} style={{ color: CURRENT_C }} />
          <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: CURRENT_C }} />
          Current
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: DEST_C }} />
          Destination
        </span>
      </div>
    </div>
  );
}
