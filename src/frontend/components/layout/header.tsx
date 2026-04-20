"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Bell, User, ChevronDown, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/frontend/theme-toggle";
import { NotificationBell } from "@/frontend/components/dashboard/notification-bell";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

/**
 * Public marketing header — used on landing page, /track, /pricing, /about.
 * Matches the branding: Navy + Orange ".ai"
 */
export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-navy-800 bg-navy-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Logo */}
        <Link
          href="/"
          aria-label="Container Tracking — home"
          className="flex items-center flex-shrink-0 rounded-md
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <img src="/logo-dark-final.png" alt="Container Tracking" className="h-[52px] w-auto hidden dark:block" />
          <img src="/logo-light-final.png" alt="Container Tracking" className="h-[52px] w-auto block dark:hidden" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/track"   className="text-sm font-medium text-navy-200 hover:text-orange-400 transition-colors">Track Shipment</Link>
          <Link href="/pricing" className="text-sm font-medium text-navy-200 hover:text-orange-400 transition-colors">Pricing</Link>
          <Link href="/about"   className="text-sm font-medium text-navy-200 hover:text-orange-400 transition-colors">About</Link>
        </nav>

        {/* Auth actions + theme toggle */}
        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          <Link
            href="/login"
            className="text-sm font-medium text-navy-200 hover:text-orange-400 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white
                       hover:bg-orange-600 transition-colors shadow-sm"
          >
            Get Started Free
          </Link>
        </div>

        {/* Mobile: theme toggle + hamburger */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            className="p-2 rounded-lg text-navy-200 hover:bg-navy-800"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-navy-800 bg-navy-950 px-4 py-4 space-y-3 animate-fade-up">
          <Link href="/track"    className="block text-sm font-medium text-navy-200 py-2" onClick={() => setMobileOpen(false)}>Track Shipment</Link>
          <Link href="/pricing"  className="block text-sm font-medium text-navy-200 py-2" onClick={() => setMobileOpen(false)}>Pricing</Link>
          <Link href="/about"    className="block text-sm font-medium text-navy-200 py-2" onClick={() => setMobileOpen(false)}>About</Link>
          <hr className="border-navy-800"/>
          <Link href="/login"    className="block text-sm font-medium text-navy-200 py-2" onClick={() => setMobileOpen(false)}>Sign In</Link>
          <Link
            href="/register"
            className="block rounded-lg bg-orange-500 px-4 py-2.5 text-center text-sm font-semibold text-white"
            onClick={() => setMobileOpen(false)}
          >
            Get Started Free
          </Link>
        </div>
      )}
    </header>
  );
}

// ── User menu dropdown ───────────────────────────────────────
function UserMenu({ userName }: { userName?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-navy-600
                   hover:bg-navy-50 transition-colors
                   dark:text-navy-100 dark:hover:bg-navy-800"
      >
        <div className="h-7 w-7 rounded-full bg-orange-500 flex items-center justify-center">
          <span className="text-xs font-bold text-white">{userName?.[0]?.toUpperCase() ?? "U"}</span>
        </div>
        <ChevronDown size={14} className={cn("text-navy-400 dark:text-navy-300 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-navy-200 bg-white py-1 shadow-lg
                          dark:border-navy-700 dark:bg-navy-900">
            <div className="px-3 py-2 border-b border-navy-100 dark:border-navy-800">
              <p className="text-sm font-semibold text-navy-900 dark:text-white">{userName}</p>
            </div>
            <a
              href="/dashboard/settings"
              className="flex items-center gap-2 px-3 py-2 text-sm text-navy-600 hover:bg-navy-50 dark:text-navy-300 dark:hover:bg-navy-800 transition-colors"
              onClick={() => setOpen(false)}
            >
              <Settings size={14} />
              Settings
            </a>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Dashboard header (inside dashboard layout) ────────────────
export function DashboardHeader({ userName }: { userName?: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-navy-100 bg-white px-6
                        dark:border-navy-800 dark:bg-navy-950">

      {/* Logo (compact) */}
      <Link href="/dashboard" className="flex items-center gap-1.5">
        <span className="text-base font-bold">
          <span className="text-navy-900 dark:text-white">Container</span>
          <span className="text-orange-500"> Tracking</span>
        </span>
      </Link>

      {/* Search */}
      <div className="hidden max-w-xs flex-1 mx-8 md:block">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300 dark:text-navy-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Enter Container or AWB Number"
            className="w-full rounded-lg border border-navy-200 bg-navy-50 py-2 pl-10 pr-4
                       text-sm font-mono text-navy-700 placeholder:text-navy-300
                       focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100
                       dark:border-navy-700 dark:bg-navy-900 dark:text-white
                       dark:placeholder:text-navy-500 dark:focus:border-orange-500
                       dark:focus:ring-orange-500/20"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <NotificationBell />
        <UserMenu userName={userName} />
      </div>
    </header>
  );
}
