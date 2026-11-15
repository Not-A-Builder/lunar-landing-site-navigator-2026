# Architecture

```
 OFFLINE (pipeline/, run once; outputs committed)
 Draft 3 sheet ─────────► build_metrics_catalog.py ─► src/data/metrics-catalog.json
 sites research (quoted) ► build_sites.py ──────────► src/data/sites.json
 JPL Horizons ──────────► fetch-ephemeris.ts ───────► public/data/ephemeris/<year>.bin   (hourly, Moon-wide)
 PDS/LROC/USGS/Diviner ─► download-raw.sh ──────────► data/raw/ (git-ignored)
 data/raw + ephemeris ──► build-terrain.ts ─────────► public/data/terrain/<site>.json, peers.json,
                                                       src/data/validation.json, src/data/source-usage.json
 data/raw ──────────────► build-deploy-bundle.ts ───► data/deploy/ (127 MB, committed: brotli DEMs, PSRs,
                                                       gazetteer, Diviner)

 SERVER (Next.js route handlers)
 /api/ephemeris/[year]  live Horizons table for years outside 2024–2032
 /api/terrain?lat&lon   terrain file for custom coordinates (same code as the pipeline; reads data/raw
                        when present, else data/deploy; TERRAIN_SOURCE=deploy forces the bundle)
 /api/horizons          raw topocentric proxy (debug / planners)

 BROWSER (all metric maths runs client-side, instantly, for any date and assumption)
 ephemeris tables + terrain file ─► engine/scenario (10-min series, windows)
                                 ─► engine/analysis (multi-year, landing-date percentiles, area grid, sensitivity, power, link)
                                 ─► metrics/compute (196 MetricValues: status, sources, RAG rating)
                                 ─► pages: / (select), /site/[id] (details), /compare, /history, /sources
```

Maps: OpenLayers + proj4 for the polar stereographic and flat whole-Moon maps; three.js for the 3D globe
(`src/components/map/MoonGlobe.tsx`, WAC tiles).

## Core computation

1. **Sun and Earth positions.** The tables hold, for each hour, the sub-solar point, the sub-Earth point
   (= libration) and both distances. `topocentric()` turns them into azimuth/elevation at any site,
   reproducing Horizons' own topocentric output to within 0.0002°.
2. **Terrain horizon.** We trace 360 rays over LOLA data out to 200 km, including the Moon's curvature
   and with no refraction. Masks exist for six observer heights, four 1 km offsets and a 7×7 grid around
   each site.
3. **Visibility.** The visible fraction of the Sun's disk is a circular segment above the local horizon,
   reduced by any Earth eclipse. Earth's disk fraction works the same way. DSN visibility comes from the
   Moon's elevation at Goldstone, Canberra and Madrid.
4. **Windows.** Crossing times are interpolated between samples, then complemented and intersected to
   give sunlit, dark, Earth-in-view, joint and DSN windows.
5. **Metrics and ratings.** See `src/lib/metrics/compute.ts` and `types.ts` (bands, roll-up). Scores
   (1–10) appear only on Compare.

## State

- **Persona and assumptions:** zustand stores persisted to localStorage, rehydrated after mount.
- **Site, date and comparison:** kept in the URL (`/site/<id>?t=ISO`, `/compare?s=id@ISO,…`), so every
  view is shareable.
- **History:** every site details page and comparison opened, per browser in localStorage
  (`src/lib/history.ts`, recorded by `HistoryRecorder` in the root layout). No accounts, so nothing
  leaves the browser.

## Next.js notes

Next 16.4 with `cacheComponents` on. Client components that use `useSearchParams` sit under `<Suspense>`.
Read `node_modules/next/dist/docs/` before using unfamiliar APIs (see AGENTS.md).
