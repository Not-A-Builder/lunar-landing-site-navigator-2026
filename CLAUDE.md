# CLAUDE.md

Instructions for Claude working in this repo. Read `MEMORY.md` at the start of each session for
current state and open questions.

@AGENTS.md

## Project

**Lunar Landing Site Navigator**: NASA Space Apps Challenge 2026 entry ([brief](docs/challenge-brief.md)).
Built by a single-person team (the project owner). A website that turns complex ephemeris and topographic data into clear, comparable
visualisations, so users can quickly compare lunar south-pole landing **sites** and **dates**:
Sun vs horizon (power) and Earth vs horizon (direct-to-Earth comms).

Three core functions:
1. **Site selection** (`/`): south-pole map with candidate pins; filter by name, custom coordinates,
   curated lists (Artemis III, CLPS past/future, other commercial, Apollo, other nations), and landing date/time.
2. **Site details** (`/site/[siteId]`): for one site + time: horizon view, Sun and Earth position vs
   horizon, time to sunset/Earthset, multi-day timelines, libration, and 13 metric categories.
3. **Comparison** (`/compare`): up to `MAX_COMPARE` site+date scenarios side by side, 1–10 rating per
   category, and an explanation of *why* small date or location changes matter.

A **global 3-way persona toggle** (Enthusiast / Educator / Mission planner) is on every page. Structure
and functions stay the same; only representation and technical depth change. Per-metric copy for
each persona comes from the metrics sheet (`views.enthusiast|educator|planner`).

## Non-negotiable rules

1. **Authentic data only.** Every number shown traces to a NASA/partner source in `docs/data-sources.md`.
   Never invent, estimate from memory, or "placeholder" a real-looking value. Show "—" or "pending".
   Site coordinates stay `null` until copied from a cited source and marked `verified`.
2. **Every data point has a tooltip and a source link** (`<InfoTip>`), plus helper text.
3. **Check with the owner before adding a new data source** or changing scope. Record proposals as
   *proposed* in `LOGS.md` until confirmed.
4. **Keep `SOURCES.md` current.** It is generated (`npm run sources:doc`) from `src/lib/sources.ts`, `moon.ts`,
   `download-raw.sh`, references and sites; a test fails if it is stale. Never edit it by hand.
5. **Log every product/design/tech decision in `LOGS.md`** (append-only, next `D-0xx` id) in the same
   change that makes it. Update `MEMORY.md` when state, open questions or next steps change.

## Commands

```bash
npm run dev:1313     # dev server the owner watches: http://localhost:1313 (keep it running)
npm run build        # production build (also type-checks)
npm run lint && npm run typecheck && npm test
npm run catalog            # metrics catalog from data/source/metrics-draft3.csv (--refresh re-pulls the sheet)
npm run pipeline:sites     # src/data/sites.json from data/source/sites-research.json
npm run pipeline:ephemeris # public/data/ephemeris 2024–2032 from JPL Horizons
npm run pipeline:raw       # download NASA rasters into data/raw (git-ignored, ~500 MB, slow)
npm run pipeline:terrain   # public/data/terrain/*.json + validation + source usage + SOURCES.md (needs data/raw)
npm run pipeline:deploy    # data/deploy/ compact NASA layers shipped with /api/terrain
npm run sources:doc        # regenerate SOURCES.md
node scripts/screenshot.mjs <outDir> <url…>   # headless screenshots + console errors (visual QA)
```

## Layout

```
src/app/                 /, /site/[siteId] (+ /site/custom?lat&lon), /compare, /sources, /api/horizons, /api/ephemeris/[year], /api/terrain
src/components/          AppHeader, PersonaToggle, InfoTip, RagBadge, map/MoonMap, charts/*, site-selection/, site-details/, compare/
src/lib/engine/          pure maths: geometry, ephemeris tables, series, windows, terrain (masks), scenario, analysis; server-only: dem-readers, terrain-build, terrain-context
src/lib/metrics/         compute.ts (all 196 metrics → MetricValue with status + sources + rating), types.ts (RAG bands, roll-up), format.ts
src/lib/                 sources.ts (registry), assumptions(.ts|-store.ts), persona.ts, sites.ts, moon.ts (basemaps), data-client.ts, use-analysis.ts
src/data/                generated JSON (catalog, sites, references, validation, source-usage). Do not hand-edit; rebuild via pipeline
public/data/             ephemeris/*.bin, terrain/*.json (pipeline outputs fetched at runtime)
pipeline/                build_metrics_catalog.py, build_sites.py, fetch-ephemeris.ts, build-terrain.ts, download-raw.sh, lib/shapefile.ts
data/source/             snapshots of research inputs (sheet CSV, sites research, references research); data/raw/ = big downloads
```

## Stack

Next.js 16.4 (App Router, `cacheComponents` on) · React 19 · TypeScript · Tailwind 4 (tokens in
`globals.css`) · zustand (persona, assumptions) · OpenLayers + proj4 (polar stereographic + global maps)
· geotiff (pipeline) · vitest · playwright-core (screenshots). Pipeline in TypeScript via `tsx` (shares
`src/lib/engine`), plus small stdlib Python scripts.

## Domain gotchas

- **Horizons elevation ignores terrain.** It is relative to the smooth-sphere horizontal. Visibility =
  body elevation > LOLA terrain horizon mask at that azimuth. No atmosphere means no refraction.
- **Libration is already in Horizons output** for a fixed lunar site. Don't add it again; visualise it.
- **Longitudes:** store east-positive in [-180, 180]; Horizons wants E-lon in [0, 360) (handled in `buildHorizonsUrl`).
- **Horizons has no CORS:** browser code uses the precomputed tables or `/api/ephemeris/[year]`, never JPL directly.
- **Ephemeris tables** hold sub-solar/sub-Earth points; `topocentric()` turns them into site az/el (validated 0.0002°). Don't query Horizons per site.
- **Map coverage:** polar map stacks Trek SPole45/75/875 (to ~55°S); global map = WAC mosaic. QuickMap has no public tiles.
- **Value statuses:** every metric is computed / modelled / reference / assumption / unavailable (`metrics/types.ts`). Never show a number without one, and never fill a value from memory: add a cited reference or mark unavailable with a reason.
- **Personas:** Enthusiast = question + plain answer + category status; Educator = `src/data/educator-copy.json` (value in a sentence, mechanism, how to read it) + per-metric bands; Planner = full detail + assumptions + band editor (`src/lib/bands.ts`).
- **Terrain data:** `data/raw` (local, full) or `data/deploy` (committed bundle, production); `TERRAIN_SOURCE=deploy` forces the bundle.
- **South polar region** = poleward of 80°S (`isPolar`); sites north of it get "Not south pole" callouts.
- **Sun is a disk** (~0.53°): partial visibility matters at grazing elevations.
- **Next 16:** `useSearchParams` needs a `<Suspense>` parent; `params` / `searchParams` are Promises.
  Check `node_modules/next/dist/docs/` before using unfamiliar APIs.

## Conventions

- UI copy: plain language first; technical detail goes behind the planner persona or a tooltip.
- Keep URLs as state (site, `t` ISO UTC, `s` comparison list) so views are shareable.
- All times UTC, ISO 8601 with `Z`.
- Tests sit next to code (`*.test.ts`); fixtures from real API responses in `__fixtures__/`.
