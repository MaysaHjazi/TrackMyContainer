"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { User, Bell as BellIcon, CreditCard, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────

type PlanId = "FREE" | "PRO" | "BUSINESS";

interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsappOptIn: boolean;
  plan: PlanId;
  maxTrackedShipments: number;
  maxDailyQueries: number;
  whatsappEnabled: boolean;
  apiAccessEnabled: boolean;
  maxTeamMembers: number;
}

type Tab = "profile" | "notifications" | "account";

const TABS: { key: Tab; label: string; icon: typeof User }[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "notifications", label: "Notifications", icon: BellIcon },
  { key: "account", label: "Account", icon: CreditCard },
];

// ── Notification type / channel grid ─────────────────────────

const NOTIFICATION_TYPES = [
  { key: "etaUpdate", label: "ETA Update" },
  { key: "delayAlert", label: "Delay Alert" },
  { key: "arrivalNotice", label: "Arrival Notice" },
  { key: "statusChange", label: "Status Change" },
  { key: "customsHold", label: "Customs Hold" },
] as const;

const CHANNELS = ["email", "whatsapp", "inApp"] as const;

type NotifKey = (typeof NOTIFICATION_TYPES)[number]["key"];
type ChannelKey = (typeof CHANNELS)[number];
type NotifPrefs = Record<NotifKey, Record<ChannelKey, boolean>>;

const DEFAULT_PREFS: NotifPrefs = {
  etaUpdate: { email: true, whatsapp: false, inApp: true },
  delayAlert: { email: true, whatsapp: false, inApp: true },
  arrivalNotice: { email: true, whatsapp: false, inApp: true },
  statusChange: { email: true, whatsapp: false, inApp: true },
  customsHold: { email: true, whatsapp: false, inApp: true },
};

// ── Plan badges ──────────────────────────────────────────────

const PLAN_BADGES: Record<PlanId, { label: string; color: string }> = {
  FREE: {
    label: "Free",
    color: "bg-navy-100 text-navy-700 dark:bg-navy-800 dark:text-navy-300",
  },
  PRO: {
    label: "Pro",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
  },
  BUSINESS: {
    label: "Business",
    color: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400",
  },
};

// ── Toggle switch ────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors",
        checked ? "bg-orange-500" : "bg-navy-200 dark:bg-navy-700",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ── Main component ───────────────────────────────────────────

interface Props {
  profile: Profile;
}

