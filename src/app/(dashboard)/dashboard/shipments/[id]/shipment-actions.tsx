"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Share2, Pencil, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EditShipmentModal } from "@/frontend/components/dashboard/edit-shipment-modal";

interface Props {
  shipmentId: string;
  trackingNumber: string;
  nickname: string | null;
  isFavorite: boolean;
}

export function ShipmentActions({ shipmentId, trackingNumber, nickname, isFavorite }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  async function toggleFavorite() {
    setLoading("favorite");
    try {
      await fetch(`/api/shipments/${shipmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !isFavorite }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function shareShipment() {
    const url = `${window.location.origin}/track/${trackingNumber}`;
    await navigator.clipboard.writeText(url);
    alert("Share link copied to clipboard!");
  }

  async function deleteShipment() {
    if (!confirm(`Delete shipment ${trackingNumber}? This cannot be undone.`)) return;
    setLoading("delete");
    try {
      await fetch(`/api/shipments/${shipmentId}`, { method: "DELETE" });
      router.push("/dashboard/shipments");
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-navy-500">
          Actions
        </h4>

        <button
          onClick={toggleFavorite}
          disabled={loading === "favorite"}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors",
            isFavorite
              ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300 dark:hover:bg-orange-500/20"
              : "border-navy-200 text-navy-700 hover:bg-navy-50 dark:border-navy-700 dark:text-navy-300 dark:hover:bg-navy-800",
          )}
        >
          {loading === "favorite" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Star
              size={16}
              className={cn(isFavorite && "fill-orange-400 text-orange-400")}
            />
          )}
          {isFavorite ? "Remove from Favorites" : "Add to Favorites"}
        </button>

        <button
          onClick={() => setEditOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-navy-200 px-3 py-2.5 text-sm
                     font-semibold text-navy-700 transition-colors hover:bg-navy-50
                     dark:border-navy-700 dark:text-navy-300 dark:hover:bg-navy-800"
        >
          <Pencil size={16} />
          Edit Shipment
        </button>

        <button
          onClick={shareShipment}
          className="flex w-full items-center gap-2 rounded-lg border border-navy-200 px-3 py-2.5 text-sm
                     font-semibold text-navy-700 transition-colors hover:bg-navy-50
                     dark:border-navy-700 dark:text-navy-300 dark:hover:bg-navy-800"
        >
          <Share2 size={16} />
          Share Tracking
        </button>

        <button
          onClick={deleteShipment}
          disabled={loading === "delete"}
          className="flex w-full items-center gap-2 rounded-lg border border-red-200 px-3 py-2.5 text-sm
                     font-semibold text-red-600 transition-colors hover:bg-red-50
                     dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
        >
          {loading === "delete" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Trash2 size={16} />
          )}
          Delete Shipment
        </button>
      </div>

      <EditShipmentModal
        shipmentId={shipmentId}
        trackingNumber={trackingNumber}
        currentNickname={nickname}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
