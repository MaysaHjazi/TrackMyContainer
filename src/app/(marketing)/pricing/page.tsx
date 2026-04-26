import type { Metadata } from "next"
import { Header }       from "@/frontend/components/layout/header"
import { Footer }       from "@/frontend/components/layout/footer"
import { PricingCards } from "@/frontend/components/marketing/pricing-cards"

export const metadata: Metadata = {
  title: "Pricing — TrackMyContainer",
  description: "Simple pricing for container tracking. Free tier, PRO at $35/month, or Custom for enterprise.",
}

export default function PricingPage() {
  return (
    <>
      <Header />
      <main>
        {/* small hero above the pricing cards */}
        <section className="bg-[#EEF2F6] dark:bg-navy-950 pt-24 pb-8 text-center px-4">
          <h1 className="text-4xl font-extrabold text-[#1F2937] dark:text-white">
            Pricing
          </h1>
          <p className="mt-3 text-lg text-[#6B7280] dark:text-navy-400 max-w-xl mx-auto">
            Start free. Scale when you&apos;re ready.
          </p>
        </section>
        <PricingCards />
      </main>
      <Footer />
    </>
  )
}
