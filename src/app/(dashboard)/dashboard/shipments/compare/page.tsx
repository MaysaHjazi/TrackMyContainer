import { prisma } from "@/backend/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Ship, Plane, MapPin, ArrowRight, Calendar } from "lucide-react";
import { getStatusLabel, getStatusColor, formatDate, daysUntil } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Props {
  searchParams: Promise<{ a?: string; b?: string }>;
}

export default async function CompareShipmentsPage({ searchParams }: Props) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const { a, b } = await searchParams;

  if (!a || !b) {
    return (
      <div className="p-6">
        <Link href="/dashboard/shipments" className="text-sm text-navy-400 hover:text-orange-500 flex items-center gap-1 mb-4">
          <ArrowLeft size={14} /> Back to Shipments
        </Link>
        <div className="text-center py-16">
          <h2 className="text-lg font-bold text-navy-900 dark:text-white">Compare Shipments</h2>
          <p className="text-sm text-navy-400 dark:text-navy-500 mt-2">Select two shipments from the shipments page to compare them side by side.</p>
        </div>
      </div>
    );
  }

  const [shipmentA, shipmentB] = await Promise.all([
    prisma.shipment.findFirst({
      where: { id: a, userId: user.id },
      include: { trackingEvents: { orderBy: { eventDate: "desc" } } },
    }),
    prisma.shipment.findFirst({
      where: { id: b, userId: user.id },
      include: { trackingEvents: { orderBy: { eventDate: "desc" } } },
    }),
  ]);

  if (!shipmentA || !shipmentB) {
    return (
      <div className="p-6 text-center py-16">
        <p className="text-navy-400">One or both shipments not found.</p>
      </div>
    );
  }

  const shipments = [shipmentA, shipmentB];

  const rows = [
    { label: "Tracking #", render: (s: typeof shipmentA) => s.trackingNumber },
    { label: "Type", render: (s: typeof shipmentA) => s.type === "SEA" ? "Sea Freight" : "Air Cargo" },
    { label: "Carrier", render: (s: typeof shipmentA) => s.carrier || "—" },
    { label: "Status", render: (s: typeof shipmentA) => getStatusLabel(s.currentStatus), badge: true },
    { label: "Origin", render: (s: typeof shipmentA) => s.origin || "—" },
    { label: "Destination", render: (s: typeof shipmentA) => s.destination || "—" },
    { label: "ETD", render: (s: typeof shipmentA) => s.etdDate ? formatDate(s.etdDate) : "—" },
    { label: "ETA", render: (s: typeof shipmentA) => s.etaDate ? formatDate(s.etaDate) : "—" },
    { label: "ETA Countdown", render: (s: typeof shipmentA) => s.etaDate ? `${daysUntil(s.etaDate)} days` : "—" },
    { label: "Vessel / Flight", render: (s: typeof shipmentA) => s.vesselName || s.flightNumber || "—" },
    { label: "Events Count", render: (s: typeof shipmentA) => String(s.trackingEvents.length) },
    { label: "Last Updated", render: (s: typeof shipmentA) => s.lastPolledAt ? formatDate(s.lastPolledAt, "MMM d, HH:mm") : "—" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/dashboard/shipments" className="text-sm text-navy-400 hover:text-orange-500 flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> Back to Shipments
      </Link>

      <h1 className="text-xl font-bold text-navy-900 dark:text-white mb-6">Compare Shipments</h1>

      <div className="rounded-xl border border-navy-200 bg-white dark:border-navy-700 dark:bg-navy-900 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-navy-200 dark:border-navy-700">
              <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-navy-400 w-1/4">Attribute</th>
              <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-navy-400 w-[37.5%]">
                <div className="flex items-center gap-2">
                  {shipmentA.type === "SEA" ? <Ship size={14} className="text-teal-500" /> : <Plane size={14} className="text-orange-500" />}
                  <span className="font-mono">{shipmentA.trackingNumber}</span>
                </div>
              </th>
              <th className="py-3 px-4 text-left text-xs font-semibold uppercase text-navy-400 w-[37.5%]">
                <div className="flex items-center gap-2">
                  {shipmentB.type === "SEA" ? <Ship size={14} className="text-teal-500" /> : <Plane size={14} className="text-orange-500" />}
                  <span className="font-mono">{shipmentB.trackingNumber}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100 dark:divide-navy-800">
            {rows.map(({ label, render, badge }) => {
              const valA = render(shipmentA);
              const valB = render(shipmentB);
              const diff = valA !== valB;

              return (
                <tr key={label} className="hover:bg-navy-50 dark:hover:bg-navy-800/50">
                  <td className="py-2.5 px-4 text-xs font-semibold text-navy-400 dark:text-navy-500">{label}</td>
                  <td className={cn("py-2.5 px-4 text-sm text-navy-900 dark:text-white", diff && "font-semibold")}>
                    {badge ? (
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", getStatusColor(shipmentA.currentStatus))}>
                        {valA}
                      </span>
                    ) : valA}
                  </td>
                  <td className={cn("py-2.5 px-4 text-sm text-navy-900 dark:text-white", diff && "font-semibold")}>
                    {badge ? (
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", getStatusColor(shipmentB.currentStatus))}>
                        {valB}
                      </span>
                    ) : valB}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
