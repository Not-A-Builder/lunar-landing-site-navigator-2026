# LOGS.md: decision log

Append-only record of product, design and technical decisions, so the reasoning can be reviewed later.
Never rewrite history: to change a decision, add a new entry that **supersedes** the old one and
update the old entry's status line only.

**Status values:** `confirmed` (owner agreed / came from owner) · `proposed` (Claude's default, awaiting
owner confirmation) · `open` (needs a decision) · `superseded by D-0xx`.

**Entry template**
```
## D-0xx · YYYY-MM-DD · Title
Status: proposed | confirmed | open | superseded by D-0yy
Context: why this came up
Decision: what we chose
Alternatives: what else was considered, and why not
Consequences: what this commits us to / follow-ups
```

---

## D-001 · 2026-11-14 · Product definition
Status: confirmed (from owner's brief)
Context: NASA Space Apps 2026 "Lunar Landing Site Navigator". The owner is a solo participant.
Decision: Build a website with three core functions (site selection → site details → comparison) for
three audiences (mission planners, educators, general public). Focus is quick comparison of sites and
dates through Sun position vs horizon (power) and Earth position vs horizon (DTE comms), with libration
accounted for.
Consequences: Everything is scoped around these three pages and the persona toggle.

## D-002 · 2026-11-14 · Web stack: Next.js 16 + TypeScript + Tailwind 4
Status: proposed
Context: Solo hackathon; needs a small server piece (Horizons proxy) plus a rich client UI.
Decision: Next.js 16.4 App Router (create-next-app defaults, `cacheComponents` on), React 19, TS strict,
Tailwind 4, vitest, deployed on Vercel.
Alternatives: Vite + React SPA (simpler, but needs a separate proxy for Horizons); SvelteKit (less
ecosystem for OpenLayers/three); plain static site (can't proxy Horizons).
Consequences: Client components using `useSearchParams` need `<Suspense>`; read bundled Next docs for new APIs.

## D-003 · 2026-11-14 · Map: OpenLayers + proj4 on Moon Trek polar-stereographic tiles
Status: proposed
Context: The landing page needs a real south-pole map. Polar regions are badly distorted in
Web-Mercator/equirectangular projections.
Decision: OpenLayers with a custom south polar stereographic projection (R = 1737.4 km) and Moon Trek
WMTS `LRO_LOLA_Shade_SPole875_5mp_v04` as the basemap. Grid verified by fetching real tiles.
Alternatives: Leaflet (custom CRS support is weak); CesiumJS (Earth-centric, heavy); embedding
QuickMap/Trek in an iframe (no control over pins or styling).
Consequences: Need a wider-coverage layer for regions north of 87.5°S (D-013).

## D-004 · 2026-11-14 · Ephemeris: JPL Horizons, via server proxy + offline precompute
Status: proposed
Context: Challenge points to Horizons. Test showed it supports a Moon-surface observer
(`coord@301`, geodetic) and returns apparent az/el. The API sends no CORS headers.
Decision: `/api/horizons` route proxies ad-hoc queries (cached 24 h at the CDN). `pipeline/fetch_ephemeris.py`
precomputes series for curated sites into `public/data/ephemeris/`. Libration is taken directly from the
Horizons output, not modelled separately.
Alternatives: SPICE in-browser or in Python (more setup; kept as a fallback for bulk runs); astronomy
JS libraries (not NASA-authoritative).
Consequences: Horizons elevations are vs. a smooth sphere, so a terrain mask is mandatory (D-005).

## D-005 · 2026-11-14 · Terrain horizon from LOLA DEM ray-marching
Status: proposed (DEM product to be chosen)
Context: The challenge highlights that terrain and the sphere edge define the horizon (no refraction).
Decision: Precompute a 360° horizon-elevation mask per site from a LOLA south-pole DEM, including lunar
curvature, out to roughly 150–200 km. Visibility = body elevation above the mask. Sun treated as a disk.
Alternatives: Use precomputed illumination maps only (can't give per-time az/el or Earth visibility).
Consequences: Needs a DEM download (PGDA, proposed source) and numpy/rasterio in the pipeline.

## D-006 · 2026-11-14 · Metrics catalog from the Draft 3 sheet
Status: confirmed (owner said to use Draft 3)
Context: Owner keeps metric definitions and persona copy in a Google Sheet (Draft 3, gid 380290889).
Decision: Snapshot the CSV in `data/source/`. Generate `src/data/metrics-catalog.json` with stable ids
(`<category>.<slug>`) via `pipeline/build_metrics_catalog.py`. The build fails loudly if the header or
the categories change.
Consequences: Sheet edits need `npm run catalog -- --refresh` (or the script with `--refresh`), then a commit.

## D-007 · 2026-11-14 · Max comparisons = 3
Status: confirmed 2026-11-14 (owner: "yes, keep 3 for now")
Context: Brief says "choose 2 or 3 sites to compare".
Decision: `MAX_COMPARE = 3` in `src/lib/config.ts`.
Consequences: One constant to change if the owner wants 4.

## D-008 · 2026-11-14 · Dark-first visual theme
Status: proposed
Context: Space context; Sun (amber) and Earth (blue) markers need strong contrast.
Decision: Dark tokens in `globals.css`: amber = Sun/power, blue = Earth/comms.
Alternatives: Light default (better for printed/education material; can be added later via tokens).

## D-009 · 2026-11-14 · Category ratings (1–10)
Status: superseded by D-024
Context: Comparison page needs an at-a-glance 1–10 per core category.
Decision: Placeholder cells for now. Scoring model (inputs, thresholds, weights, how to show
uncertainty) still to be designed with the owner.

## D-010 · 2026-11-14 · Data-authenticity and tooltip rules
Status: confirmed (from owner's brief)
Decision: No invented or remembered values in the UI. Curated site coordinates stay `null` with
`verification: "pending"` until copied from a cited source. Every information element has an
`<InfoTip>` with helper text and a source link.
Consequences: The map shows no pins until sites are verified. This is intentional.

## D-011 · 2026-11-14 · Persona toggle implementation
Status: proposed
Context: Global 3-way toggle like Google Docs' view/suggest/edit mode, on every page.
Decision: Segmented control in the sticky header. State in zustand, persisted to localStorage
(`llsn-persona`), rehydrated after mount to avoid SSR mismatch. Ids: `enthusiast | educator | planner`
(sheet column "Public/Enthusiast view" maps to `enthusiast`).
Alternatives: `?view=` URL param (shareable, but clutters every link). Could add later for sharing a
specific view.

## D-012 · 2026-11-14 · 3D library: three.js via @react-three/fiber
Status: proposed
Decision: Installed for future 3D horizon/terrain views; not used yet.
Alternatives: CesiumJS (heavier, Earth-centric), deck.gl (better for 2D data layers).

## D-013 · 2026-11-14 · Map coverage beyond 87.5°S
Status: superseded by D-019
Context: Trek's 5 m/px SP layer spans ±75.84 km. Several Artemis III regions sit around 84–86°S.
Decision: Pending. Find a wider Trek south-pole layer or a coarser LOLA product; possibly stack both.

## D-014 · 2026-11-14 · Non-polar curated sites on a south-pole map
Status: superseded by D-020
Context: The curated list includes Apollo and other equatorial or mid-latitude sites, which a polar
stereographic map can't show.
Decision: Pending owner input (global map toggle, inset globe, or list-only).

## D-015 · 2026-11-14 · URL as state
Status: proposed
Decision: The site details page uses `/site/<id>?t=<ISO>`, custom sites use `/site/custom?lat=&lon=&t=`,
and comparison uses `/compare?s=<id>@<ISO>,...`. This makes any view shareable with a team, which
supports the "science ↔ engineering coordination" goal.

## D-016 · 2026-11-14 · Ephemeris engine: Moon-wide hourly tables, site geometry in the browser
Status: proposed
Context: Every site and date needs Sun/Earth az/el. A Horizons call per site/date is slow and can't run for custom sites instantly.
Decision: For each hour, take the sub-solar point, the sub-Earth point (= optical libration) and both distances from Horizons (Moon from the geocentre, QUANTITIES 14,15,19,20). Compute topocentric az/el for any site from those with exact vector geometry. Validated against Horizons' own topocentric output to within 0.0002° (engine.test.ts). Precomputed for 2024–2032 (2.7 MB, `public/data/ephemeris/`). Other years come from `/api/ephemeris/[year]` live.
Alternatives: Per-site Horizons queries (slow, no custom sites). SPICE in the browser (heavy, same DE441 data).
Consequences: All Sun/Earth numbers trace to JPL Horizons DE441. Libration needs no separate model.

## D-017 · 2026-11-14 · Data sources brought in, and where each is used
Status: confirmed (owner: "go ahead and bring all of them in. log each … where each is being used")
Decision, with where each source appears in the product (each is also in `src/lib/sources.ts` and shown in tooltips):
- **JPL Horizons API (DE441):** every Sun/Earth angle, sunrise/sunset, Earth-rise/set, libration, eclipses, Earth range and light time. Also the Moon's elevation at DSN complexes. Used in timelines, horizon view, stat tiles and most ☀️/🌎/🍀 metrics.
- **NASA Moon Trek WMTS:**
  - South-pole basemap from LOLA hillshade layers SPole45 100 m, SPole75 30 m and SPole875 5 m.
  - Whole-Moon basemap from the LRO WAC global mosaic.
  - Used on the site-selection map.
- **LROC QuickMap:** link-out on site pages. It has no public tile service, so it can't be embedded (dataset research).
- **LRO LOLA gridded DEMs (PDS):**
  - LDEM_75S_120M for horizon masks, slope, aspect, relief, edge drop, site elevation and the area grid.
  - LDEM_16 for far terrain and non-polar sites.
  - Used in 🪨 terrain, 🛬 landing, 🛞 rover and every visibility metric.
- **LOLA average-illumination maps (PDS extras / PGDA, Mazarico et al. 2011 method):** independent validation of our Sun and Earth visibility. Shown on Data & methods and in the evidence-maturity metric.
- **NSSDCA Moon / Sun / Earth fact sheets:** constants (gravity, albedo, solar irradiance, radii). Used in the power, irradiance, temperature and disk-size calculations.
- **DSN 810-005:**
  - Module 301 Rev P Table 5: antenna positions (DSS 14/43/63). Horizons resolves the same antennas.
  - Module 104: 34 m X-band gain and system noise temperature, giving the default G/T.
  - Used in DSN availability, link budget and feasible operating hours.
- **USGS Gazetteer of Planetary Nomenclature:** 9,087 named features, used for landmark proximity, science targets and reference pins (south-pole features).
- **LRO Diviner polar maps (Williams et al. 2019, UCLA):** measured summer maximum and winter minimum temperatures poleward of 80°S. Used in 🪨 temperature and 🔬 cold-trap metrics.
- **LROC/LOLA PSR polygons (NAC_POLE_PSR_SOUTH, 653 polygons):** distance to the nearest permanently shadowed region. Used in 🔬 science, 🛞 rover and ratings.
- **NASA SVS Moon Phase & Libration:** educator libration explainer link.
- **NAIF SPICE:** documented fallback and the frame reference. Horizons already serves the same DE441 ephemeris, so SPICE isn't run.
- **NASA CLPS / Artemis pages:** site status and dates (via the site research).
- **CSA Moon exploration:** partner context link.
- **LROC anthropogenic-objects catalogue (PDS):** lander, impact and Apollo LM positions.
- **Cited literature (123 values):**
  - Sources: Lunar Sourcebook, NASA DSNE SLS-SPEC-159, Hayne 2017, Schwadron 2012, NASA HRP, NASA MEO, the NASA 2011 heritage recommendations, and VIPER NTRS papers.
  - Used in 🪨 regolith, ☄️ space weather and 📌 heritage reference metrics.

## D-018 · 2026-11-14 · Curated sites from fetched sources only (65 verified)
Status: proposed
Decision: `data/source/sites-research.json` → `pipeline/build_sites.py` → `src/data/sites.json`. Every coordinate has a sourceUrl and sourceQuote.
- **Past landers and impacts:** the LROC anthropogenic-objects shapefile (PDS).
- **Named features and future targets:** USGS Gazetteer.
- **Artemis III regions:** the centre of LROC's NAC mosaic for each region. These are approximate; NASA publishes no region centres. Slater Plain has no source, so it isn't mapped.
- **Not mapped:** 6 records have no published site (e.g. Chandrayaan-4, Argonaut).
Context: in Feb 2026 NASA made Artemis III an Earth-orbit test flight; the first crewed landing is now Artemis IV (2028). This is noted on every region and was confirmed by multiple outlets.

## D-019 · 2026-11-14 · Basemaps: stacked Trek polar layers + global WAC
Status: confirmed (owner asked for wider coverage; QuickMap checked)
Decision: The south-pole map stacks Trek SPole45 (to about 55°S), SPole75 (to 75°S) and SPole875 (5 m near the pole) on one shared grid. The whole-Moon map uses the WAC global mosaic. QuickMap has no public tiles, so it's a link-out.

## D-020 · 2026-11-14 · Site selection: results list + map, hover-linked; non-polar handling
Status: confirmed (owner request)
Decision:
- **List and map:** a Google-Maps-style list sits beside the map. Hovering a card highlights the pin, and hovering a pin highlights and scrolls to the card. Clicking either opens site details.
- **Map toggle:** "South pole" or "Whole Moon". The polar map draws sites at or south of 60°S.
- **"Not south pole" flag:** sites outside the south polar region (north of 80°S) get a badge on the card, a banner on the details page, and a callout on the compare page.

## D-021 · 2026-11-14 · Provenance everywhere (tooltips + Data & methods)
Status: confirmed (owner: surface sources at the corresponding locations, as data-authentication proof)
Decision: Every metric value carries source ids. The InfoTip, which opens on hover, focus or tap, lists each source with provider and link, plus a definition, why it matters, notes and the band basis. Site headers show the original location record. The Data & methods page lists every source, the metrics that use it (generated by the pipeline), all 123 cited reference values with quotes, the assumptions, and the LOLA validation table.

## D-022 · 2026-11-14 · Physical constants verified against NSSDCA fact sheets
Status: confirmed
Decision: Moon radius 1737.4 km, g 1.62 m/s², Bond albedo 0.11, irradiance 1361 W/m², Earth radius 6378.137 km and Sun radius 695,700 km all match fetched fact sheets.

## D-023 · 2026-11-14 · Reference (non-site-specific) values: cite or mark unavailable
Status: proposed
Decision: Use only quoted values from fetched documents (`data/source/references-research.json`). Show them with status "Reference" and the note "Global lunar value, not specific to this site". Where no source exists (e.g. an abrasiveness index, asteroid impact risk), show "Not available" with the reason.

## D-024 · 2026-11-14 · Ratings: RAG bands everywhere, 1–10 scores only in Compare
Status: confirmed (owner's proposal, refined)
Decision:
- **Bands per rated metric:** each has red/amber/green bands, and the band strip is shown so it's clear there's no single right answer.
- **By persona:**
  - Enthusiast: one rolled-up status per category, no per-metric bands.
  - Educator and planner: a status and band strip on every rated metric row.
- **Compare scores:** 1–10 per category. A metric's 0–10 position across its bands is averaged over the category's rated metrics, and hovering shows the contributing metrics.
- **Threshold basis:** each band set states its basis. Some are tied to your assumptions (slope vs lander tolerance, darkness vs battery survival) or to NASA criteria (6.5-day continuous sunlight for Artemis III). Others are labelled "Planning bands set by this tool, not a NASA requirement".
- **Status colours:** reserved good/warning/critical with an icon and a word, never colour alone (dataviz rules).
Follow-up: let the planner edit band thresholds.

## D-025 · 2026-11-14 · Terrain pipeline (per site) and custom-site terrain API
Status: proposed
Decision: `pipeline/build-terrain.ts` (shared code in `src/lib/engine/terrain-build.ts`) produces, per site:
- horizon masks for observer heights 0/2/5/10/20/50 m (1°, out to 200 km, with curvature)
- 1 km offset masks (N/E/S/W) for position sensitivity
- a 7×7 grid of masks and slopes (1 km spacing poleward of 75°S; 5 km elsewhere)
- slope, aspect, relief and edge drop
- nearest PSR, nearest named features, Diviner temperatures, and LOLA validation values

`/api/terrain` runs the same code for custom coordinates. It needs the raw files in `data/raw` (from `pipeline/download-raw.sh`).

## D-026 · 2026-11-14 · Honest value statuses; no remembered numbers
Status: confirmed (owner's authenticity rule)
Decision: Every metric is computed, modelled (NASA data plus your assumptions), reference, your input, or not available (with the reason). I removed numbers typed from memory during the build (a 110 K ice-stability threshold, the ±8° and 6.7° libration figures) and replaced them with computed or cited values.

## D-027 · 2026-11-14 · Editable mission assumptions (planner)
Status: proposed
Decision: 26 inputs (mission length, mast height, disk thresholds, array, battery, loads, slope tolerance, link parameters, rover). They persist in localStorage and recompute all dependent metrics. Defaults are examples; where possible they're grounded in cited documents (slope 10° = VIPER delivery requirement; G/T 55.0 dB/K from DSN 810-005 module 104).

## D-028 · 2026-11-14 · What changes per persona (answer to the owner's question 10)
Status: proposed
Decision:
- **Enthusiast:** each metric's plain question, the sheet's enthusiast wording, the value, and one status per category.
- **Educator:** the metric name, the sheet's significance column ("why it matters"), the value, the band strip, a libration explainer and a link to NASA SVS.
- **Planner:** the full numeric detail (timestamps, intervals, role, dependencies, literature), the status badge, assumptions, battery and power charts, and CSV export.

The sheet's Educator and Planner columns are generic instructions ("Show physical mechanism…"), so the definition and significance columns supply the per-metric content.

## D-029 · 2026-11-14 · Compare page
Status: proposed
Decision:
- **Scenarios:** up to 3, each a site (or custom coordinate) plus a landing time. ±day and duplicate shortcuts.
- **Comparison type:** labelled automatically (same site/different dates, etc.).
- **Content:** visibility strips on a shared day axis, a key-numbers table with "best" and deltas against A, auto-generated "why they differ" sentences (horizon height toward the Sun, distance, elevation, libration latitude), and category scores (D-024).
- **Non-polar sites:** called out on their scenario card.

## D-030 · 2026-11-14 · Dev server on port 1313
Status: confirmed (owner request)
Decision: `npm run dev:1313` (next dev -p 1313) runs continuously while building, so the owner can track progress at http://localhost:1313.

## D-031 · 2026-11-14 · Deploying the custom-site terrain API
Status: superseded by D-032
Context: `/api/terrain` reads about 150 MB of LOLA rasters from `data/raw`, which is git-ignored.
Options: ship the DEMs with the deployment (Git LFS or a storage bucket fetched at build time), use the 240 m polar DEM (29 MB) for custom sites in production, or limit custom sites to precomputed ones.

## D-032 · 2026-11-14 · Ship the NASA terrain data with the deployment
Status: confirmed (owner: "Should we ship those: yes")
Decision: `pipeline/build-deploy-bundle.ts` writes `data/deploy/` (committed, 126.7 MB):
- the brotli-compressed LOLA LDEM_75S_120M (84.8 MB) and LDEM_16 (28.7 MB)
- the PSR polygons and IAU-adopted gazetteer features as compact JSON
- the Diviner summer-max and winter-min maps as K×10 int16

`terrain-context.ts` uses `data/raw` when it is present and the bundle otherwise. `next.config.ts` traces the bundle into `/api/terrain` and excludes `data/raw`.

Verification: with `TERRAIN_SOURCE=deploy`, terrain built from the bundle matches the raw build exactly (masks, elevation, PSR distance, features), and Diviner agrees to 0.05 K. A production `next start` served a custom point in 3.3 s.
Alternatives: Git LFS (not installed; Vercel needs extra setup); a coarser 240 m DEM (loses near-field horizon detail).
Consequences: every file is under GitHub's 100 MB limit, but GitHub warns about files over 50 MB. The LOLA validation maps aren't shipped, so custom points in production omit the validation line.

## D-033 · 2026-11-14 · Planner-editable rating bands with logical defaults
Status: confirmed (owner: "yes, but with a default logical threshold defined from the get-go")
Decision: `src/lib/bands.ts` defines 15 band sets, each with a default and its reason. Two are linked to assumptions (slope ↔ lander tolerance, darkness ↔ battery ÷ survival load) until edited. The Mission planner view has a "Rating bands" editor on Site Details and Compare: amber and green inputs with the default shown, validation (green must be on the better side of amber), a preview strip, and reset per row or for all. Overrides persist in localStorage and feed every rating and the 1–10 scores. An edited band's tooltip shows "Edited by you" plus the default and its reason.

## D-034 · 2026-11-14 · Rich educator copy for all 196 metrics
Status: confirmed (owner request)
Decision: `src/data/educator-copy.json` holds three parts per metric:
- **lead:** the result in a sentence, with the computed value substituted
- **explain:** the mechanism or reasoning, with a plain-language analogy
- **readIt:** how to interpret the value

It's written from each metric's own definition, significance and notes. It adds no numbers beyond those and qualitative physics, and was audited for stray numbers. If a value is unavailable at runtime, the row shows the reason instead of a sentence with a blank. A test enforces coverage.
Context: the sheet's Educator column is a generic instruction, so this replaces it. Educator now sits between Enthusiast (question + one-liner + category status) and Mission planner (raw detail + timestamps + assumptions + bands editor).

## D-035 · 2026-11-14 · SOURCES.md, generated and enforced
Status: confirmed (owner request: "a constantly updated document")
Decision: `npm run sources:doc` generates `SOURCES.md` from the product's own registries:
- the source registry (with metric-usage counts)
- the Trek map layers
- the raw downloads (parsed from download-raw.sh)
- every cited document with the values used
- the site location records, grouped by record

`src/lib/sources-doc.test.ts` fails when SOURCES.md is stale. `pipeline:terrain` regenerates it automatically. All registry URLs were checked on 2026-11-14; the CSA link (supplied by the challenge) didn't respond from this machine, and QuickMap answers with a redirect.

## D-036 · 2026-11-14 · Accurate Artemis label
Status: confirmed (owner: "relabel to whatever is the more accurate, precise and true")
Decision: the group is now "Artemis candidate landing regions" (id `artemis-region`). The note on each region says:
- it is one of the nine regions NASA announced in Oct 2024, for Artemis III
- in Feb 2026 Artemis III became an Earth-orbit test and the first crewed landing moved to Artemis IV (planned 2028)
- NASA has not published a revised region list

Recent literature uses the same "Artemis candidate landing regions" wording (Wueller et al. 2026, JGR Planets).

## D-037 · 2026-11-14 · Custom coordinates anywhere on the Moon, any date
Status: confirmed (owner request; the feature existed but was hidden)
Decision:
- **Entry:** one visible input on the selection page, also used on custom site pages and in Compare. It accepts "85.2S 30.1E", "-85.2, 30.1" or east longitude 0–360, with validation messages and a "Reads as …" preview.
- **Map click:** drops a "Custom point" marker and a floating "Analyse this point" card.
- **Custom site page:** lets you edit the coordinates in place and shows the nearest IAU feature.
- **Compare:** a "Custom coordinates…" option in each slot.

Coverage: LOLA 120 m poleward of 75°S, and the LOLA 1.9 km global grid everywhere else. Any date works: 2024–2032 from precomputed tables, other years live from Horizons. Parser unit tests are in `coords.test.ts`.

## D-038 · 2026-11-14 · Every listed site has a cited coordinate
Status: confirmed (owner: "every site should be backed by a coordinate")
Context: 6 of 71 research records had no published coordinate and were shown in lists without a pin: Slater Plain, Peregrine Mission One, Blue Ghost Mission 4, Chandrayaan-4, Luna 26/27 and ESA Argonaut.
Decision: `build_sites.py` lists only records that have a coordinate and a source URL. The others go to `sites.json` → `excluded`, each with a short reason, and are shown only in a "Not listed" note on Data & methods. A record comes back automatically once a cited coordinate is added to `data/source/sites-research.json`. `sites.test.ts` enforces the rule; `Site.lat/lon` are no longer nullable.
Search on 2026-11-14 (no coordinate adopted):
- **Slater Plain:** USGS data release doi:10.5066/P13FD9ZD (LGRS grids for the nine Artemis III regions, CC0) should contain the region; ScienceBase returns HTTP 403 to scripted downloads. Samaddar et al. (LPSC 2025 #2401) place the plain north of Slater crater (88°S, 111°E) without a coordinate for the plain.
- **Chandrayaan-4:** SpaceNews reports a candidate near Shackleton from an ISRO presentation; no ISRO-published coordinate was fetched.
- **Luna 27:** only a candidate area (79–83°S) in a journal paper; no official coordinate.
- **Peregrine** (did not land), **Blue Ghost 4** (region named only), **Argonaut** (no site published): no coordinate exists.
Consequences: Slater Plain is the only Artemis region missing. Proposed fix: the owner downloads the USGS release in a browser into `data/source/`, and the pipeline takes the region centre from it (new data source, needs owner approval).

## D-039 · 2026-11-14 · Hosting: public GitHub repo
Status: confirmed (owner: "github for now. public repo inside not-a-builder")
Decision: code and the committed data bundle (`data/deploy`, 121 MB; largest file 81 MB, under GitHub's 100 MB limit) go to a public repo under the Not-A-Builder account, default branch `main`. `data/raw` stays git-ignored. Vercel (or another web host) is deferred.
Consequences: no live URL yet; the app runs locally from the repo. GitHub warns about files over 50 MB; that is expected.

## D-040 · 2026-11-14 · Light + dark themes, IBM Plex, Phosphor icons, flatter layout
Status: confirmed (owner request; replaces D-008's dark-first theme)
Decision:
- **Themes:** light is the default and a header button switches to dark. Both are subtly warm; dark is a deep warm near-black. Tokens are in `globals.css` under `:root[data-theme]`. The choice is saved in localStorage (`lsn-theme`) and applied by an inline `<head>` script before first paint (`src/lib/theme-script.ts`), so there is no flash. Map pins and labels read the same tokens (`src/lib/theme.ts`).
- **Shape and type:** corner radii are 2px at most (the Tailwind radius tokens are capped; `rounded-full` is kept only for dots). The smallest text is 14px and the scale steps up from it (xs 14, sm 16, base 18, lg 20, xl 24, 3xl 34; body 16; chart ticks 14).
- **Fonts:** IBM Plex Sans for text and IBM Plex Mono (tabular) for numbers. `NumText` sets the numeric runs inside a sentence in mono.
- **Icons:** Phosphor (`@phosphor-icons/react`) in place of emoji and text glyphs: the category icons (`CategoryIcon`), RAG status (check circle / warning diamond / warning octagon, still with a word), info tips and actions.
- **Layout:** sections are separated by hairlines rather than boxed panels, the site list uses rows rather than cards, badges have no chip borders, and notes are a left rule with an icon. All content is kept. Compare's scenario slots stay as cards.
Contrast: text tokens are ≥ 4.5:1 on their backgrounds in both themes; the amber icon colour is used for graphics only.

## D-041 · 2026-11-14 · Metrics that can't be computed are not shown
Status: confirmed (owner: "remove all metrics that are not available to be computed or fetched from live data sets. don't show them.")
Decision: a metric whose value has status `unavailable` for the current site and date is hidden: in the site metric list (along with the "show unavailable" toggle; a category with nothing to show is dropped), in Compare's key numbers (a row is shown if at least one scenario has a value; the others show "—") and in its category scores. Data & methods no longer counts them, and `source-usage.json` / SOURCES.md no longer count them as uses of a source (`pipeline:terrain` skips them; `npm run pipeline:usage` refreshes the usage file alone).
Kept: `computed`, `modelled`, `reference` (cited lunar-wide values) and `assumption` (your inputs). The metrics catalog still lists all 196; ingesting a new source (open question 2) brings a metric back automatically.
Consequences: on the Haworth reference run, 38 of 196 metrics are hidden. Metrics that are still computing show "…" and are not hidden.


## D-042 · 2026-11-14 · Filled buttons use the opposite theme's base colour
Status: confirmed (owner: "use the dark colour of the opposite theme as the primary colour for buttons"; chose "inverted neutrals")
Decision: filled (primary) buttons use new `--primary` / `--primary-ink` tokens instead of the blue accent. Light theme: near-black `#1b1917` with `#ece8e1` text (the dark theme's colours). Dark theme: warm off-white `#ece8e1` with `#1b1917` text. Applies to the active persona tab, the site-selection mode toggle, "Analyse this point", "Add to comparison" and the custom-coordinate "Use" button.
Kept: `--accent` (blue) stays for links, the compare-kind label and selected filter chips.
Consequences: contrast is about 15:1 in both themes.

## D-043 · 2026-11-14 · Site selection redesign: one site field, iOS-style date/time, framed maps, 3D Moon
Status: confirmed (owner request, 2026-11-14)
Decision:
- **Header:** a vertical hairline separates the title from the page links. The current page's link has full-strength text and a small dot under it (`NavLinks`, by pathname); `/` selects "Select sites". The persona control is now a dropdown read as a sentence: "I am [an enthusiast | an educator | a mission planner]" (`PERSONAS[].phrase`), with each option's hint below it.
- **One site field:** "Select a lunar site" replaces the separate search and coordinate forms. A Name / Lat, lon switch sits on the left; the input on the right changes its placeholder (fainter than before) and behaviour: name mode suggests sites as you type, coordinate mode takes any lunar lat/lon (same parser as before). Switching from a named site to Lat, lon keeps its coordinates. Clicking a pin or list row fills the name; clicking empty map fills the coordinates. Picking never navigates by itself.
- **Landing date & time:** two fields modelled on iOS Reminders: a month calendar (tap the month title for month/year wheels) and hour/minute scroll wheels, all UTC. Both are prefilled with the current UTC minute (was the current hour). The selected day uses a filled circle, as in iOS; like the dots, it is an exception to the 2px radius rule.
- **Explore site details:** the primary button stays disabled until the site field holds a valid site or coordinate; it opens `/site/<id>?t=` or `/site/custom?lat&lon&t=` (URL state unchanged, D-015).
- **List:** under a hairline, a heading "Existing lunar sites, missions, & features", collapsible quick-filter chips (a checkbox on the left; a dark stroke when on), "N results · M outside the south-pole map", then rows split by hairlines. Hovered rows get a light full stroke in the primary colour and the selected row a dark one. The free-text list filter is replaced by name suggestions in the site field.
- **South-pole map:** framed by latitude (left/right) and longitude (top/bottom) rulers that follow pan and zoom (`map/rulers.ts`, tested). Dashed 0°–180° and 90°E–90°W meridians cross at the pole, which is labelled 90°S. Zoom-out stops when the whole mosaic square fits the view (OpenLayers `showFullExtent`; resolution is now continuous between tile levels).
- **Whole-Moon map:** the toggle has a Flat / 3D sub-switch. Flat: pins are no longer repeated left and right of the chart (`wrapX: false`), and zoom-out stops just beyond the full chart (4% margin). 3D: a three.js sphere (D-012 is now in use) textured with the same LRO WAC mosaic tiles from Moon Trek, so no new data source. It is stitched in the browser at z2 and then z3 (4096 × 2048 px). Drag to turn and scroll to zoom, between about 140 km altitude and a little beyond where the whole sphere fits. Hovering a list row eases the globe toward that site (exponential easing, about 1 s; the camera stays within ±72° latitude so the controls never flip). Without WebGL the view shows a note instead.
- **Scale bar:** every map view shows a km and mile scale (metres and feet when zoomed in), measured on the lunar sphere (`MOON_RADIUS_M`) at the centre of the view.
Consequences: `CustomCoordForm` is no longer used on the home page; site details and compare still use it.

## D-044 · 2026-11-14 · Site selection round 2: two sections, system theme, globe compass
Status: confirmed (owner request, 2026-11-14; refines D-043)
Decision:
- **Left column = two sections + button.** *Site selection*: "Lunar sites, missions, and features" with a filter icon (checkbox menu of the curated lists, plus Select all / Reset / Clear; a dot on the icon means some lists are off), a search box that filters the list, and the results as cards in a scrolling box. The selected card has a dark double stroke, a shadow and a "Selected" check. Then an "OR" divider, "Enter Lunar Coordinates" and the coordinate field. Exactly one input is active: picking a card or pin clears the coordinates; typing or clicking a point on the map clears the card. *Date & time*: the iOS-style pickers from D-043, which now open upward. Then "Explore Site Details". The combined Name / Lat, lon field from D-043 is gone.
- **Tooltips** (`InfoTip`) render in a portal with fixed positioning, kept inside the viewport and flipped above the icon when needed, so scrolling panels no longer clip them.
- **Theme on first load** follows the device's light/dark setting (and its changes) until the user picks one with the header button; the choice is still saved (`lsn-theme`). Replaces "light is the default" in D-040.
- **Map pins** look the same in both themes: the dark theme's light-blue fill with a near-black ring (hover: off-white; selected: amber; features: grey), via new `--pin*` tokens.
- **Map controls:** the zoom buttons are in the bottom-left corner. The South pole / Whole Moon switch is at the top right, and the Flat / 3D switch is a separate control to its right, shown only for Whole Moon.
- **3D globe:** a compass (a small globe that turns with the big one, with the 0° meridian, the south pole and a north needle) sits above +/− zoom buttons; clicking it eases back to the default view (35°S over the near side). Drag and scroll are gentler (rotate × 0.45, zoom speed 0.3). Site names are a DOM label projected each frame (drei `<Html>` broke under React StrictMode).

## D-045 · 2026-11-14 · Map name tooltips, pink pins, toggles top-left, flat site list
Status: confirmed (owner request, 2026-11-14; refines D-043/D-044)
Decision:
- **Name tooltip on the maps:** the hovered (else selected) site's name, or "Custom point", appears in a small translucent panel in the current theme (80% panel colour, blur, hairline border) with a pointer touching the top of the pin. One component (`map/MapTip.tsx`) serves the polar, flat and 3D views; it replaces the haloed canvas text labels.
- **Pink markers:** pins and Artemis region outlines use a saturated pink (`--pin`, `--pin-region` = `#ff2e93`) in both themes, so they stand out on grey terrain. The 0° meridian on the globe compass uses it too. Hovered pins stay off-white, selected amber, features grey. Replaces the light-blue pin colour in D-044.
- **Map toggles** (South pole / Whole Moon, plus Flat / 3D for Whole Moon) move to the top-left corner of the map.
- **Site list:** rows split by hairlines inside the scrolling box (no per-row cards). The selected row gets a tint, a 2px dark inset stroke and the "Selected" check; a hovered row gets a light tint and stroke. The "N results · M outside the south-pole map" line sits between the search box and the list.

## D-046 · 2026-11-14 · Globe compass: top-right, "N" only in the default orientation
Status: confirmed (owner request, 2026-11-14; refines D-044)
Decision: the 3D globe's compass moves to the top-right corner (zoom buttons stay bottom-left). Its "N" shows only while the globe is turned as in the default view (camera within 2° of 35°S, 0°E; the orbit controls keep north up, so this is when "N is at the top" of the default view). It fades out as soon as the globe is turned away, and returns when the compass is clicked (the reset) or the globe is turned back. The pointer cursor (and the "Reset view" title) appears whenever a click would change the view: when turned away, or zoomed away from the default distance (±2%). The scene reports both states each frame through `GlobeRig.sync`.

## D-047 · 2026-11-14 · Floating list scrollbar; one select-all toggle in the filter menu
Status: confirmed (owner request, 2026-11-14)
Decision:
- **Site list scrollbar:** the native bar is hidden (`.no-scrollbar`) and a floating bar (`ScrollThumb`) is drawn over the list's right edge whenever at least one row overflows; it stays visible (macOS hides native bars until you scroll), sits on a soft drop shadow so it reads as above the list, can be dragged, and a click on the track scrolls a page. It hides when everything fits.
- **Filter menu:** Reset and Clear are gone. One button toggles between "Select all" (when any list is off) and "Deselect all" (when all are on). The default on first load is unchanged (all lists except named features).

## D-048 · 2026-11-14 · Pointer coordinate readout; filter menu beside its button; boxed theme button
Status: confirmed (owner request, 2026-11-14)
Decision:
- **Coordinate readout** on every map type (polar, flat, 3D): while the pointer is over the map (over the sphere on the globe), the bottom-left corner shows its position as Moon Trek does, `Lat: -88.07025°, Lon: 24.73108°` (planetocentric latitude, east longitude in −180…180, five decimals). It sits to the right of the zoom buttons, which are now ours on all three views (`MapControls`); OpenLayers' own zoom control is off.
- **Filter menu** opens to the right of the filter button with top edges aligned. It is portalled with fixed positioning so the scrolling column can't clip it, and kept inside the viewport.
- **Theme button** in the header gets the same bordered 36px square as the filter button.

## D-049 · 2026-11-14 · Clearing a selection: × on the custom point, Esc anywhere
Status: confirmed (owner request, 2026-11-14)
Decision: when the map tooltip belongs to the custom point, it shows a × to the right of "Custom point" that clears the point (and the coordinate field) on all three map views. Pressing Esc clears any selection (a curated site or a custom point) on the site-selection page, unless a menu, picker or dialog is open; then Esc only closes that, and a second Esc clears the selection.

## D-050 · 2026-11-14 · CTA shimmer; dev server always on :1313; Turbopack dev cache off
Status: confirmed (owner requests, 2026-11-14)
Decision:
- **CTA shimmer:** while "Explore Site Details" is enabled, an angled highlight (`.cta-shimmer`, skewed −24°) sweeps left to right once every 2 s (a ~1 s pass, then a pause). It runs behind the label (the button isolates its stacking context; the sheen sits at z-index −1), with a per-theme strength (`--shimmer`: soft white on the dark light-theme button, brighter white on the off-white dark-theme button). Off under `prefers-reduced-motion`.
- **Port:** "always run on port 1313, never 3000". `npm run dev`, `npm run dev:1313` and `npm start` all pass `-p 1313`.
- **Turbopack dev filesystem cache off** (`experimental.turbopackFileSystemCacheForDev: false`): it kept serving stale `globals.css` output from the `@tailwindcss/turbopack` loader, even across restarts. Live CSS edits can still lag one change behind (upstream behaviour); a dev-server restart now always serves the current file.

## D-051 · 2026-11-14 · Green markers; true colours on the globe; sharp CTA shimmer
Status: confirmed (owner requests, 2026-11-14; refines D-045 and D-050)
Decision:
- **Markers:** pins and region outlines use a bright saturated green, `#24e866` (`--pin`, `--pin-region`; first `#2bff72`, then a touch darker on request), in both themes. Hover off-white, selected amber, features grey, as before.
- **Globe colours:** tone mapping is off for the globe's materials (`toneMapped={false}`). React Three Fiber's default filmic tone mapping washed out the marker colours and slightly altered the WAC mosaic; both now show as they are.
- **CTA shimmer:** a solid band (16% of the button width, skewed −24°) with sharp edges instead of a feathered gradient; `--shimmer` is 16% white on the dark button (light theme) and 70% white on the light button (dark theme).

## D-052 · 2026-11-14 · All curated lists on by default
Status: confirmed (owner request, 2026-11-14; replaces the D-047 default)
Decision: the site-selection filter starts with all nine lists on, including "Named south-pole features" (65 results instead of 43). The filter icon's dot therefore doesn't show on first load, and the menu's toggle starts as "Deselect all".

## D-053 · 2026-11-14 · Named features as green diamonds; map legend
Status: confirmed (owner request, 2026-11-14; replaces the grey feature dots)
Decision:
- **Named features** (the 22 IAU-named craters and massifs in "Named south-pole features") are drawn as small diamonds with the same green fill and dark stroke as site pins. Only the shape differs, on all three map views; hover (off-white) and selected (amber) keep the diamond shape. The grey `--pin-feature` token is gone.
- **Legend** (`MapLegend`) above the scale bar, bottom right, on every map view: landing site or mission (green dot), named feature (green diamond), candidate region (green outline), selected (amber), custom point (ring). Swatches use the marker tokens, so they always match the map.

## D-054 · 2026-11-14 · All markers are circles; no legend
Status: confirmed (owner request, 2026-11-14; reverts D-053)
Decision: named features use the same green circle as sites (same size, fill and dark stroke), so every marker on every map view is a circle; hover is off-white and selected is amber. The map legend is removed entirely (`MapLegend` deleted). A site's name and type remain available from its tooltip and the list.

## D-055 · 2026-11-14 · Date & time comes first in the left column
Status: confirmed (owner request, 2026-11-14; reorders D-044)
Decision: the left column now reads Date & time (landing date and UTC time pickers), then Site selection (list or coordinates), then "Explore Site Details". The date and time pickers open downward again, over the site section. The site list still takes the remaining height.
