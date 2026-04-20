"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────

interface NotificationPreview {
  id: string;
  type: string;
  body: string;
  shipmentId: string | null;
  createdAt: string;
  status: string;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  ETA_UPDATE: Clock,
  ETA_IMMINENT: Clock,
  DELAY_ALERT: AlertTriangle,
  ARRIVAL_NOTICE: CheckCircle,
  STATUS_CHANGE: Bell,
  CUSTOMS_HOLD: ShieldAlert,
  EXCEPTION: AlertTriangle,
};

// ── Helpers ──────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Component ────────────────────────────────────────────────

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationPreview[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch unread notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unread=true&limit=5");
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.totalUnread ?? data.notifications?.length ?? 0);
      setNotifications(data.notifications ?? []);
    } catch {
      // silently fail
    }
  }, []);

  // Poll every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  async function handleNotificationClick(notification: NotificationPreview) {
    // Mark as read
    try {
      await fetch(`/api/notifications/${notification.id}/read`, {
        method: "PATCH",
      });
    } catch {
      // silently fail
    }

    setOpen(false);

    // Navigate to shipment if linked
    if (notification.shipmentId) {
      router.push(`/dashboard/shipments/${notification.shipmentId}`);
    } else {
      router.push("/dashboard/notifications");
    }

    // Refresh counts
    fetchNotifications();
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-navy-400 hover:bg-navy-50 hover:text-navy-600
                   transition-colors dark:text-navy-300 dark:hover:bg-navy-800 dark:hover:text-white"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center
                       rounded-full bg-orange-500 text-[10px] font-bold text-white
                       ring-2 ring-white dark:ring-navy-950"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-navy-200
                     bg-white shadow-lg dark:border-navy-700 dark:bg-navy-900"
        >
          {/* Dropdown header */}
          <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3 dark:border-navy-800">
            <h3 className="text-sm font-semibold text-navy-900 dark:text-white">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                {unreadCount} new
              </span>
            )}
          </div>

          {/* Notification items */}
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell size={24} className="mx-auto text-navy-300 dark:text-navy-600" />
              <p className="mt-2 text-sm text-navy-400 dark:text-navy-500">
                No unread notifications
              </p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((notification) => {
                const Icon = TYPE_ICONS[notification.type] ?? Bell;
                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors
                               hover:bg-navy-50 dark:hover:bg-navy-800"
                  >
                    <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-500/20">
                      <Icon size={14} className="text-orange-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-navy-800 dark:text-navy-200">
                        {notification.body}
                      </p>
                      <p className="mt-0.5 text-xs text-navy-400 dark:text-navy-500">
                        {relativeTime(notification.createdAt)}
                      </p>
                    </div>
                    <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-orange-500" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-navy-100 dark:border-navy-800">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-center text-sm font-medium text-orange-500
                         transition-colors hover:bg-navy-50
                         dark:text-orange-400 dark:hover:bg-navy-800"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
