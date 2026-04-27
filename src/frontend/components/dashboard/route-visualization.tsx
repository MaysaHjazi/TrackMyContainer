"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Ship, Plane, Anchor, CheckCircle2, AlertTriangle } from "lucide-react";
import type { ShipmentStatus, ShipmentType } from "@prisma/client";
import { cn } from "@/lib/utils";

/**
 * Cinematic Route Visualization for the shipment detail page.
 *
 * Theming strategy: all palette values live in CSS custom properties on the
 * `.route-viz` root, flipped by `.dark` and per-status via `data-tone`. This
 * keeps the SVG markup theme-agnostic (no hardcoded hex) and lets both light
 * and dark modes use tuned palettes — light stays soft/desaturated, dark
 * keeps the neon glow language.
 *
 * The `<style>` block is injected via `dangerouslySetInnerHTML` at the root
 * of the component (not inside the SVG) to keep SSR hydration stable.
 *
 * Vessel position is deterministic (based on ATD/ETA/ATA dates), but all
 * path-length math runs after mount (DOM API) to avoid hydration mismatch.
 */

interface Props {
  origin:         string | null;
  destination:    string | null;
  type:           ShipmentType;
  currentStatus:  ShipmentStatus;
  atdDate?:       Date | null;
  etdDate?:       Date | null;
  etaDate?:       Date | null;
  ataDate?:       Date | null;
}

// SVG coordinate space — fixed, scales responsively via viewBox.
const VB_W = 800;
const VB_H = 280;

// Wavy route built from 4 cubic beziers (origin → peak → trough → peak → end).
const ROUTE_PATH =
  "M 80 180 " +
  "C 160 180, 160 80,  240 80 " +
  "C 320 80,  320 200, 400 200 " +
  "C 480 200, 480 80,  560 80 " +
  "C 640 80,  640 180, 720 180";

function statusMeta(status: ShipmentStatus): {
  label: string;
  icon:  typeof Ship;
  tone:  "teal" | "orange" | "green" | "red";
} {
  switch (status) {
    case "DELIVERED":
    case "AT_PORT":
    case "OUT_FOR_DELIVERY":
      return { label: "Arrived",       icon: CheckCircle2,  tone: "green"  };
    case "TRANSSHIPMENT":
      return { label: "Transshipment", icon: Anchor,        tone: "teal"   };
    case "DELAYED":
      return { label: "Delayed",       icon: AlertTriangle, tone: "orange" };
    case "EXCEPTION":
    case "CUSTOMS_HOLD":
      return { label: "Hold",          icon: AlertTriangle, tone: "red"    };
    case "IN_TRANSIT":
    default:
      return { label: "In Transit",    icon: Ship,          tone: "teal"   };
  }
}

/** Fraction of journey [0, 1] from departure → ETA. */
function calcProgress(
  status: ShipmentStatus,
  atd:    Date | null | undefined,
  etd:    Date | null | undefined,
  eta:    Date | null | undefined,
  ata:    Date | null | undefined,
): number {
  // Already arrived at destination
  if (ata || status === "DELIVERED") return 1;

  // AT_PORT only means "arrived" if there's also an ata. Without ata,
  // the container is just at some port (intermediate) — keep moving.
  if ((status === "AT_PORT" || status === "OUT_FOR_DELIVERY") && ata) return 1;

  // Prefer actual departure (atd); fall back to estimated (etd) when the
  // provider didn't supply atd but the journey has clearly started (e.g.
  // status is in transit / transshipment).
  const start = atd?.getTime() ?? etd?.getTime();
  if (!start) return 0;
  if (!eta)   return 0.15;

  const now = Date.now();
  if (now <= start) return 0;
  if (now >= eta.getTime()) return 0.92;
  return (now - start) / (eta.getTime() - start);
}

