"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Bell, Ship, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastNotification {
  id: string;
  type: string;
  body: string;
  shipmentId?: string | null;
}

export function NotificationToast() {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [lastCheck, setLastCheck] = useState(Date.now());

  const checkNewNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?unread=true&limit=3&page=1`);
      if (!res.ok) return;
      const data = await res.json();

      const newItems = (data.data ?? []).filter(
        (n: ToastNotification) => !toasts.some((t) => t.id === n.id)
      );

      if (newItems.length > 0) {
        setToasts((prev) => [...newItems.slice(0, 2), ...prev].slice(0, 5));
      }
      setLastCheck(Date.now());
    } catch {
      // silently fail
    }
  }, [toasts]);

  useEffect(() => {
    const interval = setInterval(checkNewNotifications, 15_000);
    return () => clearInterval(interval);
  }, [checkNewNotifications]);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    fetch(`/api/notifications/${id}/read`, { method: "PATCH" }).catch(() => {});
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = toast.type.includes("DELAY") ? AlertTriangle
          : toast.type.includes("ARRIVAL") || toast.type.includes("DELIVERED") ? CheckCircle
          : Bell;

        return (
          <div
            key={toast.id}
            className={cn(
              "flex items-start gap-3 rounded-xl border bg-white p-4 shadow-lg",
              "dark:bg-navy-900 dark:border-navy-700",
              "animate-slide-up"
            )}
          >
            <Icon size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-navy-900 dark:text-white line-clamp-2">{toast.body}</p>
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-navy-100 dark:hover:bg-navy-800 transition-colors"
            >
              <X size={14} className="text-navy-400" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
