import type { AnalysisResult } from "@/lib/types";
import { MapPanel } from "@/components/MapPanel";
import { MetricsDashboard } from "@/components/MetricsDashboard";
import { PartyList } from "@/components/PartyList";
import { Tabs } from "@/components/Tabs";
import { PdfExportButton } from "@/components/PdfExportButton";
import { TradeAreaLegend } from "@/components/TradeAreaLegend";
import { daysBetween } from "@/lib/utils/format";
import { geofenceAreaSqMeters } from "@/lib/geo/polygon";

const SQM_PER_ACRE = 4046.86;

function describeGeofence(result: AnalysisResult): string {
  const g = result.request.geofence;
  const areaAcres = geofenceAreaSqMeters(g) / SQM_PER_ACRE;
  return g.type === "radius"
    ? `${g.radiusMeters}m radius geofence (~${areaAcres.toFixed(2)} acres)`
    : `${g.points.length}-point polygon geofence (~${areaAcres.toFixed(2)} acres)`;
}

export function ResultsPanel({ result }: { result: AnalysisResult }) {
  const days = daysBetween(result.request.dateRange.start, result.request.dateRange.end);
  const geofenceLabel = describeGeofence(result);

  return (
    <div className="space-y-5 print-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">{result.request.address}</h2>
          <p className="text-sm text-ink/50 mt-0.5">
            {days}-day window · {result.request.propertyType.replace("_", " ")} · {geofenceLabel}
          </p>
          {/* Print-only cover details — the app header (with the "Synthetic
              data mode" badge) is hidden on paper, so restate the honesty
              note here where it will actually be seen. */}
          <div className="hidden print:block mt-2 text-xs text-ink/50 space-y-0.5">
            <p className="font-medium text-ink/70">CRESSOLUTIONS — Location Intelligence Report</p>
            <p>Generated {new Date(result.generatedAt).toLocaleString()}</p>
            <p className="italic">
              Synthetic data mode: visit events are deterministically generated for demonstration, not
              observed from a real device panel. See README for methodology.
            </p>
          </div>
        </div>
        <PdfExportButton />
      </div>

      <Tabs
        tabs={[
          {
            key: "map",
            label: "Map",
            content: (
              <div className="space-y-3">
                <MapPanel result={result} />
                <TradeAreaLegend geofenceLabel={geofenceLabel} />
              </div>
            ),
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
