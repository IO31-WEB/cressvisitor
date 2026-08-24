"use client";

import { useMemo, useState } from "react";
import type { AnalysisResult, VisitCluster } from "@/lib/types";
import { formatMinutes, formatTime, formatHourOfDay } from "@/lib/utils/format";
import clsx from "clsx";

type Filter = "all" | VisitCluster["classification"];

const CLASS_LABEL: Record<VisitCluster["classification"], string> = {
  visitor: "Visitor",
  employee: "Employee",
  delivery_service: "Delivery / service",
};

const CLASS_STYLE: Record<VisitCluster["classification"], string> = {
  visitor: "bg-good/10 text-good",
  employee: "bg-accent/10 text-accent",
  delivery_service: "bg-warn/10 text-warn",
};

export function PartyList({ result }: { result: AnalysisResult }) {
  const [filter, setFilter] = useState<Filter>("all");

  // Screen view follows the selected filter.
  // Print always shows the full unfiltered list so every category appears in the PDF.
  const clusters = useMemo(() => {
    const sorted = [...result.clusters].sort(
      (a, b) =>
        new Date(b.arrivalWindow.start).getTime() -
        new Date(a.arrivalWindow.start).getTime()
    );
    return filter === "all"
      ? sorted
      : sorted.filter((c) => c.classification === filter);
  }, [result.clusters, filter]);

  // Always compute the full sorted list for print
  const allClusters = useMemo(() => {
    return [...result.clusters].sort(
      (a, b) =>
        new Date(b.arrivalWindow.start).getTime() -
        new Date(a.arrivalWindow.start).getTime()
    );
  }, [result.clusters]);

  const counts = useMemo(() => {
    const c = {
      all: result.clusters.length,
      visitor: 0,
      employee: 0,
      delivery_service: 0,
    };
    for (const cl of result.clusters) c[cl.classification]++;
    return c;
  }, [result.clusters]);

  return (
    <div className="card overflow-hidden">
      {/* Filter chips — hidden when printing */}
      <div className="flex flex-wrap gap-1.5 p-4 border-b border-line no-print">
        {(["all", "visitor", "employee", "delivery_service"] as Filter[]).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                filter === f
                  ? "bg-navy-900 text-white"
                  : "bg-paper text-ink/60 hover:bg-line"
              )}
            >
              {f === "all" ? "All" : CLASS_LABEL[f]} ({counts[f]})
            </button>
          )
        )}
      </div>

      {/* Screen list (respects current filter) */}
      <div className="divide-y divide-line max-h-[560px] overflow-y-auto no-print">
        {clusters.length === 0 && (
          <p className="p-6 text-sm text-ink/40 text-center">
            No clusters match this filter.
          </p>
        )}
        {clusters.map((c) => (
          <PartyRow key={c.id} cluster={c} />
        ))}
      </div>

      {/* Print-only list — always shows every category */}
      <div className="hidden print:block divide-y divide-line">
        {allClusters.map((c) => (
          <PartyRow key={c.id} cluster={c} />
        ))}
      </div>
    </div>
  );
}

/**
 * A cluster's arrivalWindow start/end are real chronological timestamps,
 * but for a multi-day cluster they land on different days — formatting
 * both as clock-time-only (e.g. "9:40 AM–8:39 AM") reads as backwards even
 * though the underlying order is correct. For anything observed on more
 * than one day, show the mean time-of-day instead of a raw range; same-day
 * clusters keep the exact range since there's no date ambiguity there.
 */
function arrivalLabel(c: VisitCluster): string {
  if (c.daysObserved > 1) {
    return `~${formatHourOfDay(c.avgArrivalHour)} typical arrival`;
  }
  return c.arrivalWindow.start !== c.arrivalWindow.end
    ? `${formatTime(c.arrivalWindow.start)}–${formatTime(c.arrivalWindow.end)}`
    : formatTime(c.arrivalWindow.start);
}

function PartyRow({ cluster: c }: { cluster: VisitCluster }) {
  return (
    <div className="p-4 hover:bg-paper/60 transition-colors print:break-inside-avoid">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                "px-2 py-0.5 rounded-full text-[11px] font-semibold",
                CLASS_STYLE[c.classification]
              )}
            >
              {CLASS_LABEL[c.classification]}
            </span>
            <span className="text-xs text-ink/40">{arrivalLabel(c)}</span>
          </div>
          <p className="mt-1.5 text-sm text-ink/70">{c.classificationReason}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-semibold tabular-nums">
            {c.estimatedPartySize}
          </p>
          <p className="text-[11px] text-ink/40">est. party</p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/50">
        <span>
          {c.deviceIds.length} device{c.deviceIds.length !== 1 ? "s" : ""}
        </span>
        <span>{formatMinutes(c.avgDwellMinutes)} dwell</span>
        <span>{Math.round(c.confidence * 100)}% confidence</span>
        <span>
          {c.daysObserved} day{c.daysObserved !== 1 ? "s" : ""} observed
        </span>
      </div>
    </div>
  );
}
