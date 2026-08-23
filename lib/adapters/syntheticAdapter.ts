import type { AnalysisRequest, DataAdapter, LatLng, PropertyType, VisitEvent } from "@/lib/types";
import { hashStringToSeed, mulberry32, seededGaussian, seededInt } from "@/lib/utils/seed";
import { geofenceAreaSqMeters, geofenceCenter, sampleRandomPointInGeofence } from "@/lib/geo/polygon";

// -----------------------------------------------------------------------
// SyntheticAdapter
// -----------------------------------------------------------------------
// Produces device-level visit events that *look and behave* like a real
// mobile-location panel feed (SafeGraph Patterns / Unacast / Foursquare),
// without paying for one. It is deterministic: the same address + geofence
// + date range always yields byte-identical output, driven entirely by a
// seeded PRNG (see lib/utils/seed.ts) — never Math.random.
//
// Three traffic classes are generated per day, matching what the client
// asked the dashboard to separate out:
//   1. Employees        — weekday-only, long dwell, arrive ~7-9am, same
//                          device recurs on every weekday in range.
//   2. Delivery/service  — very short dwell, scattered through the day.
//   3. Visitor parties   — the traffic we actually care about. Modeled as
//                          groups of 1-5 devices arriving within a few
//                          minutes of each other (families/coworkers
//                          arriving in one car), with dwell + origin drawn
//                          from a property-type profile below.
//
// Phase 2: the geofence is no longer just a display circle. Every event
// gets a `siteEntryPoint` sampled from inside the ACTUAL drawn shape
// (circle or hand-drawn polygon) via lib/geo/polygon.ts, and the overall
// traffic volume scales with the geofence's real area — draw a bigger lot,
// get proportionally more ambient device pickup, the same way a larger
// footprint would in a real panel feed. See computeAreaScale() below.
//
// Swap to a real provider by implementing the same DataAdapter interface
// in a new file under lib/adapters/ and switching DATA_PROVIDER — nothing
// here is imported anywhere except via that interface.
// -----------------------------------------------------------------------

type PropertyProfile = {
  dwellMeanMin: number;
  dwellStdDevMin: number;
  partySizeWeights: [size: number, weight: number][];
  visitorsPerWeekdayRange: [number, number];
  visitorsPerWeekendRange: [number, number];
  employeeCount: number;
  deliveriesPerDayRange: [number, number];
  repeatVisitorRate: number; // fraction of parties that are repeat customers
  openHour: number;
  closeHour: number;
};