export function SettingsForm({ profile }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [isPending, startTransition] = useTransition();

  // Profile state
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [profileSaved, setProfileSaved] = useState(false);

  // Notification prefs state
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [notifSaved, setNotifSaved] = useState(false);

  // Deactivate confirm
  const [showDeactivate, setShowDeactivate] = useState(false);

  // ── Handlers ─────────────────────────────────────────────

  async function handleSaveProfile() {
    setProfileSaved(false);
    startTransition(async () => {
      try {
        await fetch("/api/user/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, phone }),
        });
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 3000);
      } catch {
        // handle error
      }
    });
  }

  async function handleSaveNotifications() {
    setNotifSaved(false);
    startTransition(async () => {
      try {
        await fetch("/api/user/notification-prefs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(notifPrefs),
        });
        setNotifSaved(true);
        setTimeout(() => setNotifSaved(false), 3000);
      } catch {
        // handle error
      }
    });
  }

  function toggleNotifPref(type: NotifKey, channel: ChannelKey) {
    setNotifPrefs((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [channel]: !prev[type][channel],
      },
    }));
  }

  // ── Render ───────────────────────────────────────────────

  return (
    <div>
      {/* Tab navigation */}
      <div className="mb-6 flex gap-1 rounded-lg bg-navy-100 p-1 dark:bg-navy-800">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === key
                ? "bg-white text-navy-900 shadow-sm dark:bg-navy-700 dark:text-white"
                : "text-navy-500 hover:text-navy-700 dark:text-navy-400 dark:hover:text-navy-200"
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Profile tab ─────────────────────────────────── */}
      {activeTab === "profile" && (
        <div className="rounded-xl border border-navy-200 bg-white p-6 dark:border-navy-800 dark:bg-navy-900">
          <h3 className="mb-4 text-lg font-semibold text-navy-900 dark:text-white">
            Profile Information
          </h3>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-300">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-navy-200 bg-white px-4 py-2.5 text-sm
                           text-navy-900 placeholder:text-navy-400
                           focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100
                           dark:border-navy-700 dark:bg-navy-800 dark:text-white
                           dark:focus:border-orange-500 dark:focus:ring-orange-500/20"
                placeholder="John Doe"
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-300">
                Email
              </label>
              <input
                type="email"
                value={profile.email}
                readOnly
                className="w-full rounded-lg border border-navy-200 bg-navy-50 px-4 py-2.5 text-sm
                           text-navy-500 cursor-not-allowed
                           dark:border-navy-700 dark:bg-navy-800/50 dark:text-navy-500"
              />
              <p className="mt-1 text-xs text-navy-400 dark:text-navy-500">
                Email cannot be changed. Contact support for assistance.
              </p>
            </div>

            {/* Phone */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-300">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-navy-200 bg-white px-4 py-2.5 text-sm
                           text-navy-900 placeholder:text-navy-400
                           focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100
                           dark:border-navy-700 dark:bg-navy-800 dark:text-white
                           dark:focus:border-orange-500 dark:focus:ring-orange-500/20"
                placeholder="+1 212 555 1234"
              />
              <p className="mt-1 text-xs text-navy-400 dark:text-navy-500">
                E.164 format (e.g. +12125551234). Required for WhatsApp notifications.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSaveProfile}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm
                         font-semibold text-white transition-colors hover:bg-orange-600
                         disabled:opacity-50"
            >
              {isPending && <Loader2 size={16} className="animate-spin" />}
              Save Changes
            </button>
            {profileSaved && (
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Saved successfully
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Notifications tab ───────────────────────────── */}
      {activeTab === "notifications" && (
        <div className="rounded-xl border border-navy-200 bg-white p-6 dark:border-navy-800 dark:bg-navy-900">
          <h3 className="mb-1 text-lg font-semibold text-navy-900 dark:text-white">
            Notification Preferences
          </h3>
          <p className="mb-6 text-sm text-navy-500 dark:text-navy-400">
            Choose how you want to be notified for each event type.
          </p>

          {/* Grid header */}
          <div className="grid grid-cols-4 gap-4 border-b border-navy-100 pb-3 dark:border-navy-800">
            <div className="text-sm font-medium text-navy-500 dark:text-navy-400">
              Event Type
            </div>
            <div className="text-center text-sm font-medium text-navy-500 dark:text-navy-400">
              Email
            </div>
            <div className="text-center text-sm font-medium text-navy-500 dark:text-navy-400">
              WhatsApp
            </div>
            <div className="text-center text-sm font-medium text-navy-500 dark:text-navy-400">
              In-App
            </div>
          </div>

          {/* Grid rows */}
          {NOTIFICATION_TYPES.map(({ key, label }) => (
            <div
              key={key}
              className="grid grid-cols-4 items-center gap-4 border-b border-navy-50 py-3
                         last:border-0 dark:border-navy-800/50"
            >
              <div className="text-sm font-medium text-navy-700 dark:text-navy-300">
                {label}
              </div>

              {/* Email toggle */}
              <div className="flex justify-center">
                <Toggle
                  checked={notifPrefs[key].email}
                  onChange={() => toggleNotifPref(key, "email")}
                />
              </div>

              {/* WhatsApp toggle */}
              <div className="flex flex-col items-center gap-1">
                {profile.whatsappOptIn ? (
                  <Toggle
                    checked={notifPrefs[key].whatsapp}
                    onChange={() => toggleNotifPref(key, "whatsapp")}
                    disabled={!profile.whatsappEnabled}
                  />
                ) : (
                  <span className="text-center text-xs text-navy-400 dark:text-navy-500">
                    Enable WhatsApp in Profile tab
                  </span>
                )}
              </div>

              {/* In-App toggle */}
              <div className="flex justify-center">
                <Toggle
                  checked={notifPrefs[key].inApp}
                  onChange={() => toggleNotifPref(key, "inApp")}
                />
              </div>
            </div>
          ))}

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSaveNotifications}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm
                         font-semibold text-white transition-colors hover:bg-orange-600
                         disabled:opacity-50"
            >
              {isPending && <Loader2 size={16} className="animate-spin" />}
              Save Preferences
            </button>
            {notifSaved && (
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Saved successfully
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Account tab ─────────────────────────────────── */}
      {activeTab === "account" && (
        <div className="space-y-6">
          {/* Current plan */}
          <div className="rounded-xl border border-navy-200 bg-white p-6 dark:border-navy-800 dark:bg-navy-900">
            <h3 className="mb-4 text-lg font-semibold text-navy-900 dark:text-white">
              Current Plan
            </h3>

            <div className="flex items-center gap-3 mb-4">
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-bold",
                  PLAN_BADGES[profile.plan].color
                )}
              >
                {PLAN_BADGES[profile.plan].label}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-navy-50 px-4 py-3 dark:bg-navy-800">
                <p className="text-xs text-navy-400 dark:text-navy-500">
                  Tracked Shipments
                </p>
                <p className="text-lg font-bold text-navy-900 dark:text-white">
                  {profile.maxTrackedShipments === -1
                    ? "Unlimited"
                    : profile.maxTrackedShipments}
                </p>
              </div>
              <div className="rounded-lg bg-navy-50 px-4 py-3 dark:bg-navy-800">
                <p className="text-xs text-navy-400 dark:text-navy-500">
                  Daily Lookups
                </p>
                <p className="text-lg font-bold text-navy-900 dark:text-white">
                  {profile.maxDailyQueries === -1
                    ? "Unlimited"
                    : profile.maxDailyQueries}
                </p>
              </div>
              <div className="rounded-lg bg-navy-50 px-4 py-3 dark:bg-navy-800">
                <p className="text-xs text-navy-400 dark:text-navy-500">
                  Team Members
                </p>
                <p className="text-lg font-bold text-navy-900 dark:text-white">
                  {profile.maxTeamMembers}
                </p>
              </div>
              <div className="rounded-lg bg-navy-50 px-4 py-3 dark:bg-navy-800">
                <p className="text-xs text-navy-400 dark:text-navy-500">
                  API Access
                </p>
                <p className="text-lg font-bold text-navy-900 dark:text-white">
                  {profile.apiAccessEnabled ? "Enabled" : "Disabled"}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <Link
                href="/dashboard/billing"
                className="inline-flex rounded-lg border border-navy-200 bg-white px-4 py-2.5 text-sm
                           font-medium text-navy-700 transition-colors hover:bg-navy-50
                           dark:border-navy-700 dark:bg-navy-800 dark:text-navy-200
                           dark:hover:bg-navy-700"
              >
                Manage Billing
              </Link>
            </div>
          </div>

          {/* Danger zone */}
          <div className="rounded-xl border border-red-200 bg-white p-6 dark:border-red-500/30 dark:bg-navy-900">
            <h3 className="mb-1 text-lg font-semibold text-red-600 dark:text-red-400">
              Danger Zone
            </h3>
            <p className="mb-4 text-sm text-navy-500 dark:text-navy-400">
              Permanently deactivate your account and delete all associated data.
              This action cannot be undone.
            </p>

            {!showDeactivate ? (
              <button
                onClick={() => setShowDeactivate(true)}
                className="rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm
                           font-medium text-red-600 transition-colors hover:bg-red-50
                           dark:border-red-500/30 dark:bg-navy-800 dark:text-red-400
                           dark:hover:bg-red-500/10"
              >
                Deactivate Account
              </button>
            ) : (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
                <p className="mb-3 text-sm font-medium text-red-700 dark:text-red-300">
                  Are you sure you want to deactivate your account? All your
                  shipments, notifications, and data will be permanently deleted.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      // TODO: call deactivation API
                    }}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white
                               transition-colors hover:bg-red-700"
                  >
                    Yes, deactivate my account
                  </button>
                  <button
                    onClick={() => setShowDeactivate(false)}
                    className="rounded-lg border border-navy-200 bg-white px-4 py-2 text-sm
                               font-medium text-navy-700 transition-colors hover:bg-navy-50
                               dark:border-navy-700 dark:bg-navy-800 dark:text-navy-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
