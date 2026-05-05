import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/frontend/components/layout/header";
import { Footer } from "@/frontend/components/layout/footer";
import {
  Globe2,
  Ship,
  Plane,
  Shield,
  Zap,
  Bell,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "About — TrackMyContainer",
  description:
    "TrackMyContainer is a real-time container & air-cargo tracking platform connecting 160+ carriers and 75+ countries — built for freight forwarders, importers, and logistics teams.",
};

const STATS = [
  { value: "160+", label: "Sea & air carriers" },
  { value: "75+",  label: "Countries covered" },
  { value: "24/7", label: "Real-time updates" },
  { value: "<3s",  label: "Average lookup" },
];

const VALUES = [
  {
    icon: Globe2,
    title: "One source of truth",
    body:
      "We aggregate vessel schedules, port events, and AWB milestones from 160+ carriers into a single timeline you can actually trust.",
  },
  {
    icon: Zap,
    title: "Built for speed",
    body:
      "Most lookups resolve in under three seconds. No spreadsheet hopping, no carrier portals, no copy-paste between systems.",
  },
  {
    icon: Bell,
    title: "Alerts that matter",
    body:
      "Push notifications, email, WhatsApp and Messenger — only fire on the events your team actually cares about: ETA shifts, delays, customs holds, arrivals.",
  },
  {
    icon: Shield,
    title: "Enterprise-grade reliability",
    body:
      "Backed by a hardened polling worker with retry, dedup, and audit logs. We carry the operational weight so your team doesn't.",
  },
];

