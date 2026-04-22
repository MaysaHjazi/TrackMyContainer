"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Ship } from "lucide-react";

export function CtaSection() {
  return (
    <section className="relative py-24 overflow-hidden
                        bg-[#F5F7FA] dark:bg-navy-950">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r
                      from-transparent via-[#E5E7EB] to-transparent
                      dark:via-navy-700" />

      {/* glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full blur-[140px]
                        opacity-[0.12] dark:opacity-[0.06]"
          style={{ background: "radial-gradient(ellipse, #FF6A00 0%, transparent 70%)" }} />
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl
                          border border-[#FF6A00]/30 bg-[#FFF4EC] shadow-[0_12px_32px_rgba(255,106,0,0.15)]
                          dark:border-orange-500/30 dark:bg-orange-500/10 dark:shadow-[0_0_40px_rgba(245,130,31,0.15)]">
            <Ship size={28} className="text-[#FF6A00] dark:text-orange-400" />
          </div>

          <h2 className="text-4xl font-extrabold sm:text-5xl leading-tight mb-4
                         text-[#1F2937] dark:text-white">
            Start tracking{" "}
            <span className="bg-gradient-to-r bg-clip-text text-transparent
                             from-[#FF6A00] to-[#FF7A1A]
                             dark:from-orange-400 dark:to-orange-500">
              for free
            </span>
          </h2>
          <p className="text-lg max-w-xl mx-auto mb-10
                        text-[#6B7280] dark:text-navy-400">
            No credit card. No sign-up required for basic lookups.
            Get your first 5 container or AWB searches free — every day.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-bold text-white transition-all duration-200
                         bg-[#FF6A00] hover:bg-[#FF7A1A] shadow-[0_6px_20px_rgba(255,106,0,0.3)] hover:shadow-[0_10px_28px_rgba(255,106,0,0.4)]
                         dark:bg-gradient-to-r dark:from-orange-500 dark:to-orange-600 dark:hover:from-orange-600 dark:hover:to-orange-700
                         dark:shadow-lg dark:shadow-orange-500/25"
            >
              Get Started Free
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/track"
              className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold backdrop-blur-sm transition-all duration-200
                         border border-[#E5E7EB] bg-white text-[#1F2937] hover:border-[#D1D5DB] hover:bg-[#F5F7FA] shadow-[0_2px_8px_rgba(0,0,0,0.04)]
                         dark:border-navy-700 dark:bg-navy-900/60 dark:text-white dark:hover:border-navy-600 dark:hover:bg-navy-800/60 dark:shadow-none"
            >
              Try a Free Lookup
            </Link>
          </div>

          <p className="mt-6 text-xs text-[#9CA3AF] dark:text-navy-600">
            Pro plan from $29/mo · Cancel anytime · WhatsApp alerts included
          </p>
        </motion.div>
      </div>
    </section>
  );
}
