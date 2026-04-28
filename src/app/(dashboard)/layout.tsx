export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Sidebar }        from "@/frontend/components/layout/sidebar";
import { DashboardHeader } from "@/frontend/components/layout/header";
import { NotificationToast } from "@/frontend/components/dashboard/notification-toast";
import { createClient }    from "@/lib/supabase/server";
import { SubscriptionProvider } from "@/frontend/subscription-provider";
import type { SubscriptionInfo } from "@/frontend/subscription-provider";
import { getAuthenticatedUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin-auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userName = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";

  /* Fetch subscription info for tier gating */
  let subInfo: SubscriptionInfo | null = null;
  let userIsAdmin = false;
  try {
    const dbUser = await getAuthenticatedUser();
    if (dbUser?.subscription) {
      subInfo = {
        plan: dbUser.subscription.plan as SubscriptionInfo["plan"],
        maxTrackedShipments: dbUser.subscription.maxTrackedShipments,
        maxDailyQueries: dbUser.subscription.maxDailyQueries,
        whatsappEnabled: dbUser.subscription.whatsappEnabled,
        apiAccessEnabled: dbUser.subscription.apiAccessEnabled,
        maxTeamMembers: dbUser.subscription.maxTeamMembers,
      };
    }
    if (dbUser) {
      userIsAdmin = await isAdmin({
        id:    dbUser.id,
        email: dbUser.email,
        role:  (dbUser.role as "USER" | "ADMIN") ?? "USER",
      });
    }
  } catch {
    /* DB not available — default to FREE */
  }

  return (
    <SubscriptionProvider subscription={subInfo}>
      <div className="flex h-screen overflow-hidden bg-navy-50 dark:bg-navy-950">
        <Sidebar isAdmin={userIsAdmin} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <DashboardHeader userName={userName} />
          <main className="flex-1 min-h-0 overflow-y-auto">
            {children}
          </main>
          <NotificationToast />
        </div>
      </div>
    </SubscriptionProvider>
  );
}
