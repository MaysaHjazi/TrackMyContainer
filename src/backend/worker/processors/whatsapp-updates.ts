import { prisma } from "@/backend/lib/db";
import { trackShipment } from "@/backend/services/tracking";
import { getStatusLabel } from "@/lib/utils";
import { isMetaProvider, sendMetaText } from "@/backend/services/notifications/whatsapp-meta";

/**
 * Additive: poll WhatsApp-saved shipments, push an Arabic/English
 * update when status changes. Inert unless WHATSAPP_PROVIDER=meta.
 * NEVER touches Shipment/email/delay logic.
 */
export async function runWhatsappUpdates(): Promise<void> {
  if (!isMetaProvider()) return;

  const rows = await prisma.whatsappTrackedShipment.findMany({ take: 200 });
  const byNumber = new Map<string, typeof rows>();
  for (const r of rows) {
    const a = byNumber.get(r.trackingNumber) ?? [];
    a.push(r); byNumber.set(r.trackingNumber, a);
  }

  for (const [num, list] of byNumber) {
    let statusLabel: string;
    try {
      const t = await trackShipment(num);
      statusLabel = getStatusLabel(t.currentStatus);
    } catch { continue; }

    for (const row of list) {
      if (row.lastStatus === statusLabel) continue;
      const ar = `📦 تحديث: شحنتك ${num}\n🚢 الحالة: ${statusLabel}`;
      try {
        await sendMetaText(row.phoneNumber, ar);
        await prisma.whatsappTrackedShipment.update({
          where: { id: row.id },
          data: { lastStatus: statusLabel },
        });
      } catch (e) {
        console.error(`[wa-updates] ${row.phoneNumber}/${num}:`, e);
      }
    }
  }
}
