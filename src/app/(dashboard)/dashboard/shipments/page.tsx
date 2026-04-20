export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/backend/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { ShipmentsTable } from "@/frontend/components/dashboard/shipments-table";
import { AddShipmentDialog } from "@/frontend/components/dashboard/add-shipment-dialog";

export const metadata = {
  title: "Shipments — TrackMyContainer",
};

// Is any real tracking API configured?
const isLiveData =
  !!process.env.JSONCARGO_API_KEY ||
  !!process.env.LUFTHANSA_CARGO_API_KEY ||
  !!(process.env.QATAR_CARGO_CLIENT_ID && process.env.QATAR_CARGO_CLIENT_SECRET) ||
  !!process.env.CARGOAI_API_KEY;

export default async function ShipmentsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Include arrived shipments (isActive=false) — the flag is used to pause
  // polling, not to hide them from the user. Delete uses a hard delete.
  const shipments = await prisma.shipment.findMany({
    where: { userId: user.id },
    orderBy: [{ isFavorite: "desc" }, { createdAt: "desc" }],
    include: {
      trackingEvents: {
        orderBy: { eventDate: "desc" },
        take: 1,
      },
    },
  });

  // Serialize dates for client components
  const serialized = shipments.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    etaDate: s.etaDate?.toISOString() ?? null,
    etdDate: s.etdDate?.toISOString() ?? null,
    atdDate: s.atdDate?.toISOString() ?? null,
    ataDate: s.ataDate?.toISOString() ?? null,
    lastPolledAt: s.lastPolledAt?.toISOString() ?? null,
    trackingEvents: s.trackingEvents.map((e) => ({
      ...e,
      eventDate: e.eventDate.toISOString(),
      createdAt: e.createdAt.toISOString(),
    })),
  }));

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-navy-200 dark:border-navy-800 px-6 py-5">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-extrabold text-navy-900 dark:text-white">
              Shipments
            </h2>
            {isLiveData ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-2.5 py-1 text-[11px] font-bold text-green-600 dark:text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                LIVE DATA
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 px-2.5 py-1 text-[11px] font-bold text-orange-600 dark:text-orange-400"
                title="No API keys configured — showing realistic demo data. Add SHIPSGO_API_KEY to switch to live tracking.">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                DEMO DATA
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-navy-400 dark:text-navy-300">
            {shipments.length} tracked shipment{shipments.length !== 1 ? "s" : ""}
          </p>
        </div>
        <AddShipmentDialog />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-6">
        <ShipmentsTable shipments={serialized} />
      </div>
    </div>
  );
}
