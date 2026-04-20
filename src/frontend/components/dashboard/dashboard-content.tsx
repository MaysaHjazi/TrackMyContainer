"use client";

import dynamic from "next/dynamic";
import { ShipmentStatusPanel } from "@/frontend/components/dashboard/shipment-status-panel";
import { StatsCards } from "@/frontend/components/dashboard/stats-cards";
import { UpgradeOverlay } from "@/frontend/components/dashboard/upgrade-overlay";
import type { ShipmentStatus, ShipmentType } from "@prisma/client";

// Load the map ONLY on the client — react-simple-maps generates floating-point
// SVG paths that differ between SSR and CSR, causing hydration mismatches.
const WorldMapPanel = dynamic(
  () => import("@/frontend/components/dashboard/world-map-panel").then((m) => m.WorldMapPanel),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-navy-950 animate-pulse" /> },
);

interface ShipmentData {
  id: string;
  trackingNumber: string;
  type: ShipmentType;
  carrier?: string;
  currentStatus: ShipmentStatus;
  origin?: string;
  destination?: string;
  currentLocation?: string;
  etaDate?: string | null;
  lat: number;
  lng: number;
}

interface Props {
  shipments: ShipmentData[];
  /** Resolved SERVER-SIDE — true when plan is PRO or BUSINESS */
  isPro: boolean;
}

export function DashboardContent({ shipments, isPro }: Props) {
  return (
    <div className="flex h-full max-h-full overflow-hidden">
      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <StatsCards shipments={shipments} />
        <div className="flex-1 min-h-0 relative">
          <div className="absolute inset-0">
            {isPro ? (
              <WorldMapPanel shipments={shipments} />
            ) : (
              <UpgradeOverlay
                feature="Live World Map"
                description="Track all your shipments on an interactive global map with real-time positions, trade routes, and port markers."
              >
                <WorldMapPanel shipments={shipments} />
              </UpgradeOverlay>
            )}
          </div>
        </div>
      </div>

      {/* ── Shipment Status Panel ── */}
      <ShipmentStatusPanel shipments={shipments} />
    </div>
  );
}
