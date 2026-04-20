"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2, AlertCircle, Pencil } from "lucide-react";

interface Props {
  shipmentId: string;
  trackingNumber: string;
  currentNickname: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditShipmentModal({
  shipmentId,
  trackingNumber,
  currentNickname,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [nickname, setNickname] = useState(currentNickname ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when the modal opens for a different shipment
  useEffect(() => {
    if (open) {
      setNickname(currentNickname ?? "");
      setError(null);
      setLoading(false);
    }
  }, [open, currentNickname]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const trimmed = nickname.trim();
      const res = await fetch(`/api/shipments/${shipmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: trimmed === "" ? null : trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Failed to update shipment. Please try again.",
        );
      }

      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2
                     rounded-2xl border border-navy-200 bg-white p-6 shadow-xl
                     dark:border-navy-700 dark:bg-navy-900
                     animate-in fade-in-0 zoom-in-95"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="flex items-center gap-2 text-lg font-extrabold text-navy-900 dark:text-white">
              <Pencil size={18} className="text-teal-500" />
              Edit Shipment
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
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
            <span className="font-mono text-navy-600 dark:text-navy-300">{trackingNumber}</span>
          </Dialog.Description>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5
                            dark:border-red-500/30 dark:bg-red-500/10">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-500 dark:text-red-400" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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
                autoFocus
                className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm
                           text-navy-900 placeholder:text-navy-400
                           focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20
                           dark:border-navy-700 dark:bg-navy-800 dark:text-white dark:placeholder:text-navy-500
                           dark:focus:border-teal-400 dark:focus:ring-teal-400/20"
              />
              <p className="mt-1 text-xs text-navy-400 dark:text-navy-500">
                Give this shipment a memorable name. Leave empty to remove.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={loading}
                  className="rounded-lg border border-navy-200 px-4 py-2 text-sm font-semibold text-navy-700
                             transition-colors hover:bg-navy-50
                             dark:border-navy-700 dark:text-navy-300 dark:hover:bg-navy-800
                             disabled:opacity-50"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-bold text-white
                           transition-colors hover:bg-teal-600
                           focus:outline-none focus:ring-2 focus:ring-teal-500/40
                           disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
