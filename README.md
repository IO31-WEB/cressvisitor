# CRESSOLUTIONS — Location Intelligence (Phase 1)

Geofenced visit analytics and observed-trade-area module for the CRES
Solutions Site Quality Scorecard. Enter a commercial property address, run
the analysis, and get: visiting-party clustering, employee/delivery
exclusion filters, the metrics the client asked for, and an observed trade
area — all without a paid device-panel subscription.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. No environment variables are required — the
app boots and demos fully with a synthetic data adapter and a zero-key
schematic map fallback.

```bash
npm run typecheck   # tsc --noEmit
npm run build        # production build, same one Vercel runs
```

## What Phase 1 actually does

1. You enter/search an address (geocoded via Mapbox if `NEXT_PUBLIC_MAPBOX_TOKEN`
   is set, otherwise via the free OpenStreetMap Nominatim API — no key
   required either way).
2. You set a geofence radius, property type, and date range.
3. The **SyntheticAdapter** (`lib/adapters/syntheticAdapter.ts`) generates
   deterministic, realistic device-visit events for that geofence and date
   range — employees, delivery/service traffic, and visitor parties (with
   family/coworker-style group arrivals), profiled per property type.
4. The **clustering engine** (`lib/clustering/cluster.ts`) groups raw
   device events into probable visiting parties using a weighted multi-signal
   similarity score (arrival time, departure time, dwell duration, coarse
   origin, approach bearing), then merges same-party occurrences across
   days by shared device ID to detect repeat visitors.
5. **Filters** (`lib/clustering/filters.ts`) classify each cluster as
   `visitor`, `employee`, or `delivery_service` using heuristics described
   in the code comments, and only `visitor` clusters count toward the
   headline metrics and trade area.
6. The **trade area** (`lib/geo/hull.ts`) is a convex hull + Gaussian
   kernel-density grid over filtered visitor origins — not an arbitrary
   1/3/5-mile ring.

## Why synthetic data, and how it's kept honest

Real device-panel data (SafeGraph Patterns, Veraset, Unacast, Placer.ai)
costs $5k–$40k+/year — not viable for a one-time-fee client engagement
where you're covering the API bill. Phase 1 ships a **DataAdapter
interface** (`lib/types.ts`) so the entire rest of the app — clustering,
filtering, metrics, map, PDF export — is provider-agnostic:

```ts
export interface DataAdapter {
  readonly name: string;
  fetchVisits(request: AnalysisRequest): Promise<VisitEvent[]>;
}
```

The synthetic generator is **seeded and deterministic** (`lib/utils/seed.ts`,
mulberry32 PRNG — never `Math.random`), so the same address + date range +
property type always produces byte-identical output. That matters for
client demos, screenshots, and re-exported PDFs that need to match.

**Be upfront with the client that this is synthetic, not observed, data.**
The UI says so directly ("Synthetic data mode" badge in the header) — don't
present Phase 1 numbers as real foot traffic without that caveat.

## Swapping in a real data provider later

1. Create `lib/adapters/unacastAdapter.ts` (or safegraph/foursquare) that
   implements `DataAdapter`:
   ```ts
   export class UnacastAdapter implements DataAdapter {
     readonly name = "unacast";
     async fetchVisits(request: AnalysisRequest): Promise<VisitEvent[]> {
       // call the real API, map its response into VisitEvent[]
     }
   }
   ```
2. In `lib/adapters/syntheticAdapter.ts`, the exported `dataAdapter` singleton
   is the only thing `lib/analysis/runAnalysis.ts` imports — point that
   import at your new adapter (or add a small factory keyed off the
   `DATA_PROVIDER` env var if you want to switch adapters without a
   redeploy).
3. Add the provider's API key to `.env.example` and Vercel's environment
   variables — everything else (clustering, filters, metrics, map, PDF)
   needs zero changes, because they only ever see `VisitEvent[]`.

No other file in the app knows or cares whether visit data is synthetic or
real.

## Maps: Mapbox with a genuine zero-key fallback

- `components/MapPanel.tsx` picks the map implementation at render time
  based on whether `NEXT_PUBLIC_MAPBOX_TOKEN` is set.
- With a token: `components/MapboxMap.tsx` — full interactive Mapbox GL map
  with a geofence overlay, party-origin markers, and a heatmap trade-area
  layer, loaded client-only via `next/dynamic`.
