import type { VisitEvent, VisitCluster } from "@/lib/types";
import { haversineMeters } from "@/lib/geo/hull";
import { classifyCluster } from "@/lib/clustering/filters";

// -----------------------------------------------------------------------
// PARTY / VISIT-GROUP CLUSTERING
// -----------------------------------------------------------------------
// One device != one visitor. This module turns a flat list of per-device
// VisitEvents into VisitClusters representing probable *visiting parties*
// (e.g. a family of four that arrived in one car), in two passes:
//
//   PASS 1 — same-day "occurrence" clustering.
//     Within a single day, two events are linked if they are close on ALL
//     of: arrival time, departure time, dwell duration, coarse origin, and
//     approach bearing. We score every pair on a 0-1 scale per signal,
//     take a weighted sum, and union-find any pair above SIMILARITY_THRESHOLD
//     into the same occurrence. This is the "did these devices arrive
//     together today" question.
//
//   PASS 2 — cross-day merge.
//     Two occurrences (possibly days apart) are merged into one VisitCluster
//     if they share at least one device ID — i.e. the same party came back.
//     This is the "repeated co-occurrence across multiple days" signal the
//     brief asks for, and it's what lets us tell a one-time visitor from a
//     regular.
//
// Signal weights (tunable, documented inline below) favor arrival-time and
// origin proximity, since those are the two hardest signals to fake with
// coincidence — two strangers rarely arrive within 3 minutes of each other
// AND come from within 300m of the same coarse origin cell.
// -----------------------------------------------------------------------

const WEIGHTS = {
  arrival: 0.3,
  departure: 0.15,
  dwell: 0.15,
  origin: 0.25,
  bearing: 0.15,
};

const SIMILARITY_THRESHOLD = 0.62;
const ARRIVAL_WINDOW_MIN = 5;
const DEPARTURE_WINDOW_MIN = 6;
const ORIGIN_WINDOW_METERS = 300;
const BEARING_WINDOW_DEG = 45;

function minutesBetween(aISO: string, bISO: string): number {
  return Math.abs(new Date(aISO).getTime() - new Date(bISO).getTime()) / 60_000;
}

function angularDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function pairScore(a: VisitEvent, b: VisitEvent): number {
  const arrivalDiff = minutesBetween(a.arrival, b.arrival);
  const departureDiff = minutesBetween(a.departure, b.departure);
  const dwellDiff = Math.abs(a.dwellMinutes - b.dwellMinutes);
  const dwellScale = Math.max(a.dwellMinutes, b.dwellMinutes, 1);
  const originDist = haversineMeters(a.originCoarse, b.originCoarse);
  const bearingDelta = angularDiff(a.approachBearingDeg, b.approachBearingDeg);

  const arrivalScore = Math.max(0, 1 - arrivalDiff / ARRIVAL_WINDOW_MIN);
  const departureScore = Math.max(0, 1 - departureDiff / DEPARTURE_WINDOW_MIN);
  const dwellScore = Math.max(0, 1 - dwellDiff / dwellScale);
  const originScore = Math.max(0, 1 - originDist / ORIGIN_WINDOW_METERS);
  const bearingScore = Math.max(0, 1 - bearingDelta / BEARING_WINDOW_DEG);

  return (
    arrivalScore * WEIGHTS.arrival +
    departureScore * WEIGHTS.departure +
    dwellScore * WEIGHTS.dwell +
    originScore * WEIGHTS.origin +
    bearingScore * WEIGHTS.bearing
  );
}

// --- tiny union-find -----------------------------------------------------
class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]!);
    return this.parent[x]!;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
}

type Occurrence = {
  date: string;
  deviceIds: string[];
  events: VisitEvent[];
  arrivalStart: string;
  arrivalEnd: string;
  avgDwellMinutes: number;
  originCentroid: { lat: number; lng: number };
};

function clusterSingleDay(events: VisitEvent[]): Occurrence[] {
  const n = events.length;
  const uf = new UnionFind(n);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const score = pairScore(events[i]!, events[j]!);
      if (score >= SIMILARITY_THRESHOLD) uf.union(i, j);
    }
  }

  const groups = new Map<number, VisitEvent[]>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    const arr = groups.get(root) ?? [];
    arr.push(events[i]!);
    groups.set(root, arr);
  }

  return Array.from(groups.values()).map((groupEvents) => {
    const arrivals = groupEvents.map((e) => new Date(e.arrival).getTime());
    const avgDwell = groupEvents.reduce((s, e) => s + e.dwellMinutes, 0) / groupEvents.length;
    const avgLat = groupEvents.reduce((s, e) => s + e.originCoarse.lat, 0) / groupEvents.length;
    const avgLng = groupEvents.reduce((s, e) => s + e.originCoarse.lng, 0) / groupEvents.length;
    return {
      date: groupEvents[0]!.date,
      deviceIds: groupEvents.map((e) => e.deviceId),
      events: groupEvents,
      arrivalStart: new Date(Math.min(...arrivals)).toISOString(),
      arrivalEnd: new Date(Math.max(...arrivals)).toISOString(),
      avgDwellMinutes: avgDwell,
      originCentroid: { lat: avgLat, lng: avgLng },
    };
  });
}

