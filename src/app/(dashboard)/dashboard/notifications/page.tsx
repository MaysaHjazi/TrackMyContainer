import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/backend/lib/db";
import { redirect } from "next/navigation";
import { NotificationsClient } from "./notifications-client";
import { NotificationsGate } from "@/frontend/components/dashboard/notifications-gate";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const plan = user.subscription?.plan ?? "FREE";

  /* Free users see upgrade prompt */
  if (plan === "FREE") {
    return <NotificationsGate />;
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    include: {
      shipment: {
        select: {
          id: true,
          trackingNumber: true,
          carrier: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const serialized = notifications.map((n) => ({
    id: n.id,
    channel: n.channel,
    type: n.type,
    subject: n.subject,
    body: n.body,
    status: n.status,
    shipmentId: n.shipmentId,
    shipmentTrackingNumber: n.shipment?.trackingNumber ?? null,
    shipmentCarrier: n.shipment?.carrier ?? null,
    createdAt: n.createdAt.toISOString(),
    sentAt: n.sentAt?.toISOString() ?? null,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <NotificationsClient notifications={serialized} />
    </div>
  );
}
