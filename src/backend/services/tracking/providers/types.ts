import type { ShipmentStatus, ShipmentType } from "@prisma/client";

// ── Provider interface contract ───────────────────────────────
export interface TrackingProvider {
  readonly name: string;
  readonly supports: ShipmentType[];
  track(trackingNumber: string, type: ShipmentType): Promise<ProviderResult>;
  healthCheck?(): Promise<boolean>;
}

// ── Raw provider response (before normalization) ──────────────
export interface ProviderResult {
  success:   boolean;
  provider:  string;
  trackingNumber: string;
  carrier?:  string;
  events:    ProviderEvent[];
  eta?:      Date;
  etd?:      Date;
  origin?:   string;
  destination?: string;
  vessel?:   string;
  voyage?:   string;
  flight?:   string;
  rawData?:  unknown;
  error?:    string;
}

export interface ProviderEvent {
  rawStatus:   string;           // Provider-specific status string
  location:    string;
  description: string;
  timestamp:   Date;
}

// ── Unified normalized result ─────────────────────────────────
export interface TrackingResult {
  trackingNumber: string;
  type:          ShipmentType;
  carrier?:      string;
  carrierCode?:  string;
  currentStatus: ShipmentStatus;
  currentLocation?: string;
  origin?:       string;
  destination?:  string;
  etaDate?:      Date;
  etdDate?:      Date;
  ataDate?:      Date;
  vesselName?:   string;
  voyageNumber?: string;
  flightNumber?: string;
  events:        NormalizedEvent[];
  provider:      string;
  cachedAt?:     Date;
  polledAt:      Date;
}

export interface NormalizedEvent {
  status:      ShipmentStatus;
  location:    string;
  description: string;
  eventDate:   Date;
  source:      string;
}
