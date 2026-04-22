import { Header } from "@/frontend/components/layout/header";
import { Footer } from "@/frontend/components/layout/footer";
import { TrackSearchForm } from "@/frontend/components/tracking/search-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Track Shipment — Free Container & AWB Tracking",
  description:
    "Enter any container number or air waybill to get real-time tracking status. Free · No account required · 160+ carriers.",
};

export default function TrackPage() {
  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-4rem)] flex items-center
                       bg-gradient-to-b from-[#F5F7FA] to-white
                       dark:from-navy-950 dark:to-navy-950">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">

          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6
                            bg-[#FFF4EC] dark:bg-orange-500/15">
              <span className="text-xs font-semibold uppercase tracking-wider
                               text-[#FF6A00] dark:text-orange-300">
                Free Tier
              </span>
            </div>
            <h1 className="text-3xl font-extrabold sm:text-4xl
                           text-[#1F2937] dark:text-white">
              Track Your Shipment
            </h1>
            <p className="mt-3 text-[#6B7280] dark:text-navy-300">
              Enter a container number (e.g.{" "}
              <code className="font-mono text-sm px-1.5 py-0.5 rounded
                               bg-[#F5F7FA] text-[#1F2937]
                               dark:bg-navy-800 dark:text-navy-100">MAEU1234567</code>
              ) or air waybill (e.g.{" "}
              <code className="font-mono text-sm px-1.5 py-0.5 rounded
                               bg-[#F5F7FA] text-[#1F2937]
                               dark:bg-navy-800 dark:text-navy-100">157-12345678</code>
              )
            </p>
          </div>

          <TrackSearchForm />

          {/* Supported carriers */}
          <div className="mt-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider mb-4
                          text-[#9CA3AF] dark:text-navy-500">
              Supported carriers include
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {["Maersk", "MSC", "CMA CGM", "Hapag-Lloyd", "COSCO", "Evergreen",
                "Emirates SkyCargo", "FedEx", "DHL Air", "Qatar Airways Cargo"].map((c) => (
                <span
                  key={c}
                  className="rounded-full px-3 py-1 text-xs border
                             border-[#E5E7EB] bg-white text-[#6B7280]
                             dark:border-navy-700 dark:bg-navy-900 dark:text-navy-300"
                >
                  {c}
                </span>
              ))}
              <span className="rounded-full px-3 py-1 text-xs border
                               border-[#E5E7EB] bg-white text-[#9CA3AF]
                               dark:border-navy-700 dark:bg-navy-900 dark:text-navy-400">
                + 150 more
              </span>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
