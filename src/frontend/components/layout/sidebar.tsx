"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Package, BarChart2, Bell, Settings, LogOut, Zap, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useSubscription, isPro } from "@/frontend/subscription-provider";
import { siteConfig } from "@/config/site";

const WHATSAPP_NUMBER = (siteConfig.contact.whatsapp ?? "").replace(/\D/g, "");
const WHATSAPP_HREF =
  WHATSAPP_NUMBER.length >= 8
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        "Hi TrackMyContainer 👋 — I'd like to ask about shipment tracking.",
      )}`
    : null;

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

      {/* Bottom actions: WhatsApp contact (same muted icon style as
          the rest of the rail — NOT a coloured circle) sits directly
          above Sign Out. */}
      <div className="flex flex-col items-center gap-2">
        {WHATSAPP_HREF && (
          <a
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-icon group relative"
            title="Chat on WhatsApp"
          >
            <svg viewBox="0 0 32 32" width={24} height={24} fill="currentColor" aria-hidden="true">
              <path d="M16.001 3.2C9.03 3.2 3.2 8.93 3.2 15.86c0 2.49.69 4.85 1.98 6.94L3.2 28.8l6.18-1.94a12.9 12.9 0 0 0 6.62 1.78c6.97 0 12.8-5.73 12.8-12.66 0-3.4-1.36-6.59-3.82-9-2.46-2.41-5.7-3.78-9.18-3.78Zm0 23.06a10.7 10.7 0 0 1-5.6-1.57l-.4-.24-3.67 1.15 1.17-3.55-.26-.41a10.4 10.4 0 0 1-1.66-5.78c0-5.78 4.78-10.48 10.66-10.48 2.85 0 5.52 1.1 7.54 3.08a10.3 10.3 0 0 1 3.12 7.41c0 5.78-4.78 10.48-10.66 10.48Zm5.85-7.85c-.32-.16-1.9-.92-2.19-1.03-.29-.11-.5-.16-.72.16-.21.32-.82 1.03-1 1.24-.18.21-.37.24-.69.08-.32-.16-1.35-.49-2.57-1.57-.95-.84-1.59-1.87-1.78-2.19-.18-.32-.02-.49.14-.65.15-.14.32-.37.48-.55.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.55-.08-.16-.72-1.72-.99-2.36-.26-.62-.52-.54-.72-.55l-.61-.01c-.21 0-.55.08-.84.4-.29.32-1.1 1.07-1.1 2.61 0 1.54 1.13 3.03 1.28 3.24.16.21 2.22 3.39 5.38 4.75.75.32 1.34.52 1.8.66.76.24 1.44.21 1.98.13.6-.09 1.9-.78 2.17-1.53.27-.75.27-1.39.19-1.53-.08-.13-.29-.21-.61-.37Z" />
            </svg>
            <span className="absolute left-full ml-2 whitespace-nowrap rounded-md
                             bg-navy-900 px-2.5 py-1.5
                             text-xs font-semibold text-white opacity-0 pointer-events-none
                             group-hover:opacity-100 transition-opacity z-50 shadow-lg">
              Chat on WhatsApp
            </span>
          </a>
        )}

        {/* Sign Out */}
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
      </div>
    </aside>
  );
}
