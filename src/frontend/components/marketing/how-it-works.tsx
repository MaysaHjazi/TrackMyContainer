"use client";

import { motion } from "framer-motion";
import { Search, Zap, Bell } from "lucide-react";

const STEPS = [
  {
    icon: Search,
    number: "01",
    title: "Enter Tracking Number",
    description: "Paste any container number (e.g. MSCU3456789) or air waybill (157-12345678). No account needed for a quick lookup.",
    color: "orange",
  },
  {
    icon: Zap,
    number: "02",
    title: "We Query 160+ Carriers",
    description: "Our engine queries Maersk, MSC, CMA CGM, Hapag-Lloyd and 156 more carriers in real-time — all in under 3 seconds.",
    color: "teal",
  },
  {
    icon: Bell,
    number: "03",
    title: "Get Status & Alerts",
    description: "See live location, ETA, port events, and vessel info. Upgrade to get WhatsApp & Messenger alerts for every status change.",
    color: "orange",
  },
];

const CARRIERS = [
  "Maersk", "MSC", "CMA CGM", "Hapag-Lloyd", "COSCO", "ONE",
  "Evergreen", "Yang Ming", "HMM", "ZIM", "PIL", "OOCL",
  "Emirates SkyCargo", "FedEx", "DHL", "Qatar Airways Cargo",
];

export function HowItWorks() {
  return (
    <section className="relative py-24 bg-navy-950 overflow-hidden">
      {/* top divider */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-navy-700 to-transparent" />

      {/* subtle bg glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full blur-[160px] opacity-[0.04]"
          style={{ background: "radial-gradient(ellipse, #F5821F 0%, transparent 70%)" }} />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16"
        >
          <span className="inline-block mb-4 rounded-full border border-navy-700 bg-navy-900 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-teal-400">
            How it works
          </span>
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Tracking in{" "}
            <span className="bg-gradient-to-r from-orange-400 to-teal-400 bg-clip-text text-transparent">
              3 simple steps
            </span>
          </h2>
        </motion.div>

        {/* steps */}
        <div className="relative grid gap-8 md:grid-cols-3">
          {/* connector lines */}
          <div className="absolute top-10 left-[33%] right-[33%] h-px bg-gradient-to-r from-orange-500/30 via-teal-500/30 to-orange-500/30 hidden md:block" />

          {STEPS.map(({ icon: Icon, number, title, description, color }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: i * 0.15 }}
              className="relative flex flex-col items-center text-center"
            >
              {/* icon circle */}
              <div className={`relative mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2
                ${color === "orange"
                  ? "border-orange-500/30 bg-orange-500/10 shadow-[0_0_30px_rgba(245,130,31,0.12)]"
                  : "border-teal-500/30 bg-teal-500/10 shadow-[0_0_30px_rgba(0,180,196,0.12)]"
                }`}>
                <Icon size={28} className={color === "orange" ? "text-orange-400" : "text-teal-400"} />
                {/* step number */}
                <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-navy-800 border border-navy-600 text-[10px] font-bold text-navy-300">
                  {number}
                </span>
              </div>

              <h3 className="mb-3 text-lg font-bold text-white">{title}</h3>
              <p className="text-sm leading-relaxed text-navy-400 max-w-xs mx-auto">{description}</p>
            </motion.div>
          ))}
        </div>

        {/* ── Carrier strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          className="mt-20"
        >
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-navy-600 mb-6">
            Supported carriers &amp; airlines
          </p>
          <div className="relative overflow-hidden">
            {/* fade edges */}
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-navy-950 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-navy-950 to-transparent z-10 pointer-events-none" />
            <div className="flex animate-marquee gap-6 whitespace-nowrap">
              {[...CARRIERS, ...CARRIERS].map((c, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-lg border border-navy-800 bg-navy-900/60 px-4 py-2 text-xs font-semibold text-navy-400 hover:text-white hover:border-navy-700 transition-colors flex-shrink-0"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
