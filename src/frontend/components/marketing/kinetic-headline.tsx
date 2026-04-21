"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";

/**
 * Scroll-driven kinetic headline.
 * Inspired by terminal-industries.com.
 *
 * Three letters start spread across the viewport. As the user scrolls,
 * they glide together and each one "unfolds" the rest of its word —
 * forming a complete phrase (e.g. "Journey Across Seas") at the end.
 *
 * Customize the three words below — just keep the first letters of each
 * word matching the desired initials (J-A-S here).
 */

const WORDS = ["Journey", "Across", "Seas"];
const TOP_LABEL = "Every container takes a";
const BOTTOM_LABEL = "Track yours in real-time, from port to door.";

/* ── Single animated word unit ── */
function AnimatedWord({
  word,
  index,
  total,
  progress,
}: {
  word: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  const first = word[0];
  const rest = word.slice(1);

  // Horizontal offset: at progress=0 each letter is at its "spread" position,
  // at progress=0.6+ they're all snug together.
  // Center the middle letter — left letter goes negative, right letter positive.
  const spreadDistance = 340; // px between spread letters
  const offsetBase = (index - (total - 1) / 2) * spreadDistance;
  const x = useTransform(progress, [0, 0.6], [offsetBase, 0]);

  // Opacity of the "rest" of the word — starts invisible, fades in as the
  // letters converge.
  const restOpacity = useTransform(progress, [0.5, 0.85], [0, 1]);
  const restWidth   = useTransform(progress, [0.5, 0.85], ["0ch", `${rest.length}ch`]);

  return (
    <motion.div
      style={{ x }}
      className="relative inline-flex items-baseline"
    >
      {/* First letter — glowing, always visible */}
      <span className="font-serif text-white font-light tracking-tight
                       text-[5rem] sm:text-[7rem] lg:text-[9rem]
                       drop-shadow-[0_0_24px_rgba(255,255,255,0.35)]">
        {first}
      </span>

      {/* Rest of the word — fades in as letters converge */}
      <motion.span
        style={{ opacity: restOpacity, width: restWidth }}
        className="font-serif text-white/90 font-light tracking-tight
                   text-[5rem] sm:text-[7rem] lg:text-[9rem]
                   overflow-hidden whitespace-nowrap inline-block"
      >
        {rest}
      </motion.span>

      {/* Separator space (not on last word) */}
      {index < total - 1 && (
        <motion.span
          style={{ opacity: restOpacity }}
          className="font-serif text-white/80 font-light
                     text-[5rem] sm:text-[7rem] lg:text-[9rem]"
        >
          &nbsp;
        </motion.span>
      )}
    </motion.div>
  );
}

export function KineticHeadline() {
  const sectionRef = useRef<HTMLDivElement>(null);

  // Progress from 0 (section enters viewport) to 1 (section leaves)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  // Fade-in of the "That's the" label early in the scroll
  const topOpacity    = useTransform(scrollYProgress, [0, 0.25], [0, 1]);
  const bottomOpacity = useTransform(scrollYProgress, [0.7, 0.95], [0, 1]);

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#0A3A3A]"
      style={{ height: "250vh" }} // tall scroll area — longer = slower animation
    >
      {/* Grid background (subtle, like terminal-industries) */}
      <div
        className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      >
        {/* Radial glow behind letters */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(0,180,196,0.08) 0%, transparent 60%)",
          }}
        />

        {/* Noise grain */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          }}
        />

        {/* ── Content (sticky within tall scroll area) ── */}
        <div className="relative z-10 text-center px-4 w-full">
          {/* Top label */}
          <motion.p
            style={{ opacity: topOpacity }}
            className="mb-10 text-sm sm:text-base text-white/60 font-sans tracking-wide"
          >
            {TOP_LABEL}
          </motion.p>

          {/* Animated headline */}
          <div className="flex items-baseline justify-center whitespace-nowrap">
            {WORDS.map((word, i) => (
              <AnimatedWord
                key={i}
                word={word}
                index={i}
                total={WORDS.length}
                progress={scrollYProgress}
              />
            ))}
          </div>

          {/* Bottom caption */}
          <motion.p
            style={{ opacity: bottomOpacity }}
            className="mt-12 text-base sm:text-lg text-white/55 font-sans max-w-xl mx-auto"
          >
            {BOTTOM_LABEL}
          </motion.p>
        </div>

        {/* Small indicator square (like terminal-industries reference) */}
        <div className="absolute bottom-10 right-10 h-8 w-8 border border-white/20
                        bg-white/5 backdrop-blur-sm rounded-sm flex items-center justify-center">
          <div className="h-2 w-2 bg-white/40 rounded-sm" />
        </div>
      </div>
    </section>
  );
}