// Styles injected once per component instance. Using dangerouslySetInnerHTML
// bypasses React's child-whitespace normalization that can trip up hydration
// when a <style> sits inside other JSX.
const ROUTE_STYLES = `
.route-viz {
  /* LIGHT MODE — soft, desaturated, readable on white */
  --r-grid:        #E2E8F0;
  --r-dim:         #CBD5E1;
  --r-grad-1:      #67E8F9;
  --r-grad-2:      #60A5FA;
  --r-grad-3:      #FB923C;
  --r-ambient:     radial-gradient(circle at 50% 40%, rgba(6,182,212,0.06), transparent 60%);
  --r-orig-halo:   #0891B2;
  --r-orig-mid:    #0E7490;
  --r-orig-core:   #0891B2;
  --r-dest-halo:   #EA580C;
  --r-dest-mid:    #9A3412;
  --r-dest-core:   #F97316;
  --r-container-a: #F8FAFC;
  --r-container-b: #DBEAFE;
  --r-hull-shadow: rgba(15,23,42,0.18);
  --r-waterline:   rgba(255,255,255,0.75);
  --r-cockpit:     #F8FAFC;
  --r-vapor:       #94A3B8;
}

.dark .route-viz {
  /* DARK MODE — neon glow language */
  --r-grid:        rgba(255,255,255,0.04);
  --r-dim:         rgba(255,255,255,0.20);
  --r-grad-1:      #22D3EE;
  --r-grad-2:      #38BDF8;
  --r-grad-3:      #F5821F;
  --r-ambient:     radial-gradient(circle at 50% 40%, rgba(34,211,238,0.15), transparent 55%);
  --r-orig-halo:   #22D3EE;
  --r-orig-mid:    #0E7490;
  --r-orig-core:   #22D3EE;
  --r-dest-halo:   #F5821F;
  --r-dest-mid:    #B84E0C;
  --r-dest-core:   #F5821F;
  --r-container-a: #FFFFFF;
  --r-container-b: #E0F2FE;
  --r-hull-shadow: rgba(0,0,0,0.50);
  --r-waterline:   rgba(255,255,255,0.5);
  --r-cockpit:     #FFFFFF;
  --r-vapor:       rgba(255,255,255,0.75);
}

/* Per-tone hull color, theme-aware */
.route-viz[data-tone="teal"]          { --r-vessel: #0E7490; }
.route-viz[data-tone="orange"]        { --r-vessel: #C2410C; }
.route-viz[data-tone="green"]         { --r-vessel: #15803D; }
.route-viz[data-tone="red"]           { --r-vessel: #B91C1C; }
.dark .route-viz[data-tone="teal"]    { --r-vessel: #22D3EE; }
.dark .route-viz[data-tone="orange"]  { --r-vessel: #F5821F; }
.dark .route-viz[data-tone="green"]   { --r-vessel: #22C55E; }
.dark .route-viz[data-tone="red"]     { --r-vessel: #EF4444; }

@keyframes tmcVesselFadeIn { to { opacity: 1; } }
@keyframes tmcBob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-1.6px); }
}
@keyframes tmcHover {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50%      { transform: translateY(-1.2px) rotate(-0.4deg); }
}
.tmc-vessel-bob   { animation: tmcBob   3.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
.tmc-vessel-hover { animation: tmcHover 2.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }

@media (prefers-reduced-motion: reduce) {
  .tmc-vessel-bob, .tmc-vessel-hover { animation: none; }
}
`;

