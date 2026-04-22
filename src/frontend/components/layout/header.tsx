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
    <header className="relative z-50 w-full bg-transparent">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-7 lg:px-10">

        {/* Logo (same in both modes) */}
        <Link
          href="/"
          aria-label="Container Tracking — home"
          className="group/logo flex items-center gap-2.5 flex-shrink-0 rounded-md
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl
                           bg-gradient-to-b from-orange-400 via-orange-500 to-orange-600
                           ring-1 ring-inset ring-white/20
                           shadow-[0_4px_12px_-2px_rgba(245,130,31,0.35)]
                           transition-transform duration-300 group-hover/logo:scale-105">
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-xl bg-gradient-to-b from-white/25 to-transparent" />
            <svg viewBox="0 0 24 24" className="relative h-[18px] w-[18px] text-white" fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="8" width="18" height="10" rx="1.2" stroke="currentColor" />
              <path d="M7 8v10M12 8v10M17 8v10" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.5" />
              <circle cx="12" cy="5" r="1.6" fill="currentColor" />
            </svg>
          </span>
          {/* Wordmark — 2 lines stacked */}
          <span className="flex flex-col leading-none select-none">
            <span className="text-[13px] font-medium
                             text-[#1F2937] dark:text-white/90">
              track my
            </span>
            <span className="mt-[3px] text-[14px] font-bold uppercase tracking-[0.15em]
                             text-[#FF6A00] dark:text-orange-400">
              container
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-10 md:flex">
          {[
            { href: "/track", label: "Track Shipment" },
            { href: "/pricing", label: "Pricing" },
            { href: "/about", label: "About" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group relative text-[13.5px] font-medium transition-colors duration-200
                         text-[#6B7280] hover:text-[#1F2937]
                         dark:font-normal dark:text-[#C8D3E0] dark:hover:text-white"
            >
              {item.label}
              <span className="absolute -bottom-1 left-0 h-px w-0
                               bg-[#FF6A00] dark:bg-gradient-to-r dark:from-orange-400 dark:to-orange-500
                               group-hover:w-full transition-[width] duration-300 ease-out" />
            </Link>
          ))}
        </nav>

        {/* Auth actions */}
        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          {/* ── Sign In — glass frosted, stars show through ── */}
          <Link
            href="/login"
            className="inline-flex items-center rounded-xl px-5 py-2.5
                       text-[13px] font-semibold transition-all duration-200
                       backdrop-blur-md
                       border border-[#1F2937]/12 bg-white/50 text-[#1F2937]
                       hover:border-[#1F2937]/25 hover:bg-white/70
                       dark:border-white/15 dark:bg-white/[0.04] dark:text-white
                       dark:hover:border-white/30 dark:hover:bg-white/[0.08]"
          >
            Sign In
          </Link>
          {/* ── Get Started Free — glass frosted with orange border ── */}
          <Link
            href="/register"
            className="group/cta inline-flex items-center gap-2 rounded-xl px-5 py-2.5
                       text-[13px] font-semibold transition-all duration-300 ease-out
                       backdrop-blur-md
                       border border-[#FF6A00] bg-white/40 text-[#FF6A00]
                       hover:bg-[#FF6A00] hover:text-white
                       hover:shadow-[0_8px_24px_-8px_rgba(255,106,0,0.55)]
                       dark:border-orange-400/70 dark:bg-orange-400/[0.06] dark:text-orange-300
                       dark:hover:border-orange-400 dark:hover:bg-orange-400/15
                       dark:hover:text-orange-200
                       dark:hover:shadow-[0_0_30px_-4px_rgba(251,146,60,0.35)]
                       active:scale-[0.97]"
          >
            <span>Get Started Free</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                 className="transition-transform group-hover/cta:translate-x-0.5">
              <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            className="p-2 rounded-lg transition-colors
                       text-[#6B7280] hover:bg-[#F5F7FA]
                       dark:text-[#C8D3E0] dark:hover:bg-white/5"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t px-5 py-4 space-y-3 animate-fade-up
                        border-[#E5E7EB] bg-white/95
                        dark:border-white/[0.06] dark:bg-[#030711]/90
                        backdrop-blur-xl">
          <Link href="/track"    className="block text-sm font-medium py-2 text-[#6B7280] dark:text-[#C8D3E0]" onClick={() => setMobileOpen(false)}>Track Shipment</Link>
          <Link href="/pricing"  className="block text-sm font-medium py-2 text-[#6B7280] dark:text-[#C8D3E0]" onClick={() => setMobileOpen(false)}>Pricing</Link>
          <Link href="/about"    className="block text-sm font-medium py-2 text-[#6B7280] dark:text-[#C8D3E0]" onClick={() => setMobileOpen(false)}>About</Link>
          <hr className="border-[#E5E7EB] dark:border-white/[0.06]"/>
          <Link href="/login"    className="block text-sm font-medium py-2 text-[#6B7280] dark:text-[#C8D3E0]" onClick={() => setMobileOpen(false)}>Sign In</Link>
          <Link
            href="/register"
            className="block rounded-[10px] bg-[#FF6A00] hover:bg-[#FF7A1A] px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors"
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
