"use client";

import { createContext, useContext, useState, useCallback } from "react";

/**
 * Theme provider with cookie-backed persistence.
 *
 * Why cookie (not localStorage):
 *   The root layout reads the cookie on the SERVER so the SSR HTML
 *   ships with the right `dark` class on <html> AND the right Hero
 *   variant in the markup. With localStorage the server has no way
 *   to know the visitor's preference — it always emits LightHero,
 *   the client flips to DarkHero a frame later, and the page "pops".
 *
 * The pre-hydration init script is still injected in <head> as a
 * safety net for users who arrive with the legacy localStorage value
 * but no cookie yet (it migrates them) and to honour OS preference
 * when no choice has been persisted.
 */

export type Theme = "light" | "dark";

export const THEME_COOKIE = "tmc-theme";
const STORAGE_KEY = "tmc-theme"; // legacy — kept for migration only
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

function writeCookie(theme: Theme) {
  if (typeof document === "undefined") return;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

export function ThemeProvider({
  initialTheme = "light",
  children,
}: {
  initialTheme?: Theme;
  children: React.ReactNode;
}) {
  // initialTheme is provided by the server (read from cookie in
  // app/layout.tsx). SSR and client therefore agree on frame zero —
  // no remount, no animation replay.
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  const setTheme = useCallback((next: Theme) => {
    writeCookie(next);
    // Keep the legacy localStorage key in sync so any older client code
    // reading it still sees the current value.
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }

    if (typeof document === "undefined") {
      setThemeState(next);
      applyTheme(next);
      return;
    }

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Light-touch crossfade: enable transient color transitions on every
    // element while the dark class flips, then strip them off so normal
    // hover states stay snappy.
    const root = document.documentElement;
    if (!reducedMotion) root.classList.add("theme-switching");

    setThemeState(next);
    applyTheme(next);

    if (!reducedMotion) {
      window.setTimeout(() => {
        root.classList.remove("theme-switching");
      }, 220);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback so components don't crash if rendered outside provider.
    return {
      theme: "light" as Theme,
      toggleTheme: () => {},
      setTheme: () => {},
    };
  }
  return ctx;
}

/**
 * Inline script injected in <head> via dangerouslySetInnerHTML.
 * Runs BEFORE React hydrates. Two jobs:
 *   1. Migrate legacy localStorage value → cookie (so the very next
 *      request hits the SSR cookie path and gets correct HTML).
 *   2. Honour OS color-scheme preference for first-time visitors.
 *   3. Make sure <html.dark> matches whatever theme will be active,
 *      even if the visitor has no cookie yet.
 */
export const themeInitScript = `
(function () {
  try {
    var cookieMatch = document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=(\\w+)/);
    var stored = cookieMatch && cookieMatch[1];

    // Legacy migration: copy localStorage → cookie on the very first hit
    // after this release, so the next refresh uses the SSR-cookie path.
    if (!stored) {
      try {
        var legacy = localStorage.getItem('${STORAGE_KEY}');
        if (legacy === 'dark' || legacy === 'light') {
          stored = legacy;
          document.cookie = '${THEME_COOKIE}=' + legacy + '; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax';
        }
      } catch (e) {}
    }

    var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored === 'dark' || stored === 'light'
      ? stored
      : (systemDark ? 'dark' : 'light');

    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch (e) { /* ignore */ }
})();
`.trim();
