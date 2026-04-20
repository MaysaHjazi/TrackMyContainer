"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Ship } from "lucide-react";

export function CtaSection() {
  return (
    <section className="relative py-24 bg-navy-950 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-navy-700 to-transparent" />

      {/* glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full blur-[140px] opacity-[0.06]"
          style={{ background: "radial-gradient(ellipse, #F5821F 0%, transparent 70%)" }} />
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/10 shadow-[0_0_40px_rgba(245,130,31,0.15)]">
            <Ship size={28} className="text-orange-400" />
          </div>

          <h2 className="text-4xl font-extrabold text-white sm:text-5xl leading-tight mb-4">
            Start tracking{" "}
            <span className="bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent">
              for free
            </span>
          </h2>
          <p className="text-lg text-navy-400 max-w-xl mx-auto mb-10">
            No credit card. No sign-up required for basic lookups.
            Get your first 5 container or AWB searches free — every day.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600
                         px-8 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/25
                         hover:from-orange-600 hover:to-orange-700 transition-all duration-200"
            >
              Get Started Free
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/track"
              className="inline-flex items-center gap-2 rounded-xl border border-navy-700 bg-navy-900/60
                         px-8 py-4 text-base font-semibold text-white backdrop-blur-sm
                         hover:border-navy-600 hover:bg-navy-800/60 transition-all duration-200"
            >
              Try a Free Lookup
            </Link>
          </div>

          <p className="mt-6 text-xs text-navy-600">
            Pro plan from $29/mo · Cancel anytime · WhatsApp alerts included
          </p>
        </motion.div>
      </div>
    </section>
  );
}
