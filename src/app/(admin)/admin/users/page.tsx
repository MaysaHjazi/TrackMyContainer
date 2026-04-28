import { prisma } from "@/backend/lib/db";
import { cn, formatDate, relativeDate } from "@/lib/utils";

export const metadata = { title: "Admin · Users" };

interface SearchParams {
  q?:    string;
  plan?: string;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, plan } = await searchParams;

  const where: import("@prisma/client").Prisma.UserWhereInput = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name:  { contains: q, mode: "insensitive" } },
    ];
  }
  if (plan && ["FREE", "PRO", "CUSTOM"].includes(plan)) {
    where.subscription = { plan: plan as "FREE" | "PRO" | "CUSTOM" };
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take:    100,
    include: {
      subscription: { select: { plan: true } },
      _count:       { select: { shipments: true, trackingQueries: true } },
      trackingQueries: {
        select:  { createdAt: true },
        orderBy: { createdAt: "desc" },
        take:    1,
      },
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-navy-900 dark:text-white">Users</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
          {users.length} user{users.length === 1 ? "" : "s"} shown (most recent 100).
        </p>
      </header>

      <form className="flex flex-wrap gap-3" method="GET">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search email or name…"
          className="flex-1 min-w-[240px] rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm
                     dark:border-navy-700 dark:bg-navy-900 dark:text-white"
        />
        <select
          name="plan"
          defaultValue={plan ?? ""}
          className="rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm
                     dark:border-navy-700 dark:bg-navy-900 dark:text-white"
        >
          <option value="">All plans</option>
          <option value="FREE">FREE</option>
          <option value="PRO">PRO</option>
          <option value="CUSTOM">CUSTOM</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600"
        >
          Apply
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl ring-1 ring-navy-200 dark:ring-navy-800">
        <table className="w-full text-sm">
          <thead className="bg-navy-50 dark:bg-navy-900/60 text-navy-500 dark:text-navy-400">
            <tr className="text-left">
              <th className="px-4 py-2.5 font-semibold">Email</th>
              <th className="px-4 py-2.5 font-semibold">Plan</th>
              <th className="px-4 py-2.5 font-semibold">Shipments</th>
              <th className="px-4 py-2.5 font-semibold">API calls</th>
              <th className="px-4 py-2.5 font-semibold">Last seen</th>
              <th className="px-4 py-2.5 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100 dark:divide-navy-800 bg-white dark:bg-navy-900">
            {users.map((u) => {
              const planName = u.subscription?.plan ?? "FREE";
              const lastSeen = u.trackingQueries[0]?.createdAt ?? null;
              return (
                <tr key={u.id} className="hover:bg-navy-50 dark:hover:bg-navy-800/40">
                  <td className="px-4 py-3 font-medium text-navy-900 dark:text-white">
                    <div>{u.email}</div>
                    {u.name && <div className="text-xs text-navy-400 dark:text-navy-500">{u.name}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-block rounded-full px-2 py-0.5 text-xs font-bold",
                      planName === "PRO"    && "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
                      planName === "CUSTOM" && "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
                      planName === "FREE"   && "bg-navy-100 text-navy-700 dark:bg-navy-800 dark:text-navy-300",
                    )}>
                      {planName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy-700 dark:text-navy-200">{u._count.shipments}</td>
                  <td className="px-4 py-3 text-navy-700 dark:text-navy-200">{u._count.trackingQueries}</td>
                  <td className="px-4 py-3 text-navy-500 dark:text-navy-400">
                    {lastSeen ? relativeDate(lastSeen) : "never"}
                  </td>
                  <td className="px-4 py-3 text-navy-500 dark:text-navy-400">{formatDate(u.createdAt)}</td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-navy-500 dark:text-navy-400">
                  No users match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
