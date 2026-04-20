"use client";

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Ship, Plane, TrendingUp, Package } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────

interface StatusDatum {
  status: string;
  count: number;
}

interface CarrierDatum {
  carrier: string;
  count: number;
}

interface TypeDatum {
  type: string;
  count: number;
}

interface OverviewData {
  totalShipments: number;
  activeShipments: number;
  deliveredShipments: number;
  avgDaysToDeliver: number;
}

interface Props {
  statusData: StatusDatum[];
  carrierData: CarrierDatum[];
  typeData: TypeDatum[];
  overview: OverviewData;
}

// ── Color maps ───────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  UNKNOWN: "#9ca3af",
  BOOKED: "#9ca3af",
  PICKED_UP: "#14b8a6",
  IN_TRANSIT: "#14b8a6",
  TRANSSHIPMENT: "#14b8a6",
  AT_PORT: "#14b8a6",
  CUSTOMS_HOLD: "#f59e0b",
  OUT_FOR_DELIVERY: "#14b8a6",
  DELIVERED: "#22c55e",
  DELAYED: "#f97316",
  EXCEPTION: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  UNKNOWN: "Unknown",
  BOOKED: "Booked",
  PICKED_UP: "Picked Up",
  IN_TRANSIT: "In Transit",
  TRANSSHIPMENT: "Transshipment",
  AT_PORT: "At Port",
  CUSTOMS_HOLD: "Customs Hold",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  DELAYED: "Delayed",
  EXCEPTION: "Exception",
};

const TYPE_COLORS: Record<string, string> = {
  SEA: "#14b8a6",
  AIR: "#f97316",
};

// ── Chart card wrapper ───────────────────────────────────────

function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-navy-200 bg-white p-6 dark:border-navy-800 dark:bg-navy-900",
        className
      )}
    >
      <h3 className="mb-4 text-sm font-semibold text-navy-700 dark:text-navy-300">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Custom tooltip ───────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm shadow-md dark:border-navy-700 dark:bg-navy-900">
      <p className="font-medium text-navy-900 dark:text-white">
        {label ?? payload[0]?.name}
      </p>
      <p className="text-navy-500 dark:text-navy-400">
        {payload[0]?.value} shipment{payload[0]?.value !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────

export function AnalyticsCharts({
  statusData,
  carrierData,
  typeData,
  overview,
}: Props) {
  // Prepare data with labels for pie chart
  const pieData = statusData.map((d) => ({
    name: STATUS_LABELS[d.status] ?? d.status,
    value: d.count,
    color: STATUS_COLORS[d.status] ?? "#9ca3af",
  }));

  const donutData = typeData.map((d) => ({
    name: d.type === "SEA" ? "Sea Freight" : "Air Cargo",
    value: d.count,
    color: TYPE_COLORS[d.type] ?? "#9ca3af",
  }));

  const hasData = statusData.length > 0 || carrierData.length > 0;

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-navy-200
                      bg-white py-16 dark:border-navy-800 dark:bg-navy-900">
        <Package size={48} className="text-navy-300 dark:text-navy-600" />
        <p className="mt-4 text-lg font-semibold text-navy-700 dark:text-navy-300">
          No analytics data yet
        </p>
        <p className="mt-1 text-sm text-navy-400 dark:text-navy-500">
          Start tracking shipments to see analytics here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* 1. Shipments by Status - Pie Chart */}
      <ChartCard title="Shipments by Status">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
                nameKey="name"
                stroke="none"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`status-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value: string) => (
                  <span className="text-xs text-navy-600 dark:text-navy-400">
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* 2. Shipments by Carrier - Horizontal Bar Chart */}
      <ChartCard title="Shipments by Carrier">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={carrierData}
              layout="vertical"
              margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
            >
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis
                dataKey="carrier"
                type="category"
                width={100}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#1e293b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* 3. Shipment Types - Donut Chart */}
      <ChartCard title="Shipment Types">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                dataKey="value"
                nameKey="name"
                stroke="none"
              >
                {donutData.map((entry, index) => (
                  <Cell key={`type-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value: string) => (
                  <span className="text-xs text-navy-600 dark:text-navy-400">
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* 4. Overview Stats */}
      <ChartCard title="Overview">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-navy-50 p-4 dark:bg-navy-800">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-navy-100 dark:bg-navy-700">
              <Package size={18} className="text-navy-600 dark:text-navy-300" />
            </div>
            <p className="text-2xl font-bold text-navy-900 dark:text-white">
              {overview.totalShipments}
            </p>
            <p className="text-xs text-navy-400 dark:text-navy-500">
              Total Shipments
            </p>
          </div>

          <div className="rounded-lg bg-teal-50 p-4 dark:bg-teal-500/10">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-500/20">
              <Ship size={18} className="text-teal-600 dark:text-teal-400" />
            </div>
            <p className="text-2xl font-bold text-navy-900 dark:text-white">
              {overview.activeShipments}
            </p>
            <p className="text-xs text-navy-400 dark:text-navy-500">
              Active
            </p>
          </div>

          <div className="rounded-lg bg-emerald-50 p-4 dark:bg-emerald-500/10">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-500/20">
              <Plane size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-navy-900 dark:text-white">
              {overview.deliveredShipments}
            </p>
            <p className="text-xs text-navy-400 dark:text-navy-500">
              Delivered
            </p>
          </div>

          <div className="rounded-lg bg-orange-50 p-4 dark:bg-orange-500/10">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-500/20">
              <TrendingUp size={18} className="text-orange-500 dark:text-orange-400" />
            </div>
            <p className="text-2xl font-bold text-navy-900 dark:text-white">
              {overview.avgDaysToDeliver || "N/A"}
            </p>
            <p className="text-xs text-navy-400 dark:text-navy-500">
              Avg. Days to Deliver
            </p>
          </div>
        </div>
      </ChartCard>
    </div>
  );
}
