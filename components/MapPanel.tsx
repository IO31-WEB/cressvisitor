"use client";

import dynamic from "next/dynamic";
import type { AnalysisResult } from "@/lib/types";
import { SchematicMap } from "@/components/SchematicMap";

const MapboxMap = dynamic(() => import("@/components/MapboxMap").then((m) => m.MapboxMap), {
  ssr: false,
  loading: () => <div className="card h-[520px] animate-pulse bg-line/40" />,
});

const hasMapboxToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

export function MapPanel({ result }: { result: AnalysisResult }) {
  return hasMapboxToken ? <MapboxMap result={result} /> : <SchematicMap result={result} />;
}
