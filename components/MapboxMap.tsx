"use client";

import { useMemo } from "react";
// react-map-gl v7 splits bindings by map engine — this app uses the real
// Mapbox GL JS engine (react-map-gl/mapbox), not the MapLibre fork.
import { Map, Source, Layer, Marker } from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { AnalysisResult } from "@/lib/types";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// When no token is configured this component is never mounted (see
// MapPanel), so it's safe to assume MAPBOX_TOKEN is defined here. We still
// avoid calling Mapbox's hosted geocoding/styles APIs from anywhere else.
mapboxgl.accessToken = MAPBOX_TOKEN ?? "";

export function MapboxMap({ result }: { result: AnalysisResult }) {
  const { request, clusters, tradeAreaDensity } = result;
  const visitorClusters = clusters.filter((c) => c.classification === "visitor");

  const geofenceGeoJson = useMemo(() => {
    if (request.geofence.type !== "radius") return null;
    return circleGeoJson(request.location, request.geofence.radiusMeters);
  }, [request]);

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

        {geofenceGeoJson && (
          <Source id="geofence" type="geojson" data={geofenceGeoJson}>
            <Layer
              id="geofence-fill"
              type="fill"
              paint={{ "fill-color": "#0f1c33", "fill-opacity": 0.05 }}
            />
            <Layer
              id="geofence-line"
              type="line"
              paint={{ "line-color": "#0f1c33", "line-width": 1.5, "line-dasharray": [2, 2] }}
            />
          </Source>
        )}

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

function circleGeoJson(center: { lat: number; lng: number }, radiusMeters: number, points = 64) {
  const coords: [number, number][] = [];
  const distanceX = radiusMeters / (111320 * Math.cos((center.lat * Math.PI) / 180));
  const distanceY = radiusMeters / 110574;
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    coords.push([center.lng + distanceX * Math.cos(angle), center.lat + distanceY * Math.sin(angle)]);
  }
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [coords] },
  };
}
