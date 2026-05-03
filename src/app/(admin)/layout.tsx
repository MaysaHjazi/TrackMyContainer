import { notFound, redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin-auth";
import { AdminSidebar } from "@/frontend/components/admin/admin-sidebar";
import { AdminMobileHeader } from "@/frontend/components/admin/admin-mobile-header";

// Refresh server-rendered admin data every 60s — same cadence the
// shipment detail page uses. Cheap DB queries, safe to refresh often.
export const revalidate = 60;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  // Email/role check. notFound (not 403) so the existence of /admin
  // is hidden from non-admins.
  const allowed = await isAdmin({
    id:    user.id,
    email: user.email,
    role:  (user.role as "USER" | "ADMIN") ?? "USER",
  });
  if (!allowed) notFound();

  return (
    <div className="flex min-h-screen bg-navy-50 dark:bg-navy-950">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminMobileHeader />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