const PROFILES: Record<PropertyType, PropertyProfile> = {
  retail_strip: {
    dwellMeanMin: 28,
    dwellStdDevMin: 12,
    partySizeWeights: [[1, 0.45], [2, 0.35], [3, 0.13], [4, 0.07]],
    visitorsPerWeekdayRange: [14, 26],
    visitorsPerWeekendRange: [20, 38],
    employeeCount: 4,
    deliveriesPerDayRange: [1, 3],
    repeatVisitorRate: 0.3,
    openHour: 9,
    closeHour: 20,
  },
  restaurant: {
    dwellMeanMin: 58,
    dwellStdDevMin: 20,
    partySizeWeights: [[1, 0.1], [2, 0.4], [3, 0.2], [4, 0.22], [5, 0.08]],
    visitorsPerWeekdayRange: [22, 40],
    visitorsPerWeekendRange: [35, 60],
    employeeCount: 9,
    deliveriesPerDayRange: [3, 7],
    repeatVisitorRate: 0.35,
    openHour: 11,
    closeHour: 22,
  },
  office: {
    dwellMeanMin: 42,
    dwellStdDevMin: 20,
    partySizeWeights: [[1, 0.6], [2, 0.3], [3, 0.1]],
    visitorsPerWeekdayRange: [6, 14],
    visitorsPerWeekendRange: [0, 2],
    employeeCount: 22,
    deliveriesPerDayRange: [2, 5],
    repeatVisitorRate: 0.4,
    openHour: 8,
    closeHour: 18,
  },
  industrial_flex: {
    dwellMeanMin: 35,
    dwellStdDevMin: 18,
    partySizeWeights: [[1, 0.7], [2, 0.25], [3, 0.05]],
    visitorsPerWeekdayRange: [3, 9],
    visitorsPerWeekendRange: [0, 2],
    employeeCount: 14,
    deliveriesPerDayRange: [4, 10],
    repeatVisitorRate: 0.25,
    openHour: 7,
    closeHour: 17,
  },
  medical: {
    dwellMeanMin: 45,
    dwellStdDevMin: 18,
    partySizeWeights: [[1, 0.55], [2, 0.35], [3, 0.1]],
    visitorsPerWeekdayRange: [18, 34],
    visitorsPerWeekendRange: [0, 4],
    employeeCount: 12,
    deliveriesPerDayRange: [1, 3],
    repeatVisitorRate: 0.45,
    openHour: 8,
    closeHour: 17,
  },
  grocery_anchor: {
    dwellMeanMin: 24,
    dwellStdDevMin: 10,
    partySizeWeights: [[1, 0.35], [2, 0.4], [3, 0.15], [4, 0.1]],
    visitorsPerWeekdayRange: [40, 70],
    visitorsPerWeekendRange: [65, 110],
    employeeCount: 28,
    deliveriesPerDayRange: [3, 8],
    repeatVisitorRate: 0.55,
    openHour: 7,
    closeHour: 22,
  },
  mixed_use: {
    dwellMeanMin: 38,
    dwellStdDevMin: 22,
    partySizeWeights: [[1, 0.4], [2, 0.35], [3, 0.15], [4, 0.1]],
    visitorsPerWeekdayRange: [20, 36],
    visitorsPerWeekendRange: [26, 48],
    employeeCount: 10,
    deliveriesPerDayRange: [2, 6],
    repeatVisitorRate: 0.35,
    openHour: 8,
    closeHour: 21,
  },
};

/** A handful of weighted "population centroids" so origins cluster into a
 * plausible trade-area shape instead of a uniform blob — e.g. a nearby
 * residential pocket and a couple of arterial-corridor commuter sources. */
function originCentroids(center: LatLng, rand: () => number): { point: LatLng; weight: number }[] {
  const centroids: { point: LatLng; weight: number }[] = [];
  const count = seededInt(rand, 3, 5);
  for (let i = 0; i < count; i++) {
    const bearing = rand() * 2 * Math.PI;
    const distanceKm = seededGaussian(rand, 4.5, 2.5);
    const clamped = Math.max(0.6, Math.min(distanceKm, 14));
    const dLat = (clamped / 110.574) * Math.cos(bearing);
    const dLng = (clamped / (111.32 * Math.cos((center.lat * Math.PI) / 180))) * Math.sin(bearing);
    centroids.push({
      point: { lat: center.lat + dLat, lng: center.lng + dLng },
      weight: 0.4 + rand() * 0.6,
    });
  }
  return centroids;
}

function pickOrigin(
  centroids: { point: LatLng; weight: number }[],
  rand: () => number
): LatLng {
  const totalWeight = centroids.reduce((s, c) => s + c.weight, 0);
  let roll = rand() * totalWeight;
  let chosen = centroids[0]!;
  for (const c of centroids) {
    roll -= c.weight;
    if (roll <= 0) {
      chosen = c;
      break;
    }
  }
  const spreadKm = 1.5;
  const dLat = (seededGaussian(rand, 0, spreadKm) / 110.574);
  const dLng = seededGaussian(rand, 0, spreadKm) / (111.32 * Math.cos((chosen.point.lat * Math.PI) / 180));
  // Coarsen to ~500m grid cells — this is the "never exact home" guarantee.
  const coarsenDeg = 0.0045;
  const rawLat = chosen.point.lat + dLat;
  const rawLng = chosen.point.lng + dLng;
  return {
    lat: Math.round(rawLat / coarsenDeg) * coarsenDeg,
    lng: Math.round(rawLng / coarsenDeg) * coarsenDeg,
  };
}

function bearingBetween(from: LatLng, to: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(to.lng - from.lng)) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(toRad(to.lng - from.lng));
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function weightedPartySize(rand: () => number, weights: [number, number][]): number {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let roll = rand() * total;
  for (const [size, w] of weights) {
    roll -= w;
    if (roll <= 0) return size;
  }
  return weights[0]![0];
}

