"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  /** Refresh interval in milliseconds. Default 60s. */
  intervalMs?: number;
}

/**
 * Quietly calls router.refresh() at a fixed interval so server-
 * rendered data on this page (events, status, current location, ETA)
 * stays in sync with worker poll updates and ShipsGo webhook pushes
 * — without the user noticing a flash or losing scroll position.
 *
 * The component renders nothing.
 */
export function AutoRefresh({ intervalMs = 60_000 }: Props) {
  const router = useRouter();
  useEffect(() => {
    // Refresh only when the tab is visible — no point polling in the
    // background, and Chrome throttles such tabs anyway.
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        router.refresh();
      }
    };
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
