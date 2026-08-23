"use client";

import { useMemo, useRef } from "react";
import type { GeofenceMode, LatLng } from "@/lib/types";
import { makeLocalProjector } from "@/lib/geo/projection";

const VIEW = 420;
const HALF_WIDTH_METERS = 900; // fixed ~1.8km-wide drawing window

export function GeofenceMapSchematic({
  location,
  mode,
  radiusMeters,
  polygonPoints,
  onAddPoint,
}: {
  location: LatLng;
  mode: GeofenceMode;
  radiusMeters: number;
  polygonPoints: LatLng[];
  onAddPoint: (p: LatLng) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const projector = useMemo(() => makeLocalProjector(location, HALF_WIDTH_METERS, VIEW), [location]);
  const propertyPt = projector.project(location);
  const radiusPx = (radiusMeters / HALF_WIDTH_METERS) * (VIEW / 2);

  const polygonScreenPoints = polygonPoints.map((p) => projector.project(p));
  const polygonPath =
    polygonScreenPoints.length > 0
      ? polygonScreenPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") +
        (polygonScreenPoints.length >= 3
          ? ` L${polygonScreenPoints[0]!.x},${polygonScreenPoints[0]!.y}`
          : "")
      : null;

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (mode !== "polygon" || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VIEW;
    const y = ((e.clientY - rect.top) / rect.height) * VIEW;
    onAddPoint(projector.unproject({ x, y }));
  }

  return (
    <div className="card overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        onClick={handleClick}
        className={`w-full h-[380px] bg-[#eef1f6] ${mode === "polygon" ? "cursor-crosshair" : ""}`}
      >
        <defs>
          <pattern id="draw-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#dde2ea" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={VIEW} height={VIEW} fill="url(#draw-grid)" />

        {mode === "radius" && (
          <circle
            cx={propertyPt.x}
            cy={propertyPt.y}
            r={radiusPx}
            fill="#0f1c33"
            fillOpacity={0.06}
            stroke="#0f1c33"
            strokeOpacity={0.4}
            strokeDasharray="4 3"
          />
        )}

        {mode === "polygon" && polygonPath && (
          <path
            d={polygonPath}
            fill={polygonScreenPoints.length >= 3 ? "#2563eb" : "none"}
            fillOpacity={0.12}
            stroke="#2563eb"
            strokeWidth={2}
            strokeDasharray={polygonScreenPoints.length < 3 ? "4 3" : undefined}
          />
        )}
        {mode === "polygon" &&
          polygonScreenPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={5} fill="#2563eb" stroke="white" strokeWidth={1.5} />
          ))}

        <circle cx={propertyPt.x} cy={propertyPt.y} r={6} fill="#0f1c33" stroke="white" strokeWidth={2} />
      </svg>
      <p className="px-3 py-2 text-xs text-ink/40 border-t border-line">
        {mode === "polygon"
          ? 'Tap/click the map to add boundary points. Use "Undo point" or "Clear polygon" above to fix mistakes.'
          : "Zero-key schematic view — set NEXT_PUBLIC_MAPBOX_TOKEN for a real interactive basemap here too."}
      </p>
    </div>
  );
}
