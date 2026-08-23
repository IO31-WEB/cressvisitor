"use client";

import { useState } from "react";
import type { Geofence, GeofenceMode, LatLng, PropertyType } from "@/lib/types";
import { geocodeAddress } from "@/lib/geo/geocode";
import { useAnalysisStore } from "@/store/useAnalysisStore";
import { GeofenceEditor } from "@/components/GeofenceEditor";

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "retail_strip", label: "Retail strip" },
  { value: "restaurant", label: "Restaurant" },
  { value: "office", label: "Office" },
  { value: "industrial_flex", label: "Industrial / flex" },
  { value: "medical", label: "Medical" },
  { value: "grocery_anchor", label: "Grocery-anchored" },
  { value: "mixed_use", label: "Mixed-use" },
];

function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function AddressSearch() {
  const submit = useAnalysisStore((s) => s.submit);
  const status = useAnalysisStore((s) => s.status);

  // Stage 1: locate the property. Stage 2: configure geofence + type + dates.
  // Split into two stages (rather than Phase 1's single-shot form) because
  // the geofence drawing tools need a resolved lat/lng to center the map on
  // before they can render anything.
  const [stage, setStage] = useState<"address" | "configure">("address");
  const [address, setAddress] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const [propertyType, setPropertyType] = useState<PropertyType>("retail_strip");
  const [geofenceMode, setGeofenceMode] = useState<GeofenceMode>("radius");
  const [radiusMeters, setRadiusMeters] = useState(400);
  const [polygonPoints, setPolygonPoints] = useState<LatLng[]>([]);
  const [start, setStart] = useState(todayISO(-13));
  const [end, setEnd] = useState(todayISO());

  const busy = isGeocoding || status === "analyzing";
  const polygonValid = geofenceMode === "radius" || polygonPoints.length >= 3;

  async function handleLocate(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim() || busy) return;
    setGeocodeError(null);
    setIsGeocoding(true);

    const geocoded = await geocodeAddress(address);
    setIsGeocoding(false);

    if (!geocoded) {
      setGeocodeError(
        'Couldn\'t geocode that address. Try including city and state, e.g. "4200 W Kennedy Blvd, Tampa, FL".'
      );
      return;
    }
    setResolvedAddress(geocoded.address);
    setLocation(geocoded.location);
    setStage("configure");
  }

  function handleChangeAddress() {
    setStage("address");
    setLocation(null);
    setResolvedAddress(null);
    setPolygonPoints([]);
    setGeofenceMode("radius");
  }

  async function handleRunAnalysis(e: React.FormEvent) {
    e.preventDefault();
    if (!location || !resolvedAddress || busy || !polygonValid) return;

    const geofence: Geofence =
      geofenceMode === "radius"
        ? { type: "radius", center: location, radiusMeters }
        : { type: "polygon", points: polygonPoints };

    await submit({
      address: resolvedAddress,
      location,
      propertyType,
      geofence,
      dateRange: { start, end },
    });
  }

  if (stage === "address") {
    return (
      <form onSubmit={handleLocate} className="card p-6 space-y-4">
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-ink mb-1.5">
            Property address
          </label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="4200 W Kennedy Blvd, Tampa, FL 33609"
            className="w-full rounded-card border border-line px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            required
          />
          {geocodeError && <p className="mt-1.5 text-sm text-bad">{geocodeError}</p>}
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full sm:w-auto inline-flex items-center justify-center rounded-card bg-navy-900 px-6 py-3 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGeocoding ? "Locating address…" : "Find property"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleRunAnalysis} className="card p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">{resolvedAddress}</p>
          <p className="text-xs text-ink/40 mt-0.5">Property location matched</p>
        </div>
        <button
          type="button"
          onClick={handleChangeAddress}
          className="text-xs text-accent hover:underline shrink-0"
        >
          Change address
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="propertyType" className="block text-sm font-medium text-ink mb-1.5">
            Property type
          </label>
          <select
            id="propertyType"
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value as PropertyType)}
            className="w-full rounded-card border border-line px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {PROPERTY_TYPES.map((pt) => (
              <option key={pt.value} value={pt.value}>
                {pt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink/40">Weights the clustering & visitor-volume model.</p>
        </div>

        <div>
          <span className="block text-sm font-medium text-ink mb-1.5">Date range</span>
          <div className="flex gap-2">
            <input
              type="date"
              value={start}
              max={end}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-card border border-line px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="Start date"
            />
            <input
              type="date"
              value={end}
              min={start}
              max={todayISO()}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full rounded-card border border-line px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="End date"
            />
          </div>
        </div>
      </div>

      <GeofenceEditor
        location={location!}
        mode={geofenceMode}
        radiusMeters={radiusMeters}
        polygonPoints={polygonPoints}
        onModeChange={setGeofenceMode}
        onRadiusChange={setRadiusMeters}
        onPolygonPointsChange={setPolygonPoints}
      />

      <div>
        <button
          type="submit"
          disabled={busy || !polygonValid}
          className="w-full sm:w-auto inline-flex items-center justify-center rounded-card bg-navy-900 px-6 py-3 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {status === "analyzing" ? "Analyzing…" : "Run location intelligence analysis"}
        </button>
        {!polygonValid && (
          <p className="mt-2 text-xs text-warn">
            Add at least 3 points to close the polygon before running the analysis.
          </p>
        )}
      </div>
    </form>
  );
}
