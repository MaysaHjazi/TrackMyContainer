"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, AlertTriangle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin",        icon: LayoutDashboard, label: "Overview" },
  { href: "/admin/users",  icon: Users,           label: "Users" },
  { href: "/admin/errors", icon: AlertTriangle,   label: "Errors" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 flex-shrink-0 border-r border-navy-200 bg-white
                      dark:border-navy-800 dark:bg-navy-950 lg:flex lg:flex-col">
      <div className="px-5 py-5 border-b border-navy-200 dark:border-navy-800">
        <p className="text-xs font-bold uppercase tracking-wider text-orange-500">Admin</p>
        <p className="mt-1 text-sm font-semibold text-navy-900 dark:text-white">Operations</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300"
                  : "text-navy-600 hover:bg-navy-50 dark:text-navy-300 dark:hover:bg-navy-800/60",
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-navy-200 dark:border-navy-800">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold
                     text-navy-500 hover:text-navy-900 hover:bg-navy-50
                     dark:text-navy-400 dark:hover:text-navy-100 dark:hover:bg-navy-800/60"
        >
          <ArrowLeft size={14} />
          Back to dashboard
        </Link>
      </div>
    </aside>
  );
}
