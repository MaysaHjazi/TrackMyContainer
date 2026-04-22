"use client";

import { useState, Suspense, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Ship, Plane, ArrowRight } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import dynamic from "next/dynamic";
import { useTheme } from "@/frontend/theme-provider";

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

/* ── Motion variants ── */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (delay: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay },
  }),
};
const fadeLeft: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: (delay: number) => ({
    opacity: 1, x: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay },
  }),
};

/* ═══════════════════════════════════════════════════════════════
   DARK HERO — 1:1 original design (navy-950 galaxy)
   ═══════════════════════════════════════════════════════════════ */

function DarkFloatingCards() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
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
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
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
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
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

function DarkAnimatedStat({ value, suffix, label, icon: Icon, delay }: {
  value: number; suffix: string; label: string; icon: typeof Ship; delay: number;
}) {
  const count = useCountUp(value, 1.2, delay);
  return (
    <motion.div
      variants={fadeUp} initial="hidden" animate="visible" custom={delay}
      className="flex items-center gap-3"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full
                      border-[1.5px] border-orange-400/60 bg-transparent">
        <Icon size={18} strokeWidth={2} className="text-orange-400" />
      </div>
      <div>
        <div className="text-xl font-extrabold text-white leading-none">{count}{suffix}</div>
        <div className="mt-1 text-xs text-navy-400 font-medium">{label}</div>
      </div>
    </motion.div>
  );
}

