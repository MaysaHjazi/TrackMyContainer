import { Header }          from "@/frontend/components/layout/header";
import { Hero }             from "@/frontend/components/marketing/hero";
import { KineticHeadline }  from "@/frontend/components/marketing/kinetic-headline";
import { HowItWorks }       from "@/frontend/components/marketing/how-it-works";
import { Features }         from "@/frontend/components/marketing/features";
import { PricingCards }     from "@/frontend/components/marketing/pricing-cards";
import { CtaSection }       from "@/frontend/components/marketing/cta-section";
import { Footer }           from "@/frontend/components/layout/footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Container Tracking — Global Sea & Air Freight Tracking",
  description:
    "Track any shipping container or air waybill in real-time. 160+ carriers worldwide. Free lookup · Paid dashboard · WhatsApp alerts.",
};

export default function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <KineticHeadline />
        <HowItWorks />
        <Features />
        <PricingCards />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}
