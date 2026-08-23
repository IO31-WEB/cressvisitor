import type { AnalysisResult, LatLng } from "@/lib/types";

// -----------------------------------------------------------------------
// Zero-key fallback renderer. When NEXT_PUBLIC_MAPBOX_TOKEN is unset we
// still owe the client a real, readable map — not a "connect an API key"
// placeholder. This projects lat/lng into an SVG viewbox using a local
// equirectangular approximation (fine at trade-area scale, a few miles
// across) and draws the same layers the Mapbox path draws: geofence,
// visit-origin dots, and the observed trade-area hull.
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
    const x = PAD + ((p.lng - minLng) * cosLat / span) * (VIEW - PAD * 2) + (VIEW - PAD * 2) * (1 - lngSpan * cosLat / span) / 2;
    const y = VIEW - PAD - ((p.lat - minLat) / span) * (VIEW - PAD * 2) - (VIEW - PAD * 2) * (1 - latSpan / span) / 2;
    return { x, y };
  };
}

export function SchematicMap({ result }: { result: AnalysisResult }) {
  const { request, clusters, tradeAreaHull } = result;
  const visitorClusters = clusters.filter((c) => c.classification === "visitor");
  const allPoints = [...visitorClusters.map((c) => c.originCentroid), ...tradeAreaHull];
  const project = makeProjector(request.location, allPoints);
  const propertyPt = project(request.location);

  // Geofence radius in SVG units — approximate using the projector's scale
  // by projecting a point offset due north by radiusMeters.
  const metersPerDegLat = 110_574;
  const northPoint: LatLng = {
    lat: request.location.lat + (request.geofence.type === "radius" ? request.geofence.radiusMeters : 300) / metersPerDegLat,
    lng: request.location.lng,
  };
  const radiusPx = Math.abs(project(northPoint).y - propertyPt.y);

  const hullPath =
    tradeAreaHull.length >= 3
      ? tradeAreaHull.map((p) => project(p)).map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z"
      : null;

  return (
    <div className="card p-2">
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="w-full h-[520px] rounded-card bg-[#eef1f6]">
        <defs>
          <pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M 26 0 L 0 0 0 26" fill="none" stroke="#dde2ea" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={VIEW} height={VIEW} fill="url(#grid)" />

        {hullPath && (
          <path d={hullPath} fill="#2563eb" fillOpacity={0.12} stroke="#2563eb" strokeOpacity={0.5} strokeWidth={1.5} />
        )}

        <circle cx={propertyPt.x} cy={propertyPt.y} r={radiusPx} fill="#0f1c33" fillOpacity={0.05} stroke="#0f1c33" strokeOpacity={0.35} strokeDasharray="4 3" />

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
        ring is the geofence, shaded polygon is the observed trade area. Set NEXT_PUBLIC_MAPBOX_TOKEN for a
        full interactive basemap.
      </p>
    </div>
  );
}
