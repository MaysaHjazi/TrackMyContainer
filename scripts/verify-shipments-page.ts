/**
 * Simulate the shipments page query to confirm all shipments appear,
 * including arrived ones.
 */
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const users = await p.user.findMany({ select: { id: true, email: true } });

  for (const u of users) {
    const shipments = await p.shipment.findMany({
      where: { userId: u.id },
      orderBy: [{ isFavorite: "desc" }, { createdAt: "desc" }],
      select: {
        trackingNumber: true, currentStatus: true,
        currentLocation: true, isActive: true,
      },
    });
    if (shipments.length) {
      console.log(`\nUser ${u.email}: ${shipments.length} shipment(s) will show`);
      console.table(shipments);
    }
  }
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
