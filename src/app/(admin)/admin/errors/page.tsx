import Link from "next/link";
import { prisma } from "@/backend/lib/db";
import { cn, relativeDate } from "@/lib/utils";

// Always render fresh so brand-new errors appear without a manual refresh
// loop or container restart.
export const dynamic = "force-dynamic";

export const metadata = { title: "Admin · Errors" };

interface SearchParams {
  category?: string;
  range?:    string;
}

const CATEGORY_PREFIX: Record<string, string> = {
  tracking:      "tracking.",
  notifications: "notification.",
  webhooks:      "billing.",
  auth:          "auth.",
};

const RANGE_HOURS: Record<string, number> = {
  "24h": 24,
  "7d":  24 * 7,
  "30d": 24 * 30,
};

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { category, range } = await searchParams;
  const hours = RANGE_HOURS[range ?? "24h"] ?? 24;
  const since = new Date(Date.now() - hours * 3600 * 1000);

  const where: import("@prisma/client").Prisma.AuditLogWhereInput = {
    level:     { in: ["warning", "error"] },
    createdAt: { gte: since },
  };
  if (category && CATEGORY_PREFIX[category]) {
    where.type = { startsWith: CATEGORY_PREFIX[category] };
  }

  const items = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take:    200,
    include: { user: { select: { email: true } } },
  });

  const categories = [
    { key: "all",           label: "All" },
    { key: "tracking",      label: "Tracking" },
    { key: "notifications", label: "Notifications" },
    { key: "webhooks",      label: "Webhooks" },
    { key: "auth",          label: "Auth" },
  ];

  const ranges = [
    { key: "24h", label: "24h" },
    { key: "7d",  label: "7d" },
    { key: "30d", label: "30d" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-navy-900 dark:text-white">Errors</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          {items.length} entr{items.length === 1 ? "y" : "ies"} in the last {range ?? "24h"}.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-navy-500 dark:text-navy-400 mr-1">
          Category
        </span>
        {categories.map((c) => {
          const active = (category ?? "all") === c.key;
          const href = c.key === "all"
            ? `?range=${range ?? "24h"}`
            : `?category=${c.key}&range=${range ?? "24h"}`;
          return (
            <Link key={c.key} href={href} className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold border transition-colors",
              active
                ? "border-orange-500 bg-orange-500 text-white"
                : "border-navy-200 text-navy-700 hover:border-navy-300 dark:border-navy-700 dark:text-navy-300 dark:hover:border-navy-600",
            )}>
              {c.label}
            </Link>
          );
        })}

        <span className="text-xs font-bold uppercase tracking-wider text-navy-500 dark:text-navy-400 ml-4 mr-1">
          Range
        </span>
        {ranges.map((r) => {
          const active = (range ?? "24h") === r.key;
          const href = category
            ? `?category=${category}&range=${r.key}`
            : `?range=${r.key}`;
          return (
            <Link key={r.key} href={href} className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold border transition-colors",
              active
                ? "border-orange-500 bg-orange-500 text-white"
                : "border-navy-200 text-navy-700 hover:border-navy-300 dark:border-navy-700 dark:text-navy-300 dark:hover:border-navy-600",
            )}>
              {r.label}
            </Link>
          );
        })}
      </div>

      <div className="rounded-2xl ring-1 ring-navy-200 dark:ring-navy-800 divide-y divide-navy-100 dark:divide-navy-800 bg-white dark:bg-navy-900 overflow-hidden">
        {items.map((item) => (
          <details key={item.id} className="group">
            <summary className="flex items-start gap-3 px-4 py-3 cursor-pointer list-none hover:bg-navy-50 dark:hover:bg-navy-800/40">
              <span className={cn(
                "mt-0.5 h-2 w-2 rounded-full flex-shrink-0",
                item.level === "error"   ? "bg-red-500" : "bg-orange-400",
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-navy-900 dark:text-white">
                  <span className="font-mono text-xs text-navy-500 dark:text-navy-400 mr-1.5">
                    {item.type}
                  </span>
                  {item.message}
                </p>
                <p className="mt-0.5 text-xs text-navy-400 dark:text-navy-500">
                  {item.user?.email ?? "system"} · {relativeDate(item.createdAt)}
                </p>
              </div>
            </summary>
            {item.metadata != null && (
              <pre className="bg-navy-50 dark:bg-navy-950 text-xs text-navy-700 dark:text-navy-300 p-4 overflow-x-auto">
                {JSON.stringify(item.metadata, null, 2)}
              </pre>
            )}
          </details>
        ))}

        {items.length === 0 && (
          <div className="px-4 py-12 text-center text-navy-500 dark:text-navy-400">
            No errors in this window.
          </div>
        )}
      </div>
    </div>
  );
}
