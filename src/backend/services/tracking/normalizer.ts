import type { ShipmentStatus } from "@prisma/client";

/**
 * Maps provider-specific raw status strings to our unified ShipmentStatus enum.
 * Each provider section contains case-insensitive keyword patterns.
 */

type StatusMap = Record<string, ShipmentStatus>;

// ── Shipsgo v2 Ocean event codes (OceanMovement.event enum) ──
const SHIPSGO_MAP: StatusMap = {
  // v2 ocean codes
  "emsh": "BOOKED",           // Empty to shipper
  "gtin": "PICKED_UP",        // Gate in
  "load": "IN_TRANSIT",       // Loaded
  "depa": "IN_TRANSIT",       // Departed
  "arrv": "AT_PORT",          // Arrived
  "disc": "AT_PORT",          // Discharged
  "gtot": "OUT_FOR_DELIVERY", // Gate out
  "emrt": "DELIVERED",        // Empty return
  // v2 air codes (shared)
  "rcs": "PICKED_UP",         // Received from shipper
  "man": "IN_TRANSIT",        // Manifested
  "dep": "IN_TRANSIT",        // Departed
  "arr": "AT_PORT",           // Arrived
  "rcf": "AT_PORT",           // Received from flight
  "dlv": "DELIVERED",         // Delivered
  // Legacy v1.x text patterns (kept for backward compat)
  "order created":            "BOOKED",
  "booking confirmed":        "BOOKED",
  "empty container release":  "BOOKED",
  "gate in":                  "PICKED_UP",
  "loaded on vessel":         "IN_TRANSIT",
  "vessel departed":          "IN_TRANSIT",
  "gate out from pol":        "IN_TRANSIT",
  "departure":                "IN_TRANSIT",
  "in transit":               "IN_TRANSIT",
  "transshipment":            "TRANSSHIPMENT",
  "transshipment discharge":  "TRANSSHIPMENT",
  "vessel arrived":           "AT_PORT",
  "arrival":                  "AT_PORT",
  "discharged":               "AT_PORT",
  "gate out":                 "OUT_FOR_DELIVERY",
  "delivered":                "DELIVERED",
  "gate in at pod":           "DELIVERED",
  "empty return":             "DELIVERED",
  "delay":                    "DELAYED",
  "delayed":                  "DELAYED",
  "hold":                     "CUSTOMS_HOLD",
  "customs":                  "CUSTOMS_HOLD",
  "exception":                "EXCEPTION",
  "rollover":                 "EXCEPTION",
};

// ── Maersk ────────────────────────────────────────────────────
const MAERSK_MAP: StatusMap = {
  "transport planned":        "BOOKED",
  "transport order created":  "BOOKED",
  "in transit":               "IN_TRANSIT",
  "vessel departed":          "IN_TRANSIT",
  "transshipment":            "TRANSSHIPMENT",
  "arrived":                  "AT_PORT",
  "vessel arrived":           "AT_PORT",
  "discharged":               "AT_PORT",
  "gate out":                 "OUT_FOR_DELIVERY",
  "delivered":                "DELIVERED",
  "cargo released":           "DELIVERED",
  "delay":                    "DELAYED",
  "hold":                     "CUSTOMS_HOLD",
};

// ── AirRates / IATA status codes (lowercase keys for case-insensitive match) ──
const AIRRATES_MAP: StatusMap = {
  "rcs": "PICKED_UP",     // Received from shipper
  "dep": "IN_TRANSIT",    // Departed
  "arr": "AT_PORT",       // Arrived
  "rcf": "AT_PORT",       // Received from flight
  "nfd": "OUT_FOR_DELIVERY", // Notified for delivery
  "awd": "OUT_FOR_DELIVERY", // Consignee notified
  "dlv": "DELIVERED",     // Delivered
  "ccd": "CUSTOMS_HOLD",  // Customs clearance delayed
  "foh": "CUSTOMS_HOLD",  // Freight on hold
  "dis": "EXCEPTION",     // Discrepancy
  "dly": "DELAYED",       // Delayed
  "trm": "TRANSSHIPMENT", // Transfer manifest
  "man": "IN_TRANSIT",    // Manifested
  "pre": "BOOKED",        // Pre-advised
  "bkd": "BOOKED",        // Booked
};

