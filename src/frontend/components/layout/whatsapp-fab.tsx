"use client";

/**
 * Floating WhatsApp contact button (FAB).
 *
 * Fixed bottom-right on every page. Opens a wa.me chat with the
 * business number in a new tab. The number lives in
 * `siteConfig.contact.whatsapp` — update that one line + redeploy to
 * change it. If it's still the placeholder, the button hides itself
 * rather than linking to a broken chat.
 */

import { siteConfig } from "@/config/site";

// Keep digits only — wa.me wants the full international number, no '+'.
const NUMBER = (siteConfig.contact.whatsapp ?? "").replace(/\D/g, "");

const PREFILL = encodeURIComponent(
  "Hi TrackMyContainer 👋 — I'd like to ask about shipment tracking.",
);

export function WhatsAppFab() {
  // No real number configured → render nothing (avoids a dead button).
  if (NUMBER.length < 8) return null;

  const href = `https://wa.me/${NUMBER}?text=${PREFILL}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="group fixed bottom-5 right-5 z-[1000] flex h-14 w-14 items-center
                 justify-center rounded-full bg-[#25D366] shadow-[0_8px_24px_rgba(37,211,102,0.45)]
                 ring-1 ring-black/5 transition-transform duration-200
                 hover:scale-110 active:scale-95
                 motion-reduce:transition-none motion-reduce:hover:scale-100"
    >
      {/* Soft pulsing halo */}
      <span
        className="absolute inset-0 rounded-full bg-[#25D366] opacity-60
                   motion-safe:animate-ping"
        aria-hidden
      />
      {/* WhatsApp glyph */}
      <svg
        viewBox="0 0 32 32"
        className="relative h-7 w-7 fill-white"
        aria-hidden
      >
        <path d="M16.001 3.2C9.03 3.2 3.2 8.93 3.2 15.86c0 2.49.69 4.85 1.98 6.94L3.2 28.8l6.18-1.94a12.9 12.9 0 0 0 6.62 1.78c6.97 0 12.8-5.73 12.8-12.66 0-3.4-1.36-6.59-3.82-9-2.46-2.41-5.7-3.78-9.18-3.78Zm0 23.06a10.7 10.7 0 0 1-5.6-1.57l-.4-.24-3.67 1.15 1.17-3.55-.26-.41a10.4 10.4 0 0 1-1.66-5.78c0-5.78 4.78-10.48 10.66-10.48 2.85 0 5.52 1.1 7.54 3.08a10.3 10.3 0 0 1 3.12 7.41c0 5.78-4.78 10.48-10.66 10.48Zm5.85-7.85c-.32-.16-1.9-.92-2.19-1.03-.29-.11-.5-.16-.72.16-.21.32-.82 1.03-1 1.24-.18.21-.37.24-.69.08-.32-.16-1.35-.49-2.57-1.57-.95-.84-1.59-1.87-1.78-2.19-.18-.32-.02-.49.14-.65.15-.14.32-.37.48-.55.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.55-.08-.16-.72-1.72-.99-2.36-.26-.62-.52-.54-.72-.55l-.61-.01c-.21 0-.55.08-.84.4-.29.32-1.1 1.07-1.1 2.61 0 1.54 1.13 3.03 1.28 3.24.16.21 2.22 3.39 5.38 4.75.75.32 1.34.52 1.8.66.76.24 1.44.21 1.98.13.6-.09 1.9-.78 2.17-1.53.27-.75.27-1.39.19-1.53-.08-.13-.29-.21-.61-.37Z" />
      </svg>
    </a>
  );
}
