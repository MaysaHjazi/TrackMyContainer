"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Zap } from "lucide-react";

interface Props {
  feature: string;
  description: string;
  children: ReactNode;
}

/**
 * Wraps a PRO-only feature with a soft, animated overlay.
 *
 * Animation timeline:
 *   0ms   — heavy blur + dark, content invisible
 *   200ms — content fades in with strong blur
 *   600ms — blur eases to a soft veil, content peeks through
 *   400ms — glass card scales up gently behind the blur
 *
 * Feels like content "developing" rather than being blocked.
 */
export function UpgradeOverlay({ feature, description, children }: Props) {
  const router = useRouter();

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Blurred content — starts dark and heavily blurred, eases into a soft veil */}
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0, filter: "blur(20px)" }}
        animate={{ opacity: 0.4, filter: "blur(5px)" }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none select-none h-full w-full"
      >
        {children}
      </motion.div>

      {/* Soft glassmorphism overlay — fades in last, after the blur settles */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
        className="absolute inset-0 flex items-center justify-center z-20 p-6"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-4 rounded-2xl
                     bg-white/[0.04] backdrop-blur-xl
                     border border-white/10
                     px-8 py-7 max-w-xs text-center
                     shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
        >
          {/* Soft icon with gentle pulsing glow */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7, ease: "backOut" }}
            className="relative"
          >
            <motion.div
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full bg-gradient-to-br from-teal-400/30 to-orange-400/30 blur-lg"
            />
            <div
              className="relative h-12 w-12 rounded-full
                         bg-gradient-to-br from-teal-500/15 to-orange-500/15
                         border border-white/10
                         flex items-center justify-center"
            >
              <Sparkles size={20} className="text-orange-300" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8, ease: "easeOut" }}
          >
            <h3 className="text-base font-semibold text-white/95 mb-1.5">{feature}</h3>
            <p className="text-sm text-white/55 leading-relaxed">{description}</p>
          </motion.div>

          {/* Gentle CTA */}
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.95, ease: "easeOut" }}
            onClick={() => router.push("/dashboard/billing")}
            className="group inline-flex items-center gap-1.5
                       rounded-lg bg-white/[0.05] hover:bg-white/[0.09]
                       border border-white/10 hover:border-white/20
                       px-4 py-2 text-sm font-medium text-white/90
                       transition-colors"
          >
            <Zap size={14} className="text-orange-300" />
            Available with PRO
            <ArrowRight
              size={14}
              className="opacity-60 group-hover:translate-x-0.5 transition-transform"
            />
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}

/**
 * Small inline upgrade badge for individual features.
 */
export function ProBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5
                 text-[10px] font-bold text-orange-400 uppercase tracking-wider"
    >
      <Zap size={10} />
      Pro
    </span>
  );
}
