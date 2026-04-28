"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

/**
 * Minimal, dependency-free theme provider.
 * Connects to the existing `.dark` CSS variable block in globals.css
 * and the Tailwind `darkMode: ["class"]` config.
 *
 * Strategy:
 *  - On mount, read saved theme from localStorage (`tmc-theme`) or fall back to system pref.
 *  - Apply/remove the `dark` class on <html>.
 *  - Persist changes back to localStorage.
 *
 * Exports `themeInitScript` which must run BEFORE hydration (in <head>)
 * to prevent a flash of the wrong theme.
 */

export type Theme = "light" | "dark";

const STORAGE_KEY = "tmc-theme";

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start as "light" on the server; the init script already set the real class
  // before hydration, and the effect below reads it back into React state.
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const isDark =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark");
    setThemeState(isDark ? "dark" : "light");
  }, []);

  const setTheme = useCallback((next: Theme) => {
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

    // Light-touch crossfade approach (no full-page snapshot freeze):
    //   1. Add a transient `.theme-switching` class on <html>.
    //   2. CSS rule for that class enables ~180ms color/fill/stroke
    //      transitions on every element.
    //   3. Flip the dark class. CSS variables (map land, borders,
    //      routes, body bg, card bg, text…) interpolate smoothly
    //      between their old and new values.
    //   4. After 220ms, drop the `.theme-switching` class so normal
    //      hover/state transitions stay snappy.
    //
    // No setTimeout throttling, no React render race, and the map
    // animates because its colours all live in CSS variables.
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
 * Inline script injected in <head> via dangerouslySetInnerHTML to prevent FOUC.
 * Runs BEFORE React hydrates, reads the persisted choice, and applies the class.
 */
export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored === 'dark' || stored === 'light' ? stored : (systemDark ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) { /* ignore */ }
})();
`.trim();
