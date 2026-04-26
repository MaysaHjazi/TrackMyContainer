"use client"

import { useState } from "react"

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus("loading")
    setErrorMessage("")

    const form = e.currentTarget
    const data = {
      name:            (form.elements.namedItem("name")            as HTMLInputElement).value,
      email:           (form.elements.namedItem("email")           as HTMLInputElement).value,
      phone:           (form.elements.namedItem("phone")           as HTMLInputElement).value || undefined,
      containersCount: Number((form.elements.namedItem("containersCount") as HTMLInputElement).value),
      message:         (form.elements.namedItem("message")         as HTMLTextAreaElement).value || undefined,
    }

    if (!data.containersCount || data.containersCount < 1 || !Number.isInteger(data.containersCount)) {
      setErrorMessage("Please enter a valid number of containers (whole number, at least 1).")
      setStatus("error")
      return
    }

    try {
      const res = await fetch("/api/contact", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? "Something went wrong")
      }
      setStatus("success")
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong")
      setStatus("error")
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl bg-white dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-700 p-10 text-center shadow-sm">
        <div className="text-4xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-[#1F2937] dark:text-white">We&apos;ll be in touch soon!</h2>
        <p className="mt-2 text-[#6B7280] dark:text-navy-400">
          Thanks for reaching out. Our team typically responds within 24 hours.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-700 p-8 shadow-sm flex flex-col gap-5"
    >
      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-[#374151] dark:text-navy-200 mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name" name="name" type="text" required autoComplete="name"
          className="w-full rounded-xl border border-[#E5E7EB] dark:border-navy-600 bg-transparent px-4 py-2.5 text-sm text-[#1F2937] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/40"
          placeholder="Your name"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-[#374151] dark:text-navy-200 mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          id="email" name="email" type="email" required autoComplete="email"
          className="w-full rounded-xl border border-[#E5E7EB] dark:border-navy-600 bg-transparent px-4 py-2.5 text-sm text-[#1F2937] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/40"
          placeholder="you@company.com"
        />
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-[#374151] dark:text-navy-200 mb-1">
          Phone <span className="text-[#9CA3AF] font-normal">(optional)</span>
        </label>
        <input
          id="phone" name="phone" type="tel" autoComplete="tel"
          className="w-full rounded-xl border border-[#E5E7EB] dark:border-navy-600 bg-transparent px-4 py-2.5 text-sm text-[#1F2937] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/40"
          placeholder="+1 555 000 0000"
        />
      </div>

      {/* Containers per month */}
      <div>
        <label htmlFor="containersCount" className="block text-sm font-medium text-[#374151] dark:text-navy-200 mb-1">
          Containers per month <span className="text-red-500">*</span>
        </label>
        <input
          id="containersCount" name="containersCount" type="number" min="1" required
          className="w-full rounded-xl border border-[#E5E7EB] dark:border-navy-600 bg-transparent px-4 py-2.5 text-sm text-[#1F2937] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/40"
          placeholder="e.g. 50"
        />
      </div>

      {/* Message */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-[#374151] dark:text-navy-200 mb-1">
          Message <span className="text-[#9CA3AF] font-normal">(optional)</span>
        </label>
        <textarea
          id="message" name="message" rows={4}
          className="w-full rounded-xl border border-[#E5E7EB] dark:border-navy-600 bg-transparent px-4 py-2.5 text-sm text-[#1F2937] dark:text-white placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#FF6A00]/40 resize-none"
          placeholder="Tell us more about your needs..."
        />
      </div>

      {status === "error" && (
        <p className="text-sm text-red-500">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-2 rounded-xl bg-[#FF6A00] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_12px_rgba(255,106,0,0.25)] hover:bg-[#FF7A1A] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "loading" ? "Sending…" : "Send Message"}
      </button>
    </form>
  )
}
