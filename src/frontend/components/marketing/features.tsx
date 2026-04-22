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
  teal:   {
    icon: "bg-[#EEF5FF] text-[#3B82F6] dark:bg-teal-500/15 dark:text-teal-400",
    glow: "dark:group-hover:shadow-teal-500/10"
  },
  orange: {
    icon: "bg-[#FFF4EC] text-[#FF6A00] dark:bg-orange-500/15 dark:text-orange-400",
    glow: "dark:group-hover:shadow-orange-500/10"
  },
  navy:   {
    icon: "bg-[#F5F7FA] text-[#6B7280] dark:bg-navy-700 dark:text-navy-200",
    glow: "dark:group-hover:shadow-navy-500/10"
  },
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
    <section className="relative py-24 overflow-hidden
                        bg-[#F5F7FA] dark:bg-navy-950">
      {/* Subtle top divider */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r
                      from-transparent via-[#E5E7EB] to-transparent
                      dark:via-navy-700" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-extrabold sm:text-4xl
                         text-[#1F2937] dark:text-white">
            Everything you need to track{" "}
            <span className="bg-gradient-to-r bg-clip-text text-transparent
                             from-[#3B82F6] to-[#FF6A00]
                             dark:from-teal-400 dark:to-orange-400">
              global shipments
            </span>
          </h2>
          <p className="mt-4 text-lg max-w-2xl mx-auto
                        text-[#6B7280] dark:text-navy-400">
            From a single free lookup to a full dashboard with automated alerts —
            Container<span className="text-[#FF6A00] dark:text-orange-400"> Tracking</span> covers it all.
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
                className={`group relative rounded-2xl p-7 transition-all duration-300
                           border bg-white border-[#E5E7EB] shadow-[0_2px_10px_rgba(0,0,0,0.04)]
                           hover:border-[#D1D5DB] hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)]
                           dark:border-navy-800 dark:bg-gradient-to-br dark:from-navy-900 dark:to-navy-950 dark:shadow-none
                           dark:hover:border-navy-700 dark:hover:shadow-xl ${c.glow}`}
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
                <h3 className="mb-2 text-base font-bold text-[#1F2937] dark:text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-[#6B7280] dark:text-navy-400">{description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
