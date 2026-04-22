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
    <section className="relative py-24 overflow-hidden
                        bg-[#EEF2F6] dark:bg-navy-950">
      {/* top divider */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r
                      from-transparent via-[#E5E7EB] to-transparent
                      dark:via-navy-700" />

      {/* subtle bg glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full blur-[160px]
                        opacity-[0.10] dark:opacity-[0.04]"
          style={{ background: "radial-gradient(ellipse, #FF6A00 0%, transparent 70%)" }} />
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
          <span className="inline-block mb-4 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest
                           border border-[#E5E7EB] bg-white text-[#FF6A00] shadow-[0_2px_8px_rgba(0,0,0,0.04)]
                           dark:border-navy-700 dark:bg-navy-900 dark:text-teal-400 dark:shadow-none">
            How it works
          </span>
          <h2 className="text-3xl font-extrabold sm:text-4xl
                         text-[#1F2937] dark:text-white">
            Tracking in{" "}
            <span className="bg-gradient-to-r bg-clip-text text-transparent
                             from-[#FF6A00] to-[#3B82F6]
                             dark:from-orange-400 dark:to-teal-400">
              3 simple steps
            </span>
          </h2>
        </motion.div>

        {/* steps */}
        <div className="relative grid gap-8 md:grid-cols-3">
          {/* connector lines */}
          <div className="absolute top-10 left-[33%] right-[33%] h-px hidden md:block
                          bg-gradient-to-r from-[#FF6A00]/30 via-[#3B82F6]/30 to-[#FF6A00]/30
                          dark:from-orange-500/30 dark:via-teal-500/30 dark:to-orange-500/30" />

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
              <div className={`relative mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 ${
                color === "orange"
                  ? "border-[#FF6A00]/30 bg-[#FFF4EC] shadow-[0_8px_24px_rgba(255,106,0,0.12)] dark:border-orange-500/30 dark:bg-orange-500/10 dark:shadow-[0_0_30px_rgba(245,130,31,0.12)]"
                  : "border-[#3B82F6]/30 bg-[#EEF5FF] shadow-[0_8px_24px_rgba(59,130,246,0.12)] dark:border-teal-500/30 dark:bg-teal-500/10 dark:shadow-[0_0_30px_rgba(0,180,196,0.12)]"
              }`}>
                <Icon size={28} className={
                  color === "orange"
                    ? "text-[#FF6A00] dark:text-orange-400"
                    : "text-[#3B82F6] dark:text-teal-400"
                } />
                {/* step number */}
                <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold
                                 border bg-white border-[#E5E7EB] text-[#6B7280]
                                 dark:bg-navy-800 dark:border-navy-600 dark:text-navy-300">
                  {number}
                </span>
              </div>

              <h3 className="mb-3 text-lg font-bold text-[#1F2937] dark:text-white">{title}</h3>
              <p className="text-sm leading-relaxed max-w-xs mx-auto
                            text-[#6B7280] dark:text-navy-400">{description}</p>
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
          <p className="text-center text-xs font-semibold uppercase tracking-widest mb-6
                        text-[#9CA3AF] dark:text-navy-600">
            Supported carriers &amp; airlines
          </p>
          <div className="relative overflow-hidden">
            {/* fade edges */}
            <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none
                            bg-gradient-to-r from-[#EEF2F6] to-transparent
                            dark:from-navy-950 dark:to-transparent" />
            <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none
                            bg-gradient-to-l from-[#EEF2F6] to-transparent
                            dark:from-navy-950 dark:to-transparent" />
            <div className="flex animate-marquee gap-6 whitespace-nowrap">
              {[...CARRIERS, ...CARRIERS].map((c, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-lg px-4 py-2 text-xs font-semibold transition-colors flex-shrink-0
                             border bg-white border-[#E5E7EB] text-[#6B7280] hover:text-[#1F2937] hover:border-[#D1D5DB]
                             dark:border-navy-800 dark:bg-navy-900/60 dark:text-navy-400 dark:hover:text-white dark:hover:border-navy-700"
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
