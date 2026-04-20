"use client";

import { ComposableMap, Geographies, Geography, Marker, Line } from "react-simple-maps";
import { MapPin, Navigation } from "lucide-react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Common port/airport coordinates
const LOCATION_COORDS: Record<string, [number, number]> = {
  "shanghai": [121.47, 31.23], "rotterdam": [4.48, 51.92], "singapore": [103.85, 1.29],
  "dubai": [55.27, 25.2], "london": [-0.12, 51.51], "new york": [-74.0, 40.71],
  "los angeles": [-118.24, 33.94], "busan": [129.04, 35.18], "hong kong": [114.17, 22.32],
  "jeddah": [39.17, 21.54], "sydney": [151.21, -33.87], "doha": [51.53, 25.29],
  "frankfurt": [8.68, 50.11], "istanbul": [28.98, 41.01], "mumbai": [72.88, 19.08],
  "santos": [-46.33, -23.96], "shenzhen": [114.06, 22.54], "lagos": [3.39, 6.45],
  "tokyo": [139.69, 35.69], "hamburg": [9.99, 53.55],
};

function findCoords(location: string | undefined | null): [number, number] | null {
  if (!location) return null;
  const lower = location.toLowerCase();
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (lower.includes(key)) return coords;
  }
  return null;
}

interface Props {
  origin?: string | null;
  destination?: string | null;
  currentLocation?: string | null;
}

export function RouteMap({ origin, destination, currentLocation }: Props) {
  const originCoords = findCoords(origin);
  const destCoords = findCoords(destination);
  const currentCoords = findCoords(currentLocation);

  const hasData = originCoords || destCoords;

  if (!hasData) {
    return (
      <div className="rounded-xl border border-navy-200 bg-navy-50 dark:border-navy-700 dark:bg-navy-800 p-6 text-center">
        <MapPin size={24} className="mx-auto text-navy-300 dark:text-navy-600 mb-2" />
        <p className="text-sm text-navy-400 dark:text-navy-500">Route map unavailable</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-navy-200 dark:border-navy-700 overflow-hidden bg-navy-900">
      <div className="px-4 py-2 border-b border-navy-700 flex items-center gap-2">
        <Navigation size={14} className="text-teal-400" />
        <span className="text-xs font-semibold text-navy-300">Route Map</span>
      </div>
      <ComposableMap
        projectionConfig={{ scale: 140, center: [30, 20] }}
        width={500}
        height={280}
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#1e3a5f"
                stroke="#2a4d7a"
                strokeWidth={0.3}
              />
            ))
          }
        </Geographies>

        {/* Route line */}
        {originCoords && destCoords && (
          <Line
            from={originCoords}
            to={destCoords}
            stroke="#F5821F"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            strokeLinecap="round"
          />
        )}

        {/* Origin marker */}
        {originCoords && (
          <Marker coordinates={originCoords}>
            <circle r={5} fill="#00B4C4" stroke="#fff" strokeWidth={1.5} />
            <text y={-10} textAnchor="middle" fill="#00B4C4" fontSize={7} fontWeight="bold">
              Origin
            </text>
          </Marker>
        )}

        {/* Current location marker (pulsing) */}
        {currentCoords && (
          <Marker coordinates={currentCoords}>
            <circle r={7} fill="#F5821F" opacity={0.3}>
              <animate attributeName="r" from="5" to="12" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <circle r={4} fill="#F5821F" stroke="#fff" strokeWidth={1.5} />
          </Marker>
        )}

        {/* Destination marker */}
        {destCoords && (
          <Marker coordinates={destCoords}>
            <circle r={5} fill="#22c55e" stroke="#fff" strokeWidth={1.5} />
            <text y={-10} textAnchor="middle" fill="#22c55e" fontSize={7} fontWeight="bold">
              Dest
            </text>
          </Marker>
        )}
      </ComposableMap>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-navy-700 text-xs text-navy-400">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-teal-500" /> Origin</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" /> Current</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> Destination</span>
      </div>
    </div>
  );
}
