"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Star,
  Ship,
  Plane,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Share2,
  Trash2,
  ArrowRight,
  Loader2,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ShipmentStatus, ShipmentType } from "@prisma/client";
import { cn, getStatusColor, getStatusLabel, daysUntil } from "@/lib/utils";
import { EditShipmentModal } from "./edit-shipment-modal";

/* ── Types ──────────────────────────────────────────────────── */

interface TrackingEvent {
  id: string;
  status: ShipmentStatus;
  description: string;
  eventDate: string;
  location: string | null;
}

interface ShipmentRow {
  id: string;
  trackingNumber: string;
  type: ShipmentType;
  carrier: string | null;
  currentStatus: ShipmentStatus;
  origin: string | null;
  destination: string | null;
  etaDate: string | null;
  isFavorite: boolean;
  nickname: string | null;
  trackingEvents: TrackingEvent[];
}

interface Props {
  shipments: ShipmentRow[];
}

/* ── Filter tabs ────────────────────────────────────────────── */

const STATUS_FILTERS = [
  { label: "All", value: "ALL" },
  { label: "In Transit", value: "IN_TRANSIT" },
  { label: "Delayed", value: "DELAYED" },
  { label: "Delivered", value: "DELIVERED" },
] as const;

/* ── ETA text helper ────────────────────────────────────────── */

// Statuses that mean the shipment has reached its destination (on time or late)
const ARRIVED_STATUSES: ShipmentStatus[] = ["DELIVERED", "AT_PORT", "OUT_FOR_DELIVERY"];

function etaText(etaDate: string | null, status: ShipmentStatus) {
  // Arrived = show green regardless of ETA
  if (ARRIVED_STATUSES.includes(status))
    return { text: "Arrived", className: "text-green-600 dark:text-green-400" };

  if (!etaDate) return { text: "—", className: "text-navy-400" };

  // Still in transit — check if overdue
  const days = daysUntil(etaDate);
  if (days < 0) return { text: "Overdue", className: "text-red-500 dark:text-red-400" };
  if (days === 0) return { text: "Today", className: "text-orange-500 dark:text-orange-400 font-bold" };
  if (days === 1) return { text: "Tomorrow", className: "text-orange-500 dark:text-orange-400" };
  if (days <= 3) return { text: `${days} days`, className: "text-orange-500 dark:text-orange-400" };
  return { text: `${days} days`, className: "text-navy-500 dark:text-navy-300" };
}

/* ── Component ──────────────────────────────────────────────── */

