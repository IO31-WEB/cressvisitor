"use client";

import { useMemo } from "react";
// Using react-map-gl v7's default export (bare "react-map-gl" resolves to
// the Mapbox GL JS bindings on v7; the /mapbox and /maplibre subpath split
// was introduced later, in v8).
import Map, { Source, Layer, Marker } from "react-map-gl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { AnalysisResult } from "@/lib/types";
import { circlePolygonPoints, geofenceCenter, geofenceToGeoJsonPolygon, pointsToGeoJsonPolygon } from "@/lib/geo/polygon";
import { haversineMeters } from "@/lib/geo/hull";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// When no token is configured this component is never mounted (see
// MapPanel), so it's safe to assume MAPBOX_TOKEN is defined here. We still
// avoid calling Mapbox's hosted geocoding/styles APIs from anywhere else.
mapboxgl.accessToken = MAPBOX_TOKEN ?? "";

export function MapboxMap({ result }: { result: AnalysisResult }) {
  const { request, clusters, tradeAreaDensity, tradeAreaHull } = result;
  const visitorClusters = clusters.filter((c) => c.classification === "visitor");
  const center = geofenceCenter(request.geofence);

  // Phase 2: renders the ACTUAL geofence shape (circle or hand-drawn
  // polygon) rather than always drawing a circle.
  const geofenceGeoJson = useMemo(() => geofenceToGeoJsonPolygon(request.geofence), [request.geofence]);

  const hullGeoJson = useMemo(
    () => (tradeAreaHull.length >= 3 ? pointsToGeoJsonPolygon(tradeAreaHull) : null),
    [tradeAreaHull]
  );

  // Lightweight, clearly-labeled distance rings (straight-line, NOT
  // drive-time isochrones — see TradeAreaLegend) at 50% and 100% of the
  // hull's farthest reach from the geofence center.
  const ringsGeoJson = useMemo(() => {
    if (tradeAreaHull.length < 3) return null;
    const maxDist = Math.max(...tradeAreaHull.map((p) => haversineMeters(p, center)));
    if (!isFinite(maxDist) || maxDist <= 0) return null;
    const features = [maxDist * 0.5, maxDist].map((r) => {
      const ring = circlePolygonPoints(center, r, 64);
      const closed = [...ring, ring[0]!];
      return {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: closed.map((p) => [p.lng, p.lat]) },
      };
    });
    return { type: "FeatureCollection" as const, features };
  }, [tradeAreaHull, center]);

  const densityGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: tradeAreaDensity.map((d) => ({
        type: "Feature" as const,
        properties: { weight: d.weight },
        geometry: { type: "Point" as const, coordinates: [d.point.lng, d.point.lat] },
      })),
    }),
    [tradeAreaDensity]
  );

  return (
    <div className="card overflow-hidden">
      <Map
        initialViewState={{ longitude: request.location.lng, latitude: request.location.lat, zoom: 13.5 }}
        style={{ width: "100%", height: 520 }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        mapboxAccessToken={MAPBOX_TOKEN ?? ""}
      >
        <Source id="density" type="geojson" data={densityGeoJson}>
          <Layer
            id="trade-area-heat"
            type="heatmap"
            paint={{
              "heatmap-weight": ["get", "weight"],
              "heatmap-intensity": 0.9,
              "heatmap-radius": 34,
              "heatmap-opacity": 0.55,
              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0,
                "rgba(37,99,235,0)",
                0.5,
                "rgba(37,99,235,0.5)",
                1,
                "rgba(15,28,51,0.85)",
              ],
            }}
          />
        </Source>

        {ringsGeoJson && (
          <Source id="distance-rings" type="geojson" data={ringsGeoJson}>
            <Layer
              id="distance-rings-line"
              type="line"
              paint={{ "line-color": "#0f1c33", "line-width": 1, "line-opacity": 0.25, "line-dasharray": [1, 2] }}
            />
          </Source>
        )}

        {hullGeoJson && (
          <Source id="trade-area-hull" type="geojson" data={hullGeoJson}>
            <Layer id="hull-fill" type="fill" paint={{ "fill-color": "#2563eb", "fill-opacity": 0.06 }} />
            <Layer id="hull-line" type="line" paint={{ "line-color": "#2563eb", "line-width": 2.5, "line-opacity": 0.85 }} />
          </Source>
        )}

        <Source id="geofence" type="geojson" data={geofenceGeoJson}>
          <Layer id="geofence-fill" type="fill" paint={{ "fill-color": "#0f1c33", "fill-opacity": 0.05 }} />
          <Layer
            id="geofence-line"
            type="line"
            paint={{ "line-color": "#0f1c33", "line-width": 1.5, "line-dasharray": [2, 2] }}
          />
        </Source>

        {visitorClusters.map((c) => (
          <Marker key={c.id} longitude={c.originCentroid.lng} latitude={c.originCentroid.lat}>
            <div
              className="rounded-full bg-accent/70 border border-white"
              style={{ width: 6 + Math.min(c.estimatedPartySize, 5) * 2, height: 6 + Math.min(c.estimatedPartySize, 5) * 2 }}
              title={`Party of ${c.estimatedPartySize} · ${Math.round(c.confidence * 100)}% confidence`}
            />
          </Marker>
        ))}

        <Marker longitude={request.location.lng} latitude={request.location.lat}>
          <div className="h-3.5 w-3.5 rounded-full bg-navy-950 border-2 border-white shadow" />
        </Marker>
      </Map>
    </div>
  );
}