const HOW = [
  {
    step: "01",
    title: "Connect once",
    body:
      "Paste a container number, B/L, or AWB. No carrier setup, no API keys to wrangle. We handle the carrier integrations behind the scenes.",
  },
  {
    step: "02",
    title: "Track everything",
    body:
      "Live vessel positions, port-to-port milestones, ETAs, and exception events — all in one timeline view per shipment.",
  },
  {
    step: "03",
    title: "Get notified",
    body:
      "When something changes, we surface it in-app and ping you on the channel you prefer — no need to keep refreshing.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#F5F7FA] dark:bg-navy-950">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden border-b border-[#E5E7EB] dark:border-navy-800">
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute -top-[20%] right-[10%] w-[600px] h-[500px] rounded-full blur-[150px] opacity-[0.18] dark:opacity-[0.10]"
              style={{
                background:
                  "radial-gradient(ellipse, #FFB070 0%, transparent 70%)",
              }}
            />
            <div
              className="absolute top-[10%] left-[5%] w-[500px] h-[400px] rounded-full blur-[140px] opacity-[0.12] dark:opacity-[0.07]"
              style={{
                background:
                  "radial-gradient(ellipse, #4FA3FF 0%, transparent 70%)",
              }}
            />
          </div>

          <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-24 lg:py-32 text-center">
            <span
              className="inline-block mb-6 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest
                         border border-[#E5E7EB] bg-white text-[#FF6A00] shadow-[0_2px_8px_rgba(0,0,0,0.04)]
                         dark:border-navy-700 dark:bg-navy-900 dark:text-orange-400 dark:shadow-none"
            >
              About TrackMyContainer
            </span>
            <h1
              className="text-[2.5rem] sm:text-[3rem] lg:text-[3.5rem] font-extrabold leading-[1.1] tracking-[-0.025em]
                         text-[#0A0E1A] dark:text-white"
            >
              The freight visibility platform built{" "}
              <span className="text-[#FF6A00]">for the people moving the world</span>.
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-[16px] leading-[1.7] text-[#6B7280] dark:text-navy-400">
              We connect 160+ ocean and air carriers into a single real-time view —
              so freight forwarders, importers, and logistics teams stop chasing
              status updates and start making decisions.
            </p>

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-semibold
                           bg-[#FF6A00] text-white shadow-[0_8px_22px_-8px_rgba(255,106,0,0.55)]
                           hover:bg-[#FF7A1A] transition-all"
              >
                Get Started Free <ArrowRight size={15} />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-semibold
                           border border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#EEF2F6]
                           dark:border-navy-700 dark:bg-navy-900 dark:text-white dark:hover:bg-navy-800
                           transition-all"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </section>

        {/* ── Stats strip ── */}
        <section className="border-b border-[#E5E7EB] dark:border-navy-800 bg-white dark:bg-navy-950/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-3xl sm:text-4xl font-extrabold text-[#FF6A00] dark:text-orange-400">
                    {s.value}
                  </div>
                  <div className="mt-2 text-sm font-medium text-[#6B7280] dark:text-navy-400">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Mission ── */}
        <section className="py-24 lg:py-28">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#FF6A00]">
              Our mission
            </p>
            <h2
              className="text-3xl sm:text-4xl font-extrabold leading-[1.15] tracking-[-0.02em]
                         text-[#0A0E1A] dark:text-white"
            >
              Make global shipping feel as transparent as a parcel tracking page.
            </h2>
            <div className="mt-8 space-y-5 text-[16px] leading-[1.8] text-[#374151] dark:text-navy-300">
              <p>
                Ocean and air freight power 90% of global trade — yet for most teams
                it still runs on email threads, carrier portals, and spreadsheets.
                A container leaves Shanghai and disappears for days. An AWB
                changes status with no notification. Customers ask for an ETA
                you can&apos;t confidently give.
              </p>
              <p>
                <span className="font-semibold text-[#1F2937] dark:text-white">
                  TrackMyContainer
                </span>{" "}
                exists to close that visibility gap. One number in, one timeline
                out — across every major sea and air carrier, with alerts when
                something actually changes. No carrier accounts to manage,
                no integrations to maintain.
              </p>
              <p>
                Built by a small team that grew up watching freight teams burn
                hours on status chasing — and decided that wasn&apos;t the job.
              </p>
            </div>
          </div>
        </section>

        {/* ── Values ── */}
        <section className="py-20 border-t border-[#E5E7EB] dark:border-navy-800">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#FF6A00]">
                What we believe
              </p>
              <h2
                className="text-3xl sm:text-4xl font-extrabold leading-[1.15] tracking-[-0.02em]
                           text-[#0A0E1A] dark:text-white"
              >
                Four principles. Every release.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {VALUES.map((v) => (
                <div
                  key={v.title}
                  className="group rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-[0_2px_10px_rgba(0,0,0,0.03)]
                             hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.12)] hover:-translate-y-0.5
                             dark:border-navy-800 dark:bg-navy-900/60 dark:shadow-none
                             dark:hover:bg-navy-900 dark:hover:border-navy-700
                             transition-all duration-300"
                >
                  <div
                    className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl
                               bg-[#FFF4EC] ring-1 ring-[#FF6A00]/25
                               dark:bg-orange-500/10 dark:ring-orange-500/30"
                  >
                    <v.icon
                      size={22}
                      strokeWidth={2}
                      className="text-[#FF6A00] dark:text-orange-400"
                    />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-[#1F2937] dark:text-white">
                    {v.title}
                  </h3>
                  <p className="text-[14px] leading-[1.7] text-[#6B7280] dark:text-navy-400">
                    {v.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Coverage strip ── */}
        <section className="py-20 border-t border-[#E5E7EB] dark:border-navy-800 bg-white dark:bg-navy-950/60">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              <div>
                <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#FF6A00]">
                  Coverage
                </p>
                <h2 className="text-3xl font-extrabold leading-[1.2] tracking-[-0.02em] text-[#0A0E1A] dark:text-white">
                  Sea, air, and every paper trail in between.
                </h2>
                <p className="mt-5 text-[15px] leading-[1.75] text-[#6B7280] dark:text-navy-400">
                  Maersk, MSC, CMA CGM, Hapag-Lloyd, COSCO, ONE, Evergreen,
                  Yang Ming, Emirates SkyCargo, Qatar Airways Cargo, FedEx,
                  DHL — and 150+ more. One lookup, every carrier.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div
                  className="rounded-xl border border-[#E5E7EB] bg-[#F5F7FA] p-5
                             dark:border-navy-800 dark:bg-navy-900/60"
                >
                  <Ship
                    size={22}
                    className="text-[#3B82F6] dark:text-teal-400"
                  />
                  <div className="mt-3 text-2xl font-extrabold text-[#1F2937] dark:text-white">
                    160+
                  </div>
                  <div className="text-xs font-medium text-[#6B7280] dark:text-navy-400">
                    Ocean carriers
                  </div>
                </div>
                <div
                  className="rounded-xl border border-[#E5E7EB] bg-[#F5F7FA] p-5
                             dark:border-navy-800 dark:bg-navy-900/60"
                >
                  <Plane
                    size={22}
                    className="text-[#FF6A00] dark:text-orange-400"
                  />
                  <div className="mt-3 text-2xl font-extrabold text-[#1F2937] dark:text-white">
                    60+
                  </div>
                  <div className="text-xs font-medium text-[#6B7280] dark:text-navy-400">
                    Airlines
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="py-24 border-t border-[#E5E7EB] dark:border-navy-800">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#FF6A00]">
                How it works
              </p>
              <h2 className="text-3xl sm:text-4xl font-extrabold leading-[1.15] tracking-[-0.02em] text-[#0A0E1A] dark:text-white">
                Three steps. No carrier accounts.
              </h2>
            </div>

            <div className="grid gap-8 md:grid-cols-3 relative">
              <div
                className="absolute top-7 left-[16%] right-[16%] h-px hidden md:block
                           bg-gradient-to-r from-[#FF6A00]/30 via-[#3B82F6]/30 to-[#FF6A00]/30
                           dark:from-orange-500/30 dark:via-teal-500/30 dark:to-orange-500/30"
              />
              {HOW.map((h) => (
                <div
                  key={h.step}
                  className="relative flex flex-col items-center text-center"
                >
                  <div
                    className="relative z-10 mb-5 flex h-14 w-14 items-center justify-center rounded-full
                               bg-white border-2 border-[#FF6A00]/30 text-[#FF6A00] font-extrabold
                               shadow-[0_8px_24px_rgba(255,106,0,0.12)]
                               dark:bg-navy-900 dark:border-orange-500/30 dark:text-orange-400"
                  >
                    {h.step}
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-[#1F2937] dark:text-white">
                    {h.title}
                  </h3>
                  <p className="text-[14px] leading-[1.7] text-[#6B7280] dark:text-navy-400 max-w-xs">
                    {h.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="relative overflow-hidden py-24 border-t border-[#E5E7EB] dark:border-navy-800 bg-white dark:bg-navy-950/60">
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] rounded-full blur-[140px] opacity-[0.18] dark:opacity-[0.10]"
              style={{
                background:
                  "radial-gradient(ellipse, #FF6A00 0%, transparent 70%)",
              }}
            />
          </div>

          <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold leading-[1.1] tracking-[-0.02em] text-[#0A0E1A] dark:text-white">
              Stop chasing status. Start{" "}
              <span className="text-[#FF6A00]">tracking smarter</span>.
            </h2>
            <p className="mt-5 text-[16px] leading-[1.7] text-[#6B7280] dark:text-navy-400">
              Free for the first 5 lookups a day. Upgrade when your team is ready.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl px-7 py-3 text-[14px] font-semibold
                           bg-[#FF6A00] text-white shadow-[0_8px_22px_-8px_rgba(255,106,0,0.55)]
                           hover:bg-[#FF7A1A] transition-all"
              >
                Start Tracking Free <ArrowRight size={15} />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-xl px-7 py-3 text-[14px] font-semibold
                           border border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#EEF2F6]
                           dark:border-navy-700 dark:bg-navy-900 dark:text-white dark:hover:bg-navy-800
                           transition-all"
              >
                Talk to us
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
