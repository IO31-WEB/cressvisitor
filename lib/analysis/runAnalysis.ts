import type { AnalysisRequest, AnalysisResult, MetricSummary, VisitCluster } from "@/lib/types";
import { dataAdapter } from "@/lib/adapters/syntheticAdapter";
import { buildClusters } from "@/lib/clustering/cluster";
import { convexHull, kernelDensityGrid } from "@/lib/geo/hull";
import { isInsideGeofence } from "@/lib/geo/polygon";
import { daysBetween } from "@/lib/utils/format";

function computeMetrics(clusters: VisitCluster[], dateRange: AnalysisRequest["dateRange"]): MetricSummary {
  const visitorClusters = clusters.filter((c) => c.classification === "visitor");
  const employeeClusters = clusters.filter((c) => c.classification === "employee");
  const deliveryClusters = clusters.filter((c) => c.classification === "delivery_service");

  const uniqueDevices = new Set(clusters.flatMap((c) => c.deviceIds)).size;
  const estimatedActualVisitors = visitorClusters.reduce((s, c) => s + c.estimatedPartySize, 0);
  const estimatedVisitingParties = visitorClusters.length;
  const avgPartySize = estimatedVisitingParties > 0 ? estimatedActualVisitors / estimatedVisitingParties : 0;

  const repeatVisitors = visitorClusters.filter((c) => c.daysObserved > 1).length;
  const newVisitors = visitorClusters.length - repeatVisitors;

  const avgDwellMinutes =
    visitorClusters.length > 0
      ? visitorClusters.reduce((s, c) => s + c.avgDwellMinutes, 0) / visitorClusters.length
      : 0;

  const totalDays = daysBetween(dateRange.start, dateRange.end);
  const weeks = Math.max(totalDays / 7, 1 / 7);
  const totalVisitorVisits = visitorClusters.reduce((s, c) => s + c.daysObserved, 0);
  const visitsPerWeek = totalVisitorVisits / weeks;

  const employeesExcluded = new Set(employeeClusters.flatMap((c) => c.deviceIds)).size;
  const deliveryServiceExcluded = new Set(deliveryClusters.flatMap((c) => c.deviceIds)).size;

  return {
    uniqueDevices,
    estimatedActualVisitors,
    estimatedVisitingParties,
    avgPartySize: Number(avgPartySize.toFixed(1)),
    repeatVisitors,
    newVisitors,
    avgDwellMinutes: Math.round(avgDwellMinutes),
    visitsPerWeek: Number(visitsPerWeek.toFixed(1)),
    employeesExcluded,
    deliveryServiceExcluded,
  };
}

export async function runAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
  const rawEvents = await dataAdapter.fetchVisits(request);

  // Phase 2: containment is enforced by the pipeline itself, not assumed
  // from generation. Every event's site-entry point is checked against the
  // actual drawn geofence (circle or polygon) with the same point-in-polygon
  // test a real ingestion pipeline would run against raw device pings. The
  // SyntheticAdapter already samples inside the geofence, so this is a
  // no-op today by construction — but it's what makes "the actual polygon
  // geometry" a real constraint on the data rather than a display-only
  // decoration, and it's the exact hook a future real adapter's raw pings
  // would need if they ever arrived un-filtered.
  const events = rawEvents.filter((e) => isInsideGeofence(e.siteEntryPoint, request.geofence));

  const clusters = buildClusters(events);
  const metrics = computeMetrics(clusters, request.dateRange);

  const visitorOrigins = clusters
    .filter((c) => c.classification === "visitor")
    .map((c) => c.originCentroid);

  const tradeAreaHull = convexHull(visitorOrigins);
  const tradeAreaDensity = kernelDensityGrid(visitorOrigins);

  return {
    request,
    events,
    clusters,
    metrics,
    tradeAreaHull,
    tradeAreaDensity,
    generatedAt: new Date().toISOString(),
  };
}
