import { z } from "zod";

// ── Shipment ─────────────────────────────────────────────────
export const createShipmentSchema = z.object({
  trackingNumber: z.string().min(1, "Tracking number is required").max(30),
  type: z.enum(["SEA", "AIR"]),
  nickname: z.string().max(100).optional(),
  reference: z.string().max(100).optional(),
  notifyEmail: z.boolean().default(true),
  notifyWhatsapp: z.boolean().default(false),
});

export const updateShipmentSchema = z.object({
  nickname: z.string().max(100).optional(),
  reference: z.string().max(100).optional(),
  notifyEmail: z.boolean().optional(),
  notifyWhatsapp: z.boolean().optional(),
  notifyMessenger: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// ── Settings ─────────────────────────────────────────────────
export const updateSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().regex(/^\+\d{10,15}$/, "Phone must be E.164 format (e.g. +12125551234)").optional().or(z.literal("")),
  whatsappOptIn: z.boolean().optional(),
});

// ── Bulk Import ──────────────────────────────────────────────
export const bulkImportRowSchema = z.object({
  trackingNumber: z.string().min(1).max(30),
  nickname: z.string().max(100).optional(),
  reference: z.string().max(100).optional(),
});

// ── Notifications ────────────────────────────────────────────
export const notificationQuerySchema = z.object({
  channel: z.enum(["EMAIL", "WHATSAPP", "MESSENGER", "IN_APP"]).optional(),
  type: z.string().optional(),
  unread: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Shipments Query ──────────────────────────────────────────
export const shipmentsQuerySchema = z.object({
  status: z.string().optional(),
  type: z.enum(["SEA", "AIR"]).optional(),
  search: z.string().optional(),
  favorite: z.coerce.boolean().optional(),
  sort: z.enum(["eta", "created", "status", "tracking"]).default("created"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
