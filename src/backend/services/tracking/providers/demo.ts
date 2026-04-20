import type { TrackingProvider, ProviderResult, ProviderEvent } from "./types";
import type { ShipmentType } from "@prisma/client";

/**
 * DemoProvider — generates realistic tracking data deterministically
 * based on the tracking number. No API key required.
 *
 * Used as a fallback when real API keys aren't configured, or for demo/
 * development purposes. Results are stable per tracking number (same input
 * always returns the same events, vessels, ETAs).
 */

/* ── Simple deterministic hash from string ── */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* ── Major shipping routes for realistic data ── */
const SEA_ROUTES = [
  { from: "Shanghai", to: "Rotterdam", fromCode: "CNSHA", toCode: "NLRTM", transitDays: 32 },
  { from: "Singapore", to: "Dubai", fromCode: "SGSIN", toCode: "AEJEA", transitDays: 14 },
  { from: "Busan", to: "Los Angeles", fromCode: "KRPUS", toCode: "USLAX", transitDays: 18 },
  { from: "Rotterdam", to: "New York", fromCode: "NLRTM", toCode: "USNYC", transitDays: 11 },
  { from: "Shanghai", to: "Santos", fromCode: "CNSHA", toCode: "BRSSZ", transitDays: 45 },
  { from: "Jeddah", to: "Singapore", fromCode: "SAJED", toCode: "SGSIN", transitDays: 12 },
];

const AIR_ROUTES = [
  { from: "Dubai", to: "London", fromCode: "DXB", toCode: "LHR", transitDays: 1 },
  { from: "Frankfurt", to: "Shanghai", fromCode: "FRA", toCode: "PVG", transitDays: 2 },
  { from: "Doha", to: "Sydney", fromCode: "DOH", toCode: "SYD", transitDays: 2 },
  { from: "Hong Kong", to: "New York", fromCode: "HKG", toCode: "JFK", transitDays: 2 },
];

const SEA_CARRIERS = [
  { name: "Maersk", code: "MAEU" },
  { name: "MSC", code: "MSCU" },
  { name: "CMA CGM", code: "CMAU" },
  { name: "Hapag-Lloyd", code: "HLCU" },
  { name: "COSCO", code: "COSU" },
  { name: "Evergreen", code: "EGLV" },
  { name: "ONE", code: "ONEY" },
  { name: "Yang Ming", code: "YMLU" },
];

const AIR_CARRIERS = [
  { name: "Emirates SkyCargo", code: "176" },
  { name: "Qatar Airways Cargo", code: "157" },
  { name: "Lufthansa Cargo", code: "020" },
  { name: "Cathay Pacific Cargo", code: "160" },
  { name: "Singapore Airlines Cargo", code: "618" },
];

const VESSEL_NAMES = [
  "Ever Given", "MSC Oscar", "Maersk Madrid", "CMA CGM Marco Polo",
  "Hapag-Lloyd Hamburg", "COSCO Shipping Universe", "OOCL Hong Kong",
  "Ever Ace", "HMM Algeciras", "MSC Gülsün",
];

const FLIGHT_NUMBERS = ["EK203", "QR201", "LH472", "CX830", "SQ308"];

/* ── Build stable route/carrier from tracking number ── */
function pickStable<T>(arr: T[], seed: string, salt: number = 0): T {
  return arr[(hash(seed) + salt) % arr.length];
}

