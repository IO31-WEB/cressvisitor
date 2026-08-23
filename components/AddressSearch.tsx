"use client";

import { useState } from "react";
import type { PropertyType } from "@/lib/types";
import { geocodeAddress } from "@/lib/geo/geocode";
import { useAnalysisStore } from "@/store/useAnalysisStore";

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

  const [address, setAddress] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType>("retail_strip");
  const [radiusMeters, setRadiusMeters] = useState(400);
  const [start, setStart] = useState(todayISO(-13));
  const [end, setEnd] = useState(todayISO());
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const busy = isGeocoding || status === "analyzing";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim() || busy) return;
    setGeocodeError(null);
    setIsGeocoding(true);

    const geocoded = await geocodeAddress(address);
    setIsGeocoding(false);

    if (!geocoded) {
      setGeocodeError(
        "Couldn't geocode that address. Try including city and state, e.g. \"4200 W Kennedy Blvd, Tampa, FL\"."
      );
      return;
    }
    setResolvedAddress(geocoded.address);

    await submit({
      address: geocoded.address,
      location: geocoded.location,
      propertyType,
      radiusMeters,
      dateRange: { start, end },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-5">
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
        {resolvedAddress && !geocodeError && (
          <p className="mt-1.5 text-sm text-ink/50">Matched: {resolvedAddress}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          <label htmlFor="radius" className="block text-sm font-medium text-ink mb-1.5">
            Geofence radius: {radiusMeters}m
          </label>
          <input
            id="radius"
            type="range"
            min={100}
            max={1200}
            step={50}
            value={radiusMeters}
            onChange={(e) => setRadiusMeters(Number(e.target.value))}
            className="w-full accent-accent mt-3"
          />
          <p className="mt-1 text-xs text-ink/40">Drawn as a radius; polygon drawing coming in Phase 2.</p>
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

      <button
        type="submit"
        disabled={busy}
        className="w-full sm:w-auto inline-flex items-center justify-center rounded-card bg-navy-900 px-6 py-3 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isGeocoding ? "Locating address…" : status === "analyzing" ? "Analyzing…" : "Run location intelligence analysis"}
      </button>
    </form>
  );
}
