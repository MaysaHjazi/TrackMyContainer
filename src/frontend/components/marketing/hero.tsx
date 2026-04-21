"use client";

import { useState, Suspense, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Ship, Plane, ArrowRight } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import dynamic from "next/dynamic";

/* ── Lazy load 3D (no SSR) ── */
const HeroGlobe = dynamic(
  () => import("@/frontend/components/3d/globe").then((m) => ({ default: m.HeroGlobe })),
  { ssr: false },
);

/* ── Animated counter hook ── */
function useCountUp(target: number, duration = 1.5, delay = 1) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      let start = 0;
      const step = target / (duration * 60);
      const interval = setInterval(() => {
        start += step;
        if (start >= target) {
          setCount(target);
          clearInterval(interval);
        } else {
          setCount(Math.floor(start));
        }
      }, 1000 / 60);
      return () => clearInterval(interval);
    }, delay * 1000);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);
  return count;
}

/* ── Framer Motion variants ── */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay },
  }),
};

const fadeLeft: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: (delay: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay },
  }),
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: (delay: number) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay },
  }),
};

/* ── Floating Status Cards (positioned across full page) ── */
function FloatingCards() {
  return (
    <>
      {/* Card 1 — In Transit (top right area) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.8 }}
        className="absolute top-[15%] right-[5%] z-30"
      >
        <div className="animate-float-slow rounded-xl border border-navy-700/60 bg-navy-900/80 backdrop-blur-md px-4 py-3 shadow-xl shadow-teal-500/5">
          <div className="flex items-center gap-3">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-400" />
            </div>
            <div>
              <p className="text-[11px] font-mono font-bold text-white">MAEU1234567</p>
              <p className="text-[10px] text-teal-400 font-semibold">In Transit · Shanghai → Rotterdam</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Card 2 — Delayed (bottom center) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2, duration: 0.8 }}
        className="absolute bottom-[15%] right-[35%] z-30"
      >
        <div className="animate-float-medium rounded-xl border border-orange-500/20 bg-navy-900/80 backdrop-blur-md px-4 py-3 shadow-xl shadow-orange-500/5">
          <div className="flex items-center gap-3">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-400" />
            </div>
            <div>
              <p className="text-[11px] font-mono font-bold text-white">157-12345678</p>
              <p className="text-[10px] text-orange-400 font-semibold">Delayed · Dubai → London</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Card 3 — Arrived (right middle) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.4, duration: 0.8 }}
        className="absolute top-[55%] right-[3%] z-30"
      >
        <div className="animate-float-fast rounded-xl border border-green-500/20 bg-navy-900/80 backdrop-blur-md px-4 py-3 shadow-xl shadow-green-500/5">
          <div className="flex items-center gap-3">
            <span className="inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
            <div>
              <p className="text-[11px] font-mono font-bold text-white">MSCU9876543</p>
              <p className="text-[10px] text-green-400 font-semibold">Arrived · New York</p>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ── Stat with animated count ── */
function AnimatedStat({ value, suffix, label, delay }: { value: number; suffix: string; label: string; delay: number }) {
  const count = useCountUp(value, 1.2, delay);
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      custom={delay}
    >
      <div className="text-2xl font-extrabold text-white">{count}{suffix}</div>
      <div className="text-xs text-navy-400">{label}</div>
    </motion.div>
  );
}

export function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const starsRef = useRef<HTMLCanvasElement>(null);

  /* ── Draw star field on canvas ── */
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

    // Seed-based random for consistent stars
    const stars = 250;
    for (let i = 0; i < stars; i++) {
      const seed = i * 7919;
      const x = ((seed * 13) % (w * 100)) / 100;
      const y = ((seed * 17) % (h * 100)) / 100;
      const size = 0.3 + ((seed % 10) / 10) * 1.2;
      const alpha = 0.15 + ((seed % 7) / 7) * 0.45;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();

      // Some stars get a subtle glow
      if (i % 8 === 0) {
        ctx.beginPath();
        ctx.arc(x, y, size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha * 0.15})`;
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
    <>
      {/* ═══ HERO ═══ */}
      <section className="relative overflow-x-clip bg-navy-950 min-h-screen flex items-center">
        {/* ── Galaxy / Space background ── */}
        {/* Base deep space gradient */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 65% 45%, #0F1A3A 0%, #080E1F 40%, #050810 100%)",
          }}
        />

        {/* Star canvas — rendered via CSS for performance */}
        <canvas ref={starsRef} className="absolute inset-0 w-full h-full pointer-events-none" />

        {/* Nebula clouds — soft colored blurs like reference */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Warm orange nebula — top right (like reference image) */}
          <div className="absolute -top-[10%] right-[5%] w-[700px] h-[500px] rounded-full blur-[150px] opacity-[0.07]"
            style={{ background: "radial-gradient(ellipse, #F5821F 0%, #E8721A 30%, transparent 70%)" }} />
          {/* Teal nebula — center right behind globe */}
          <div className="absolute top-[20%] right-[15%] w-[600px] h-[600px] rounded-full blur-[130px] opacity-[0.05]"
            style={{ background: "radial-gradient(ellipse, #00B4C4 0%, #0088A0 40%, transparent 70%)" }} />
          {/* Deep blue nebula — bottom left */}
          <div className="absolute bottom-[-5%] left-[5%] w-[800px] h-[400px] rounded-full blur-[140px] opacity-[0.08]"
            style={{ background: "radial-gradient(ellipse, #1B3A6E 0%, #0D1B3E 50%, transparent 70%)" }} />
          {/* Warm glow bottom — like city light reflection */}
          <div className="absolute bottom-[0%] right-[30%] w-[500px] h-[300px] rounded-full blur-[120px] opacity-[0.04]"
            style={{ background: "radial-gradient(ellipse, #F5821F 0%, transparent 70%)" }} />
        </div>

        {/* ── Globe fills right side, bleeds behind text ── */}
        <div className="absolute top-0 -right-[5%] w-[80%] h-full hidden lg:block z-10"
          style={{ maskImage: "linear-gradient(to right, transparent 0%, black 25%)", WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 25%)" }}>
          <Suspense fallback={null}>
            <HeroGlobe />
          </Suspense>
        </div>

        {/* ── Floating shipment cards (over everything) ── */}
        <div className="absolute inset-0 pointer-events-none hidden lg:block">
          <FloatingCards />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 w-full z-20 pointer-events-none">
          <div className="max-w-xl pointer-events-auto">
            {/* ── Left: Content ── */}
            <div className="text-left">
              {/* Badge */}
              <motion.div
                variants={fadeLeft}
                initial="hidden"
                animate="visible"
                custom={0}
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-navy-700 bg-navy-900/80 px-4 py-1.5 backdrop-blur-sm"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-navy-200">
                  160+ Carriers · Sea &amp; Air · Real-time
                </span>
              </motion.div>

              {/* Title */}
              <motion.h1
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={0.15}
                className="mb-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.1]"
              >
                Track Any Shipment,{" "}
                <span className="bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent">
                  Anywhere
                </span>{" "}
                in the World
              </motion.h1>

              {/* Description */}
              <motion.p
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={0.35}
                className="mb-8 max-w-lg text-lg text-navy-300 leading-relaxed"
              >
                Real-time tracking for sea containers and air cargo.
                Enter your container number or air waybill — no account required.
              </motion.p>

              {/* Type badges */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={0.5}
                className="mb-8 flex flex-wrap items-center gap-3"
              >
                <div className="flex items-center gap-2 rounded-xl bg-navy-800/80 border border-navy-700 px-4 py-2 backdrop-blur-sm">
                  <Ship size={16} className="text-teal-400" />
                  <span className="text-sm font-semibold text-white">Sea Freight</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-navy-800/80 border border-orange-500/30 px-4 py-2 backdrop-blur-sm">
                  <Plane size={16} className="text-orange-400" />
                  <span className="text-sm font-semibold text-white">Air Cargo</span>
                </div>
              </motion.div>

              {/* Search */}
              <motion.form
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={0.6}
                onSubmit={handleSearch}
                className="mb-4"
              >
                <div className="relative flex items-center w-full max-w-lg
                                bg-navy-900/80 border border-navy-700 rounded-2xl
                                shadow-[0_0_30px_rgba(0,180,196,0.08)]
                                focus-within:border-orange-500/60 focus-within:shadow-[0_0_40px_rgba(245,130,31,0.1)]
                                transition-all duration-300 backdrop-blur-sm">
                  <Search size={18} className="ml-4 flex-shrink-0 text-navy-500" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setError(""); }}
                    placeholder="e.g. MAEU1234567 or 157-12345678"
                    className="flex-1 bg-transparent py-4 px-3 text-sm font-mono text-white
                               placeholder:text-navy-500 placeholder:font-sans focus:outline-none"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="m-1.5 flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-3
                               text-sm font-bold text-white hover:from-orange-600 hover:to-orange-700
                               transition-all disabled:opacity-60 shadow-lg shadow-orange-500/20"
                  >
                    {loading ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <ArrowRight size={16} />
                    )}
                    Track
                  </button>
                </div>
              </motion.form>

              {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

              <motion.p
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={0.75}
                className="text-xs text-navy-500"
              >
                Free: 5 lookups/day · No account needed ·{" "}
                <a href="/register" className="font-semibold text-orange-400 hover:underline">Upgrade for unlimited</a>
              </motion.p>

              {/* Stats with count-up */}
              <div className="mt-12 flex items-center gap-8">
                <AnimatedStat value={160} suffix="+" label="Carriers" delay={1} />
                <AnimatedStat value={75} suffix="+" label="Airlines" delay={1.15} />
                <AnimatedStat value={24} suffix="/7" label="Real-time" delay={1.3} />
              </div>
            </div>

          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-navy-950 to-transparent" />
      </section>
    </>
  );
}
