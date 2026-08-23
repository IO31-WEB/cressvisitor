"use client";

import Map, { Source, Layer, Marker } from "react-map-gl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { MapLayerMouseEvent } from "mapbox-gl";
import type { GeofenceMode, LatLng } from "@/lib/types";
import { geofenceToGeoJsonPolygon, pointsToGeoJsonLine, pointsToGeoJsonPolygon } from "@/lib/geo/polygon";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
mapboxgl.accessToken = MAPBOX_TOKEN ?? "";

export function GeofenceMapMapbox({
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
  const radiusGeoJson = geofenceToGeoJsonPolygon({ type: "radius", center: location, radiusMeters });
  const polygonFillGeoJson = polygonPoints.length >= 3 ? pointsToGeoJsonPolygon(polygonPoints) : null;
  const polygonLineGeoJson =
    polygonPoints.length >= 2 ? pointsToGeoJsonLine(polygonPoints, polygonPoints.length >= 3) : null;
  const polygonLinePaint =
    polygonPoints.length < 3
      ? { "line-color": "#2563eb", "line-width": 2, "line-dasharray": [3, 2] }
      : { "line-color": "#2563eb", "line-width": 2 };

  function handleClick(e: MapLayerMouseEvent) {
    if (mode !== "polygon") return;
    onAddPoint({ lat: e.lngLat.lat, lng: e.lngLat.lng });
  }

  return (
    <div className={`card overflow-hidden ${mode === "polygon" ? "cursor-crosshair" : ""}`}>
      <Map
        initialViewState={{ longitude: location.lng, latitude: location.lat, zoom: 16 }}
        style={{ width: "100%", height: 380 }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        mapboxAccessToken={MAPBOX_TOKEN ?? ""}
        onClick={handleClick}
      >
        {mode === "radius" && (
          <Source id="radius-preview" type="geojson" data={radiusGeoJson}>
            <Layer id="radius-fill" type="fill" paint={{ "fill-color": "#0f1c33", "fill-opacity": 0.06 }} />
            <Layer
              id="radius-line"
              type="line"
              paint={{ "line-color": "#0f1c33", "line-width": 1.5, "line-dasharray": [2, 2] }}
            />
          </Source>
        )}

        {mode === "polygon" && polygonFillGeoJson && (
          <Source id="polygon-fill-preview" type="geojson" data={polygonFillGeoJson}>
            <Layer id="polygon-fill" type="fill" paint={{ "fill-color": "#2563eb", "fill-opacity": 0.12 }} />
          </Source>
        )}
        {mode === "polygon" && polygonLineGeoJson && (
          <Source id="polygon-line-preview" type="geojson" data={polygonLineGeoJson}>
            <Layer id="polygon-line" type="line" paint={polygonLinePaint} />
          </Source>
        )}
        {mode === "polygon" &&
          polygonPoints.map((p, i) => (
            <Marker key={i} longitude={p.lng} latitude={p.lat}>
              <div className="h-2.5 w-2.5 rounded-full bg-accent border-2 border-white shadow" />
            </Marker>
          ))}

        <Marker longitude={location.lng} latitude={location.lat}>
          <div className="h-3.5 w-3.5 rounded-full bg-navy-950 border-2 border-white shadow" />
        </Marker>
      </Map>
      <p className="px-3 py-2 text-xs text-ink/40 border-t border-line">
        {mode === "polygon"
          ? "Click the map to add boundary points."
          : 'Drag the slider above, or switch to "Draw polygon" for a precise boundary.'}
      </p>
    </div>
  );
}
