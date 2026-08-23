import type { LatLng } from "@/lib/types";

// -----------------------------------------------------------------------
// A simple, invertible local equirectangular projector for a fixed square
// window around a center point.
//
// This is deliberately separate from SchematicMap's results-view projector
// (lib is not shared 1:1) because the two have different framing needs:
// the results map sizes its window from the actual data extent (property +
// visitor origins + hull), which doesn't exist yet at drawing time. The
// geofence drawing surface needs a *fixed* real-world window so clicking
// near the edge of the visible map behaves predictably, and — critically —
// needs to invert screen coordinates back to lat/lng, which the results
// projector never has to do.
// -----------------------------------------------------------------------

export function makeLocalProjector(center: LatLng, halfWidthMeters: number, viewSize: number) {
  const metersPerDegLat = 110_574;
  const metersPerDegLng = 111_320 * Math.cos((center.lat * Math.PI) / 180);
  const scale = viewSize / 2 / halfWidthMeters;

  return {
    project(p: LatLng): { x: number; y: number } {
      const dxMeters = (p.lng - center.lng) * metersPerDegLng;
      const dyMeters = (p.lat - center.lat) * metersPerDegLat;
      return { x: viewSize / 2 + dxMeters * scale, y: viewSize / 2 - dyMeters * scale };
    },
    unproject(pt: { x: number; y: number }): LatLng {
      const dxMeters = (pt.x - viewSize / 2) / scale;
      const dyMeters = (viewSize / 2 - pt.y) / scale;
      return {
        lat: center.lat + dyMeters / metersPerDegLat,
        lng: center.lng + dxMeters / metersPerDegLng,
      };
    },
  };
}
