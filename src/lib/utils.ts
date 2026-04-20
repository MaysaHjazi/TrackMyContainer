import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format, differenceInDays } from "date-fns";
import type { ShipmentStatus, ShipmentType } from "@prisma/client";

// ── Tailwind class merging ────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Date helpers ──────────────────────────────────────────────
export function relativeDate(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDate(date: Date | string, fmt = "MMM d, yyyy"): string {
  return format(new Date(date), fmt);
}

export function daysUntil(date: Date | string): number {
  return differenceInDays(new Date(date), new Date());
}

// ── Status helpers ────────────────────────────────────────────
export const STATUS_LABELS: Record<ShipmentStatus, string> = {
  UNKNOWN:          "Unknown",
  BOOKED:           "Booked",
  PICKED_UP:        "Picked Up",
  IN_TRANSIT:       "In Transit",
  TRANSSHIPMENT:    "Transshipment",
  AT_PORT:          "At Port",
  CUSTOMS_HOLD:     "Customs Hold",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED:        "Delivered",
  DELAYED:          "Delayed",
  EXCEPTION:        "Exception",
};

export const STATUS_COLORS: Record<ShipmentStatus, string> = {
  UNKNOWN:          "status-unknown",
  BOOKED:           "status-unknown",
  PICKED_UP:        "status-in-transit",
  IN_TRANSIT:       "status-in-transit",
  TRANSSHIPMENT:    "status-in-transit",
  AT_PORT:          "status-at-port",
  CUSTOMS_HOLD:     "status-customs-hold",
  OUT_FOR_DELIVERY: "status-in-transit",
  DELIVERED:        "status-delivered",
  DELAYED:          "status-delayed",
  EXCEPTION:        "status-exception",
};

export function getStatusLabel(status: ShipmentStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function getStatusColor(status: ShipmentStatus): string {
  return STATUS_COLORS[status] ?? "status-unknown";
}

export function isActiveStatus(status: ShipmentStatus): boolean {
  return !["DELIVERED", "EXCEPTION"].includes(status);
}

// ── Shipment type helpers ─────────────────────────────────────
export function getTypeLabel(type: ShipmentType): string {
  return type === "SEA" ? "Sea Freight" : "Air Cargo";
}

export function getTypeIcon(type: ShipmentType): string {
  return type === "SEA" ? "🚢" : "✈️";
}

// ── Tracking number formatting ────────────────────────────────
export function formatTrackingNumber(number: string, type: ShipmentType): string {
  const clean = number.trim().toUpperCase();
  if (type === "AIR") {
    // Format AWB: XXX-XXXXXXXX
    const match = clean.replace("-", "").match(/^(\d{3})(\d{8})$/);
    if (match) return `${match[1]}-${match[2]}`;
  }
  return clean;
}

// ── Plan helpers ──────────────────────────────────────────────
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

// ── API helpers ───────────────────────────────────────────────
export function getBaseUrl(): string {
  if (typeof window !== "undefined") return "";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

// ── Error helpers ─────────────────────────────────────────────
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred";
}