// ── Sinay.ai — DCSA standard event codes ─────────────────────
// Full DCSA code list: https://api.sinay.ai/container-tracking/api/v2/swagger.yaml
const SINAY_MAP: StatusMap = {
  // DCSA Equipment/Transport event codes
  "gtin": "PICKED_UP",          // Gate In (origin)
  "gtot": "OUT_FOR_DELIVERY",   // Gate Out (destination)
  "load": "IN_TRANSIT",         // Loaded on vessel
  "disc": "AT_PORT",            // Discharged from vessel
  "stuf": "PICKED_UP",          // Cargo stuffed into container
  "strp": "AT_PORT",            // Cargo stripped from container
  "pick": "PICKED_UP",          // Pickup
  "avpu": "PICKED_UP",          // Available for pickup
  "drop": "DELIVERED",          // Drop off
  "avdo": "OUT_FOR_DELIVERY",   // Available for drop-off
  "rece": "PICKED_UP",          // Received at facility
  // DCSA Shipment event codes
  "conf": "BOOKED",             // Booking confirmed
  "drft": "BOOKED",             // Draft submitted
  "reqs": "BOOKED",             // Request submitted
  "appr": "BOOKED",             // Booking approved
  "cmpl": "DELIVERED",          // Shipment complete
  "canc": "EXCEPTION",          // Cancelled
  "reje": "EXCEPTION",          // Rejected
  "hold": "CUSTOMS_HOLD",       // On hold
  "rels": "DELIVERED",          // Released
  "issu": "IN_TRANSIT",         // Issued (bill of lading)
  "surr": "DELIVERED",          // Surrendered
  "void": "EXCEPTION",          // Voided
  // DCSA Transport event codes
  "depa": "IN_TRANSIT",         // Departed
  "arri": "AT_PORT",            // Arrived
  "cros": "IN_TRANSIT",         // Crossing / in transit
  // Customs event codes
  "cuss": "CUSTOMS_HOLD",       // Customs started
  "cusi": "CUSTOMS_HOLD",       // Customs inspection
  "cusr": "DELIVERED",          // Customs released
  // Inspection & penalties
  "insp": "CUSTOMS_HOLD",       // Inspection
  "rsea": "EXCEPTION",          // Re-sealed
  "rmvd": "EXCEPTION",          // Removed
  "pena": "EXCEPTION",          // Penalty applied
  "penu": "EXCEPTION",          // Penalty under appeal
  "penc": "EXCEPTION",          // Penalty cancelled
  // Shipping status (top-level metadata.shippingStatus)
  "planned":    "BOOKED",
  "in_transit": "IN_TRANSIT",
  "delivered":  "DELIVERED",
  "unknown":    "UNKNOWN",
};

// ── JSONCargo — ocean container status strings ────────────────
const JSONCARGO_MAP: StatusMap = {
  "empty to shipper":            "BOOKED",
  "empty received at cy":        "DELIVERED",
  "gate in":                     "PICKED_UP",
  "loaded on board":             "IN_TRANSIT",
  "loaded on vessel":            "IN_TRANSIT",
  "in transit":                  "IN_TRANSIT",
  "departed":                    "IN_TRANSIT",
  "vessel departed":             "IN_TRANSIT",
  "loaded on transshipment":     "TRANSSHIPMENT",
  "load on transshipment":       "TRANSSHIPMENT",
  "transshipment":               "TRANSSHIPMENT",
  "transshipment discharge":     "TRANSSHIPMENT",
  "discharged in transshipment": "TRANSSHIPMENT",
  "arrived":                     "AT_PORT",
  "vessel arrived":              "AT_PORT",
  "vessel arrival":              "AT_PORT",
  "discharged":                  "AT_PORT",
  "discharge":                   "AT_PORT",  // JSONCargo sometimes without "d"
  "at port":                     "AT_PORT",
  "last seen at":                "IN_TRANSIT",
  "gate out":                    "OUT_FOR_DELIVERY",
  "delivered":                   "DELIVERED",
  "empty return":                "DELIVERED",
  "customs clearance":           "CUSTOMS_HOLD",
  "hold":                        "CUSTOMS_HOLD",
  "delay":                       "DELAYED",
  "delayed":                     "DELAYED",
  "exception":                   "EXCEPTION",
};