function isoAt(date: string, hour: number, minute: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setHours(Math.floor(hour), minute, 0, 0);
  return d.toISOString();
}

function* dateRangeDays(start: string, end: string): Generator<{ date: string; weekday: number }> {
  const cur = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cur <= last) {
    yield { date: cur.toISOString().slice(0, 10), weekday: cur.getDay() };
    cur.setDate(cur.getDate() + 1);
  }
}

// A drawn geofence's traffic volume scales with its real area relative to
// the Phase-1 default (a 400m-radius circle, ~50.3 hectares / ~124 acres).
// Clamped so a tiny sliver or a sprawling multi-block polygon still
// produces a sane, demoable device count rather than near-zero or absurd.
const BASELINE_GEOFENCE_AREA_SQM = Math.PI * 400 * 400;

function computeAreaScale(geofence: AnalysisRequest["geofence"]): number {
  const raw = Math.sqrt(geofenceAreaSqMeters(geofence) / BASELINE_GEOFENCE_AREA_SQM);
  return Math.min(2.2, Math.max(0.4, raw));
}

function scaleCount(n: number, scale: number, min = 1): number {
  return Math.max(min, Math.round(n * scale));
}

function scaleRange([lo, hi]: [number, number], scale: number, min = 0): [number, number] {
  const scaledLo = Math.max(min, Math.round(lo * scale));
  const scaledHi = Math.max(scaledLo, Math.round(hi * scale));
  return [scaledLo, scaledHi];
}

export class SyntheticAdapter implements DataAdapter {
  readonly name = "synthetic";