export function ShipmentsTable({ shipments }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    id: string;
    trackingNumber: string;
    nickname: string | null;
  } | null>(null);

  /* Client-side filtering */
  const filtered = useMemo(() => {
    let list = shipments;

    if (statusFilter !== "ALL") {
      if (statusFilter === "IN_TRANSIT") {
        list = list.filter((s) =>
          ["IN_TRANSIT", "TRANSSHIPMENT", "AT_PORT", "OUT_FOR_DELIVERY", "BOOKED", "PICKED_UP"].includes(s.currentStatus),
        );
      } else {
        list = list.filter((s) => s.currentStatus === statusFilter);
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.trackingNumber.toLowerCase().includes(q) ||
          s.nickname?.toLowerCase().includes(q) ||
          s.carrier?.toLowerCase().includes(q) ||
          s.origin?.toLowerCase().includes(q) ||
          s.destination?.toLowerCase().includes(q),
      );
    }

    return list;
  }, [shipments, search, statusFilter]);

  /* ── Mutations ─────────────────────────────────────────────── */

  async function toggleFavorite(id: string, current: boolean) {
    setLoadingId(id);
    try {
      await fetch(`/api/shipments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !current }),
      });
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  async function deleteShipment(id: string, trackingNumber: string) {
    if (!confirm(`Delete shipment ${trackingNumber}? This cannot be undone.`)) return;
    setLoadingId(id);
    try {
      await fetch(`/api/shipments/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  async function shareShipment(trackingNumber: string) {
    const url = `${window.location.origin}/track/${trackingNumber}`;
    await navigator.clipboard.writeText(url);
    alert("Share link copied to clipboard!");
  }

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative max-w-sm flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 dark:text-navy-500"
          />
          <input
            type="text"
            placeholder="Search tracking #, carrier, route..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-navy-200 bg-white py-2 pl-9 pr-3 text-sm
                       text-navy-900 placeholder:text-navy-400
                       focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20
                       dark:border-navy-700 dark:bg-navy-900 dark:text-white dark:placeholder:text-navy-500
                       dark:focus:border-teal-400 dark:focus:ring-teal-400/20"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 rounded-lg border border-navy-200 bg-navy-50 p-1 dark:border-navy-700 dark:bg-navy-900">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                statusFilter === f.value
                  ? "bg-white text-navy-900 shadow-sm dark:bg-navy-700 dark:text-white"
                  : "text-navy-500 hover:text-navy-700 dark:text-navy-400 dark:hover:text-navy-200",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-xl border border-navy-200 bg-white shadow-sm dark:border-navy-800 dark:bg-navy-900">
        {/* Desktop table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-100 dark:border-navy-800">
                <th className="w-10 px-4 py-3" />
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-navy-500">
                  Tracking #
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-navy-500">
                  Carrier
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-navy-500">
                  Status
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-navy-500 md:table-cell">
                  Route
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-navy-500 lg:table-cell">
                  ETA
                </th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100 dark:divide-navy-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Ship size={32} className="text-navy-300 dark:text-navy-600" />
                      <p className="text-sm font-medium text-navy-500 dark:text-navy-400">
                        {search || statusFilter !== "ALL"
                          ? "No shipments match your filters"
                          : "No shipments yet"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const eta = etaText(s.etaDate, s.currentStatus);
                  return (
                    <tr
                      key={s.id}
                      className="group transition-colors hover:bg-navy-50/60 dark:hover:bg-navy-800/50"
                    >
                      {/* Favorite star */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleFavorite(s.id, s.isFavorite)}
                          disabled={loadingId === s.id}
                          className="transition-colors"
                          aria-label={s.isFavorite ? "Remove from favorites" : "Add to favorites"}
                        >
                          <Star
                            size={16}
                            className={cn(
                              "transition-colors",
                              s.isFavorite
                                ? "fill-orange-400 text-orange-400"
                                : "text-navy-300 hover:text-orange-400 dark:text-navy-600 dark:hover:text-orange-400",
                            )}
                          />
                        </button>
                      </td>

                      {/* Tracking # + type */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/shipments/${s.id}`}
                          className="group/link flex items-center gap-2"
                        >
                          <div className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-md flex-shrink-0",
                            s.type === "SEA"
                              ? "bg-teal-50 dark:bg-teal-500/15"
                              : "bg-orange-50 dark:bg-orange-500/15",
                          )}>
                            {s.type === "SEA" ? (
                              <Ship size={14} className="text-teal-600 dark:text-teal-400" />
                            ) : (
                              <Plane size={14} className="text-orange-500 dark:text-orange-400" />
                            )}
                          </div>
                          <div>
                            <span className="font-mono text-sm font-bold text-navy-900 group-hover/link:text-teal-600 dark:text-white dark:group-hover/link:text-teal-400 transition-colors">
                              {s.trackingNumber}
                            </span>
                            {s.nickname && (
                              <p className="text-xs text-navy-400 dark:text-navy-500 truncate max-w-[200px]">
                                {s.nickname}
                              </p>
                            )}
                          </div>
                        </Link>
                      </td>

                      {/* Carrier */}
                      <td className="px-4 py-3 text-navy-600 dark:text-navy-300">
                        {s.carrier ?? "—"}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
                            getStatusColor(s.currentStatus),
                          )}
                        >
                          {getStatusLabel(s.currentStatus)}
                        </span>
                      </td>

                      {/* Route */}
                      <td className="hidden px-4 py-3 md:table-cell">
                        {s.origin || s.destination ? (
                          <div className="flex items-center gap-1.5 text-xs text-navy-600 dark:text-navy-300">
                            <span className="max-w-[100px] truncate">{s.origin ?? "—"}</span>
                            <ArrowRight size={12} className="flex-shrink-0 text-navy-400" />
                            <span className="max-w-[100px] truncate">{s.destination ?? "—"}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-navy-400">—</span>
                        )}
                      </td>

                      {/* ETA */}
                      <td className={cn("hidden px-4 py-3 text-xs font-semibold lg:table-cell", eta.className)}>
                        {eta.text}
                      </td>

                      {/* Actions dropdown */}
                      <td className="px-4 py-3">
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button
                              className="flex h-8 w-8 items-center justify-center rounded-md
                                         text-navy-400 transition-colors
                                         hover:bg-navy-100 hover:text-navy-600
                                         dark:text-navy-500 dark:hover:bg-navy-800 dark:hover:text-navy-200"
                              aria-label="Shipment actions"
                            >
                              <MoreHorizontal size={16} />
                            </button>
                          </DropdownMenu.Trigger>

                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              align="end"
                              sideOffset={4}
                              className="z-50 min-w-[160px] rounded-lg border border-navy-200 bg-white p-1
                                         shadow-lg dark:border-navy-700 dark:bg-navy-900
                                         animate-in fade-in-0 zoom-in-95"
                            >
                              <DropdownMenu.Item asChild>
                                <Link
                                  href={`/dashboard/shipments/${s.id}`}
                                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-navy-700
                                             outline-none hover:bg-navy-50 dark:text-navy-200 dark:hover:bg-navy-800
                                             cursor-pointer"
                                >
                                  <Eye size={14} />
                                  View Details
                                </Link>
                              </DropdownMenu.Item>

                              <DropdownMenu.Item
                                onSelect={() =>
                                  setEditing({ id: s.id, trackingNumber: s.trackingNumber, nickname: s.nickname })
                                }
                                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-navy-700
                                           outline-none hover:bg-navy-50 dark:text-navy-200 dark:hover:bg-navy-800
                                           cursor-pointer"
                              >
                                <Pencil size={14} />
                                Edit
                              </DropdownMenu.Item>

                              <DropdownMenu.Item
                                onSelect={() => shareShipment(s.trackingNumber)}
                                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-navy-700
                                           outline-none hover:bg-navy-50 dark:text-navy-200 dark:hover:bg-navy-800
                                           cursor-pointer"
                              >
                                <Share2 size={14} />
                                Share
                              </DropdownMenu.Item>

                              <DropdownMenu.Separator className="my-1 h-px bg-navy-100 dark:bg-navy-800" />

                              <DropdownMenu.Item
                                onSelect={() => deleteShipment(s.id, s.trackingNumber)}
                                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600
                                           outline-none hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10
                                           cursor-pointer"
                              >
                                <Trash2 size={14} />
                                Delete
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        {filtered.length > 0 && (
          <div className="border-t border-navy-100 px-4 py-3 dark:border-navy-800">
            <p className="text-xs text-navy-400 dark:text-navy-500">
              Showing {filtered.length} of {shipments.length} shipment{shipments.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      <EditShipmentModal
        shipmentId={editing?.id ?? ""}
        trackingNumber={editing?.trackingNumber ?? ""}
        currentNickname={editing?.nickname ?? null}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </div>
  );
}
