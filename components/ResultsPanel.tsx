import type { AnalysisResult } from "@/lib/types";
import { MapPanel } from "@/components/MapPanel";
import { MetricsDashboard } from "@/components/MetricsDashboard";
import { PartyList } from "@/components/PartyList";
import { Tabs } from "@/components/Tabs";
import { PdfExportButton } from "@/components/PdfExportButton";
import { daysBetween } from "@/lib/utils/format";

export function ResultsPanel({ result }: { result: AnalysisResult }) {
  const days = daysBetween(result.request.dateRange.start, result.request.dateRange.end);

  return (
    <div className="space-y-5 print-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">{result.request.address}</h2>
          <p className="text-sm text-ink/50 mt-0.5">
            {days}-day window · {result.request.propertyType.replace("_", " ")} ·{" "}
            {(result.request.geofence.type === "radius" ? result.request.geofence.radiusMeters : 0)}m geofence
          </p>
        </div>
        <PdfExportButton />
      </div>

      <Tabs
        tabs={[
          {
            key: "map",
            label: "Map",
            content: <MapPanel result={result} />,
          },
          {
            key: "metrics",
            label: "Metrics",
            content: <MetricsDashboard result={result} />,
          },
          {
            key: "parties",
            label: `Parties (${result.clusters.length})`,
            content: <PartyList result={result} />,
          },
        ]}
      />
    </div>
  );
}
