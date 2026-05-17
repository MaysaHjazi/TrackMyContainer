import { prisma } from "@/backend/lib/db";
import { trackShipment } from "@/backend/services/tracking";
import { formatDate, getStatusLabel } from "@/lib/utils";
import { runBot, type BotState, type TrackView } from "./bot-engine";

async function loadSession(phone: string) {
  const s = await prisma.whatsappSession.findUnique({ where: { phoneNumber: phone } });
  const state = (s?.state as BotState) ?? "MAIN";
  return {
    state: (["MAIN", "AWAIT_TRACK", "AWAIT_SAVE"].includes(state) ? state : "MAIN") as BotState,
  };
}

async function saveSession(phone: string, state: BotState) {
  await prisma.whatsappSession.upsert({
    where: { phoneNumber: phone },
    update: { state, lang: "en", lastMessageAt: new Date(), messageCount: { increment: 1 } },
    create: { phoneNumber: phone, state, lang: "en", lastMessageAt: new Date(), messageCount: 1 },
  });
}

async function getSaved(phone: string) {
  const rows = await prisma.whatsappTrackedShipment.findMany({
    where: { phoneNumber: phone },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return rows.map((r) => ({ trackingNumber: r.trackingNumber, lastStatus: r.lastStatus }));
}

async function doTrack(num: string): Promise<TrackView> {
  try {
    const r = await trackShipment(num.trim());
    return {
      found: true,
      trackingNumber: r.trackingNumber,
      status: getStatusLabel(r.currentStatus),
      location: r.currentLocation ?? undefined,
      updatedAt: r.events?.length ? formatDate(r.events[r.events.length - 1].eventDate) : undefined,
      eta: r.etaDate ? formatDate(r.etaDate) : undefined,
    };
  } catch {
    return { found: false };
  }
}

export interface OutMsg {
  type: "text" | "buttons";
  body: string;
  buttons?: { id: string; title: string }[];
}

export async function handleBotTurn(phone: string, text: string): Promise<OutMsg[]> {
  const { state } = await loadSession(phone);
  let track: TrackView | undefined;

  let out = runBot({ state, text, savedShipments: await getSaved(phone) });

  if (out.action?.kind === "NEED_TRACK" || out.action?.kind === "NEED_TRACK_THEN_SAVE") {
    track = await doTrack(out.action.trackingNumber);
    out = runBot({ state, text, savedShipments: await getSaved(phone), track });
  }

  if (out.action?.kind === "SAVE" && track?.found) {
    const r = await trackShipment(out.action.trackingNumber).catch(() => null);
    if (r) {
      await prisma.whatsappTrackedShipment.upsert({
        where: { phoneNumber_trackingNumber: { phoneNumber: phone, trackingNumber: r.trackingNumber } },
        update: { lastStatus: getStatusLabel(r.currentStatus) },
        create: {
          phoneNumber: phone,
          trackingNumber: r.trackingNumber,
          trackingType: r.type,
          lastStatus: getStatusLabel(r.currentStatus),
        },
      });
    }
  }

  await saveSession(phone, out.nextState);
  return out.replies.map((rp) => ({ type: rp.type, body: rp.body, buttons: rp.buttons }));
}
