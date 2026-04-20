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
      <main className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-navy-50 to-white flex items-center">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">

          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-navy-100 px-4 py-1.5 mb-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-navy-600">
                Free Tier
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-navy-600 sm:text-4xl">
              Track Your Shipment
            </h1>
            <p className="mt-3 text-navy-400">
              Enter a container number (e.g.{" "}
              <code className="font-mono text-sm bg-navy-100 px-1.5 py-0.5 rounded text-navy-600">MAEU1234567</code>
              ) or air waybill (e.g.{" "}
              <code className="font-mono text-sm bg-navy-100 px-1.5 py-0.5 rounded text-navy-600">157-12345678</code>
              )
            </p>
          </div>

          <TrackSearchForm />

          {/* Supported carriers */}
          <div className="mt-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-300 mb-4">
              Supported carriers include
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {["Maersk", "MSC", "CMA CGM", "Hapag-Lloyd", "COSCO", "Evergreen",
                "Emirates SkyCargo", "FedEx", "DHL Air", "Qatar Airways Cargo"].map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-navy-200 bg-white px-3 py-1 text-xs text-navy-500"
                >
                  {c}
                </span>
              ))}
              <span className="rounded-full border border-navy-200 bg-white px-3 py-1 text-xs text-navy-400">
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
