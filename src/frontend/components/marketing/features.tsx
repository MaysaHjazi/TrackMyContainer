"use client";

import { Ship, Plane, Bell, LayoutDashboard, MessageCircle, Globe } from "lucide-react";
import { motion, type Variants } from "framer-motion";

const FEATURES = [
  {
    icon: Ship, color: "teal",
    title: "Sea Freight Tracking",
    description: "Track containers across 160+ shipping lines including Maersk, MSC, CMA CGM, Hapag-Lloyd, COSCO, and more.",
  },
  {
    icon: Plane, color: "orange",
    title: "Air Cargo Tracking",
    description: "Monitor air waybills across 75+ airlines worldwide. Real-time updates from departure through final delivery.",
  },
  {
    icon: LayoutDashboard, color: "navy",
    title: "Live World Map Dashboard",
    description: "See all your shipments on an interactive 3D global map. Color-coded dots for sea and air freight.",
  },
  {
    icon: Bell, color: "orange",
    title: "WhatsApp Notifications",
    description: "Get instant alerts via WhatsApp when your ETA is 3 days out, when there's a delay, or when your shipment arrives.",
  },
  {
    icon: MessageCircle, color: "teal",
    title: "Messenger Bot",
    description: "Track shipments directly from Facebook Messenger. Just send a container number or AWB and get instant status.",
  },
  {
    icon: Globe, color: "navy",
    title: "Global Coverage",
    description: "All major trade lanes covered — Asia-Europe, Trans-Pacific, Middle East, Americas. Sea and air, end-to-end.",
  },
];

const COLOR_MAP = {
  teal:   { icon: "bg-teal-500/15 text-teal-400", glow: "group-hover:shadow-teal-500/10" },
  orange: { icon: "bg-orange-500/15 text-orange-400", glow: "group-hover:shadow-orange-500/10" },
  navy:   { icon: "bg-navy-700 text-navy-200", glow: "group-hover:shadow-navy-500/10" },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      delay: i * 0.1,
    },
  }),
};

const iconVariants: Variants = {
  hidden: { scale: 0.5, opacity: 0 },
  visible: (i: number) => ({
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
      delay: i * 0.1 + 0.2,
    },
  }),
};

export function Features() {
  return (
    <section className="relative py-24 bg-navy-950 overflow-hidden">
      {/* Subtle top divider */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-navy-700 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Everything you need to track{" "}
            <span className="bg-gradient-to-r from-teal-400 to-orange-400 bg-clip-text text-transparent">
              global shipments
            </span>
          </h2>
          <p className="mt-4 text-lg text-navy-400 max-w-2xl mx-auto">
            From a single free lookup to a full dashboard with automated alerts —
            Container<span className="text-orange-400"> Tracking</span> covers it all.
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, color, title, description }, i) => {
            const c = COLOR_MAP[color as keyof typeof COLOR_MAP];
            return (
              <motion.div
                key={title}
                variants={cardVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                custom={i}
                className={`group relative rounded-2xl border border-navy-800 bg-gradient-to-br from-navy-900 to-navy-950 p-7
                           hover:border-navy-700 transition-all duration-300 hover:shadow-xl ${c.glow}`}
              >
                <motion.div
                  variants={iconVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  custom={i}
                  className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl ${c.icon}`}
                >
                  <Icon size={22} />
                </motion.div>
                <h3 className="mb-2 text-base font-bold text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-navy-400">{description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
