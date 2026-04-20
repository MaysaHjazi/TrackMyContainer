import Link from "next/link";
import { siteConfig } from "@/config/site";

export function Footer() {
  return (
    <footer className="border-t border-navy-800 bg-navy-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">

          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <div className="text-xl font-bold">
              Container<span className="text-orange-400"> Tracking</span>
            </div>
            <p className="mt-3 text-sm text-navy-400 leading-relaxed">
              Global sea container and air cargo tracking. Real-time, reliable, worldwide.
            </p>
            <div className="mt-4 flex gap-3">
              {["facebook", "instagram", "linkedin"].map((s) => (
                <a
                  key={s}
                  href={siteConfig.links[s as keyof typeof siteConfig.links]}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-800 text-navy-300
                             hover:bg-orange-500 hover:text-white transition-colors text-xs font-bold uppercase"
                >
                  {s[0]}
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-navy-500">Product</h3>
            <ul className="mt-4 space-y-2">
              {[
                { label: "Track Shipment", href: "/track" },
                { label: "Pricing", href: "/pricing" },
                { label: "Dashboard", href: "/dashboard" },
                { label: "API Docs", href: "/docs" },
                { label: "WhatsApp Alerts", href: "/features/whatsapp" },
              ].map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-navy-400 hover:text-orange-400 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Carriers */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-navy-500">Supported Carriers</h3>
            <ul className="mt-4 space-y-2">
              {["Maersk", "MSC", "CMA CGM", "Hapag-Lloyd", "COSCO", "Evergreen", "Emirates SkyCargo", "FedEx"].map((c) => (
                <li key={c} className="text-sm text-navy-400">{c}</li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-navy-500">Company</h3>
            <ul className="mt-4 space-y-2">
              {[
                { label: "About", href: "/about" },
                { label: "Blog", href: "/blog" },
                { label: "Contact", href: "/contact" },
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Terms of Service", href: "/terms" },
              ].map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-navy-400 hover:text-orange-400 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-navy-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-navy-500">
            &copy; {new Date().getFullYear()} Container Tracking — All rights reserved.
          </p>
          <div className="flex items-center gap-1 text-xs text-navy-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-40" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400" />
            </span>
            All systems operational
          </div>
        </div>
      </div>
    </footer>
  );
}
