// -----------------------------------------------------------------------
// Core domain types for the Geofencing / Location-Intelligence module.
// Every layer (adapter -> clustering -> UI) speaks these shapes, so the
// SyntheticAdapter and a future real-data adapter are interchangeable.
// -----------------------------------------------------------------------

export type LatLng = { lat: number; lng: number };

/** Radius or hand-drawn polygon geofence around the subject property. */
export type Geofence =
  | { type: "radius"; center: LatLng; radiusMeters: number }
  | { type: "polygon"; points: LatLng[] };

/** Convenience alias for the discriminant of Geofence — used by UI state
 * (mode toggle) without importing the full union. */
export type GeofenceMode = Geofence["type"];

export type PropertyType =
  | "retail_strip"
  | "restaurant"
  | "office"
  | "industrial_flex"
  | "medical"
  | "grocery_anchor"
  | "mixed_use";

export type DateRange = { start: string; end: string }; // ISO yyyy-mm-dd

export type AnalysisRequest = {
  address: string;
  location: LatLng;
  geofence: Geofence;
  propertyType: PropertyType;
  dateRange: DateRange;
};

/**
 * A single raw device "ping" derived event: one visit by one mobile device
 * to the geofence. This is the atomic unit a real panel provider (Unacast,
 * SafeGraph, Foursquare) would hand back — the DataAdapter's job is only
 * to produce a list of these, however it gets them.
 */
export type VisitEvent = {
  deviceId: string;
  arrival: string; // ISO datetime
  departure: string; // ISO datetime
  dwellMinutes: number;
  originCoarse: LatLng; // deliberately coarsened (~500m jitter), never home-level
  approachBearingDeg: number; // 0-360, direction traveled from immediately prior
  date: string; // yyyy-mm-dd, convenience for day-bucketing
  /**
   * Phase 2: where within the geofence this device was actually detected
   * (as opposed to originCoarse, which is where the visitor came FROM).
   * Sampled inside the real geofence shape — circle or polygon — via
   * lib/geo/polygon.ts, and re-validated against that same shape by the
   * analysis pipeline (lib/analysis/runAnalysis.ts) with a point-in-polygon
   * test. This is what makes a hand-drawn polygon a real constraint on the
   * data rather than a cosmetic overlay.
   */
  siteEntryPoint: LatLng;
};

/** A probabilistic grouping of devices believed to be one visiting party. */
export type VisitCluster = {
  id: string;
  deviceIds: string[];
  estimatedPartySize: number;
  confidence: number; // 0-1
  arrivalWindow: { start: string; end: string };
  avgDwellMinutes: number;
  originCentroid: LatLng;
  classification: "visitor" | "employee" | "delivery_service";
  classificationReason: string;
  daysObserved: number;
};

export type MetricSummary = {
  uniqueDevices: number;
  estimatedActualVisitors: number;
  estimatedVisitingParties: number;
  avgPartySize: number;
  repeatVisitors: number;
  newVisitors: number;
  avgDwellMinutes: number;
  visitsPerWeek: number;
  employeesExcluded: number;
  deliveryServiceExcluded: number;
};

export type AnalysisResult = {
  request: AnalysisRequest;
  events: VisitEvent[];
  clusters: VisitCluster[];
  metrics: MetricSummary;
  tradeAreaHull: LatLng[]; // convex hull of filtered visitor origins
  tradeAreaDensity: { point: LatLng; weight: number }[]; // for heatmap layer
  generatedAt: string;
};

/**
 * The seam between "however we get visit data" and "everything downstream".
 * Swap SyntheticAdapter for a real provider by implementing this interface
 * against a paid API — nothing in clustering/ or components/ needs to change.
 */
export interface DataAdapter {
  readonly name: string;
  fetchVisits(request: AnalysisRequest): Promise<VisitEvent[]>;
}