// ── Lufthansa Cargo + Qatar Airways (IATA standard codes) ────
// Both use identical IATA Cargo-IMP event codes
const LH_QR_MAP: StatusMap = {
  "rcs": "PICKED_UP",        // Received from shipper
  "bkd": "BOOKED",           // Booked
  "pre": "BOOKED",           // Pre-advised
  "man": "IN_TRANSIT",       // Manifested
  "dep": "IN_TRANSIT",       // Departed
  "arr": "AT_PORT",          // Arrived at destination
  "rcf": "AT_PORT",          // Received from flight
  "trm": "TRANSSHIPMENT",    // Transfer manifest
  "nfd": "OUT_FOR_DELIVERY", // Notified for delivery
  "awd": "OUT_FOR_DELIVERY", // Consignee notified
  "dlv": "DELIVERED",        // Delivered
  "ccd": "CUSTOMS_HOLD",     // Customs clearance delayed
  "foh": "CUSTOMS_HOLD",     // Freight on hold
  "dis": "EXCEPTION",        // Discrepancy
  "dly": "DELAYED",          // Delayed
};

// ── Generic fallbacks ─────────────────────────────────────────
const GENERIC_MAP: StatusMap = {
  "book":     "BOOKED",
  "pick":     "PICKED_UP",
  "collect":  "PICKED_UP",
  "transit":  "IN_TRANSIT",
  "depart":   "IN_TRANSIT",
  "sail":     "IN_TRANSIT",
  "fly":      "IN_TRANSIT",
  "transfer": "TRANSSHIPMENT",
  "port":     "AT_PORT",
  "arrive":   "AT_PORT",
  "arrival":  "AT_PORT",
  "delivery": "OUT_FOR_DELIVERY",
  "deliver":  "DELIVERED",
  "complete": "DELIVERED",
  "delay":    "DELAYED",
  "late":     "DELAYED",
  "customs":  "CUSTOMS_HOLD",
  "hold":     "CUSTOMS_HOLD",
  "except":   "EXCEPTION",
  "problem":  "EXCEPTION",
  "error":    "EXCEPTION",
};

/**
 * Normalizes a raw status string from a specific provider
 * into our unified ShipmentStatus enum.
 */
export function normalizeStatus(
  rawStatus: string,
  provider: string,
): ShipmentStatus {
  if (!rawStatus) return "UNKNOWN";

  const lower = rawStatus.toLowerCase().trim();

  // 1. Try provider-specific map (exact match)
  const providerMap = getProviderMap(provider);
  if (providerMap[lower]) return providerMap[lower];

  // 2. Try provider-specific map (substring match)
  for (const [key, status] of Object.entries(providerMap)) {
    if (lower.includes(key)) return status;
  }

  // 3. Try generic map (substring match)
  for (const [key, status] of Object.entries(GENERIC_MAP)) {
    if (lower.includes(key)) return status;
  }

  return "UNKNOWN";
}

function getProviderMap(provider: string): StatusMap {
  switch (provider.toLowerCase()) {
    case "jsoncargo":  return JSONCARGO_MAP;
    case "shipsgo":    return SHIPSGO_MAP;
    case "maersk":     return MAERSK_MAP;
    case "sinay":      return SINAY_MAP;
    case "lufthansa":
    case "qatar":      return LH_QR_MAP;
    case "airrates":
    case "trackcargo":
    case "champ":      return AIRRATES_MAP;
    default:           return {};
  }
}
