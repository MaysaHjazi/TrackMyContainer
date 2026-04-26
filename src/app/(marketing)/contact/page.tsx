import type { Metadata } from "next"
import { Header }      from "@/frontend/components/layout/header"
import { Footer }      from "@/frontend/components/layout/footer"
import { ContactForm } from "@/frontend/components/marketing/contact-form"

export const metadata: Metadata = {
  title: "Contact Us — TrackMyContainer",
  description: "Get in touch for custom pricing and enterprise container tracking solutions.",
}

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#EEF2F6] dark:bg-navy-950">
        <div className="mx-auto max-w-2xl px-4 py-24">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-extrabold text-[#1F2937] dark:text-white">
              Contact Us for Custom Pricing
            </h1>
            <p className="mt-3 text-[#6B7280] dark:text-navy-400">
              Need unlimited container tracking or custom integrations?
              Tell us about your needs and we&apos;ll get back to you within 24 hours.
            </p>
          </div>
          <ContactForm />
        </div>
      </main>
      <Footer />
    </>
  )
}
