import type { LatLng } from "@/lib/types";

export type GeocodeResult = {
  address: string;
  location: LatLng;
  provider: "mapbox" | "nominatim";
};

/**
 * Geocode a free-text address. Uses Mapbox if NEXT_PUBLIC_MAPBOX_TOKEN is
 * set (better US commercial-address matching); otherwise falls back to the
 * free OpenStreetMap Nominatim API. The app must never hard-require a paid
 * key to boot, so this fallback path is exercised by default.
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (token) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query
      )}.json?access_token=${token}&country=us&types=address,poi&limit=1`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const feature = data.features?.[0];
        if (feature) {
          const [lng, lat] = feature.center as [number, number];
          return { address: feature.place_name as string, location: { lat, lng }, provider: "mapbox" };
        }
      }
    } catch {
      // fall through to Nominatim
    }
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(
      query
    )}`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
    const first = data[0];
    if (!first) return null;
    return {
      address: first.display_name,
      location: { lat: parseFloat(first.lat), lng: parseFloat(first.lon) },
      provider: "nominatim",
    };
  } catch {
    return null;
  }
}