function makeSeaEvents(trackingNumber: string, route: typeof SEA_ROUTES[0]): {
  events: ProviderEvent[];
  etd: Date;
  eta: Date;
  vessel: string;
  voyage: string;
  carrier: string;
} {
  const h = hash(trackingNumber);
  const carrier = pickStable(SEA_CARRIERS, trackingNumber);
  const vessel = pickStable(VESSEL_NAMES, trackingNumber, 1);
  const voyage = `${String.fromCharCode(65 + (h % 26))}${String.fromCharCode(65 + ((h + 7) % 26))}${100 + (h % 900)}`;

  // Progress: how far along the journey is this container? (0-1)
  const progressSalt = h % 100;
  const isDelivered = progressSalt < 20;
  const isDelayed = progressSalt >= 85;
  const progress = isDelivered ? 1 : Math.min(0.95, 0.15 + (progressSalt % 75) / 100);

  const now = Date.now();
  const transitMs = route.transitDays * 24 * 60 * 60 * 1000;
  const etdTime = now - transitMs * progress;
  const etaTime = etdTime + transitMs + (isDelayed ? 3 * 24 * 60 * 60 * 1000 : 0);
  const etd = new Date(etdTime);
  const eta = new Date(etaTime);

  const events: ProviderEvent[] = [];

  // 1. Booking
  events.push({
    rawStatus: "Booking Confirmed",
    location: route.from,
    description: `Booking confirmed with ${carrier.name}`,
    timestamp: new Date(etdTime - 7 * 24 * 60 * 60 * 1000),
  });

  // 2. Container received at origin
  events.push({
    rawStatus: "Empty Container Release",
    location: `${route.from} Terminal`,
    description: "Empty container released to shipper",
    timestamp: new Date(etdTime - 4 * 24 * 60 * 60 * 1000),
  });

  // 3. Gate In
  events.push({
    rawStatus: "Gate In",
    location: `${route.from} Port`,
    description: "Container gated in at origin port",
    timestamp: new Date(etdTime - 2 * 24 * 60 * 60 * 1000),
  });

  // 4. Loaded on vessel
  if (progress >= 0.1) {
    events.push({
      rawStatus: "Loaded on Vessel",
      location: `${route.from} Port`,
      description: `Loaded on ${vessel} voyage ${voyage}`,
      timestamp: new Date(etdTime - 1 * 24 * 60 * 60 * 1000),
    });
  }

  // 5. Departure
  if (progress >= 0.15) {
    events.push({
      rawStatus: "Vessel Departure",
      location: route.from,
      description: `Vessel ${vessel} departed ${route.from}`,
      timestamp: etd,
    });
  }

  // 6. In transit — multiple waypoints
  const waypoints = [
    { name: "Arabian Sea", at: 0.3 },
    { name: "Suez Canal", at: 0.5 },
    { name: "Mediterranean Sea", at: 0.7 },
    { name: "Bay of Biscay", at: 0.85 },
  ];
  for (const wp of waypoints) {
    if (progress >= wp.at) {
      events.push({
        rawStatus: "In Transit",
        location: wp.name,
        description: `Vessel passing ${wp.name}`,
        timestamp: new Date(etdTime + transitMs * wp.at),
      });
    }
  }

  // 7. Arrival at destination port
  if (progress >= 0.95) {
    events.push({
      rawStatus: "Vessel Arrival",
      location: route.to,
      description: `Vessel ${vessel} arrived at ${route.to}`,
      timestamp: new Date(etdTime + transitMs * 0.97),
    });
  }

  // 8. Discharged
  if (progress >= 0.98 || isDelivered) {
    events.push({
      rawStatus: "Discharged",
      location: `${route.to} Port`,
      description: "Container discharged from vessel",
      timestamp: new Date(etdTime + transitMs * 0.99),
    });
  }

  // 9. Delivered
  if (isDelivered) {
    events.push({
      rawStatus: "Delivered",
      location: route.to,
      description: "Container delivered to consignee",
      timestamp: new Date(etaTime),
    });
  }

  // 10. Delay event
  if (isDelayed && progress >= 0.5 && !isDelivered) {
    events.push({
      rawStatus: "Delayed",
      location: "Mediterranean Sea",
      description: "Vessel delayed due to port congestion",
      timestamp: new Date(etdTime + transitMs * 0.6),
    });
  }

  return { events, etd, eta, vessel, voyage, carrier: carrier.name };
}

