"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Package, BarChart2, Bell, Settings, LogOut, Zap, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useSubscription, isPro } from "@/frontend/subscription-provider";

const NAV_ITEMS = [
  { href: "/dashboard",              icon: LayoutDashboard, label: "Dashboard",     proOnly: false },
  { href: "/dashboard/shipments",    icon: Package,         label: "Shipments",     proOnly: false },
  { href: "/dashboard/analytics",    icon: BarChart2,       label: "Analytics",     proOnly: true  },
  { href: "/dashboard/notifications",icon: Bell,            label: "Notifications", proOnly: true  },
  { href: "/dashboard/settings",     icon: Settings,        label: "Settings",      proOnly: false },
];

interface SidebarProps {
  /** Server-resolved admin flag — adds the ShieldCheck "Admin" link below settings. */
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin = false }: SidebarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const sub = useSubscription();
  const userIsPro = isPro(sub);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="flex h-full w-[68px] flex-col items-center justify-between
                       bg-white border-r border-navy-200
                       dark:bg-navy-900 dark:border-navy-800
                       py-5">
      {/* Nav icons */}
      <nav className="flex flex-col items-center gap-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label, proOnly }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "sidebar-icon group relative",
                active && "active"
              )}
            >
              <Icon size={24} strokeWidth={active ? 2.2 : 1.8} />
              {/* Pro badge dot */}
              {proOnly && !userIsPro && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-orange-500 border-2 border-white dark:border-navy-900" />
              )}
              {/* Tooltip */}
              <span className="absolute left-full ml-2 whitespace-nowrap rounded-md
                               bg-navy-900 px-2.5 py-1.5
                               text-xs font-semibold text-white opacity-0 pointer-events-none
                               group-hover:opacity-100 transition-opacity z-50
                               shadow-lg flex items-center gap-1.5">
                {label}
                {proOnly && !userIsPro && (
                  <Zap size={10} className="text-orange-400" />
                )}
              </span>
            </Link>
          );
        })}

        {/* Admin link — only rendered when the layout resolved isAdmin=true. */}
        {isAdmin && (() => {
          const active = pathname === "/admin" || pathname.startsWith("/admin/");
          return (
            <Link
              href="/admin"
              title="Admin"
              className={cn("sidebar-icon group relative", active && "active")}
            >
              <ShieldCheck size={24} strokeWidth={active ? 2.2 : 1.8} />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-orange-500" />
              <span className="absolute left-full ml-2 whitespace-nowrap rounded-md
                               bg-navy-900 px-2.5 py-1.5
                               text-xs font-semibold text-white opacity-0 pointer-events-none
                               group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                Admin
              </span>
            </Link>
          );
        })()}
      </nav>

      {/* Logout */}
      <button
        className="sidebar-icon group relative"
        title="Sign Out"
        onClick={handleSignOut}
      >
        <LogOut size={24} strokeWidth={1.8} />
        <span className="absolute left-full ml-2 whitespace-nowrap rounded-md
                         bg-navy-900 px-2.5 py-1.5
                         text-xs font-semibold text-white opacity-0 pointer-events-none
                         group-hover:opacity-100 transition-opacity z-50
                         shadow-lg">
          Sign Out
        </span>
      </button>
    </aside>
  );
}