function mergeOccurrencesAcrossDays(occurrences: Occurrence[]): Occurrence[][] {
  const n = occurrences.length;
  const uf = new UnionFind(n);
  const deviceToOccurrenceIndices = new Map<string, number[]>();

  occurrences.forEach((occ, idx) => {
    for (const deviceId of occ.deviceIds) {
      const list = deviceToOccurrenceIndices.get(deviceId) ?? [];
      list.push(idx);
      deviceToOccurrenceIndices.set(deviceId, list);
    }
  });

  for (const indices of deviceToOccurrenceIndices.values()) {
    for (let i = 1; i < indices.length; i++) uf.union(indices[0]!, indices[i]!);
  }

  const groups = new Map<number, Occurrence[]>();
  occurrences.forEach((occ, idx) => {
    const root = uf.find(idx);
    const arr = groups.get(root) ?? [];
    arr.push(occ);
    groups.set(root, arr);
  });

  return Array.from(groups.values());
}

export function buildClusters(events: VisitEvent[]): VisitCluster[] {
  const byDate = new Map<string, VisitEvent[]>();
  for (const e of events) {
    const arr = byDate.get(e.date) ?? [];
    arr.push(e);
    byDate.set(e.date, arr);
  }

  const allOccurrences: Occurrence[] = [];
  for (const dayEvents of byDate.values()) {
    allOccurrences.push(...clusterSingleDay(dayEvents));
  }

  const merged = mergeOccurrencesAcrossDays(allOccurrences);

  return merged.map((occGroup, idx) => {
    const uniqueDeviceIds = Array.from(new Set(occGroup.flatMap((o) => o.deviceIds)));
    const daysObserved = new Set(occGroup.map((o) => o.date)).size;
    const allEvents = occGroup.flatMap((o) => o.events);
    const avgDwellMinutes = allEvents.reduce((s, e) => s + e.dwellMinutes, 0) / allEvents.length;
    const avgPartySize = occGroup.reduce((s, o) => s + o.deviceIds.length, 0) / occGroup.length;

    const arrivalHours = allEvents.map((e) => new Date(e.arrival).getHours() + new Date(e.arrival).getMinutes() / 60);
    const avgLat = allEvents.reduce((s, e) => s + e.originCoarse.lat, 0) / allEvents.length;
    const avgLng = allEvents.reduce((s, e) => s + e.originCoarse.lng, 0) / allEvents.length;

    // Confidence blends: (a) how tight same-day pairings were on average,
    // approximated here via dwell/arrival consistency across occurrences,
    // and (b) corroboration from repeat observation across days.
    const dwellVariance =
      allEvents.reduce((s, e) => s + (e.dwellMinutes - avgDwellMinutes) ** 2, 0) / allEvents.length;
    const dwellConsistency = Math.max(0, 1 - Math.sqrt(dwellVariance) / Math.max(avgDwellMinutes, 1));
    const repeatBoost = Math.min(0.25, (daysObserved - 1) * 0.08);
    const confidence = Math.min(0.98, Math.max(0.4, dwellConsistency * 0.75 + 0.25 + repeatBoost));

    const weekdaysOnly = occGroup.every((o) => {
      const d = new Date(`${o.date}T00:00:00`).getDay();
      return d >= 1 && d <= 5;
    });
    const avgArrivalHour = arrivalHours.reduce((s, h) => s + h, 0) / arrivalHours.length;

    const { classification, reason } = classifyCluster({
      avgDwellMinutes,
      avgPartySize,
      daysObserved,
      weekdaysOnly,
      avgArrivalHour,
      uniqueDeviceCount: uniqueDeviceIds.length,
    });

    const arrivalStarts = occGroup.map((o) => new Date(o.arrivalStart).getTime());
    const arrivalEnds = occGroup.map((o) => new Date(o.arrivalEnd).getTime());

    const cluster: VisitCluster = {
      id: `cluster_${idx}_${uniqueDeviceIds[0] ?? "x"}`,
      deviceIds: uniqueDeviceIds,
      estimatedPartySize: Math.max(1, Math.round(avgPartySize)),
      confidence: Number(confidence.toFixed(2)),
      arrivalWindow: {
        start: new Date(Math.min(...arrivalStarts)).toISOString(),
        end: new Date(Math.max(...arrivalEnds)).toISOString(),
      },
      avgDwellMinutes: Math.round(avgDwellMinutes),
      originCentroid: { lat: avgLat, lng: avgLng },
      classification,
      classificationReason: reason,
      daysObserved,
    };
    return cluster;
  });
}