export function RouteVisualization({
  origin, destination, type, currentStatus,
  atdDate, etdDate, etaDate, ataDate,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const pathRef = useRef<SVGPathElement>(null);
  const [vessel, setVessel] = useState<{ x: number; y: number; rot: number; traveled: number; total: number } | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Stable primitive keys so the effect doesn't re-run on every parent render.
  const atdKey = atdDate ? atdDate.getTime() : null;
  const etdKey = etdDate ? etdDate.getTime() : null;
  const etaKey = etaDate ? etaDate.getTime() : null;
  const ataKey = ataDate ? ataDate.getTime() : null;

  useEffect(() => {
    if (!mounted || !pathRef.current) return;
    const progress = calcProgress(currentStatus, atdDate, etdDate, etaDate, ataDate);
    const path = pathRef.current;
    const total = path.getTotalLength();
    const traveled = total * progress;
    const p = path.getPointAtLength(traveled);
    const pAhead = path.getPointAtLength(Math.min(traveled + 2, total));
    const rot = Math.atan2(pAhead.y - p.y, pAhead.x - p.x) * (180 / Math.PI);
    setVessel({ x: p.x, y: p.y, rot, traveled, total });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, currentStatus, atdKey, etdKey, etaKey, ataKey]);

  const meta = statusMeta(currentStatus);
  const StatusIcon = meta.icon;
  const isAir = type === "AIR";

  return (
    <>
      {/* Component-scoped styles (injected once; safe for SSR) */}
      <style dangerouslySetInnerHTML={{ __html: ROUTE_STYLES }} />

      <div
        className="route-viz relative rounded-2xl overflow-hidden border
                   border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50/40
                   dark:border-navy-800 dark:from-[#060A1C] dark:via-[#060A1C] dark:to-[#060A1C]
                   shadow-sm"
        data-tone={meta.tone}
      >
        {/* Ambient glow backdrop (very faint in light, richer in dark) */}
        <div className="pointer-events-none absolute inset-0"
             style={{ backgroundImage: "var(--r-ambient)" }} />

        {/* Section header */}
        <div className="relative flex items-center justify-between px-6 pt-5 pb-1">
          <span className="text-xs font-bold uppercase tracking-[0.22em]
                           text-teal-600 dark:text-teal-400">
            Route
          </span>
        </div>

        {/* SVG stage */}
        <div className="relative w-full px-4 pb-4" style={{ aspectRatio: `${VB_W} / ${VB_H}` }}>
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Brand gradient — values pulled from CSS vars (theme-aware) */}
              <linearGradient id="travelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="var(--r-grad-1)" />
                <stop offset="55%"  stopColor="var(--r-grad-2)" />
                <stop offset="100%" stopColor="var(--r-grad-3)" />
              </linearGradient>

              {/* Grid pattern for the backdrop */}
              <pattern id="routeGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none"
                      stroke="var(--r-grid)" strokeWidth="1" />
              </pattern>

              {/* Soft bloom for the path halo */}
              <filter id="pathBloom" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Tighter bloom for the vessel sprite */}
              <filter id="vesselBloom" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Grid */}
            <rect width={VB_W} height={VB_H} fill="url(#routeGrid)" />

            {/* Full dim path (always visible under the bright overlay) */}
            <path d={ROUTE_PATH}
                  stroke="var(--r-dim)"
                  strokeWidth="2"
                  strokeDasharray="6 8"
                  strokeLinecap="round"
                  fill="none" />

            {/* Hidden reference path for point/tangent queries */}
            <path ref={pathRef} d={ROUTE_PATH} fill="none" stroke="none" />

            {/* Bright traveled leg, clipped to vessel position (animates on mount) */}
            {vessel && vessel.total > 0 && (
              <>
                <defs>
                  <clipPath id="traveledClip">
                    <rect x="0" y="0" height={VB_H} width={vessel.x}>
                      <animate attributeName="width"
                               from="0" to={vessel.x}
                               dur="1.4s"
                               fill="freeze"
                               calcMode="spline"
                               keySplines="0.4 0 0.2 1" />
                    </rect>
                  </clipPath>
                </defs>

                <g clipPath="url(#traveledClip)">
                  <path d={ROUTE_PATH}
                        stroke="url(#travelGrad)"
                        strokeWidth="10"
                        strokeDasharray="6 8"
                        strokeLinecap="round"
                        fill="none"
                        opacity="0.28"
                        filter="url(#pathBloom)" />
                  <path d={ROUTE_PATH}
                        stroke="url(#travelGrad)"
                        strokeWidth="2.5"
                        strokeDasharray="6 8"
                        strokeLinecap="round"
                        fill="none" />
                </g>
              </>
            )}

            {/* ── Origin marker ── */}
            <g transform="translate(80, 180)">
              <circle r="18" fill="var(--r-orig-halo)" opacity="0.18">
                <animate attributeName="r"       from="14" to="24" dur="2.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.30" to="0" dur="2.2s" repeatCount="indefinite" />
              </circle>
              <circle r="10" fill="var(--r-orig-mid)" />
              <circle r="5"  fill="var(--r-orig-core)" />
            </g>

            {/* ── Destination marker ── */}
            <g transform="translate(720, 180)">
              <circle r="18" fill="var(--r-dest-halo)" opacity="0.18">
                <animate attributeName="r"       from="14" to="24" dur="2.2s" repeatCount="indefinite" begin="1.1s" />
                <animate attributeName="opacity" from="0.30" to="0" dur="2.2s" repeatCount="indefinite" begin="1.1s" />
              </circle>
              <circle r="10" fill="var(--r-dest-mid)" />
              <circle r="5"  fill="var(--r-dest-core)" />
            </g>

            {/* ── Stationary vessel at real progress position ── */}
            {vessel && (
              <g transform={`translate(${vessel.x}, ${vessel.y}) rotate(${vessel.rot})`}
                 filter="url(#vesselBloom)"
                 style={{ opacity: 0, animation: "tmcVesselFadeIn 0.6s 1.4s forwards" }}>
                {/* Live halo */}
                <circle r="14" fill="var(--r-vessel)" opacity="0.2">
                  <animate attributeName="r"       from="12"  to="22"  dur="2.0s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.4" to="0"   dur="2.0s" repeatCount="indefinite" />
                </circle>

                {!isAir && (
                  <>
                    {/* Water ripples under the hull */}
                    <ellipse cx="0" cy="10" rx="16" ry="2.5" fill="var(--r-vessel)" opacity="0.3">
                      <animate attributeName="rx"      from="10"  to="26"  dur="2.6s" repeatCount="indefinite" />
                      <animate attributeName="ry"      from="1.6" to="3.6" dur="2.6s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.45" to="0"  dur="2.6s" repeatCount="indefinite" />
                    </ellipse>
                    <ellipse cx="0" cy="10" rx="14" ry="2" fill="var(--r-waterline)" opacity="0.25">
                      <animate attributeName="rx"      from="8"   to="22"  dur="2.6s" repeatCount="indefinite" begin="1.3s" />
                      <animate attributeName="ry"      from="1.2" to="3"   dur="2.6s" repeatCount="indefinite" begin="1.3s" />
                      <animate attributeName="opacity" from="0.35" to="0"  dur="2.6s" repeatCount="indefinite" begin="1.3s" />
                    </ellipse>
                  </>
                )}

                {/* Bobbing / hovering inner art */}
                <g className={isAir ? "tmc-vessel-hover" : "tmc-vessel-bob"}>
                  {isAir ? (
                    <g>
                      {/* Vapor trails — flicker behind the plane */}
                      <line x1="-14" y1="-2" x2="-26" y2="-2"
                            stroke="var(--r-vapor)" strokeWidth="1.4" strokeLinecap="round" opacity="0.55">
                        <animate attributeName="opacity" values="0.1;0.6;0.1" dur="1.2s" repeatCount="indefinite" />
                        <animate attributeName="x2"      values="-22;-30;-22" dur="1.2s" repeatCount="indefinite" />
                      </line>
                      <line x1="-14" y1="2" x2="-26" y2="2"
                            stroke="var(--r-vapor)" strokeWidth="1.4" strokeLinecap="round" opacity="0.55">
                        <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.2s" repeatCount="indefinite" />
                        <animate attributeName="x2"      values="-30;-22;-30" dur="1.2s" repeatCount="indefinite" />
                      </line>

                      {/* Tail fin */}
                      <path d="M -14 -6 L -10 -6 L -6 0 L -10 0 Z"
                            fill="var(--r-vessel)" opacity="0.95" />
                      {/* Swept wings */}
                      <path d="M -2 -1 L 8 -10 L 12 -10 L 4 -1 Z"
                            fill="var(--r-vessel)" opacity="0.95" />
                      <path d="M -2 1 L 8 10 L 12 10 L 4 1 Z"
                            fill="var(--r-vessel)" opacity="0.95" />
                      {/* Fuselage */}
                      <path d="M -14 -2 L 14 -2 Q 18 0, 14 2 L -14 2 Z"
                            fill="var(--r-vessel)" opacity="0.98" />
                      {/* Cockpit windows */}
                      <rect x="6" y="-1" width="6" height="2" rx="0.8" fill="var(--r-cockpit)" opacity="0.85" />
                      <rect x="-8" y="-0.5" width="10" height="1" rx="0.4" fill="var(--r-cockpit)" opacity="0.5" />
                    </g>
                  ) : (
                    <g>
                      {/* Shadow under hull */}
                      <ellipse cx="0" cy="9" rx="20" ry="1.5" fill="var(--r-hull-shadow)" />

                      {/* Hull with angled bow */}
                      <path d="M -18 2 L 14 2 Q 20 2, 20 6 L 18 8 L -15 8 Q -18 8, -18 5 Z"
                            fill="var(--r-vessel)" opacity="0.98" />

                      {/* Waterline stripe */}
                      <rect x="-18" y="6.2" width="36" height="0.6" fill="var(--r-waterline)" />

                      {/* Container stacks */}
                      <rect x="-14" y="-4" width="6" height="6" fill="var(--r-container-a)" opacity="0.95" />
                      <rect x="-7"  y="-7" width="6" height="9" fill="var(--r-container-b)" opacity="0.95" />
                      <rect x="0"   y="-5" width="6" height="7" fill="var(--r-container-a)" opacity="0.95" />
                      <rect x="7"   y="-3" width="5" height="5" fill="var(--r-container-b)" opacity="0.95" />

                      {/* Container dividers */}
                      <line x1="-11" y1="-4" x2="-11" y2="2" stroke="var(--r-vessel)" strokeWidth="0.4" opacity="0.5" />
                      <line x1="-4"  y1="-7" x2="-4"  y2="2" stroke="var(--r-vessel)" strokeWidth="0.4" opacity="0.5" />
                      <line x1="3"   y1="-5" x2="3"   y2="2" stroke="var(--r-vessel)" strokeWidth="0.4" opacity="0.5" />

                      {/* Bridge at stern */}
                      <rect x="-17"   y="-5"   width="3" height="7" fill="var(--r-vessel)" opacity="0.95" />
                      <rect x="-16.5" y="-3.5" width="2" height="1" fill="var(--r-container-a)" opacity="0.8" />

                      {/* Chimney + smoke puffs */}
                      <rect x="13" y="-6" width="1.6" height="4" fill="var(--r-vessel)" opacity="0.95" />
                      <circle cx="13.8" cy="-8" r="1.4" fill="var(--r-vapor)" opacity="0">
                        <animate attributeName="cy"      values="-7;-13;-13" dur="2.4s" repeatCount="indefinite" />
                        <animate attributeName="r"       values="0.8;2.2;2.4" dur="2.4s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0;0.5;0"    dur="2.4s" repeatCount="indefinite" />
                      </circle>
                      <circle cx="13.8" cy="-8" r="1.4" fill="var(--r-vapor)" opacity="0">
                        <animate attributeName="cy"      values="-7;-13;-13" dur="2.4s" repeatCount="indefinite" begin="1.2s" />
                        <animate attributeName="r"       values="0.8;2.2;2.4" dur="2.4s" repeatCount="indefinite" begin="1.2s" />
                        <animate attributeName="opacity" values="0;0.4;0"    dur="2.4s" repeatCount="indefinite" begin="1.2s" />
                      </circle>
                    </g>
                  )}
                </g>
              </g>
            )}
          </svg>

          {/* Floating status chip */}
          <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2">
            <div className={cn(
              "flex items-center gap-2 rounded-full px-4 py-1.5",
              "text-xs font-bold uppercase tracking-wider",
              "backdrop-blur-md border shadow-lg",
              meta.tone === "teal"   && "bg-teal-500/15   border-teal-400/40   text-teal-700   dark:text-teal-300",
              meta.tone === "orange" && "bg-orange-500/15 border-orange-400/40 text-orange-700 dark:text-orange-300",
              meta.tone === "green"  && "bg-green-500/15  border-green-400/40  text-green-700  dark:text-green-300",
              meta.tone === "red"    && "bg-red-500/15    border-red-400/40    text-red-700    dark:text-red-300",
            )}>
              <StatusIcon size={14} className="flex-shrink-0" />
              {meta.label}
            </div>
          </div>

          {/* Origin label */}
          <div className="pointer-events-none absolute bottom-4 left-6 sm:left-10">
            <div className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
              <MapPin size={12} />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">
                Origin
              </span>
            </div>
            <p className="mt-0.5 text-base sm:text-lg font-extrabold text-navy-900 dark:text-white">
              {origin ?? "—"}
            </p>
          </div>

          {/* Destination label */}
          <div className="pointer-events-none absolute bottom-4 right-6 sm:right-10 text-right">
            <div className="flex items-center justify-end gap-1.5 text-orange-600 dark:text-orange-400">
              <MapPin size={12} />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">
                Destination
              </span>
            </div>
            <p className="mt-0.5 text-base sm:text-lg font-extrabold text-navy-900 dark:text-white">
              {destination ?? "—"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