function DarkHero({
  query, setQuery, loading, error, setError, handleSearch, starsRef,
}: {
  query: string; setQuery: (s: string) => void;
  loading: boolean; error: string; setError: (s: string) => void;
  handleSearch: (e: React.FormEvent) => void;
  starsRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  return (
    <section className="relative overflow-x-clip bg-navy-950 flex items-center
                        -mt-[72px] min-h-[calc(100vh+72px)] pt-[72px]">
      {/* Base deep space — VERY subtle gradient, top stays same shade as middle
          so there's no visible "band" where the header sits. */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 55% 55%, #0A1428 0%, #060B1A 70%, #040810 100%)" }} />
      {/* Star canvas — with gentle twinkle fade pulse */}
      <canvas
        ref={starsRef}
        className="absolute inset-0 w-full h-full pointer-events-none animate-star-twinkle"
        style={{ transition: "none" }}
      />
      {/* Nebulas — includes a top-wide glow so the header area has the same
          atmospheric depth as the middle of the hero (no darker "band"). */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Top-spanning subtle lift — fills the header area with depth */}
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[140%] h-[400px] rounded-[50%] blur-[120px] opacity-[0.05]"
          style={{ background: "radial-gradient(ellipse, #1B3A6E 0%, #0D1B3E 50%, transparent 75%)" }} />
        <div className="absolute -top-[10%] right-[5%] w-[700px] h-[500px] rounded-full blur-[150px] opacity-[0.08]"
          style={{ background: "radial-gradient(ellipse, #F5821F 0%, #E8721A 30%, transparent 70%)" }} />
        <div className="absolute top-[20%] right-[15%] w-[600px] h-[600px] rounded-full blur-[130px] opacity-[0.06]"
          style={{ background: "radial-gradient(ellipse, #00B4C4 0%, #0088A0 40%, transparent 70%)" }} />
        <div className="absolute bottom-[-5%] left-[5%] w-[800px] h-[400px] rounded-full blur-[140px] opacity-[0.08]"
          style={{ background: "radial-gradient(ellipse, #1B3A6E 0%, #0D1B3E 50%, transparent 70%)" }} />
        <div className="absolute bottom-[0%] right-[30%] w-[500px] h-[300px] rounded-full blur-[120px] opacity-[0.04]"
          style={{ background: "radial-gradient(ellipse, #F5821F 0%, transparent 70%)" }} />
      </div>

      {/* Globe — balanced size, positioned right but not crammed */}
      <div className="absolute top-0 right-[2%] w-[50%] h-full hidden lg:block z-10"
        style={{ maskImage: "linear-gradient(to right, transparent 0%, black 25%)", WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 25%)" }}>
        <Suspense fallback={null}>
          <HeroGlobe />
        </Suspense>
      </div>

      <div className="absolute inset-0 pointer-events-none hidden lg:block">
        <DarkFloatingCards />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 w-full z-20 pointer-events-none">
        <div className="max-w-[560px] pointer-events-auto">
          <div className="text-left">
            {/* Badge */}
            <motion.div
              variants={fadeLeft} initial="hidden" animate="visible" custom={0}
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
            {/* Title — premium, confident, 3 clean lines */}
            <motion.h1
              variants={fadeUp} initial="hidden" animate="visible" custom={0.15}
              className="mb-6 leading-[1.08] tracking-[-0.03em] text-white"
            >
              <span className="block font-extrabold
                               text-[2.75rem] sm:text-[3.25rem] lg:text-[3.75rem]">
                Track your shipment.
              </span>
              <span className="block font-extrabold text-orange-400
                               text-[2.75rem] sm:text-[3.25rem] lg:text-[3.75rem]">
                Anywhere,
              </span>
              <span className="block font-extrabold text-white
                               text-[2.75rem] sm:text-[3.25rem] lg:text-[3.75rem]">
                in real-time.
              </span>
            </motion.h1>
            {/* Description */}
            <motion.p
              variants={fadeUp} initial="hidden" animate="visible" custom={0.35}
              className="mb-8 max-w-lg text-[16px] text-navy-300 leading-[1.6]"
            >
              Real-time tracking for sea containers and air cargo.
              Enter your container number or air waybill to get started.
            </motion.p>
            {/* Type tabs — clean active/inactive states with subtle fill */}
            <motion.div
              variants={fadeUp} initial="hidden" animate="visible" custom={0.5}
              className="mb-7 inline-flex gap-1.5 p-1 rounded-2xl
                         border border-white/10 bg-white/[0.03] backdrop-blur-sm"
            >
              <button type="button"
                className="group flex items-center gap-2 rounded-xl px-4 py-2.5
                           transition-all duration-200
                           bg-orange-400/15 ring-1 ring-orange-400/40
                           hover:bg-orange-400/20
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50">
                <Ship size={15} strokeWidth={2.2} className="text-orange-300" />
                <span className="text-[13px] font-semibold text-white">Sea Freight</span>
              </button>
              <button type="button"
                className="group flex items-center gap-2 rounded-xl px-4 py-2.5
                           transition-all duration-200
                           bg-transparent
                           hover:bg-white/[0.04]
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50">
                <Plane size={15} strokeWidth={2.2} className="text-white/60" />
                <span className="text-[13px] font-semibold text-white/70">Air Cargo</span>
              </button>
            </motion.div>
            {/* Search */}
            <motion.form
              variants={fadeUp} initial="hidden" animate="visible" custom={0.6}
              onSubmit={handleSearch} className="mb-4"
            >
              <div className="relative flex items-center w-full max-w-xl rounded-2xl p-1.5
                              border-[1.5px] border-white/12 bg-white/[0.02] backdrop-blur-sm
                              focus-within:border-orange-400/60
                              focus-within:shadow-[0_0_40px_rgba(251,146,60,0.1)]
                              transition-all duration-300">
                <Search size={18} className="ml-4 flex-shrink-0 text-white/40" />
                <input
                  type="text" value={query}
                  onChange={(e) => { setQuery(e.target.value); setError(""); }}
                  placeholder="Enter container number or waybill"
                  className="flex-1 bg-transparent py-3 px-4 text-[14px] font-sans text-white
                             placeholder:text-white/35 focus:outline-none"
                  autoComplete="off" spellCheck={false}
                />
                <button type="submit" disabled={loading}
                  className="flex items-center gap-2 rounded-xl px-5 py-3
                             border-[1.5px] border-orange-400/70 bg-transparent
                             text-[14px] font-semibold text-orange-300
                             hover:bg-orange-400/10 hover:border-orange-400 hover:text-orange-200
                             transition-all disabled:opacity-60"
                >
                  {loading ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <>
                      Track Shipment
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </motion.form>
            {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
            <motion.p
              variants={fadeUp} initial="hidden" animate="visible" custom={0.75}
              className="mt-4 flex items-center gap-2 text-[13px] text-white/50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Free: 5 lookups/day · No account needed ·{" "}
              <a href="/register" className="font-semibold text-orange-400 hover:underline">Upgrade for unlimited</a>
            </motion.p>
            {/* Stats */}
            <div className="mt-12 flex flex-wrap items-center gap-8">
              <DarkAnimatedStat value={160} suffix="+" icon={Ship} label="Carriers" delay={1} />
              <DarkAnimatedStat value={75} suffix="+" icon={Plane} label="Countries" delay={1.15} />
              <DarkAnimatedStat value={24} suffix="/7" icon={Search} label="Real-time" delay={1.3} />
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-navy-950 to-transparent" />
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LIGHT HERO — premium SaaS matching screenshot reference
   ═══════════════════════════════════════════════════════════════ */

function LightFloatingCards() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.8 }}
        className="absolute top-[15%] right-[5%] z-30"
      >
        <div className="animate-float-slow rounded-xl bg-white border border-[#E5E7EB] px-4 py-3
                        shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-3">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]" />
            </div>
            <div>
              <p className="text-[11px] font-mono font-bold text-[#1F2937]">MAEU1234567</p>
              <p className="text-[10px] text-[#10B981] font-semibold">In Transit · Shanghai → Rotterdam</p>
            </div>
          </div>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2, duration: 0.8 }}
        className="absolute bottom-[15%] right-[35%] z-30"
      >
        <div className="animate-float-medium rounded-xl bg-white border border-[#E5E7EB] px-4 py-3
                        shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-3">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF6A00] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF6A00]" />
            </div>
            <div>
              <p className="text-[11px] font-mono font-bold text-[#1F2937]">157-12345678</p>
              <p className="text-[10px] text-[#FF6A00] font-semibold">Delayed · Dubai → London</p>
            </div>
          </div>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.4, duration: 0.8 }}
        className="absolute top-[55%] right-[3%] z-30"
      >
        <div className="animate-float-fast rounded-xl bg-white border border-[#E5E7EB] px-4 py-3
                        shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-3">
            <span className="inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]" />
            <div>
              <p className="text-[11px] font-mono font-bold text-[#1F2937]">MSCU9876543</p>
              <p className="text-[10px] text-[#10B981] font-semibold">Arrived · New York</p>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function LightAnimatedStat({ value, suffix, label, icon: Icon, delay }: {
  value: number; suffix: string; label: string; icon: typeof Ship; delay: number;
}) {
  const count = useCountUp(value, 1.2, delay);
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={delay}
      className="flex items-center gap-3"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full
                      border-[1.5px] border-[#FF6A00]/60 bg-transparent">
        <Icon size={18} strokeWidth={2} className="text-[#FF6A00]" />
      </div>
      <div>
        <div className="text-xl font-extrabold text-[#1F2937] leading-none">{count}{suffix}</div>
        <div className="mt-1 text-xs text-[#6B7280] font-medium">{label}</div>
      </div>
    </motion.div>
  );
}

function LightHero({
  query, setQuery, loading, error, setError, handleSearch,
}: {
  query: string; setQuery: (s: string) => void;
  loading: boolean; error: string; setError: (s: string) => void;
  handleSearch: (e: React.FormEvent) => void;
}) {
  return (
    <section className="relative overflow-x-clip bg-[#F5F7FA] flex items-center
                        -mt-[72px] min-h-[calc(100vh+72px)] pt-[72px]">
      {/* Soft light accents */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] right-[5%] w-[700px] h-[500px] rounded-full blur-[150px] opacity-[0.16]"
          style={{ background: "radial-gradient(ellipse, #FFB070 0%, transparent 70%)" }} />
        <div className="absolute top-[20%] right-[15%] w-[600px] h-[600px] rounded-full blur-[140px] opacity-[0.10]"
          style={{ background: "radial-gradient(ellipse, #4FA3FF 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 left-0 right-0 h-[400px]"
          style={{ background: "linear-gradient(to top, #EEF2F6 0%, transparent 100%)" }} />
      </div>

      {/* Globe — balanced size, positioned right but not crammed */}
      <div className="absolute top-0 right-[2%] w-[50%] h-full hidden lg:block z-10"
        style={{ maskImage: "linear-gradient(to right, transparent 0%, black 25%)", WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 25%)" }}>
        <Suspense fallback={null}>
          <HeroGlobe />
        </Suspense>
      </div>

      <div className="absolute inset-0 pointer-events-none hidden lg:block">
        <LightFloatingCards />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 w-full z-20 pointer-events-none">
        <div className="max-w-[560px] pointer-events-auto">
          <div className="text-left">
            {/* Badge */}
            <motion.div
              variants={fadeLeft} initial="hidden" animate="visible" custom={0}
              className="mb-6 inline-flex items-center gap-2 rounded-full
                         border border-[#E5E7EB] bg-white px-4 py-1.5
                         shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                160+ Carriers · Sea &amp; Air · Real-time
              </span>
            </motion.div>
            {/* Title — premium, confident, 3 clean lines */}
            <motion.h1
              variants={fadeUp} initial="hidden" animate="visible" custom={0.15}
              className="mb-6 leading-[1.08] tracking-[-0.03em] text-[#0A0E1A]"
            >
              <span className="block font-extrabold
                               text-[2.75rem] sm:text-[3.25rem] lg:text-[3.75rem]">
                Track your shipment.
              </span>
              <span className="block font-extrabold text-[#FF6A00]
                               text-[2.75rem] sm:text-[3.25rem] lg:text-[3.75rem]">
                Anywhere,
              </span>
              <span className="block font-extrabold text-[#0A0E1A]
                               text-[2.75rem] sm:text-[3.25rem] lg:text-[3.75rem]">
                in real-time.
              </span>
            </motion.h1>
            {/* Description */}
            <motion.p
              variants={fadeUp} initial="hidden" animate="visible" custom={0.35}
              className="mb-8 max-w-lg text-[16px] text-[#6B7280] leading-[1.6]"
            >
              Real-time tracking for sea containers and air cargo.
              Enter your container number or air waybill to get started.
            </motion.p>
            {/* Type tabs — clean active/inactive states with subtle fill */}
            <motion.div
              variants={fadeUp} initial="hidden" animate="visible" custom={0.5}
              className="mb-7 inline-flex gap-1.5 p-1 rounded-2xl
                         border border-[#1F2937]/10 bg-white/60 backdrop-blur-sm
                         shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
            >
              <button type="button"
                className="group flex items-center gap-2 rounded-xl px-4 py-2.5
                           transition-all duration-200
                           bg-[#FFF4EC] ring-1 ring-[#FF6A00]/30
                           hover:bg-[#FFEAD3]
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]/50">
                <Ship size={15} strokeWidth={2.2} className="text-[#FF6A00]" />
                <span className="text-[13px] font-semibold text-[#1F2937]">Sea Freight</span>
              </button>
              <button type="button"
                className="group flex items-center gap-2 rounded-xl px-4 py-2.5
                           transition-all duration-200
                           bg-transparent
                           hover:bg-[#1F2937]/[0.03]
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]/50">
                <Plane size={15} strokeWidth={2.2} className="text-[#6B7280]" />
                <span className="text-[13px] font-semibold text-[#6B7280]">Air Cargo</span>
              </button>
            </motion.div>
            {/* Search */}
            <motion.form
              variants={fadeUp} initial="hidden" animate="visible" custom={0.6}
              onSubmit={handleSearch} className="mb-4"
            >
              <div className="relative flex items-center w-full max-w-xl rounded-2xl p-1.5
                              border-[1.5px] border-[#E5E7EB] bg-white/60 backdrop-blur-sm
                              focus-within:border-[#FF6A00]
                              focus-within:shadow-[0_8px_24px_rgba(255,106,0,0.08)]
                              transition-all duration-300">
                <Search size={18} className="ml-4 flex-shrink-0 text-[#9CA3AF]" />
                <input
                  type="text" value={query}
                  onChange={(e) => { setQuery(e.target.value); setError(""); }}
                  placeholder="Enter container number or waybill"
                  className="flex-1 bg-transparent py-3 px-4 text-[14px] text-[#1F2937]
                             placeholder:text-[#9CA3AF] focus:outline-none"
                  autoComplete="off" spellCheck={false}
                />
                <button type="submit" disabled={loading}
                  className="flex items-center gap-2 rounded-xl px-5 py-3
                             border-[1.5px] border-[#FF6A00] bg-transparent
                             text-[14px] font-semibold text-[#FF6A00]
                             hover:bg-[#FF6A00] hover:text-white
                             transition-all disabled:opacity-60"
                >
                  {loading ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <>
                      Track Shipment
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </motion.form>
            {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
            <motion.p
              variants={fadeUp} initial="hidden" animate="visible" custom={0.75}
              className="mt-4 flex items-center gap-2 text-[13px] text-[#6B7280]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Free: 5 lookups/day · No account needed ·{" "}
              <a href="/register" className="font-semibold text-[#FF6A00] hover:text-[#FF7A1A] transition-colors">
                Upgrade for unlimited
              </a>
            </motion.p>
            {/* Stats */}
            <div className="mt-12 flex flex-wrap items-center gap-8">
              <LightAnimatedStat value={160} suffix="+" icon={Ship} label="Carriers" delay={1} />
              <LightAnimatedStat value={75} suffix="+" icon={Plane} label="Countries" delay={1.15} />
              <LightAnimatedStat value={24} suffix="/7" icon={Search} label="Real-time" delay={1.3} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT — Theme-switching shell
   ═══════════════════════════════════════════════════════════════ */

export function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const starsRef = useRef<HTMLCanvasElement>(null);

  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Default to DARK during SSR (matches original deployed look & avoids light flash)
  const isDark = mounted ? theme === "dark" : true;

  /* ── Star canvas (dark mode only) ── */
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

      if (i % 8 === 0) {
        ctx.beginPath();
        ctx.arc(x, y, size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha * 0.15})`;
        ctx.fill();
      }
    }
  }, []);

  useEffect(() => {
    if (!isDark) return;
    drawStars();
    window.addEventListener("resize", drawStars);
    return () => window.removeEventListener("resize", drawStars);
  }, [drawStars, isDark]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) { setError("Please enter a container or AWB number"); return; }
    setError("");
    setLoading(true);
    router.push(`/track/${encodeURIComponent(trimmed.toUpperCase())}`);
  };

  const shared = { query, setQuery, loading, error, setError, handleSearch };

  return isDark
    ? <DarkHero  {...shared} starsRef={starsRef} />
    : <LightHero {...shared} />;
}
