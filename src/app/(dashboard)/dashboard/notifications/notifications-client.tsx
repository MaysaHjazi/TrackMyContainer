"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShieldAlert,
  Mail,
  MessageCircle,
  Smartphone,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────

type NotificationChannel = "EMAIL" | "WHATSAPP" | "MESSENGER" | "IN_APP";
type NotificationType =
  | "ETA_UPDATE"
  | "ETA_IMMINENT"
  | "DELAY_ALERT"
  | "ARRIVAL_NOTICE"
  | "STATUS_CHANGE"
  | "CUSTOMS_HOLD"
  | "EXCEPTION"
  | "WELCOME"
  | "SUBSCRIPTION_CHANGE"
  | "SUBSCRIPTION_EXPIRING";
type NotificationStatus = "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "READ";

interface SerializedNotification {
  id: string;
  channel: NotificationChannel;
  type: NotificationType;
  subject: string | null;
  body: string;
  status: NotificationStatus;
  shipmentId: string | null;
  shipmentTrackingNumber: string | null;
  shipmentCarrier: string | null;
  createdAt: string;
  sentAt: string | null;
}

type FilterTab = "all" | "unread" | "status_changes" | "delays" | "arrivals";

// ── Helpers ──────────────────────────────────────────────────

const TYPE_ICONS: Record<string, typeof Bell> = {
  ETA_UPDATE: Clock,
  ETA_IMMINENT: Clock,
  DELAY_ALERT: AlertTriangle,
  ARRIVAL_NOTICE: CheckCircle,
  STATUS_CHANGE: Bell,
  CUSTOMS_HOLD: ShieldAlert,
  EXCEPTION: AlertTriangle,
  WELCOME: Bell,
  SUBSCRIPTION_CHANGE: Bell,
  SUBSCRIPTION_EXPIRING: AlertTriangle,
};

const TYPE_ICON_COLORS: Record<string, string> = {
  ETA_UPDATE: "text-teal-500",
  ETA_IMMINENT: "text-orange-500",
  DELAY_ALERT: "text-orange-500",
  ARRIVAL_NOTICE: "text-emerald-500",
  STATUS_CHANGE: "text-teal-500",
  CUSTOMS_HOLD: "text-red-500",
  EXCEPTION: "text-red-500",
  WELCOME: "text-navy-500 dark:text-navy-300",
  SUBSCRIPTION_CHANGE: "text-navy-500 dark:text-navy-300",
  SUBSCRIPTION_EXPIRING: "text-orange-500",
};

const CHANNEL_BADGES: Record<NotificationChannel, { label: string; icon: typeof Mail }> = {
  EMAIL: { label: "Email", icon: Mail },
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle },
  MESSENGER: { label: "Messenger", icon: MessageCircle },
  IN_APP: { label: "In-App", icon: Smartphone },
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "status_changes", label: "Status Changes" },
  { key: "delays", label: "Delays" },
  { key: "arrivals", label: "Arrivals" },
];

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function filterNotifications(
  notifications: SerializedNotification[],
  tab: FilterTab
): SerializedNotification[] {
  switch (tab) {
    case "unread":
      return notifications.filter((n) => n.status !== "READ");
    case "status_changes":
      return notifications.filter((n) => n.type === "STATUS_CHANGE");
    case "delays":
      return notifications.filter(
        (n) => n.type === "DELAY_ALERT" || n.type === "EXCEPTION"
      );
    case "arrivals":
      return notifications.filter(
        (n) => n.type === "ARRIVAL_NOTICE" || n.type === "ETA_IMMINENT"
      );
    default:
      return notifications;
  }
}

// ── Component ────────────────────────────────────────────────

interface Props {
  notifications: SerializedNotification[];
}