function makeAirEvents(trackingNumber: string, route: typeof AIR_ROUTES[0]): {
  events: ProviderEvent[];
  etd: Date;
  eta: Date;
  flight: string;
  carrier: string;
} {
  const h = hash(trackingNumber);
  const carrier = pickStable(AIR_CARRIERS, trackingNumber);
  const flight = pickStable(FLIGHT_NUMBERS, trackingNumber, 2);

  const progressSalt = h % 100;
  const isDelivered = progressSalt < 30;
  const isDelayed = progressSalt >= 90;
  const progress = isDelivered ? 1 : Math.min(0.95, 0.3 + (progressSalt % 65) / 100);

  const now = Date.now();
  const transitMs = route.transitDays * 24 * 60 * 60 * 1000;
  const etdTime = now - transitMs * progress;
  const etaTime = etdTime + transitMs + (isDelayed ? 12 * 60 * 60 * 1000 : 0);
  const etd = new Date(etdTime);
  const eta = new Date(etaTime);

  const events: ProviderEvent[] = [];

  events.push({
    rawStatus: "RCS",
    location: route.from,
    description: `Freight received for carriage at ${route.from}`,
    timestamp: new Date(etdTime - 6 * 60 * 60 * 1000),
  });

  events.push({
    rawStatus: "MAN",
    location: route.from,
    description: `Manifested for flight ${flight}`,
    timestamp: new Date(etdTime - 3 * 60 * 60 * 1000),
  });

  if (progress >= 0.3) {
    events.push({
      rawStatus: "DEP",
      location: route.from,
      description: `Flight ${flight} departed ${route.from}`,
      timestamp: etd,
    });
  }

  if (progress >= 0.7) {
    events.push({
      rawStatus: "ARR",
      location: route.to,
      description: `Flight ${flight} arrived at ${route.to}`,
      timestamp: new Date(etdTime + transitMs * 0.95),
    });
  }

  if (progress >= 0.9 || isDelivered) {
    events.push({
      rawStatus: "RCF",
      location: route.to,
      description: "Freight received from flight",
      timestamp: new Date(etdTime + transitMs * 0.97),
    });
  }

  if (isDelivered) {
    events.push({
      rawStatus: "DLV",
      location: route.to,
      description: "Delivered to consignee",
      timestamp: new Date(etaTime),
    });
  }

  if (isDelayed) {
    events.push({
      rawStatus: "DLY",
      location: "In Transit",
      description: "Flight delayed due to weather",
      timestamp: new Date(etdTime + transitMs * 0.5),
    });
  }

  return { events, etd, eta, flight, carrier: carrier.name };
}

export class DemoProvider implements TrackingProvider {
  readonly name = "demo";
  readonly supports: ShipmentType[] = ["SEA", "AIR"];

  async track(trackingNumber: string, type: ShipmentType): Promise<ProviderResult> {
    try {
      if (type === "SEA") {
        const route = pickStable(SEA_ROUTES, trackingNumber);
        const { events, etd, eta, vessel, voyage, carrier } = makeSeaEvents(trackingNumber, route);

        return {
          success: true,
          provider: this.name,
          trackingNumber,
          carrier,
          events,
          etd,
          eta,
          origin: route.from,
          destination: route.to,
          vessel,
          voyage,
        };
      } else {
        const route = pickStable(AIR_ROUTES, trackingNumber);
        const { events, etd, eta, flight, carrier } = makeAirEvents(trackingNumber, route);

        return {
          success: true,
          provider: this.name,
          trackingNumber,
          carrier,
          events,
          etd,
          eta,
          origin: route.from,
          destination: route.to,
          flight,
        };
      }
    } catch (err) {
      return {
        success: false,
        provider: this.name,
        trackingNumber,
        events: [],
        error: err instanceof Error ? err.message : "Demo provider error",
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
