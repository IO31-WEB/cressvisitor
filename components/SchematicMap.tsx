import type { AnalysisResult, LatLng } from "@/lib/types";
import { geofenceCenter, geofenceRingPoints } from "@/lib/geo/polygon";
import { haversineMeters } from "@/lib/geo/hull";

// -----------------------------------------------------------------------
// Zero-key fallback renderer. When NEXT_PUBLIC_MAPBOX_TOKEN is unset we
// still owe the client a real, readable map — not a "connect an API key"
// placeholder. This projects lat/lng into an SVG viewbox using a local
// equirectangular approximation (fine at trade-area scale, a few miles
// across) and draws the same layers the Mapbox path draws: the actual
// geofence shape (circle or polygon), visit-origin dots, the observed
// trade-area hull, and lightweight distance rings.
// -----------------------------------------------------------------------

const VIEW = 520;
const PAD = 40;

function makeProjector(center: LatLng, points: LatLng[]) {
  const allLats = [center.lat, ...points.map((p) => p.lat)];
  const allLngs = [center.lng, ...points.map((p) => p.lng)];
  const minLat = Math.min(...allLats);
  const maxLat = Math.max(...allLats);
  const minLng = Math.min(...allLngs);
  const maxLng = Math.max(...allLngs);

  const latSpan = Math.max(maxLat - minLat, 0.01);
  const lngSpan = Math.max(maxLng - minLng, 0.01);
  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  const span = Math.max(latSpan, lngSpan * cosLat);

  return (p: LatLng) => {
    const x =
      PAD +
      (((p.lng - minLng) * cosLat) / span) * (VIEW - PAD * 2) +
      ((VIEW - PAD * 2) * (1 - (lngSpan * cosLat) / span)) / 2;
    const y =
      VIEW -
      PAD -
      ((p.lat - minLat) / span) * (VIEW - PAD * 2) -
      ((VIEW - PAD * 2) * (1 - latSpan / span)) / 2;
    return { x, y };
  };
}

export function SchematicMap({ result }: { result: AnalysisResult }) {
  const { request, clusters, tradeAreaHull } = result;
  const visitorClusters = clusters.filter((c) => c.classification === "visitor");
  const center = geofenceCenter(request.geofence);
  const geofenceRing = geofenceRingPoints(request.geofence);

  const allPoints = [...visitorClusters.map((c) => c.originCentroid), ...tradeAreaHull, ...geofenceRing];
  const project = makeProjector(request.location, allPoints);
  const propertyPt = project(request.location);

  const geofencePath =
    geofenceRing.map(project).map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";

  const hullPath =
    tradeAreaHull.length >= 3
      ? tradeAreaHull.map((p) => project(p)).map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z"
      : null;

  // Distance rings: straight-line, not drive-time — sized off the hull's
  // farthest reach from the geofence center, offset due north for a stable
  // radius-in-pixels the same way the old radius-only circle did.
  const maxHullDist =
    tradeAreaHull.length >= 3 ? Math.max(...tradeAreaHull.map((p) => haversineMeters(p, center))) : 0;
  const centerPt = project(center);
  const ringRadiiPx =
    maxHullDist > 0
      ? [0.5, 1].map((frac) => {
          const ringPoint: LatLng = { lat: center.lat + (maxHullDist * frac) / 110_574, lng: center.lng };
          return Math.abs(project(ringPoint).y - centerPt.y);
        })
      : [];

  return (
    <div className="card p-2">
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="w-full h-[520px] rounded-card bg-[#eef1f6]">
        <defs>
          <pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M 26 0 L 0 0 0 26" fill="none" stroke="#dde2ea" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={VIEW} height={VIEW} fill="url(#grid)" />

        {ringRadiiPx.map((r, i) => (
          <circle
            key={i}
            cx={centerPt.x}
            cy={centerPt.y}
            r={r}
            fill="none"
            stroke="#0f1c33"
            strokeOpacity={0.2}
            strokeDasharray="2 3"
          />
        ))}

        {hullPath && (
          <path d={hullPath} fill="#2563eb" fillOpacity={0.1} stroke="#2563eb" strokeOpacity={0.85} strokeWidth={2.5} />
        )}

        <path
          d={geofencePath}
          fill="#0f1c33"
          fillOpacity={0.05}
          stroke="#0f1c33"
          strokeOpacity={0.35}
          strokeDasharray="4 3"
          strokeWidth={1.5}
        />

        {visitorClusters.map((c) => {
          const p = project(c.originCentroid);
          return (
            <circle
              key={c.id}
              cx={p.x}
              cy={p.y}
              r={3 + Math.min(c.estimatedPartySize, 5)}
              fill="#2563eb"
              fillOpacity={0.55}
            >
              <title>
                Party of {c.estimatedPartySize} · {Math.round(c.confidence * 100)}% confidence
              </title>
            </circle>
          );
        })}

        <circle cx={propertyPt.x} cy={propertyPt.y} r={7} fill="#0f1c33" stroke="white" strokeWidth={2} />
        <text x={propertyPt.x} y={propertyPt.y - 12} textAnchor="middle" fontSize="11" fill="#0f1c33" fontWeight={600}>
          Subject property
        </text>
      </svg>
      <p className="px-2 pb-1 pt-2 text-xs text-ink/40">
        Schematic projection (no Mapbox token configured) — dots are filtered visitor-party origins, dashed
        outline is the {request.geofence.type === "polygon" ? "drawn polygon" : "radius"} geofence, solid blue
        outline is the observed trade-area hull, faint dashed rings are straight-line distance markers (not
        drive-time isochrones). Set NEXT_PUBLIC_MAPBOX_TOKEN for a full interactive basemap.
      </p>
    </div>
  );
}
