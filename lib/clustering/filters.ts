import type { VisitCluster } from "@/lib/types";

type ClusterStats = {
  avgDwellMinutes: number;
  avgPartySize: number;
  daysObserved: number;
  weekdaysOnly: boolean;
  avgArrivalHour: number; // 0-24, decimal
  uniqueDeviceCount: number;
};

/**
 * EMPLOYEE heuristic: weekday-only pattern, long dwell (6-11h), arrives in
 * the early-morning open window, and shows up on 2+ distinct days (a true
 * one-time long visit — e.g. an all-day vendor meeting — is intentionally
 * NOT flagged as an employee; recurrence is required).
 *
 * DELIVERY/SERVICE heuristic: very short dwell (<12 min) with a small
 * party size (couriers travel alone/in pairs).
 *
 * Everything else is a genuine visitor. Order matters: employee and
 * delivery checks run first since they're the higher-precision heuristics
 * requested by the client to exclude from trade-area analysis.
 */
export function classifyCluster(
  stats: ClusterStats
): { classification: VisitCluster["classification"]; reason: string } {
  const { avgDwellMinutes, avgPartySize, daysObserved, weekdaysOnly, avgArrivalHour, uniqueDeviceCount } = stats;

  if (
    weekdaysOnly &&
    daysObserved >= 2 &&
    avgDwellMinutes >= 300 &&
    avgDwellMinutes <= 660 &&
    avgArrivalHour >= 6 &&
    avgArrivalHour <= 10 &&
    uniqueDeviceCount <= 2
  ) {
    return {
      classification: "employee",
      reason: `Weekday-only, ${(avgDwellMinutes / 60).toFixed(1)}h dwell, arrives ~${Math.floor(
        avgArrivalHour
      )}:${String(Math.round((avgArrivalHour % 1) * 60)).padStart(2, "0")}, seen on ${daysObserved} days`,
    };
  }

  if (avgDwellMinutes < 12 && avgPartySize <= 1.5) {
    return {
      classification: "delivery_service",
      reason: `${Math.round(avgDwellMinutes)} min avg dwell, single-device pattern typical of courier/service traffic`,
    };
  }

  return {
    classification: "visitor",
    reason: `${Math.round(avgDwellMinutes)} min avg dwell, party of ~${Math.round(avgPartySize)}${
      daysObserved > 1 ? `, repeat visitor across ${daysObserved} days` : ""
    }`,
  };
}
