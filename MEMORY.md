# MEMORY.md

Living project state: what's true now, what's open, what's next. Rewrite freely (unlike `LOGS.md`,
which is append-only history). Last updated: **2026-11-15**.

## Status

**Phase: owner polish round on the full product (2026-11-15), then the submission.** Educator copy is in for all 196 metrics, bands are editable, custom coordinates work everywhere, the NASA terrain bundle is shippable, and SOURCES.md is generated. The dev server runs on http://localhost:1313 (`npm run dev`).
- Site selection (D-043, D-044): left column = Date & time (iOS-style UTC pickers) + Site selection (filterable, searchable site list OR a coordinate field) + "Explore Site Details" (D-055). Polar map with lat/lon rulers, pole crosshair, km/mi scale; whole Moon as a flat chart or a 3D globe (three.js, WAC tiles) with a compass that resets the view. Theme follows the OS until the user picks one. Map pins/regions are bright green `#24e866` (D-051) with themed name tooltips.
- Educator metrics (D-118): curated 89 with educator-level names and tooltips; contents list categories only.
- Enthusiast metrics (D-109, D-110): curated main metrics only; takeaways listed first with rating accents; subtext only where it adds something; the contents sidebar uses the same names as the body for every persona.
- Site details (D-082–D-090): header-width page; name + "Select different site" (back to `/?t=` with the landing time kept, D-100) / coordinates / metadata rows; Set mission assumptions + Customise rating bands (modals with draft, Save / Discard / Reset) and Add to comparison; date & time pickers with ±1d/±7d and a 30-day mission timeline (scrubber with play/pause, D-093; pinned under the header until Array power scrolls past, D-099; every chart including the horizon view moves it on click, D-094); then a 3 / 9 split: sticky Wikipedia-style contents + views (4 cards, horizon view with azimuth running clockwise N → E → S → W, left to right (D-142), Sun / Earth from the site, libration; the Earth chart has one DSN lane per complex, a Contact lane with red handover gaps and a computed DSN summary, D-095) and metrics (battery + array power at the top of Overall). "Computed"/"Modelled" hover shows calculation steps (`MetricValue.calc`); "Your input" and rating bands open the editors at that field.
- Compare (D-128, D-130, D-131b, D-145): full viewport width; bounded tables of label column (3/12, subtle `panel` fill) + one column per scenario (2 or 3), charts included. Sticky subheader: kind + Assumptions / Rating bands / Add / Exit, then the step's own `ScenarioCard`s (click = edit in the step via `edit=<i>`; × on every card, removal animates; with 2, × opens the other scenario on its own site details page, D-145). Same per-persona content as site details (shared `MetricLabelCell` / `MetricAnswerCell` / `views-copy.tsx`); `ComparisonMode` puts chart tooltips outside the plot and stacks key/value text. Category scores for enthusiasts only. Best cell: soft green fill in every view, ties included (D-134b, lighter in dark mode D-137b); no corner score or ▲ (D-136b). Ratings read Favourable / Conditional / Unfavourable (D-140); enthusiasts see words, not scores. Shared selected time across columns. Timeline row pinned down to Array power (D-133b). Contents (D-135b, D-138): dash rail in a left gutter (md+), hover opens the full list over a dimmed page; planners can expand categories into metrics.
- Brand (D-143, D-144, D-145b, D-146, D-147): platform name **Lunar VISTA** (Visibility & Illumination Site Trade-off Analyzer); theme-aware wordmark + favicon mark in the header; dark splash on every full page load (5 s counter, CSS-driven; flat dark bg, Moon as a line drawing with craters that dissolve in, D-145b). A shared name footer (`NameFooter`, "Lunar VISTA stands for …", tall cards with a big corner letter) closes the home page and Data & methods.
- Header (D-130, D-131, D-140b, D-143): favicon mark + wordmark (links to site selection), then links "History" and "Data & methods"; no persona selector on Data & methods; the app title goes to site selection, and during a comparison it first asks to exit (dialog).
- History (D-131, D-132): every site details / comparison opening, per browser (localStorage), newest first by local day (opening times in local time with the zone abbreviation, e.g. IST, D-133; landing times UTC); a table with a sticky column header (D-136); same-set revisits within 30 min merge into one row, and only the newest row of a starred set shows the star (D-138b); star any entry to pin it in a deduplicated "Starred" section on top. One stay on a page = one entry (time changes update it).
- Data & methods (D-139b, D-140b): landing-page style at `/sources`: hero with Haworth's real horizon and six key figures, then sticky contents + sections (ground rules, pipeline, ephemeris/libration explorer, horizon explorer, Sun-disk demo, metric statuses, validation scatter, sources, sites, reference values, assumptions, FAQ). All figures read from generated files; motion via CSS scroll-driven reveals.
- Timelines (D-093, D-148): the play/pause button on site details and in the comparison is filled with the primary colour.
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
4. **Educator metric selection (D-118):** educators see a curated 89 of 196 metrics with their own names and tooltips (`src/lib/educator-metrics.ts`); the owner should review which metrics are in, and the wording.

Resolved 2026-11-15: the Enthusiast view always uses the default assumptions and bands (D-117).

Resolved 2026-11-14: ship the terrain data (D-032), editable bands with defaults (D-033), the accurate Artemis label (D-036), richer educator copy (D-034), custom coordinates (D-037), and SOURCES.md (D-035). Every site needs a cited coordinate (D-038). Hosting = public GitHub repo under Not-A-Builder (D-039).

## Next steps

1. Owner review on :1313 of the rebuilt site details page and the new comparison (D-130): all three personas, best-cell markers, removal animation, exit dialog. Also the History page (D-131), the redesigned Data & methods page (D-139b), the splash (D-145b), the name footers (D-146, D-147) and the filled timeline play buttons (D-148).
2. Repo is on GitHub (D-039). A web host (e.g. Vercel) is deferred.
3. Optional ingests: USGS Unified Geologic Map, LEND neutron maps, a metre-scale crater catalogue.
4. Write the Space Apps submission (story, demo video, data list from Data & methods).

## Known quirks

- The app header overflows at phone width (~390 px): the persona and theme controls are pushed off-screen and "Data & methods" wraps. Re-checked 2026-11-15 on `/history`; not fixed yet.

- An unknown `/site/<id>` renders the 404 UI but returns HTTP 200 (streaming with Partial Prerender). Harmless.
- `next dev` re-adds an agent-rules block to `AGENTS.md`; keep it committed.
- LOGS.md IDs D-131 to D-140 and D-145 were each used twice by parallel sessions; the second copies are now `D-1xxb` (D-149). Before adding an entry, take the next number after the highest in LOGS.md.
- PDS downloads run at about 200 KB/s, so `pipeline:raw` takes about 15–20 minutes.
