"use client";

import dynamic from "next/dynamic";
import clsx from "clsx";
import type { GeofenceMode, LatLng } from "@/lib/types";
import { polygonAreaSqMeters } from "@/lib/geo/polygon";
import { GeofenceMapSchematic } from "@/components/GeofenceMapSchematic";

const GeofenceMapMapbox = dynamic(
  () => import("@/components/GeofenceMapMapbox").then((m) => m.GeofenceMapMapbox),
  { ssr: false, loading: () => <div className="card h-[380px] animate-pulse bg-line/40" /> }
);

const hasMapboxToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
const SQM_PER_ACRE = 4046.86;

export function GeofenceEditor({
  location,
  mode,
  radiusMeters,
  polygonPoints,
  onModeChange,
  onRadiusChange,
  onPolygonPointsChange,
}: {
  location: LatLng;
  mode: GeofenceMode;
  radiusMeters: number;
  polygonPoints: LatLng[];
  onModeChange: (mode: GeofenceMode) => void;
  onRadiusChange: (radius: number) => void;
  onPolygonPointsChange: (points: LatLng[]) => void;
}) {
  const areaSqMeters = mode === "radius" ? Math.PI * radiusMeters ** 2 : polygonAreaSqMeters(polygonPoints);
  const areaAcres = areaSqMeters / SQM_PER_ACRE;
  const polygonValid = polygonPoints.length >= 3;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="block text-sm font-medium text-ink">Geofence</span>
        <div className="inline-flex rounded-card border border-line overflow-hidden text-xs font-medium">
          <button
            type="button"
            onClick={() => onModeChange("radius")}
            className={clsx(
              "px-3 py-1.5 transition-colors",
              mode === "radius" ? "bg-navy-900 text-white" : "bg-white text-ink/60 hover:bg-paper"
            )}
          >
            Radius (quick)
          </button>
          <button
            type="button"
            onClick={() => onModeChange("polygon")}
            className={clsx(
              "px-3 py-1.5 transition-colors",
              mode === "polygon" ? "bg-navy-900 text-white" : "bg-white text-ink/60 hover:bg-paper"
            )}
          >
            Draw polygon (precise)
          </button>
        </div>
      </div>

      {mode === "radius" ? (
        <div>
          <label htmlFor="radius" className="block text-xs text-ink/50 mb-1.5">
            {radiusMeters}m radius · ~{areaAcres.toFixed(2)} acres
          </label>
          <input
            id="radius"
            type="range"
            min={100}
            max={1200}
            step={50}
            value={radiusMeters}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </div>
      ) : (
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-ink/50">
          <span>
            {polygonPoints.length} point{polygonPoints.length !== 1 ? "s" : ""}
            {polygonValid && ` · ~${areaAcres.toFixed(2)} acres`}
            {!polygonValid && polygonPoints.length > 0 && " · add at least 3 points to close the shape"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onPolygonPointsChange(polygonPoints.slice(0, -1))}
              disabled={polygonPoints.length === 0}
              className="px-2.5 py-1 rounded-card border border-line text-ink/60 hover:bg-paper disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Undo point
            </button>
            <button
              type="button"
              onClick={() => onPolygonPointsChange([])}
              disabled={polygonPoints.length === 0}
              className="px-2.5 py-1 rounded-card border border-line text-ink/60 hover:bg-paper disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear polygon
            </button>
          </div>
        </div>
      )}

      {hasMapboxToken ? (
        <GeofenceMapMapbox
          location={location}
          mode={mode}
          radiusMeters={radiusMeters}
          polygonPoints={polygonPoints}
          onAddPoint={(p) => onPolygonPointsChange([...polygonPoints, p])}
        />
      ) : (
        <GeofenceMapSchematic
          location={location}
          mode={mode}
          radiusMeters={radiusMeters}
          polygonPoints={polygonPoints}
          onAddPoint={(p) => onPolygonPointsChange([...polygonPoints, p])}
        />
      )}
    </div>
  );
}
