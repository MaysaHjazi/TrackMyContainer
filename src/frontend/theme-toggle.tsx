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
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg
                 border border-navy-100 bg-white text-navy-600
                 hover:bg-navy-50 hover:text-orange-500
                 transition-colors
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500
                 dark:border-navy-700 dark:bg-navy-900 dark:text-navy-100
                 dark:hover:bg-navy-800 dark:hover:text-orange-400"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
