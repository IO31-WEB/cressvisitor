import type { Geofence, LatLng } from "@/lib/types";
import { haversineMeters } from "@/lib/geo/hull";

// -----------------------------------------------------------------------
// Phase 2: polygon geofence geometry.
// Pure functions only — no React, no map-library imports — so every piece
// is trivially unit-testable and shared identically between the
// SyntheticAdapter, the analysis pipeline, the Mapbox renderer, and the
// zero-key SVG renderer. This is the single source of truth for "what does
// the geofence actually cover" — nothing else re-implements it.
// -----------------------------------------------------------------------

/** Ray-casting point-in-polygon test. `polygon` is an open ring (the first
 * point does not need to repeat as the last). */
export function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  const { lng: x, lat: y } = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    const intersects =
      pi.lat > y !== pj.lat > y &&
      x < ((pj.lng - pi.lng) * (y - pi.lat)) / (pj.lat - pi.lat) + pi.lng;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInCircle(point: LatLng, center: LatLng, radiusMeters: number): boolean {
  return haversineMeters(point, center) <= radiusMeters;
}

/**
 * The single containment test every downstream stage shares — adapter
 * sampling, the pipeline's containment filter, and (indirectly) anything
 * that trusts a VisitEvent's siteEntryPoint. This is what makes "the
 * actual polygon geometry" a real constraint on the data rather than a
 * decoration on the map.
 */
export function isInsideGeofence(point: LatLng, geofence: Geofence): boolean {
  return geofence.type === "radius"
    ? pointInCircle(point, geofence.center, geofence.radiusMeters)
    : pointInPolygon(point, geofence.points);
}

export function polygonBounds(points: LatLng[]) {
  return {
    minLat: Math.min(...points.map((p) => p.lat)),
    maxLat: Math.max(...points.map((p) => p.lat)),
    minLng: Math.min(...points.map((p) => p.lng)),
    maxLng: Math.max(...points.map((p) => p.lng)),
  };
}

export function polygonCentroid(points: LatLng[]): LatLng {
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}

/**
 * Shoelace formula on a local equirectangular projection (meters) around
 * the polygon's own centroid — accurate at trade-area scale (a property
 * lot, at most a few miles across), not meant for continental-scale shapes.
 */
export function polygonAreaSqMeters(points: LatLng[]): number {
  if (points.length < 3) return 0;
  const centerLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const xy = points.map((p) => ({ x: p.lng * 111_320 * cosLat, y: p.lat * 110_574 }));
  let area = 0;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i]!;
    const b = xy[(i + 1) % xy.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

export function geofenceAreaSqMeters(geofence: Geofence): number {
  return geofence.type === "radius"
    ? Math.PI * geofence.radiusMeters ** 2
    : polygonAreaSqMeters(geofence.points);
}

export function geofenceCenter(geofence: Geofence): LatLng {
  return geofence.type === "radius" ? geofence.center : polygonCentroid(geofence.points);
}

/** Farthest reach of the shape from its own center — handy for framing
 * maps or sizing distance rings around an irregular hand-drawn polygon. */
export function geofenceReachMeters(geofence: Geofence): number {
  if (geofence.type === "radius") return geofence.radiusMeters;
  const center = polygonCentroid(geofence.points);
  return Math.max(...geofence.points.map((p) => haversineMeters(p, center)));
}

function offsetMeters(origin: LatLng, meters: number, bearingRad: number): LatLng {
  const dLat = (meters * Math.cos(bearingRad)) / 110_574;
  const dLng = (meters * Math.sin(bearingRad)) / (111_320 * Math.cos((origin.lat * Math.PI) / 180));
  return { lat: origin.lat + dLat, lng: origin.lng + dLng };
}

/** Point list approximating a circle — used both to render a radius
 * geofence as a drawable ring and anywhere else that only knows how to
 * work with polygon point lists. */
export function circlePolygonPoints(center: LatLng, radiusMeters: number, steps = 48): LatLng[] {
  return Array.from({ length: steps }, (_, i) => {
    const angle = (i / steps) * 2 * Math.PI;
    return offsetMeters(center, radiusMeters, angle);
  });
}

/** Ring points for whichever geofence shape is active — the one place
 * every renderer (Mapbox, SVG schematic) gets "the boundary to draw". */
export function geofenceRingPoints(geofence: Geofence): LatLng[] {
  return geofence.type === "radius"
    ? circlePolygonPoints(geofence.center, geofence.radiusMeters)
    : geofence.points;
}

export function geofenceToGeoJsonPolygon(geofence: Geofence) {
  return pointsToGeoJsonPolygon(geofenceRingPoints(geofence));
}

export function pointsToGeoJsonPolygon(points: LatLng[]) {
  const closed = points.length >= 3 ? [...points, points[0]!] : points;
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [closed.map((p) => [p.lng, p.lat])] },
  };
}

export function pointsToGeoJsonLine(points: LatLng[], close: boolean) {
  const coords = close && points.length >= 3 ? [...points, points[0]!] : points;
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: coords.map((p) => [p.lng, p.lat]) },
  };
}

/**
 * Seeded rejection-sampling of a point inside the geofence, used by the
 * SyntheticAdapter to place a realistic "site entry point" per visit
 * event. Bounded attempts guard against a degenerate (self-intersecting or
 * near-zero-area) hand-drawn polygon; falls back to the centroid rather
 * than looping forever.
 */
export function sampleRandomPointInGeofence(geofence: Geofence, rand: () => number): LatLng {
  if (geofence.type === "radius") {
    const angle = rand() * 2 * Math.PI;
    // sqrt(rand()) so points are uniform over the disc's AREA, not biased
    // toward the center the way a naive linear radius sample would be.
    const r = geofence.radiusMeters * Math.sqrt(rand());
    return offsetMeters(geofence.center, r, angle);
  }
  const bounds = polygonBounds(geofence.points);
  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate: LatLng = {
      lat: bounds.minLat + rand() * (bounds.maxLat - bounds.minLat),
      lng: bounds.minLng + rand() * (bounds.maxLng - bounds.minLng),
    };
    if (pointInPolygon(candidate, geofence.points)) return candidate;
  }
  return polygonCentroid(geofence.points);
}
