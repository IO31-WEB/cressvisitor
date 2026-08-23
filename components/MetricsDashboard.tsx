import type { AnalysisResult } from "@/lib/types";
import { MetricCard } from "@/components/MetricCard";
import { formatMinutes, formatNumber, formatPercent } from "@/lib/utils/format";

export function MetricsDashboard({ result }: { result: AnalysisResult }) {
  const m = result.metrics;
  const totalRepeatPlusNew = m.repeatVisitors + m.newVisitors || 1;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <MetricCard
        label="Unique devices"
        value={formatNumber(m.uniqueDevices)}
        tooltip="Every distinct device ID observed inside the geofence during the date range, before any clustering or filtering — the raw panel count."
      />
      <MetricCard
        label="Estimated actual visitors"
        value={formatNumber(m.estimatedActualVisitors)}
        tooltip="Sum of estimated party sizes across all clusters classified as visitors (employees and delivery/service excluded). Accounts for multiple people sharing one device signal per party."
      />
      <MetricCard
        label="Estimated visiting parties"
        value={formatNumber(m.estimatedVisitingParties)}
        tooltip="Number of distinct visiting-party clusters — groups of devices that arrived, dwelled, and departed together, or returned together on a later day."
      />
      <MetricCard
        label="Avg. estimated party size"
        value={m.avgPartySize.toFixed(1)}
        tooltip="Estimated actual visitors ÷ estimated visiting parties. A value above 1.0 means visitors are typically arriving in groups (families, coworkers), not alone."
      />
      <MetricCard
        label="Repeat vs. new visitors"
        value={`${formatPercent(m.repeatVisitors / totalRepeatPlusNew)} repeat`}
        tooltip={`${m.repeatVisitors} parties were observed on more than one day in range (repeat); ${m.newVisitors} were seen only once (new).`}
      />
      <MetricCard
        label="Average dwell time"
        value={formatMinutes(m.avgDwellMinutes)}
        tooltip="Mean time-on-site across all visitor-classified clusters, from first arrival to last departure of the party."
      />
      <MetricCard
        label="Visit frequency"
        value={`${m.visitsPerWeek.toFixed(1)} / week`}
        tooltip="Total visitor-party visit-days observed, normalized to a 7-day week across the selected date range."
      />
      <MetricCard
        label="Employees excluded"
        value={formatNumber(m.employeesExcluded)}
        tone="excluded"
        tooltip="Devices flagged as staff: weekday-only pattern, 6-11 hour dwell, arriving in the early-morning open window, observed on 2+ days. Excluded from visitor & trade-area metrics."
      />
      <MetricCard
        label="Delivery / service excluded"
        value={formatNumber(m.deliveryServiceExcluded)}
        tone="excluded"
        tooltip="Devices flagged as couriers or service traffic: under 12 minutes on site, single-device pattern. Excluded from visitor & trade-area metrics."
      />
    </div>
  );
}
