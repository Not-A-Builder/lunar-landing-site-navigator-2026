# MEMORY.md

Living project state: what's true now, what's open, what's next. Rewrite freely (unlike `LOGS.md`,
which is append-only history). Last updated: **2026-11-15**.

## Status

**Phase: computed product + owner round 2 (2026-11-14).** Educator copy is in for all 196 metrics, bands are editable, custom coordinates work everywhere, the NASA terrain bundle is shippable, and SOURCES.md is generated. The dev server runs on http://localhost:1313 (`npm run dev:1313`).
- Site selection (D-043, D-044): left column = Date & time (iOS-style UTC pickers) + Site selection (filterable, searchable site list OR a coordinate field) + "Explore Site Details" (D-055). Polar map with lat/lon rulers, pole crosshair, km/mi scale; whole Moon as a flat chart or a 3D globe (three.js, WAC tiles) with a compass that resets the view. Theme follows the OS until the user picks one. Map pins/regions are bright green `#24e866` (D-051) with themed name tooltips.
- Enthusiast metrics (D-109, D-110): curated main metrics only; takeaways listed first with rating accents; subtext only where it adds something; the contents sidebar uses the same names as the body for every persona.
- Site details (D-082–D-090): header-width page; name + "Select different site" (back to `/?t=` with the landing time kept, D-100) / coordinates / metadata rows; Set mission assumptions + Customise rating bands (modals with draft, Save / Discard / Reset) and Add to comparison; date & time pickers with ±1d/±7d and a 30-day mission timeline (scrubber with play/pause, D-093; pinned under the header until Array power scrolls past, D-099; every chart including the horizon view moves it on click, D-094); then a 3 / 9 split: sticky Wikipedia-style contents + views (4 cards, horizon view with azimuth reading right-to-left, Sun / Earth from the site, libration; the Earth chart has one DSN lane per complex, a Contact lane with red handover gaps and a computed DSN summary, D-095) and metrics (battery + array power at the top of Overall). "Computed"/"Modelled" hover shows calculation steps (`MetricValue.calc`); "Your input" and rating bands open the editors at that field.
- Compare: up to 3 scenarios, strips, key numbers, "why it differs", 1–10 scores.
- Data & methods: provenance, references, assumptions and validation.
- Design (D-040): light default + dark toggle, warm tokens, IBM Plex Sans/Mono, Phosphor icons, radii ≤ 2px, text ≥ 14px, hairline sections instead of boxes.
- Unavailable metrics are hidden everywhere (D-041); 38 of 196 on the Haworth reference run.

## Data in the repo (all regenerable)

| What | Where | Built by |
|---|---|---|
| Metrics catalog (196 × 13) | `src/data/metrics-catalog.json` | `npm run catalog` |
| Curated sites (65 listed, 6 excluded for no cited coordinate) | `src/data/sites.json` | `npm run pipeline:sites` from `data/source/sites-research.json` |
| Reference values (123 cited) | `src/data/references.json` | snapshot of `data/source/references-research.json` |
| Ephemeris 2024–2032 hourly | `public/data/ephemeris/*.bin` | `npm run pipeline:ephemeris` |
| Per-site terrain + peers | `public/data/terrain/*.json` | `npm run pipeline:terrain` (needs `data/raw`) |
| LOLA validation, source usage | `src/data/validation.json`, `src/data/source-usage.json` | `pipeline:terrain` |
| Raw NASA rasters (~500 MB) | `data/raw/` (git-ignored) | `npm run pipeline:raw` |

## Verified facts (tested, not assumed)

- **Engine accuracy:** sub-point tables reproduce Horizons topocentric az/el to within 0.0002° (engine.test.ts).
- **Tile grid:** Trek SP layers share origin (−1095930, 1095930) with res0 = 8561.953 m/px. The global WAC layer has res0 = 0.703125°/px.
- **LOLA polar IMG:** 7624², 120 m, int16 × 0.5 m, pole at pixel 3811.5. The x orientation is set in `terrain-context.ts` (POLAR_X_SIGN) and was verified against craters.
- **PSR shapefile:** orientation matches x = ρ·sin(lon), y = ρ·cos(lon) (centroid check).
- **DSN:** Horizons accepts `-14@399`, `-43@399` and `-63@399` (DSN 810-005 301 Rev P Table 5).
- **Artemis:** in Feb 2026 NASA made Artemis III an Earth-orbit test flight; the first crewed landing is now Artemis IV (2028). The nine regions are still the Oct 2024 list.
- **Draft 3 sheet:** 196 rows × 13 columns. The Educator and Planner columns are generic, so persona depth uses the definition and significance columns (D-028).

## Open questions for the owner

0. **Power model load rule (D-088):** the battery model switches to the full operating load whenever *any* sunlight reaches the array (even a sliver of the disk), else survival load. Should "operating" instead require the sunlit threshold (e.g. ≥ 50% of the disk), matching the Sunlit windows? Unchanged until the owner decides.

1. **Slater Plain coordinate:** OK to add the USGS Artemis III region-grid release (doi:10.5066/P13FD9ZD) as a source? ScienceBase blocks scripted downloads, so the owner would download the zip in a browser into `data/source/` (D-038). Until then Slater Plain is not listed.
2. **Unavailable metrics (now hidden, D-041):** which candidate sources to ingest (see the 2026-11-14 answer: USGS geologic map, LEND/LP neutron, LP/Kaguya magnetics, Mini-RF, crater/boulder catalogues). 18 of the 38 need mission inputs rather than data; a few need in-situ measurements and can't be answered from orbit.
3. **Enthusiast metric selection (D-109):** enthusiasts see a curated 27 of 196 metrics, 16 of them as takeaways with short labels, in `src/lib/enthusiast-metrics.ts`. Regolith, space weather and rover drop out for them. The owner should review the picks and labels; categories with no pick vanish for enthusiasts.

Resolved 2026-11-15: the Enthusiast view always uses the default assumptions and bands (D-117).

Resolved 2026-11-14: ship the terrain data (D-032), editable bands with defaults (D-033), the accurate Artemis label (D-036), richer educator copy (D-034), custom coordinates (D-037), and SOURCES.md (D-035). Every site needs a cited coordinate (D-038). Hosting = public GitHub repo under Not-A-Builder (D-039).

## Next steps

1. Owner review on :1313 of the rebuilt site details page (all three personas, both modals, chart hover, calculation cards).
2. Repo is on GitHub (D-039). A web host (e.g. Vercel) is deferred.
3. Optional ingests: USGS Unified Geologic Map, LEND neutron maps, a metre-scale crater catalogue.
4. Write the Space Apps submission (story, demo video, data list from Data & methods).

## Known quirks

- An unknown `/site/<id>` renders the 404 UI but returns HTTP 200 (streaming with Partial Prerender). Harmless.
- `next dev` re-adds an agent-rules block to `AGENTS.md`; keep it committed.
- PDS downloads run at about 200 KB/s, so `pipeline:raw` takes about 15–20 minutes.
