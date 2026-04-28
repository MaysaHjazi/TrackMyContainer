"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, Ship, Plane, Loader2, AlertCircle, Mail, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Auto-detect shipment type from tracking number ──────── */

function detectType(value: string): "SEA" | "AIR" | null {
  const clean = value.trim().toUpperCase();
  if (!clean) return null;

  // AWB pattern: 3 digits, dash (optional), 8 digits
  if (/^\d{3}-?\d{8}$/.test(clean)) return "AIR";
  // Common container prefix: 4 alpha + 7 digits
  if (/^[A-Z]{4}\d{7}$/.test(clean)) return "SEA";
  // BL number patterns (various formats)
  if (/^[A-Z]{3,4}[A-Z0-9]{5,10}$/.test(clean)) return "SEA";

  return null;
}

/* ── Component ──────────────────────────────────────────────── */

export function AddShipmentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Form state
  const [trackingNumber, setTrackingNumber] = useState("");
  const [type, setType] = useState<"SEA" | "AIR">("SEA");
  const [nickname, setNickname] = useState("");
  const [reference, setReference] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectedType = detectType(trackingNumber);

  const handleTrackingChange = useCallback((value: string) => {
    setTrackingNumber(value.toUpperCase());
    const detected = detectType(value);
    if (detected) setType(detected);
    setError(null);
  }, []);

  function resetForm() {
    setTrackingNumber("");
    setType("SEA");
    setNickname("");
    setReference("");
    setNotifyEmail(true);
    setNotifyWhatsapp(false);
    setError(null);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trackingNumber.trim()) {
      setError("Tracking number is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingNumber: trackingNumber.trim().toUpperCase(),
          type,
          nickname:  nickname.trim()  || undefined,
          reference: reference.trim() || undefined,
          notifyEmail,
          notifyWhatsapp,
        }),
      });

      if (res.ok) {
        resetForm();
        setOpen(false);
        router.refresh();
        return;
      }

      const data = await res.json().catch(() => ({}));
      throw new Error(
        typeof data.error === "string"
          ? data.error
          : data?.message ?? "Failed to add shipment. Please check the tracking number.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <Dialog.Trigger asChild>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5
                     text-sm font-bold text-white shadow-sm
                     transition-colors hover:bg-orange-600
                     focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        >
          <Plus size={16} />
          Add Shipment
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2
                     rounded-2xl border border-navy-200 bg-white p-6 shadow-xl
                     dark:border-navy-700 dark:bg-navy-900
                     animate-in fade-in-0 zoom-in-95"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-extrabold text-navy-900 dark:text-white">
              Track a Shipment
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg
                           text-navy-400 transition-colors hover:bg-navy-100 hover:text-navy-600
                           dark:text-navy-500 dark:hover:bg-navy-800 dark:hover:text-navy-200"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="mt-1 text-sm text-navy-400 dark:text-navy-400">
            Enter a container number or air waybill to start tracking.
          </Dialog.Description>

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5
                            dark:border-red-500/30 dark:bg-red-500/10">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-500 dark:text-red-400" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {/* Tracking number */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-navy-500 dark:text-navy-400 mb-1.5">
                Tracking Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => handleTrackingChange(e.target.value)}
                placeholder="e.g. MAEU1234567 or 157-12345678"
                autoFocus
                className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 font-mono text-sm
                           text-navy-900 placeholder:text-navy-400
                           focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20
                           dark:border-navy-700 dark:bg-navy-800 dark:text-white dark:placeholder:text-navy-500
                           dark:focus:border-teal-400 dark:focus:ring-teal-400/20"
              />
            </div>

            {/* Type selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-navy-500 dark:text-navy-400 mb-1.5">
                Shipment Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setType("SEA")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-all",
                    type === "SEA"
                      ? "border-teal-500 bg-teal-50 text-teal-700 dark:border-teal-400 dark:bg-teal-500/15 dark:text-teal-300"
                      : "border-navy-200 text-navy-500 hover:border-navy-300 dark:border-navy-700 dark:text-navy-400 dark:hover:border-navy-600",
                  )}
                >
                  <Ship size={16} />
                  Sea Freight
                  {detectedType === "SEA" && (
                    <span className="rounded bg-teal-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      DETECTED
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setType("AIR")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-all",
                    type === "AIR"
                      ? "border-orange-500 bg-orange-50 text-orange-700 dark:border-orange-400 dark:bg-orange-500/15 dark:text-orange-300"
                      : "border-navy-200 text-navy-500 hover:border-navy-300 dark:border-navy-700 dark:text-navy-400 dark:hover:border-navy-600",
                  )}
                >
                  <Plane size={16} />
                  Air Cargo
                  {detectedType === "AIR" && (
                    <span className="rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      DETECTED
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Nickname */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-navy-500 dark:text-navy-400 mb-1.5">
                Nickname <span className="text-navy-300 dark:text-navy-600 font-normal normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Order #1234"
                maxLength={100}
                className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm
                           text-navy-900 placeholder:text-navy-400
                           focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20
                           dark:border-navy-700 dark:bg-navy-800 dark:text-white dark:placeholder:text-navy-500
                           dark:focus:border-teal-400 dark:focus:ring-teal-400/20"
              />
            </div>

            {/* Reference */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-navy-500 dark:text-navy-400 mb-1.5">
                Reference <span className="text-navy-300 dark:text-navy-600 font-normal normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. PO-2024-5678"
                maxLength={100}
                className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm
                           text-navy-900 placeholder:text-navy-400
                           focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20
                           dark:border-navy-700 dark:bg-navy-800 dark:text-white dark:placeholder:text-navy-500
                           dark:focus:border-teal-400 dark:focus:ring-teal-400/20"
              />
            </div>

            {/* Notification toggles */}
            <div className="space-y-3 rounded-lg border border-navy-100 bg-navy-50/50 p-3 dark:border-navy-800 dark:bg-navy-800/50">
              <p className="text-xs font-bold uppercase tracking-wider text-navy-500 dark:text-navy-400">
                Notifications
              </p>

              {/* Email toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-navy-400 dark:text-navy-500" />
                  <span className="text-sm text-navy-700 dark:text-navy-300">Email notifications</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifyEmail}
                  onClick={() => setNotifyEmail(!notifyEmail)}
                  className={cn(
                    "relative h-5 w-9 rounded-full transition-colors",
                    notifyEmail
                      ? "bg-teal-500 dark:bg-teal-400"
                      : "bg-navy-300 dark:bg-navy-600",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                      notifyEmail && "translate-x-4",
                    )}
                  />
                </button>
              </label>

              {/* WhatsApp toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <MessageCircle size={14} className="text-navy-400 dark:text-navy-500" />
                  <span className="text-sm text-navy-700 dark:text-navy-300">WhatsApp notifications</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifyWhatsapp}
                  onClick={() => setNotifyWhatsapp(!notifyWhatsapp)}
                  className={cn(
                    "relative h-5 w-9 rounded-full transition-colors",
                    notifyWhatsapp
                      ? "bg-teal-500 dark:bg-teal-400"
                      : "bg-navy-300 dark:bg-navy-600",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                      notifyWhatsapp && "translate-x-4",
                    )}
                  />
                </button>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !trackingNumber.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3
                         text-sm font-bold text-white shadow-sm
                         transition-colors hover:bg-orange-600
                         disabled:cursor-not-allowed disabled:opacity-60
                         focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Tracking...
                </>
              ) : (
                <>
                  <Ship size={16} />
                  Track Shipment
                </>
              )}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
