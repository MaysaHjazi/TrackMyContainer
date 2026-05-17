import Link from "next/link";

/**
 * Premium split-screen auth shell (login / register).
 *
 * Left  — full-height navy "logistics command" panel: brand, headline,
 *         an animated great-circle route motif (pure SVG/CSS), trust
 *         strip. Hidden < lg; a compact brand shows on mobile instead.
 * Right — calm surface that hosts the form (the page supplies it).
 *
 * No auth logic lives here — pages keep their Supabase wiring intact.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* ── Brand panel — theme-aware, clean (no route motif) ──── */}
      <aside
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between
                   px-14 py-12
                   bg-[#F4F7FC] text-[#1B2B5E]
                   dark:bg-[#0B1430] dark:text-white"
      >
        {/* Light-mode atmosphere — soft off-white / pale-blue wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 dark:hidden"
          style={{
            background:
              "radial-gradient(120% 90% at 15% 10%, rgba(245,130,31,0.08), transparent 55%)," +
              "radial-gradient(110% 90% at 90% 90%, rgba(27,43,94,0.10), transparent 55%)," +
              "linear-gradient(160deg,#F8FAFE 0%,#EDF1FA 55%,#E3EAF6 100%)",
          }}
        />
        {/* Dark-mode atmosphere — unchanged cinematic navy */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden dark:block"
          style={{
            background:
              "radial-gradient(120% 90% at 15% 10%, rgba(245,130,31,0.16), transparent 55%)," +
              "radial-gradient(110% 90% at 90% 90%, rgba(0,180,196,0.14), transparent 55%)," +
              "linear-gradient(160deg,#0B1430 0%,#0A1027 60%,#070B1C 100%)",
          }}
        />
        {/* Faint grid — navy lines (light) / white lines (dark) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05] dark:hidden"
          style={{
            backgroundImage:
              "linear-gradient(rgba(27,43,94,0.6) 1px,transparent 1px)," +
              "linear-gradient(90deg,rgba(27,43,94,0.6) 1px,transparent 1px)",
            backgroundSize: "54px 54px",
            maskImage:
              "radial-gradient(100% 100% at 50% 40%,#000 30%,transparent 80%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden opacity-[0.18] dark:block"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px)," +
              "linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)",
            backgroundSize: "54px 54px",
            maskImage:
              "radial-gradient(100% 100% at 50% 40%,#000 30%,transparent 80%)",
          }}
        />

        <Link href="/" className="relative z-10 inline-flex w-fit items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-header-light.png" alt="TrackMyContainer" className="h-11 w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-header-dark.png" alt="TrackMyContainer" className="hidden h-11 w-auto dark:block" />
        </Link>

        <div className="relative z-10 max-w-md">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5
                        text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur
                        border border-[#1B2B5E]/15 bg-[#1B2B5E]/[0.04] text-[#1B2B5E]/70
                        dark:border-white/15 dark:bg-white/[0.04] dark:text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F5821F]" />
            Real-time freight visibility
          </p>
          <h2 className="text-[2.6rem] font-extrabold leading-[1.08] tracking-tight">
            Every box,
            <br />
            <span className="bg-gradient-to-r from-[#F5821F] to-[#FF9E4D] bg-clip-text text-transparent
                             dark:from-[#FFB877] dark:to-[#F5821F]">
              on one map.
            </span>
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[#1B2B5E]/60 dark:text-white/55">
            Sea &amp; air shipments across 160+ carriers, with port-level
            events and delay alerts — the moment they happen.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-9">
          {[
            { n: "160+", l: "Carriers" },
            { n: "24/7", l: "Live polling" },
            { n: "Sea + Air", l: "Coverage" },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-lg font-extrabold text-[#1B2B5E] dark:text-white">{s.n}</div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-[#1B2B5E]/45 dark:text-white/45">
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Form side ─────────────────────────────────────────── */}
      <main
        className="relative flex flex-col items-center justify-center px-6 py-10 sm:px-10
                   bg-gradient-to-b from-[#F4F6FB] to-[#EAEEF6]
                   dark:from-[#0A1027] dark:to-[#070B1C]"
      >
        <div className="fixed left-0 top-0 z-50 h-1 w-full bg-gradient-to-r
                        from-[#00B4C4] via-[#1B2B5E] to-[#F5821F] dark:via-[#F5821F]" />

        <Link href="/" className="mb-8 flex items-center lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-header-light.png" alt="TrackMyContainer" className="h-10 w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-header-dark.png" alt="TrackMyContainer" className="hidden h-10 w-auto dark:block" />
        </Link>

        <div className="w-full max-w-[400px]">{children}</div>

        <p className="mt-10 text-xs text-navy-400 dark:text-white/30">
          &copy; {new Date().getFullYear()} TrackMyContainer — All rights reserved.
        </p>
      </main>
    </div>
  );
}