  async fetchVisits(request: AnalysisRequest): Promise<VisitEvent[]> {
    const seedKey = `${request.address}|${request.dateRange.start}|${request.dateRange.end}|${request.propertyType}`;
    const rand = mulberry32(hashStringToSeed(seedKey));
    const profile = PROFILES[request.propertyType];
    // Phase 2: reference point is the geofence's own center — for a radius
    // geofence that's identical to the property pin, but a hand-drawn
    // polygon (e.g. an irregular corner lot) may be offset from it.
    const center = geofenceCenter(request.geofence);
    const centroids = originCentroids(center, rand);

    const areaScale = computeAreaScale(request.geofence);
    const employeeCount = scaleCount(profile.employeeCount, areaScale);
    const visitorsPerWeekdayRange = scaleRange(profile.visitorsPerWeekdayRange, areaScale);
    const visitorsPerWeekendRange = scaleRange(profile.visitorsPerWeekendRange, areaScale);
    const deliveriesPerDayRange = scaleRange(profile.deliveriesPerDayRange, areaScale);

    const events: VisitEvent[] = [];

    // Stable employee device roster, reused across every weekday so the
    // clustering layer can actually observe "repeats weekly" behavior.
    const employeeIds = Array.from(
      { length: employeeCount },
      (_, i) => `emp_${hashStringToSeed(seedKey + "emp" + i).toString(36)}`
    );
    // A handful of "regular" visitor party seeds that recur across days,
    // to model repeat customers rather than every party being a stranger.
    const regularCount = Math.max(2, Math.round(employeeCount * 0.2));
    const regularOrigins = Array.from({ length: regularCount }, () => pickOrigin(centroids, rand));
    // Regular parties keep the SAME device IDs across every day they show
    // up — this is what lets the clustering layer's "repeated co-occurrence
    // across days" signal actually find something. One-off visitors get a
    // fresh device ID every time, same as a stranger would in real panel data.
    const regularPartyDeviceIds: string[][] = regularOrigins.map((_, idx) =>
      Array.from({ length: 5 }, (_, m) => `reg_${hashStringToSeed(seedKey + "regular" + idx + "m" + m).toString(36)}`)
    );

    for (const { date, weekday } of dateRangeDays(request.dateRange.start, request.dateRange.end)) {
      const isWeekend = weekday === 0 || weekday === 6;

      // --- Employees (weekday only) ---------------------------------
      if (!isWeekend) {
        for (const empId of employeeIds) {
          const arriveHour = profile.openHour - 1 + rand() * 2; // ~1h before open, +/- jitter
          const dwell = 360 + rand() * 240; // 6-10h
          const origin = pickOrigin(centroids, rand);
          const arrival = isoAt(date, Math.max(5, arriveHour), seededInt(rand, 0, 59));
          const departure = new Date(new Date(arrival).getTime() + dwell * 60_000).toISOString();
          events.push({
            deviceId: empId,
            arrival,
            departure,
            dwellMinutes: dwell,
            originCoarse: origin,
            approachBearingDeg: bearingBetween(origin, center),
            date,
            siteEntryPoint: sampleRandomPointInGeofence(request.geofence, rand),
          });
        }
      }

      // --- Delivery / service (short dwell, scattered) ---------------
      const deliveryCount = seededInt(rand, ...deliveriesPerDayRange);
      for (let i = 0; i < deliveryCount; i++) {
        const hour = profile.openHour + rand() * (profile.closeHour - profile.openHour);
        const dwell = Math.max(2, 4 + rand() * 8); // 4-12 min
        const origin = pickOrigin(centroids, rand);
        const arrival = isoAt(date, hour, seededInt(rand, 0, 59));
        const departure = new Date(new Date(arrival).getTime() + dwell * 60_000).toISOString();
        events.push({
          deviceId: `del_${hashStringToSeed(seedKey + date + "del" + i).toString(36)}`,
          arrival,
          departure,
          dwellMinutes: dwell,
          originCoarse: origin,
          approachBearingDeg: bearingBetween(origin, center),
          date,
          siteEntryPoint: sampleRandomPointInGeofence(request.geofence, rand),
        });
      }

      // --- Visitor parties --------------------------------------------
      const [lo, hi] = isWeekend ? visitorsPerWeekendRange : visitorsPerWeekdayRange;
      const targetVisitors = seededInt(rand, lo, hi);
      let placed = 0;
      let partyIndex = 0;
      while (placed < targetVisitors) {
        const partySize = Math.min(weightedPartySize(rand, profile.partySizeWeights), targetVisitors - placed);
        const isRepeat = rand() < profile.repeatVisitorRate && regularOrigins.length > 0;
        const regularIdx = isRepeat ? seededInt(rand, 0, regularOrigins.length - 1) : -1;
        const origin = isRepeat ? regularOrigins[regularIdx]! : pickOrigin(centroids, rand);

        const hour = profile.openHour + rand() * (profile.closeHour - profile.openHour);
        const baseArrival = isoAt(date, hour, seededInt(rand, 0, 59));
        const dwell = Math.max(6, seededGaussian(rand, profile.dwellMeanMin, profile.dwellStdDevMin));
        const bearing = bearingBetween(origin, center);

        for (let m = 0; m < partySize; m++) {
          // Co-arrivals land within a tight 0-4 min window of each other —
          // this is the signal the clustering step re-derives independently.
          const arrivalJitterMs = seededInt(rand, 0, 4) * 60_000;
          const arrival = new Date(new Date(baseArrival).getTime() + arrivalJitterMs).toISOString();
          const memberDwell = Math.max(5, dwell + seededGaussian(rand, 0, 4));
          const departure = new Date(new Date(arrival).getTime() + memberDwell * 60_000).toISOString();
          const jitteredOrigin = {
            lat: origin.lat + seededGaussian(rand, 0, 0.0008),
            lng: origin.lng + seededGaussian(rand, 0, 0.0008),
          };
          const deviceId =
            isRepeat && m < regularPartyDeviceIds[regularIdx]!.length
              ? regularPartyDeviceIds[regularIdx]![m]!
              : `vis_${hashStringToSeed(seedKey + date + "party" + partyIndex + "m" + m).toString(36)}`;
          events.push({
            deviceId,
            arrival,
            departure,
            dwellMinutes: memberDwell,
            originCoarse: jitteredOrigin,
            approachBearingDeg: bearing + seededGaussian(rand, 0, 8),
            date,
            siteEntryPoint: sampleRandomPointInGeofence(request.geofence, rand),
          });
        }

        placed += partySize;
        partyIndex += 1;
      }
    }

    return events;
  }
}

export const dataAdapter: DataAdapter = new SyntheticAdapter();
