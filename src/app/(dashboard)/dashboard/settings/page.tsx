import { getAuthenticatedUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/frontend/components/dashboard/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const profile = {
    id: user.id,
    name: user.name ?? "",
    email: user.email,
    phone: user.phone ?? "",
    whatsappOptIn: user.whatsappOptIn,
    plan: user.subscription?.plan ?? "FREE",
    maxTrackedShipments: user.subscription?.maxTrackedShipments ?? 0,
    maxDailyQueries: user.subscription?.maxDailyQueries ?? 5,
    whatsappEnabled: user.subscription?.whatsappEnabled ?? false,
    apiAccessEnabled: user.subscription?.apiAccessEnabled ?? false,
    maxTeamMembers: user.subscription?.maxTeamMembers ?? 1,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h2 className="mb-6 text-2xl font-bold text-navy-900 dark:text-white">
        Settings
      </h2>
      <SettingsForm profile={profile} />
    </div>
  );
}
