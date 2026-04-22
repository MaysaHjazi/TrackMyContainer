"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Ship, Plane } from "lucide-react";
import { detectIdentifierType } from "@/config/carriers";

export function TrackSearchForm() {
  const router    = useRouter();
  const [query,   setQuery]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // Detect type in real-time for visual feedback
  const detectedType = query.trim().length >= 4 ? detectIdentifierType(query.trim()) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim().toUpperCase();
    if (!trimmed) { setError("Please enter a tracking number"); return; }
    const type = detectIdentifierType(trimmed);
    if (type === "UNKNOWN" && trimmed.length > 4) {
      setError("This doesn't look like a valid container number or AWB. Please check and try again.");
      return;
    }
    setError("");
    setLoading(true);
    router.push(`/track/${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="hero-search">
      {/* Type indicator */}
      <div className="ml-4 flex-shrink-0">
        {detectedType === "SEA" ? (
          <Ship size={20} className="text-teal-500 dark:text-teal-400" />
        ) : detectedType === "AIR" ? (
          <Plane size={20} className="text-orange-500 dark:text-orange-400" />
        ) : (
          <Search size={20} className="text-navy-300 dark:text-navy-500" />
        )}
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value.toUpperCase()); setError(""); }}
        placeholder="Enter Container or AWB Number"
        className="flex-1 bg-transparent py-4 px-3 text-base font-mono
                   text-navy-600 placeholder:text-navy-300
                   dark:text-white dark:placeholder:text-navy-500
                   placeholder:font-sans focus:outline-none"
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="characters"
      />

      {/* Detected type badge */}
      {detectedType && detectedType !== "UNKNOWN" && (
        <div className={`mr-2 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
          detectedType === "SEA"
            ? "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300"
            : "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300"
        }`}>
          {detectedType === "SEA" ? "🚢 Sea" : "✈️ Air"}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="m-1.5 flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3
                   text-sm font-bold text-white hover:bg-orange-600 transition-colors
                   disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-orange-300"
      >
        {loading ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : (
          <Search size={16} />
        )}
        Track
      </button>

      {error && (
        <div className="absolute -bottom-7 left-0 text-sm text-red-500">{error}</div>
      )}
    </form>
  );
}
