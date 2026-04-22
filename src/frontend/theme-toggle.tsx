"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/frontend/theme-provider";

/**
 * Theme toggle button for the header.
 * Uses existing brand palette (navy + orange) — no new colors introduced.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl
                 border transition-colors backdrop-blur-md
                 border-[#1F2937]/12 bg-white/50 text-[#1F2937]
                 hover:border-[#1F2937]/25 hover:text-[#FF6A00] hover:bg-white/70
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]
                 dark:border-white/15 dark:bg-white/[0.04] dark:text-white/80
                 dark:hover:border-white/30 dark:hover:bg-white/[0.08] dark:hover:text-orange-400"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
