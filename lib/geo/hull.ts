import type { LatLng } from "@/lib/types";

/**
 * Andrew's monotone chain convex hull. Treats lng as x and lat as y, which
 * is a fine planar approximation for a single trade area (a few miles
 * across) — not valid at continental scale, but that's out of scope here.
 */
export function convexHull(points: LatLng[]): LatLng[] {
  const pts = dedupe(points).sort((a, b) => a.lng - b.lng || a.lat - b.lat);
  if (pts.length < 3) return pts;

  const cross = (o: LatLng, a: LatLng, b: LatLng) =>
    (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);

  const lower: LatLng[] = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: LatLng[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }

  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function dedupe(points: LatLng[]): LatLng[] {
  const seen = new Set<string>();
  const out: LatLng[] = [];
  for (const p of points) {
    const key = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

/**
 * Very small Gaussian-kernel density estimate over an evenly spaced grid,
 * used to render the "Observed Trade Area" heatmap layer. Returns weighted
 * points (0-1) suitable for a Mapbox heatmap-weight expression.
 */
export function kernelDensityGrid(
  points: LatLng[],
  gridSize = 18,
  bandwidthDeg = 0.01
): { point: LatLng; weight: number }[] {
  if (points.length === 0) return [];

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const padding = bandwidthDeg * 2;
  const minLat = Math.min(...lats) - padding;
  const maxLat = Math.max(...lats) + padding;
  const minLng = Math.min(...lngs) - padding;
  const maxLng = Math.max(...lngs) + padding;

  const cells: { point: LatLng; weight: number }[] = [];
  let maxWeight = 0;

  for (let i = 0; i <= gridSize; i++) {
    for (let j = 0; j <= gridSize; j++) {
      const lat = minLat + ((maxLat - minLat) * i) / gridSize;
      const lng = minLng + ((maxLng - minLng) * j) / gridSize;
      let weight = 0;
      for (const p of points) {
        const dLat = lat - p.lat;
        const dLng = lng - p.lng;
        const distSq = dLat * dLat + dLng * dLng;
        weight += Math.exp(-distSq / (2 * bandwidthDeg * bandwidthDeg));
      }
      maxWeight = Math.max(maxWeight, weight);
      cells.push({ point: { lat, lng }, weight });
    }
  }

  // Normalize 0-1 and drop near-zero cells to keep the payload small.
  return cells
    .map((c) => ({ point: c.point, weight: maxWeight > 0 ? c.weight / maxWeight : 0 }))
    .filter((c) => c.weight > 0.05);
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
