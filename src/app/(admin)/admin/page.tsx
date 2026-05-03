// Always render fresh — KPI cards (especially shipsgo credits, JSONCargo
// live quota, errors-24h) must reflect the moment the admin loads the
// page. Without this Next.js caches the RSC output and "shipsgo credits"
// shows yesterday's count even after a new shipment was just created.
export const dynamic = "force-dynamic";

import { Users, Ship, CreditCard, Activity, AlertTriangle, DollarSign, MailQuestion, Database } from "lucide-react";
import {
  getUserCounts,
  getShipmentCounts,
  getShipsgoCredits,
  getApiCallsToday,
  getErrorCount24h,
  getMrrCents,
  getRecentActivity,
  getApiCallsByDay,
  getPendingContactRequests,
  getJsonCargoUsage,
} from "@/lib/admin-stats";
import { KpiCard }       from "@/frontend/components/admin/kpi-card";
import { ActivityFeed }  from "@/frontend/components/admin/activity-feed";
import { ApiCallsChart } from "@/frontend/components/admin/api-calls-chart";
import { formatPrice, formatDate } from "@/lib/utils";

export const metadata = { title: "Admin · Overview" };

export default async function AdminOverviewPage() {
  const [users, shipments, credits, apiToday, errors24h, mrr, recent, chartData, pending, jsonCargo] =
    await Promise.all([
      getUserCounts(),
      getShipmentCounts(),
      getShipsgoCredits(),
      getApiCallsToday(),
      getErrorCount24h(),
      getMrrCents(),
      getRecentActivity(),
      getApiCallsByDay(),
      getPendingContactRequests(),
      getJsonCargoUsage(),
    ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-navy-900 dark:text-white">Overview</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          Live snapshot of the service. Updates every minute.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          icon={Users}
          label="Users"
          primary={String(users.total)}
          secondary={`${users.pro} PRO · ${users.free} FREE${users.custom ? ` · ${users.custom} CUSTOM` : ""}`}
          tone="navy"
        />
        <KpiCard
          icon={Ship}
          label="Shipments"
          primary={String(shipments.total)}
          secondary={`${shipments.active} active`}
          tone="teal"
        />
        <KpiCard
          icon={CreditCard}
          label="ShipsGo credits"
          primary={`${credits.used} / ${credits.total}`}
          secondary={`${credits.remaining} remaining${credits.live ? " · live" : ""}`}
          tone="orange"
        />
        <KpiCard
          icon={Activity}
          label="API calls today"
          primary={String(apiToday.total)}
          secondary={`${Math.round(apiToday.cacheHitRate * 100)}% cache hit`}
          tone="navy"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Errors 24h"
          primary={String(errors24h)}
          secondary={errors24h === 0 ? "all clear" : "attention needed"}
          tone={errors24h === 0 ? "green" : "red"}
        />
        <KpiCard
          icon={DollarSign}
          label="MRR"
          primary={formatPrice(mrr)}
          secondary={`${users.pro} active PRO subs`}
          tone="green"
        />
        <KpiCard
          icon={Database}
          label="JSONCargo this month"
          primary={
            jsonCargo.quota !== null
              ? `${jsonCargo.consumed} / ${jsonCargo.quota}`
              : String(jsonCargo.consumed)
          }
          secondary={
            jsonCargo.quota !== null
              ? `${jsonCargo.remaining} remaining · ${Math.round(jsonCargo.cacheHitRate * 100)}% cache${jsonCargo.live ? " · live" : ""}`
              : `${jsonCargo.today} today · ${Math.round(jsonCargo.cacheHitRate * 100)}% cache · ${jsonCargo.total} all-time`
          }
          tone="teal"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><ApiCallsChart data={chartData} /></div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-navy-200 dark:bg-navy-900 dark:ring-navy-800">
          <h3 className="text-sm font-bold text-navy-900 dark:text-white mb-3">Recent activity</h3>
          <ActivityFeed items={recent.map((r) => ({
            id:        r.id,
            type:      r.type,
            level:     r.level,
            message:   r.message,
            createdAt: r.createdAt,
            user:      r.user,
          }))} />
        </div>
      </div>

      {pending.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-navy-200 dark:bg-navy-900 dark:ring-navy-800">
          <div className="flex items-center gap-2 mb-3">
            <MailQuestion size={16} className="text-orange-500" />
            <h3 className="text-sm font-bold text-navy-900 dark:text-white">
              Pending contact requests ({pending.length})
            </h3>
          </div>
          <ul className="divide-y divide-navy-100 dark:divide-navy-800">
            {pending.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-navy-900 dark:text-white">
                    {r.name} <span className="text-navy-400 font-normal">· {r.containersCount} containers/mo</span>
                  </p>
                  <p className="text-xs text-navy-500 dark:text-navy-400">
                    {r.email} · {formatDate(r.createdAt)}
                  </p>
                </div>
                <a
                  href={`mailto:${r.email}`}
                  className="text-xs font-bold text-orange-500 hover:text-orange-600"
                >
                  Reply →
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