- Without a token: `components/SchematicMap.tsx` — a dependency-free SVG
  projection of the same three layers (geofence ring, visitor-origin dots,
  trade-area hull). This is not a "connect your API key" placeholder; it's
  a fully readable map that works offline and needs nothing from you.

Get a free Mapbox token (50k map loads/month free) at
https://account.mapbox.com/ and set `NEXT_PUBLIC_MAPBOX_TOKEN` in
`.env.local` or Vercel's project settings to upgrade to the interactive map.

## Clustering algorithm (the non-obvious part)

Documented in full in `lib/clustering/cluster.ts`, summarized here:

- **Pass 1 (same day):** every pair of devices observed on the same day is
  scored 0–1 on five weighted signals — arrival proximity (0.30), departure
  proximity (0.15), dwell-duration similarity (0.15), coarse-origin distance
  (0.25), approach-bearing similarity (0.15) — and unioned into one
  "occurrence" if the combined score clears `0.62`.
- **Pass 2 (across days):** occurrences that share at least one device ID
  are merged into a single `VisitCluster`, which is how the app detects a
  party that came back on a later day.
- **Classification** (`lib/clustering/filters.ts`): employee = weekday-only,
  6–11h dwell, arrives 6–10am, seen on 2+ days, 1–2 devices. Delivery/service
  = under 12 minutes on site, 1–2 devices. Everything else is a visitor.
- **Confidence** blends dwell-time consistency within the cluster with a
  small boost for being corroborated across multiple days.

Tune the weights/thresholds at the top of `cluster.ts` and the classification
bounds in `filters.ts` as real-world validation comes in.

## Project structure

```
app/
  layout.tsx, globals.css, page.tsx      # shell + print stylesheet
components/
  AppShell.tsx                            # wires the store to the UI
  AddressSearch.tsx                       # address/type/radius/date form
  ResultsPanel.tsx, Tabs.tsx              # map/metrics/parties tabs
  MapPanel.tsx, MapboxMap.tsx,
  SchematicMap.tsx                        # map + zero-key fallback
  MetricsDashboard.tsx, MetricCard.tsx    # all 9 required metrics + tooltips
  PartyList.tsx                           # filterable cluster list
  PdfExportButton.tsx, StateViews.tsx     # print export, loading/empty/error
  Header.tsx
lib/
  types.ts                                # DataAdapter interface + shared types
  adapters/syntheticAdapter.ts            # the low-cost data strategy
  clustering/cluster.ts, filters.ts       # party clustering + classification
  analysis/runAnalysis.ts                 # pipeline: adapter -> cluster -> metrics
  geo/geocode.ts, hull.ts                 # geocoding, convex hull, KDE
  utils/seed.ts, format.ts
store/
  useAnalysisStore.ts                     # zustand store for request/result state
```

## Deployment (Vercel)

1. Push to GitHub, import the repo in Vercel.
2. No environment variables are required for a working demo deploy.
3. Optionally set `NEXT_PUBLIC_MAPBOX_TOKEN` in Vercel → Project → Settings
   → Environment Variables for the interactive map.
4. Build command `npm run build`, output is the standard Next.js App
   Router build — no special Vercel config needed.

## Phase 2 — Polygon geofences, better trade-area visuals, and a cleaner report

### Drawing a precise geofence

The address form is now two stages: **find the property**, then **configure
the geofence**. In the configure step, toggle between:

- **Radius (quick)** — the original slider, unchanged.
- **Draw polygon (precise)** — click/tap the map to drop boundary points
  around the actual property line. Live area (acres) updates as you go.
  Use **Undo point** to remove the last vertex or **Clear polygon** to start
  over; switching back to **Radius** is an implicit full reset.

Drawing works on both map backends — the interactive Mapbox map (click to
add a vertex) and the zero-key SVG schematic (tap/click the same way), so
polygon drawing never depends on having a Mapbox token. On mobile, taps
register as clicks in all major browsers; if precise drawing is fiddly on a
small screen, radius mode remains the one-tap fallback.

### How the polygon actually flows through the pipeline

This isn't a display-only shape. Every stage uses the same geometry:

1. **`lib/geo/polygon.ts`** is the single source of truth: point-in-polygon
   (ray casting), point-in-circle, area (shoelace formula), centroid, and a
   seeded rejection-sampler for picking random points inside either shape.
2. **`SyntheticAdapter`** samples a `siteEntryPoint` for every visit event
   from inside the real geofence (`sampleRandomPointInGeofence`), and scales
   overall traffic volume by the geofence's actual area relative to the
   Phase-1 default (a 400m-radius circle) — draw a bigger lot, get
   proportionally more synthetic device pickup.
3. **`runAnalysis.ts`** filters every event through `isInsideGeofence()`
   before clustering — the same point-in-polygon test, applied as a real
   pipeline constraint rather than trusted from generation.
4. **Both map renderers** (`MapboxMap.tsx`, `SchematicMap.tsx`) draw the
   actual shape via `geofenceToGeoJsonPolygon` / `geofenceRingPoints` — a
   drawn polygon renders as the polygon you drew, not an approximated circle.

### Trade-area visualization

- The convex hull now renders as a clearly distinct solid blue outline
  (thicker, higher-opacity) separate from the dashed navy geofence boundary.
- Two lightweight **distance rings** (50% / 100% of the hull's farthest
  reach from the geofence center) give a rough sense of trade-area extent.
  These are straight-line rings, **not** drive-time isochrones — labeled as
  such in the legend and the schematic map's caption so they're never
  mistaken for routing data.
- A new `TradeAreaLegend` sits under the map on both the interactive Map tab
  and the printed report, explaining every layer.

### Report / PDF export

The print stylesheet (existing `@media print` approach, no PDF library) now
produces, in order: a print-only cover block (report title, generated
timestamp, and the synthetic-data honesty note — since the app's navy header
badge is hidden on paper), the full property/parameter summary, the map with
geofence + hull + legend, the complete metrics dashboard, and the full
unfiltered parties list regardless of which filter chip was selected on
screen. All interactive chrome (the form, tab buttons, filter chips, PDF
button itself) is hidden via the existing `.no-print` / `print:` rules.

### New/changed files

```
lib/geo/polygon.ts              # NEW — point-in-polygon, area, GeoJSON helpers, seeded sampling
lib/geo/projection.ts           # NEW — invertible local projector for the drawing surface
lib/types.ts                    # + VisitEvent.siteEntryPoint, GeofenceMode alias
lib/adapters/syntheticAdapter.ts# geofence-shape-aware generation + area-based volume scaling
lib/analysis/runAnalysis.ts     # point-in-polygon containment filter before clustering
store/useAnalysisStore.ts       # submit() now takes a full Geofence, not just a radius
components/AddressSearch.tsx    # two-stage locate -> configure flow
components/GeofenceEditor.tsx   # NEW — mode toggle, radius slider / polygon controls
components/GeofenceMapMapbox.tsx    # NEW — Mapbox click-to-draw surface
components/GeofenceMapSchematic.tsx # NEW — zero-key SVG click-to-draw surface
components/MapboxMap.tsx        # polygon geofence rendering, hull outline, distance rings
components/SchematicMap.tsx     # same, for the zero-key fallback
components/ResultsPanel.tsx     # geofence-aware header text, print cover block, legend
components/TradeAreaLegend.tsx  # NEW — print-friendly map legend
app/globals.css                 # + @page margin
```

`Tabs.tsx` and `PartyList.tsx`'s existing print handling (force all tab
panels visible on paper, always render the full unfiltered party list in a
separate `print:block` section) already met the Phase 2 report requirements
and needed no changes.


- ~~Geofence is radius-only in the UI~~ — resolved in Phase 2 (polygon
  drawing, both map backends). Editing an existing polygon is still
  add/undo/clear-based rather than drag-to-reshape individual vertices —
  a natural Phase 3 addition if precision editing turns out to matter.
- PDF export uses the browser print stylesheet (`app/globals.css` `@media
  print` block + `PdfExportButton.tsx`) rather than a server-rendered PDF
  library — fast to ship, looks clean, but the client controls print
  margins/headers via their browser's print dialog.
- Synthetic visitor-count ranges per property type (`PROFILES` in
  `syntheticAdapter.ts`) are reasonable placeholders, not calibrated
  against real foot-traffic benchmarks — recalibrate once you have even a
  small sample of real observed data to compare against.
