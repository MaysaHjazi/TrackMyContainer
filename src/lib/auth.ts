import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/backend/lib/db";
import type { User, Subscription } from "@prisma/client";

export type AuthenticatedUser = User & { subscription: Subscription | null };

/**
 * Get the authenticated user from Supabase session + Prisma DB.
 * Returns null if not authenticated or user not found.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) return null;

  // Find or auto-create user in Prisma DB
  let dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    include: { subscription: true },
  });

  if (!dbUser) {
    // Auto-create user + FREE subscription on first login
    dbUser = await prisma.user.create({
      data: {
        email: user.email,
        name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email.split("@")[0],
        image: user.user_metadata?.avatar_url ?? user.user_metadata?.picture,
        subscription: {
          create: {
            stripeCustomerId: `free_${user.id}`,
            plan: "FREE",
            status: "ACTIVE",
            maxTrackedShipments: 3,
            maxDailyQueries: 5,
            whatsappEnabled: false,
            apiAccessEnabled: false,
            maxTeamMembers: 1,
          },
        },
      },
      include: { subscription: true },
    });
  }

  return dbUser;
}

/**
 * Get max tracked shipments for a user's plan.
 * Returns -1 for unlimited.
 */
export function getMaxShipments(user: AuthenticatedUser): number {
  return user.subscription?.maxTrackedShipments ?? 0;
}

/**
 * Check if user can add more tracked shipments.
 */
export async function canAddShipment(user: AuthenticatedUser): Promise<boolean> {
  const max = getMaxShipments(user);
  if (max === -1) return true;  // unlimited
  if (max <= 0)  return false;  // plan has no shipment tracking

  const count = await prisma.shipment.count({
    where: { userId: user.id, isActive: true },
  });

  return count < max;
}
