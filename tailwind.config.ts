import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/frontend/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── TrackMyContainer.ai Brand Colors ──────────────────
        navy: {
          DEFAULT: "#1B2B5E",  // Primary – container body, headings, sidebar
          50:  "#EEF1F9",
          100: "#D4DBF0",
          200: "#A9B7E1",
          300: "#7E93D2",
          400: "#536FC3",
          500: "#2B4BAB",
          600: "#1B2B5E",      // ← Brand primary
          700: "#152249",
          800: "#0F1933",
          900: "#08101E",
          950: "#040810",
        },
        orange: {
          DEFAULT: "#F5821F",  // Accent – ".ai", arrow, CTA, air freight dots
          50:  "#FFF6ED",
          100: "#FFEAD3",
          200: "#FFD0A6",
          300: "#FFB070",
          400: "#FF8A38",
          500: "#F5821F",      // ← Brand accent
          600: "#E06610",
          700: "#B84E0C",
          800: "#923D0F",
          900: "#773411",
          950: "#401608",
        },
        teal: {
          DEFAULT: "#00B4C4",  // Secondary – sea freight dots, geometric accents
          50:  "#EDFCFE",
          100: "#D1F6FB",
          200: "#A9EDF7",
          300: "#6DDFF0",
          400: "#2ACAE0",
          500: "#00B4C4",      // ← Brand secondary
          600: "#0090A0",
          700: "#047380",
          800: "#0A5D68",
          900: "#0D4D57",
          950: "#003240",
        },
        // Semantic
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card:        { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover:     { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary:     { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary:   { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted:       { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent:      { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      fontFamily: {
        /* Plus Jakarta Sans — friendly geometric sans with rounded terminals,
           high legibility, warm feel. Perfect for consumer SaaS. */
        sans:    ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
        mono:    ["JetBrains Mono", "Fira Code", "monospace"],
        serif:   ["Instrument Serif", "Georgia", "serif"],
        display: ["Instrument Serif", "Georgia", "serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // Map background
      backgroundImage: {
        "world-map": "url('/images/world-map-dark.svg')",
        "gradient-brand": "linear-gradient(135deg, #1B2B5E 0%, #0D1B3E 100%)",
        "gradient-orange": "linear-gradient(135deg, #F5821F 0%, #E06610 100%)",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%":       { transform: "scale(1.4)", opacity: "0.7" },
        },
        "slide-in": {
          from: { transform: "translateX(-100%)", opacity: "0" },
          to:   { transform: "translateX(0)",     opacity: "1" },
        },
        "fade-up": {
          from: { transform: "translateY(20px)", opacity: "0" },
          to:   { transform: "translateY(0)",    opacity: "1" },
        },
        "marquee": {
          from: { transform: "translateX(0)" },
          to:   { transform: "translateX(-50%)" },
        },
        "float-slow":   { "0%, 100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-8px)" } },
        "float-medium": { "0%, 100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-5px)" } },
        "float-fast":   { "0%, 100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-10px)" } },
        "star-twinkle": { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.65" } },
      },
      animation: {
        "pulse-dot":    "pulse-dot 2s ease-in-out infinite",
        "slide-in":     "slide-in 0.3s ease-out",
        "fade-up":      "fade-up 0.5s ease-out",
        "marquee":      "marquee 30s linear infinite",
        "float-slow":   "float-slow 4s ease-in-out infinite",
        "float-medium": "float-medium 3s ease-in-out infinite",
        "float-fast":   "float-fast 5s ease-in-out infinite",
        "star-twinkle": "star-twinkle 4.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