export function NotificationsClient({ notifications: initial }: Props) {
  const [notifications, setNotifications] = useState(initial);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [isPending, startTransition] = useTransition();

  const filtered = filterNotifications(notifications, activeTab);
  const unreadCount = notifications.filter((n) => n.status !== "READ").length;

  async function handleMarkAllRead() {
    startTransition(async () => {
      try {
        await fetch("/api/notifications/mark-all-read", { method: "PATCH" });
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, status: "READ" as NotificationStatus }))
        );
      } catch {
        // silently fail
      }
    });
  }

  async function handleMarkRead(id: string) {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, status: "READ" as NotificationStatus } : n
        )
      );
    } catch {
      // silently fail
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-navy-900 dark:text-white">
            Notifications
          </h2>
          {unreadCount > 0 && (
            <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
              {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={isPending}
            className="rounded-lg border border-navy-200 bg-white px-4 py-2 text-sm font-medium
                       text-navy-700 transition-colors hover:bg-navy-50
                       disabled:opacity-50
                       dark:border-navy-700 dark:bg-navy-800 dark:text-navy-200
                       dark:hover:bg-navy-700"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg bg-navy-100 p-1 dark:bg-navy-800">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === key
                ? "bg-white text-navy-900 shadow-sm dark:bg-navy-700 dark:text-white"
                : "text-navy-500 hover:text-navy-700 dark:text-navy-400 dark:hover:text-navy-200"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-navy-200
                        bg-white py-16 dark:border-navy-800 dark:bg-navy-900">
          <Inbox size={48} className="text-navy-300 dark:text-navy-600" />
          <p className="mt-4 text-lg font-semibold text-navy-700 dark:text-navy-300">
            No notifications
          </p>
          <p className="mt-1 text-sm text-navy-400 dark:text-navy-500">
            {activeTab === "all"
              ? "You're all caught up! Notifications will appear here."
              : "No notifications match this filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((notification) => {
            const isUnread = notification.status !== "READ";
            const Icon = TYPE_ICONS[notification.type] ?? Bell;
            const iconColor = TYPE_ICON_COLORS[notification.type] ?? "text-navy-400";
            const channel = CHANNEL_BADGES[notification.channel];

            return (
              <div
                key={notification.id}
                onClick={() => isUnread && handleMarkRead(notification.id)}
                className={cn(
                  "flex items-start gap-4 rounded-xl border p-4 transition-colors cursor-pointer",
                  isUnread
                    ? "border-l-4 border-l-orange-500 border-t border-r border-b border-navy-200 bg-orange-50/50 dark:border-navy-700 dark:border-l-orange-500 dark:bg-orange-500/5"
                    : "border-navy-200 bg-white dark:border-navy-800 dark:bg-navy-900"
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
                    isUnread
                      ? "bg-orange-100 dark:bg-orange-500/20"
                      : "bg-navy-100 dark:bg-navy-800"
                  )}
                >
                  <Icon size={18} className={iconColor} />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm leading-relaxed",
                      isUnread
                        ? "font-semibold text-navy-900 dark:text-white"
                        : "text-navy-700 dark:text-navy-300"
                    )}
                  >
                    {notification.body}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {/* Channel badge */}
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-navy-100 px-2.5 py-0.5
                                 text-xs font-medium text-navy-600
                                 dark:bg-navy-800 dark:text-navy-400"
                    >
                      <channel.icon size={12} />
                      {channel.label}
                    </span>

                    {/* Timestamp */}
                    <span className="text-xs text-navy-400 dark:text-navy-500">
                      {relativeTime(notification.createdAt)}
                    </span>

                    {/* Shipment link */}
                    {notification.shipmentId && (
                      <Link
                        href={`/dashboard/shipments/${notification.shipmentId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-medium text-orange-500 hover:text-orange-600
                                   dark:text-orange-400 dark:hover:text-orange-300"
                      >
                        {notification.shipmentTrackingNumber ?? "View shipment"}
                      </Link>
                    )}
                  </div>
                </div>

                {/* Unread dot */}
                {isUnread && (
                  <div className="mt-2 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-orange-500" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
