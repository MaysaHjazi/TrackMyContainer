"use client";

import { useState, Suspense, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import dynamic from "next/dynamic";

/* ── Lazy load 3D (no SSR) ── */
const HeroGlobe = dynamic(
  () => import("@/frontend/components/3d/globe").then((m) => ({ default: m.HeroGlobe })),
  { ssr: false },
);

/* ── Motion variants ── */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1], delay },
  }),
};

/* ── Refined floating status cards ── */
function FloatingCards() {
  const cards = [
    {
      number: "MAEU1234567",
      status: "In Transit",
      route: "Shanghai → Rotterdam",
      color: "teal",
      position: "top-[18%] right-[6%]",
      delay: 1.4,
      anim: "animate-float-slow",
    },
    {
      number: "157-12345678",
      status: "Delayed",
      route: "Dubai → London",
      color: "orange",
      position: "bottom-[22%] right-[38%]",
      delay: 1.8,
      anim: "animate-float-medium",
    },
    {
      number: "MSCU9876543",
      status: "Arrived",
      route: "New York",
      color: "emerald",
      position: "top-[58%] right-[4%]",
      delay: 2.2,
      anim: "animate-float-fast",
    },
  ];

  return (
    <>
      {cards.map((c) => (
        <motion.div
          key={c.number}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: c.delay, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className={`absolute ${c.position} z-30`}
        >
          <div className={`${c.anim} rounded-2xl bg-white/[0.06] border border-white/10
                           backdrop-blur-xl px-4 py-3 shadow-2xl shadow-black/50`}>
            <div className="flex items-center gap-3">
              <div className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full
                                  ${c.color === "teal"   ? "bg-teal-400"
                                  : c.color === "orange" ? "bg-orange-400"
                                  : "bg-emerald-400"} opacity-75`} />
                <span className={`relative inline-flex rounded-full h-2 w-2
                                  ${c.color === "teal"   ? "bg-teal-400"
                                  : c.color === "orange" ? "bg-orange-400"
                                  : "bg-emerald-400"}`} />
              </div>
              <div>
                <p className="text-[11px] font-mono font-semibold text-white/90 tracking-wider">
                  {c.number}
                </p>
                <p className={`text-[10px] font-medium
                              ${c.color === "teal"   ? "text-teal-300"
                              : c.color === "orange" ? "text-orange-300"
                              : "text-emerald-300"}`}>
                  {c.status} · {c.route}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </>
  );
}

export function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const starsRef = useRef<HTMLCanvasElement>(null);

  /* ── Star field canvas ── */
  const drawStars = useCallback(() => {
    const canvas = starsRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    const stars = 300;
    for (let i = 0; i < stars; i++) {
      const seed = i * 7919;
      const x = ((seed * 13) % (w * 100)) / 100;
      const y = ((seed * 17) % (h * 100)) / 100;
      const size = 0.3 + ((seed % 10) / 10) * 1.3;
      const alpha = 0.12 + ((seed % 7) / 7) * 0.5;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();

      if (i % 7 === 0) {
        ctx.beginPath();
        ctx.arc(x, y, size * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha * 0.2})`;
        ctx.fill();
      }
    }
  }, []);

  useEffect(() => {
    drawStars();
    window.addEventListener("resize", drawStars);
    return () => window.removeEventListener("resize", drawStars);
  }, [drawStars]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) { setError("Please enter a container or AWB number"); return; }
    setError("");
    setLoading(true);
    router.push(`/track/${encodeURIComponent(trimmed.toUpperCase())}`);
  };

  return (
    <section className="relative overflow-x-clip min-h-screen flex items-center
                        bg-[#030711]">
      {/* ── Deep space gradient ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 70% 40%, #0E1A3A 0%, #070C1C 45%, #030711 100%)",
        }}
      />

      {/* Stars canvas */}
      <canvas ref={starsRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Nebula glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] right-[0%] w-[800px] h-[600px] rounded-full blur-[160px] opacity-[0.09]"
          style={{ background: "radial-gradient(ellipse, #F5821F 0%, transparent 70%)" }} />
        <div className="absolute top-[20%] right-[10%] w-[700px] h-[700px] rounded-full blur-[140px] opacity-[0.06]"
          style={{ background: "radial-gradient(ellipse, #00B4C4 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-5%] left-[5%] w-[900px] h-[500px] rounded-full blur-[150px] opacity-[0.09]"
          style={{ background: "radial-gradient(ellipse, #1B3A6E 0%, transparent 70%)" }} />
      </div>

      {/* Subtle noise texture for depth */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Globe */}
      <div
        className="absolute top-0 -right-[8%] w-[82%] h-full hidden lg:block z-10"
        style={{
          maskImage: "linear-gradient(to right, transparent 0%, black 22%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 22%)",
        }}
      >
        <Suspense fallback={null}>
          <HeroGlobe />
        </Suspense>
      </div>

      {/* Floating cards over globe */}
      <div className="absolute inset-0 pointer-events-none hidden lg:block">
        <FloatingCards />
      </div>

      {/* ═══ Content ═══ */}
      <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 w-full z-20 pointer-events-none">
        <div className="max-w-2xl pointer-events-auto">
          {/* Small signal badge */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
            className="mb-8 inline-flex items-center gap-2.5 text-[11px] uppercase
                       tracking-[0.2em] text-white/50 font-medium"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-400" />
            </span>
            Real-time · 160+ carriers · Sea &amp; Air
          </motion.div>

          {/* ── Dramatic serif title ── */}
          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.1}
            className="mb-8 font-serif text-white leading-[0.95] tracking-[-0.02em]
                       text-6xl sm:text-7xl lg:text-[7rem]"
          >
            Every container
            <br />
            has a{" "}
            <span className="italic bg-gradient-to-br from-orange-300 via-orange-400 to-orange-500
                             bg-clip-text text-transparent">
              story
            </span>
            .
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.25}
            className="mb-10 max-w-lg text-lg text-white/60 leading-relaxed"
          >
            Real-time tracking for sea freight and air cargo — worldwide.
            Enter a container or AWB number, no account needed.
          </motion.p>

          {/* ── Elegant search ── */}
          <motion.form
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.4}
            onSubmit={handleSearch}
            className="mb-4"
          >
            <div className="relative flex items-center w-full max-w-lg
                            bg-white/[0.04] border border-white/10 rounded-2xl
                            shadow-[0_8px_32px_rgba(0,0,0,0.4)]
                            focus-within:border-orange-500/50 focus-within:bg-white/[0.06]
                            focus-within:shadow-[0_8px_32px_rgba(245,130,31,0.15)]
                            transition-all duration-300 backdrop-blur-xl">
              <Search size={18} className="ml-5 flex-shrink-0 text-white/30" />
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setError(""); }}
                placeholder="MAEU1234567 or 157-12345678"
                className="flex-1 bg-transparent py-5 px-4 text-base font-mono text-white
                           placeholder:text-white/25 placeholder:font-sans focus:outline-none"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="submit"
                disabled={loading}
                className="m-1.5 flex items-center gap-2 rounded-xl
                           bg-gradient-to-br from-orange-400 to-orange-600
                           hover:from-orange-300 hover:to-orange-500
                           px-5 py-3 text-sm font-semibold text-white
                           transition-all disabled:opacity-60
                           shadow-lg shadow-orange-500/30
                           hover:shadow-xl hover:shadow-orange-500/40
                           hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <>
                    Track
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </motion.form>

          {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.55}
            className="text-sm text-white/40"
          >
            Free: 5 lookups per day ·{" "}
            <a href="/register" className="text-orange-400 hover:text-orange-300 font-medium transition-colors">
              Upgrade for unlimited →
            </a>
          </motion.p>

          {/* ── Stats row ── */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.7}
            className="mt-14 flex items-center gap-12 pt-8 border-t border-white/[0.06]"
          >
            <div>
              <div className="font-serif text-4xl text-white font-light">160<span className="text-orange-400">+</span></div>
              <div className="mt-1 text-xs uppercase tracking-[0.15em] text-white/40">Carriers</div>
            </div>
            <div>
              <div className="font-serif text-4xl text-white font-light">75<span className="text-orange-400">+</span></div>
              <div className="mt-1 text-xs uppercase tracking-[0.15em] text-white/40">Airlines</div>
            </div>
            <div>
              <div className="font-serif text-4xl text-white font-light">24<span className="text-orange-400">/</span>7</div>
              <div className="mt-1 text-xs uppercase tracking-[0.15em] text-white/40">Real-time</div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom fade to blend with next section */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#030711] to-transparent pointer-events-none" />
    </section>
  );
}
