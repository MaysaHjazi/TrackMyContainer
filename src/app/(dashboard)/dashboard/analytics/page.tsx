import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/backend/lib/db";
import { redirect } from "next/navigation";
import { AnalyticsCharts } from "@/frontend/components/dashboard/analytics-charts";
import { AnalyticsGate } from "@/frontend/components/dashboard/analytics-gate";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const plan = user.subscription?.plan ?? "FREE";

  /* Free users see upgrade prompt */
  if (plan === "FREE") {
    return <AnalyticsGate />;
  }

  // ── Shipments by status (groupBy) ─────────────────────────
  const byStatus = await prisma.shipment.groupBy({
    by: ["currentStatus"],
    where: { userId: user.id },
    _count: { _all: true },
  });

  // ── Shipments by carrier (groupBy) ────────────────────────
  const byCarrier = await prisma.shipment.groupBy({
    by: ["carrier"],
    where: { userId: user.id },
    _count: { _all: true },
    orderBy: { _count: { carrier: "desc" } },
    take: 10,
  });

  // ── Shipments by type (groupBy) ───────────────────────────
  const byType = await prisma.shipment.groupBy({
    by: ["type"],
    where: { userId: user.id },
    _count: { _all: true },
  });

  // ── Overview stats ────────────────────────────────────────
  const totalShipments = await prisma.shipment.count({
    where: { userId: user.id },
  });

  const activeShipments = await prisma.shipment.count({
    where: {
      userId: user.id,
      isActive: true,
      currentStatus: { notIn: ["DELIVERED", "EXCEPTION"] },
    },
  });

  const deliveredShipments = await prisma.shipment.count({
    where: { userId: user.id, currentStatus: "DELIVERED" },
  });

  const deliveredWithDates = await prisma.shipment.findMany({
    where: {
      userId: user.id,
      currentStatus: "DELIVERED",
      atdDate: { not: null },
      ataDate: { not: null },
    },
    select: { atdDate: true, ataDate: true },
  });

  let avgDaysToDeliver = 0;
  if (deliveredWithDates.length > 0) {
    const totalDays = deliveredWithDates.reduce((sum, s) => {
      const atd = s.atdDate!.getTime();
      const ata = s.ataDate!.getTime();
      return sum + (ata - atd) / (1000 * 60 * 60 * 24);
    }, 0);
    avgDaysToDeliver = Math.round((totalDays / deliveredWithDates.length) * 10) / 10;
  }

  const statusData = byStatus.map((s) => ({
    status: s.currentStatus,
    count: s._count._all,
  }));

  const carrierData = byCarrier.map((c) => ({
    carrier: c.carrier ?? "Unknown",
    count: c._count._all,
  }));

  const typeData = byType.map((t) => ({
    type: t.type,
    count: t._count._all,
  }));

  const overview = {
    totalShipments,
    activeShipments,
    deliveredShipments,
    avgDaysToDeliver,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h2 className="mb-6 text-2xl font-bold text-navy-900 dark:text-white">
        Analytics
      </h2>
      <AnalyticsCharts
        statusData={statusData}
        carrierData={carrierData}
        typeData={typeData}
        overview={overview}
      />
    </div>
  );
}
