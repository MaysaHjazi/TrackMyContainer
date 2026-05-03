"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, AlertTriangle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mobile-only admin nav. The desktop AdminSidebar is `hidden lg:flex`,
 * which leaves screens narrower than lg with no way to jump between
 * Overview / Users / Errors — and no back link to the user dashboard.
 *
 * Renders a compact horizontal bar visible only below `lg`. Identical
 * label set + active-state logic to AdminSidebar so behaviour matches.
 */

const ITEMS = [
  { href: "/admin",        icon: LayoutDashboard, label: "Overview" },
  { href: "/admin/users",  icon: Users,           label: "Users" },
  { href: "/admin/errors", icon: AlertTriangle,   label: "Errors" },
];

export function AdminMobileHeader() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-40 border-b border-navy-200 bg-white
                    dark:border-navy-800 dark:bg-navy-950 lg:hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold
                     text-navy-500 hover:bg-navy-50 hover:text-navy-900
                     dark:text-navy-400 dark:hover:bg-navy-800/60 dark:hover:text-navy-100"
        >
          <ArrowLeft size={14} />
          <span className="hidden xs:inline">Back</span>
        </Link>

        <p className="text-xs font-bold uppercase tracking-wider text-orange-500">Admin</p>

        <span className="w-12" aria-hidden /> {/* spacer to balance back link */}
      </div>

      <nav className="flex items-stretch overflow-x-auto border-t border-navy-100 dark:border-navy-800">
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
                "flex flex-1 items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap",
                active
                  ? "text-orange-600 border-b-2 border-orange-500 dark:text-orange-300"
                  : "text-navy-500 border-b-2 border-transparent hover:text-navy-900 dark:text-navy-400 dark:hover:text-navy-100",
              )}
            >
              <Icon size={14} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
