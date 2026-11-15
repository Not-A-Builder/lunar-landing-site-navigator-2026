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

## D-056 · 2026-11-14 · Coordinates first within Site selection
Status: confirmed (owner request, 2026-11-14; reorders D-044)
Decision: inside Site selection the order is now "Enter Lunar Coordinates" (field and "click the map" hint), then the "OR" divider, then the curated list, renamed "Landing sites, missions, and features" (filter, search, result count, scrolling list). The list stays last and still takes the remaining height.

## D-057 · 2026-11-14 · More breathing room between the left-column sections
Status: confirmed (owner request, 2026-11-14)
Decision: the gap on each side of the divider between Date & time and Site selection, and between Site selection and "Explore Site Details", grows from 20 px to 32 px (`pb-8` / `py-8`). The site list absorbs the difference.

## D-058 · 2026-11-14 · Shorter rules around "OR"
Status: confirmed (owner request, 2026-11-14)
Decision: the two lines either side of the "OR" between the coordinate field and the site list are half their previous length (each a quarter of the column, 115 px at the 460 px column), centred on the word.

## D-059 · 2026-11-14 · "OR" rules fade at their outer ends
Status: confirmed (owner request, 2026-11-14; refines D-058)
Decision: each line beside "OR" is a gradient from transparent at its outer end to the `--line` colour next to the word (left line fades leftward, right line rightward). Lengths stay equal (115 px each at the 460 px column).

## D-060 · 2026-11-14 · CTA pointer cursor; "Date & time selection" heading
Status: confirmed (owner requests, 2026-11-14)
Decision: "Explore Site Details" shows the pointer cursor while enabled (not-allowed while disabled). The first left-column section heading reads "Date & time selection", parallel to "Site selection".

## D-061 · 2026-11-14 · No section headings in the left column
Status: confirmed (owner request, 2026-11-14; supersedes the D-060 heading)
Decision: the small uppercase headings "Date & time selection" and "Site selection" are removed. The column now opens with "Landing date & time", then (after the divider) "Enter Lunar Coordinates", "OR", "Landing sites, missions, and features". Both `<section>`s keep an `aria-label` with their old names for screen readers.

## D-062 · 2026-11-14 · Left-column labels as actions
Status: confirmed (owner request, 2026-11-14)
Decision: "Landing date & time" → "Select landing date & time"; "Landing sites, missions, and features" → "Select landing site, mission, or feature" (sentence case, like the other labels). The list's screen-reader name stays "Landing sites, missions, and features".

## D-063 · 2026-11-14 · Filled controls; funnel icon
Status: confirmed (owner request, 2026-11-14)
Decision: the persona dropdown ("I am …") gets the same fill as the form fields (`bg-panel`). The filter and theme icon buttons get a subtler fill (`bg-panel/60`, full `bg-panel` on hover or while open), and their icons use the full text colour instead of the muted one, so they no longer look disabled. The filter button uses Phosphor's `Funnel` icon (was `FunnelSimple`).

## D-064 · 2026-11-14 · Shorter site list with a scroll gutter; compare CTA; no typed coordinates for enthusiasts
Status: confirmed (owner request, 2026-11-14)
Decision:
- **Enthusiast persona:** the "Enter Lunar Coordinates" field and the "OR" divider are hidden. Below the site list sits "Or click anywhere on the map to drop a point." (once a point is dropped it reads "Point dropped at …" with a Clear link). Map clicks still pick custom points. Educator and Mission planner keep the field.
- **All personas:** the site list shows at most 4 rows plus 40% of the next one (measured from the rendered rows, so it adapts to wrapped names). It shrinks further when the column is too short, so the buttons stay visible. Because the list is no longer full height, the buttons now follow straight after it. When the list overflows, its scroll bar sits in its own 14 px gutter on the right edge (subtle fill and left rule) instead of floating over the rows. Rows are tighter: 8 px vertical padding, and no gaps between the name, type and coordinate lines.
- **New secondary button** under "Explore Site Details": "Select another scenario to compare". It opens `/compare?s=<site>@<time>` with the current site (or dropped point) and time as Scenario A, ready for Scenario B. It is disabled until a site is picked, same as the primary button.

## D-065 · 2026-11-14 · Next site row peeks in at ~58%
Status: confirmed (owner request, 2026-11-14; refines D-064)
Decision: when the site list overflows, the row below the 4 full rows now shows at 58% of its height (was 40%), slightly more than 55%. The list is about 4.6 rows tall.

## D-066 · 2026-11-14 · Build a comparison on the selection page
Status: confirmed (owner request, 2026-11-14; replaces the D-064 jump to /compare)
Decision:
- "Select another scenario to compare" no longer opens Compare. It parks the current site + time as a scenario in the URL (`/?s=…`, same format as `/compare?s=`) and resets the form to its empty state: no site, time = now, search cleared, every list on.
- While at least one scenario is parked, a sticky bar sits under the app header with `MAX_COMPARE` (3) cards: parked scenarios (name, landing time UTC), the one being filled by the form below (outlined, "selecting now", with a live preview), and dashed empty slots ("Not added yet").
- The buttons then read: primary "Start comparison now" (opens `/compare?s=` with the parked scenarios plus the current one), secondary "Select another scenario to compare" (disabled on the last slot). Both stay disabled until a site is picked.
- Every filled or filling card has a remove (×). Removing a parked card drops it. Removing the card being filled brings the last parked scenario back into the form to edit. When only one scenario is left, the bar disappears and the page returns to the plain picker ("Explore Site Details"), with that scenario in the form.
- Scenario parse/serialise helpers moved to `src/lib/scenarios.ts`, shared by both pages.

## D-067 · 2026-11-14 · Edit saved scenarios; last slot shows only "Start comparison now"
Status: confirmed (owner requests, 2026-11-14; extends D-066)
Decision:
- Every saved scenario card in the comparison bar has a pencil (edit) next to its ×. Editing first saves the form into its own slot (a new slot with no site picked is simply dropped), then loads that scenario's date, time and site into the form. That card becomes the active one ("Scenario A · editing"), and its changes are saved when the user edits another card, adds another scenario, or starts the comparison.
- × on the card being edited (or filled) discards it and opens the last remaining scenario for editing. As before, with one scenario left the bar disappears and the page is the plain picker with that scenario in the form.
- When no free slot remains after the form's scenario (filling the 3rd, or editing with all 3 saved), only the primary "Start comparison now" is shown. The secondary button is hidden, not disabled.
- A link with all 3 slots filled (`/?s=A,B,C`) opens with the last one in edit mode.

## D-068 · 2026-11-14 · Site list sorted A–Z by default, with a sort menu
Status: confirmed (owner request, 2026-11-14)
Decision: the list of sites, missions and features is sorted by name A to Z by default (case- and accent-insensitive, numbers compared naturally, so "Luna 9" comes before "Luna 16"). Before this it followed the research file's order. A sort icon button (`ArrowsDownUp`) to the right of the filter button opens a single-choice menu: Name A to Z, Name Z to A, Closest to the south pole first, Farthest from the south pole first. Distance from the pole is the angular distance 90° + latitude, so it orders by latitude, with ties broken by name. No new data. A dot on the icon marks a non-default order, like the filter. The sort applies after search and filters, and is kept when a new comparison scenario resets the form.

## D-069 · 2026-11-14 · Coordinate rulers on the flat whole-Moon map too
Status: confirmed (owner request, 2026-11-14)
Decision: the latitude/longitude rulers that frame the south-pole map now also frame the flat (equirectangular) whole-Moon map, with ticks that follow pan and zoom. The map's margin past ±180° / ±90° gets no ticks: lon and lat are clamped to the chart there, so an edge that lies in the margin still shows the other axis's ticks. The 3D globe is unchanged (no rulers).

## D-070 · 2026-11-14 · Equator and prime meridian on the flat whole-Moon map
Status: confirmed (owner request, 2026-11-14)
Decision: the flat whole-Moon map draws the equator (0° latitude) and the prime meridian (0° longitude) across the chart, in the same dashed guide style as the south-pole map's meridians. They line up with the 0° ticks on the rulers (D-069). The south-pole map is unchanged: it already shows the 0°–180° and 90°E–90°W meridians, and the equator is outside its coverage. The 3D globe is unchanged.

## D-071 · 2026-11-14 · Long-dash outline for empty scenario slots
Status: confirmed (owner request, 2026-11-14)
Decision: an empty ("Not added yet") slot in the comparison bar is outlined with long dashes and long gaps (12 px dash, 8 px gap, `--faint` at 70%, drawn as an SVG rect because CSS `dashed` can't set dash length). This makes it easy to tell apart from the solid-outlined card being filled. Showing the scenario cards in the opposite theme was tried in the same change and reverted at the owner's request ("looks bad"). Cards keep the page theme.

## D-072 · 2026-11-14 · Every load starts in the dark theme
Status: confirmed (owner request, 2026-11-14; changes the D-040 default)
Decision: the app always loads in the dark theme. The root layout renders `<html data-theme="dark">` on the server, so the first paint is dark with no flash and no script. A saved choice and the device's light/dark setting are no longer read. The header toggle still switches to light for the rest of the visit, but the choice is not saved, so a reload or new visit starts dark again. The inline theme script (`src/lib/theme-script.ts`) and the `lsn-theme` localStorage key are retired.

## D-073 · 2026-11-14 · Fainter outline for empty scenario slots
Status: confirmed (owner request, 2026-11-14; refines D-071)
Decision: the long-dash outline of a "Not added yet" slot drops from 70% to 40% opacity of `--faint`, so it recedes further behind the scenario cards. Dash and gap lengths are unchanged (12 / 8 px).

## D-074 · 2026-11-14 · Unfinished scenarios are kept until removed
Status: confirmed (owner request, 2026-11-14; changes D-067)
Decision:
- Switching to another scenario no longer drops the one being filled when it has no site yet. It is saved as a partial scenario (landing time, no site; URL entry `@ISO`) and its card reads "Site not picked yet" with its time. Only × removes a scenario.
- "Select another scenario to compare" first goes to an unfinished slot if there is one, and only opens a new slot when every other slot has a site.
- "Start comparison now" is enabled once at least two scenarios have a site (it no longer also needs the form's own site). Partial scenarios are left out of the comparison. Compare never receives partial entries (`parseScenarios` drops them unless called with `allowPartial`).
- An unfinished slot reopened for editing is labelled "selecting now", not "editing".
- The "Scenario N" label (with "· selecting now" / "· editing") uses one style in every state: faint, small caps, semibold.

## D-075 · 2026-11-14 · Click a scenario card to edit it
Status: confirmed (owner request, 2026-11-14; replaces the D-067 pencil)
Decision: the pencil button is removed. Clicking anywhere on a saved scenario card (or Enter/Space when it has focus) opens it for editing, with a pointer cursor and a hover border. The × stays and does not trigger editing. The card being filled and the empty slots are not clickable.

## D-076 · 2026-11-14 · Comparison bar animates in and out
Status: confirmed (owner requests, 2026-11-14)
Decision:
- **In:** the first "Select another scenario to compare" (when the bar appears) slides the bar down: its row grows from 0 to full height over 300 ms, so the page below moves down smoothly. Then the three cards fade in one by one from 12 px to the left (360 ms each, 110 ms apart, starting at 220 ms). The whole sequence takes about 0.8 s.
- **Out:** when all but one scenario are removed (the bar goes away), the reverse plays: cards fade out to the left, last one first (220 ms each, 80 ms apart), then the bar folds up (280 ms). A snapshot of the bar stays on screen, inert, until it finishes.
- Only these two transitions animate. Cards changing state, and opening the page from a shared `?s=` link, don't. With "reduce motion" switched on, nothing animates.

## D-077 · 2026-11-14 · More space above the map-click hint
Status: confirmed (owner request, 2026-11-14)
Decision: in the enthusiast view, the gap between the site list and "Or click anywhere on the map to drop a point." grows from 8 px to 14 px (`mt-3.5`).

## D-078 · 2026-11-14 · Pointer cursor on every enabled control
Status: confirmed (owner request, 2026-11-14)
Decision: one base-layer rule in `globals.css` gives every enabled button, `role="button"` element, `<summary>`, `<select>`, checkbox/radio/range input (and its label) and date/time field a pointer cursor on hover. Disabled controls show "not allowed", matching the existing CTA buttons. Text-entry fields (text, search, number) keep the I-beam so it is clear you can type. Per-element `cursor-*` classes still override it.

## D-079 · 2026-11-14 · Site list waits 600 ms before following a hovered map pin
Status: confirmed (owner request, 2026-11-14)
Decision: on the site selection page, hovering a pin on the map no longer scrolls the site list straight away. The list scrolls to that site's card only once the cursor has rested on the pin for 600 ms (`MAP_HOVER_SCROLL_MS`); moving off sooner cancels it. Clicking a pin still scrolls to its card at once, and leaving a pin still brings the selected site's card back into view. The pin and card highlight still follow the cursor instantly.

## D-080 · 2026-11-14 · No info button on the 2D maps; imagery credit shown as a label
Status: confirmed (owner request, 2026-11-14)
Decision: the OpenLayers "i" (attribution) button in the bottom-right corner of the polar and whole-Moon maps is removed (`controls: []`). So the NASA Moon Trek imagery is still credited, its credit ("LRO LOLA hillshade · NASA Moon Trek" / "LRO WAC global mosaic · NASA Moon Trek", from `moon.ts`) now sits as a small plain label to the left of the scale bar, the same as on the 3D globe. The scale bar moves into the corner the button used to occupy.

## D-081 · 2026-11-14 · Site elevation worded as above/below, with its own tooltip
Status: confirmed (owner request, 2026-11-14)
Decision: ground height relative to the 1,737.4 km LOLA reference sphere is formatted by `fmtElevation` (`metrics/format.ts`), which says "1,922 m below" for negative heights instead of "-1922 m above", and adds thousands separators. Used in the site details header and the `spatial.site-elevation-above-datum` metric value. The header value now has its own `<InfoTip>` (source `lola-pds`) explaining the reference sphere and why lower ground tends to see a higher skyline; it sits after the location tip so each tip follows the value it explains.

## D-082 · 2026-11-14 · Site details: header-width page, contents column, 3 / 9 split
Status: confirmed (owner request, 2026-11-14)
Decision:
- The page uses the header's content width (`max-w-[1600px] px-4`), like site selection.
- Header, top to bottom: the site name; a coordinates row (latitude • longitude ⓘ • ground height ⓘ); a metadata row (group • mission • status • date). Separators are "•" with 12 px either side.
- Buttons on the right: two secondary buttons, "Set mission assumptions" and "Customise rating bands", a vertical rule, then the primary "Add to comparison". The "Open QuickMap" link is removed.
- Below the header: landing date & time and the timeline (D-085), then a horizontal rule and a 12-column grid: 3 columns of contents on the left, 9 of content on the right (contents hidden under `lg`).
- Contents (Wikipedia-style, sticky, own scroll): "Horizon, Sun & Earth views" (Horizon view, Sun from the site, Earth from the site, Libration), then "Metrics" with each category (Overall decision metrics first, which also lists Battery charge and Array power), each opening to its metrics. The section in view is highlighted; a click jumps there instantly.
- Right column order: the four cards (Sun at selected time, Earth at selected time, Sunlit % of mission, Sun + Earth together), horizon view, Sun from the site, Earth from the site, libration, then Metrics. Battery charge and Array power sit at the top of Overall decision metrics.
- All three personas get the same layout and sections; titles, leads, card wording, tooltips and metric rows go from plain (enthusiast) to explained (educator) to technical (planner).

## D-083 · 2026-11-14 · Mission assumptions and rating bands open as modals
Status: confirmed (owner request, 2026-11-14; replaces the inline planner panels on site details)
Decision: both editors open as dialogs at most 80% of the content width and 80% of the viewport height, with a body that scrolls on its own, a sticky header (title, description, close) and a sticky footer: "Reset to defaults" (left), "Discard edits" and "Save changes" (primary). Edits are a draft until Save; Reset fills the draft with defaults (still needs Save). Escape or a backdrop click closes only when nothing is unsaved. Each assumption shows its reason and default; each band set shows its basis, defaults, which metrics it rates, and a preview with this site's value. Opening from a value (D-090) scrolls to and highlights that field. The Compare page keeps its inline band table. `AssumptionsPanel` is removed.

## D-084 · 2026-11-14 · Default mission length is 30 Earth days
Status: confirmed (owner request, 2026-11-14; was 14 days)
Decision: `DEFAULT_ASSUMPTIONS.missionDays` = 30, about one full lunar day (29.5 Earth days), so every site shows a whole light/dark cycle. The persisted assumptions store moves to version 1: a saved mission length still at the old default (14) becomes 30; any other saved value is kept.

## D-085 · 2026-11-14 · "Timeline" replaces the time cursor; ±Nd and compact durations
Status: confirmed (owner request, 2026-11-14)
Decision:
- Site details reuses the site-selection date and time pickers (the value comes from the URL `t` set on site selection) next to −7d / −1d / +1d / +7d and the mission length (click to edit it in the assumptions modal).
- The range slider called "time cursor" becomes a timeline: day ticks with dated labels, a Sun lane (sunlit windows) and an Earth lane (in-view windows), a playhead with a floating date/time label, drag or click to move, arrow keys (Shift = 1 day, Home/End), and "Back to landing". The readout shows the time and "Day N of 30".
- No space between a number and d (or h) anywhere: "+7d", "6d 14h", "12h" (`fmtHours`).

## D-086 · 2026-11-14 · Horizon view reads right to left in azimuth; solid Sun
Status: confirmed (owner request, 2026-11-14)
Decision: the horizon panorama's azimuth axis runs N 360° → W → S → E → N 0° from left to right. At the south pole the Sun's azimuth decreases with time, so the skyline now appears in the same left-to-right order as the terrain line in the Sun/Earth timelines (checked on Haworth, Dec 2026). The libration chart uses the same direction and unwraps azimuths near north. Visuals: sky and terrain gradients, a ridge line, compass ticks every 45°, the Sun as a solid orange disc (soft glow when lit, never a ring) and Earth as a solid blue disc, both drawn under the slightly translucent terrain so hidden or partly hidden bodies are occluded as they would be, with labels ("Sun · hidden"). Sun/Earth timelines fill the terrain the same way and draw the body solid while visible, dashed while hidden.

## D-087 · 2026-11-14 · Chart hover without flicker
Status: confirmed (owner report: tooltips "keep showing and hiding with every movement")
Decision: cause: the hover line and dot were drawn on top of the transparent hit rectangle, so the pointer kept "leaving" it. Now pointer handlers sit on the whole `<svg>`, guides never take pointer events, the pointer snaps to a sample (or 0.5° of azimuth) and state changes only when that changes, leaving waits 90 ms, and the tooltip glides (150 ms transform) and fades instead of mounting and unmounting. Tooltips use label/value rows at fixed precision (planner 3 decimals for angles), with UTC time, mission day, and "Click to move the timeline here".

## D-088 · 2026-11-14 · Battery and array power: exact per-sample tooltips, shown to every persona
Status: confirmed (owner request, 2026-11-14)
Decision: `powerModel` also returns per-sample sunlight at the Sun's distance (1,361 W/m² ÷ AU²), the panel cosine factor and the load drawn. Array power tooltip: output, load (operating or survival), surplus/deficit, and for planners the full product (sunlight × visible disk × cos angle × area × efficiency = output). Battery tooltip: charge in % and Wh of capacity, array output, load, and net flow (charging, draining, full with surplus not stored, empty and short by). The power chart draws the load as a dashed step line; both charts shade dark periods and mark the lowest charge. The model itself is unchanged (starts full; operating load whenever any sunlight reaches the array, survival load otherwise; 10 min steps). Both charts now sit in Overall decision metrics for all personas.

## D-089 · 2026-11-14 · Easier-to-read metric rows
Status: confirmed (owner request, 2026-11-14)
Decision: each category is an anchored section with its roll-up status explained by an info tip. Rows: name (enthusiast: the question) with an info tip, then for planners a short definition. The "role · depends on · literature" subtext line is removed; role and dependencies moved into the info tip. Values use the sans font with mono numerals, and multi-part values ("a · b · c", "a; b") are split onto separate lines. Under the value: rating (Good / Trade-off / Challenging), status, band strip; planner notes in plain text; data rows (timestamps, windows) behind "Show N data rows" instead of a code box.

## D-090 · 2026-11-14 · "Computed" shows its calculation; "Your input" and bands open the editors
Status: confirmed (owner request, 2026-11-14)
Decision: `MetricValue` gains `calc` (numbered steps with this site's numbers, built in `computeAllMetrics` from the same variables as the value), `inputs` (assumption keys) and `Rating.key` (band set). Hovering or focusing "Computed" or "Modelled" (pointer cursor, dotted underline) opens a card with the steps, the result and the data sources. 132 of 139 computed/modelled metrics have their own steps; the other 7 (text records such as mission history, the reference frame, evidence maturity) show the data method and note. "Reference" opens the citation. Clicking a "Your input" value or label opens the assumptions modal at that field; clicking a rating or band strip opens the bands modal at that band set. A test checks every rating names a band set, every input names an assumption, and the steps agree with the value.

## D-091 · 2026-11-15 · One height for buttons, one for fields, across the platform
Status: confirmed (owner request, 2026-11-15)
Decision: the home page sets the standard. Buttons with a text label are 44px (`h-11`) and fields (text, number, search, date/time pickers, selects, dropdown triggers) are 40px (`h-10`) on every page and in both planner modals. Changed: site details header buttons and "Download time series (CSV)" (40/36 → 44), modal footer buttons (42 → 44), modal number fields and select (36 → 40), compare scenario select and time input, compare rating-band inputs, custom-coordinate field (→ 40) and its submit button (→ 44), persona dropdown (34 → 40). Out of scope: icon-only buttons (filter, sort, theme, zoom, close), map overlay switches, small inline text actions (±day chips, "Duplicate", "show on Whole Moon").

## D-092 · 2026-11-15 · Shared primary and secondary button styles
Status: confirmed (owner request, 2026-11-15)
Decision: every text button uses `btnPrimary` or `btnSecondary` from `src/lib/ui.ts`: 44px, 1px border on both variants (the primary's border is its fill colour), 16px medium label, `px-4`, the same disabled state (40% opacity, not-allowed cursor). Secondary buttons get a `panel-2` fill. Why: primary and secondary were both 44px, but a border-only secondary in the low-contrast `line` colour read as shorter than a solid primary, especially inside the modals, which sit on `panel`. `panel-2` is a step lighter than both `bg` and `panel` in both themes, so the whole secondary box shows. Applies to the home CTAs, site details header, "Download time series (CSV)", custom-coordinate submit, and the modal footers. Field height lives in the same file (`FIELD_H`).

## D-093 · 2026-11-15 · Play/pause on the site details timeline
Status: confirmed (owner request, 2026-11-15)
Decision: a square play/pause button sits left of the mission timeline. Play runs the selected time forward at one mission day per second (10 min steps), wrapping from the mission end back to landing, until the button is pressed again; starting at the very end begins at landing. Any time the user picks a time stops playback there: a click or drag on the timeline, the arrow/Home/End keys, a click on any time chart (Sun, Earth, libration, battery, array power) and "Back to landing". Space (or K) plays/pauses while the timeline has focus. Metric rows are memoised because they don't depend on the selected time; production playback holds about 58 fps (dev mode is slower).

## D-094 · 2026-11-15 · Click the horizon view to move the timeline
Status: confirmed (owner request, 2026-11-15)
Decision: the horizon view (azimuth on x, not time) now moves the timeline on click, like the time charts. Hovering an azimuth finds every time the Sun's and Earth's paths cross it during the mission (within 0.5°) and picks the crossing drawn nearest the pointer; a ring in the body's colour marks it and the tooltip ends "Click to move the timeline here: Sun on 3 Dec 2026, 06:30 UTC" (or says neither body passes that way, and the click does nothing). The click goes through the same pick as the other charts, so it stops playback (D-093).

## D-095 · 2026-11-15 · Earth chart: DSN shown per complex, with Contact and handover gaps
Status: confirmed (owner request, 2026-11-15)
Decision: the single "DSN" lane under "Earth from the site" (on when any complex had the Moon ≥ `dsnMinElevDeg`) was hard to read: its 10–80 min gaps drew as hairlines and nothing said why. It becomes a sum. "In view" (Earth over the terrain), then one lane per complex in the order the Moon reaches them as Earth turns (Canberra, Madrid, Goldstone; enthusiasts see Australia / Spain / California), then "Contact" (Earth in view ∩ any complex) with handover gaps (Earth in view, no complex) as red marks at least 3px wide. The selected-time line runs through the lanes. Hover lists each complex (planner: Moon elevation) and the contact state, with time to the next antenna during a gap. A computed summary sits under the legend. Planner: per-complex and any-complex share, whole-mission gaps by handover, gaps while Earth is in view (count, total, longest with time), contact hours and the complexes' longitude spacing. Educator: the two independent geometries, the relay, and why most gaps fall at Canberra → Madrid (153° apart, versus 120° for even spacing) and grow when the northern complexes' lanes shorten. Enthusiast: plain-language version. Engine: `Series.dsnEl` (per-complex Moon elevation, already in the Horizons tables), `Windows.dsnBy` and `Windows.dteNoDsn`. No new data source. `TIME_MARGIN.l` 64 → 84 so station names fit; every time chart shares it, so they stay aligned.

## D-097 · 2026-11-15 · Fixed-height status cards under "Horizon, Sun & Earth views"
Status: confirmed (owner request, 2026-11-15)
Decision: the four status cards (Sun, Earth, sunlit share, Sun + Earth together) get a min-height per persona and breakpoint (`CARD_H` in `SiteDetails.tsx`), so moving the timeline or changing site doesn't change their height and push the sections below up or down. The values are the tallest card measured across 4 sites × 4 dates × widths 390–1920 px, plus about 1.5 lines of room to spare. Enthusiast/planner: 9rem (12rem at xl). Educator: 11rem, 18rem at xl (4 narrow columns, longest sentences) and 12rem at 2xl. Height can still change when the persona changes, because each persona has different copy. Very long copy would still make a card grow instead of being cut off.

## D-098 · 2026-11-15 · Hover cards on chart lane labels; no divider above Contact
Status: confirmed (owner request, 2026-11-15)
Decision: lane labels under the Sun and Earth charts are HTML text with a dotted underline that opens an `InfoTip` card (hover, focus or tap) with the data sources. `InfoTip` gains an optional `trigger` that replaces the ⓘ icon with text. Each card explains its lane in the persona's words, with this mission's numbers. Sunlit / In view: the disk threshold and hours. Each DSN complex: what the Deep Space Network is, the antenna and its cited coordinates (planners also see it is their assumption), hours a day the Moon is up there, and which complex comes before and after. Contact: Earth in view AND a complex, what the red handover gaps are, hours and gap count, geometry only. The horizontal line drawn above the Contact lane (D-095) is removed because it read as another data series; a little extra space still sets the combined lane apart. Lane pitch is now ≥ 20px (DSN lanes 12px tall) so the underlined labels never touch.

## D-099 · 2026-11-15 · Timeline stays pinned while the charts that follow it are on screen
Status: confirmed (owner request, 2026-11-15)
Decision: on the site details page the mission timeline (label row, time readout, play/pause scrubber) pins under the app header once it reaches it, and stays there until the bottom of the Array power chart passes under it. Everything above that point follows the selected time. The metric rows after it are computed for the landing time, not the cursor, so the timeline lets go there. The owner asked for the motion to be smooth both ways, so the bar is plain CSS `position: sticky` inside a "track" (`useStickyTimeline` in `SiteDetails.tsx`) that runs from the bar's place in the page to the bottom of `#array-power`. The browser does the pinning, the push-out at the end and re-pinning on the way back up, with no script moving anything during scroll. The track gives its extra height back with a negative bottom margin, so the layout below is unchanged; a ResizeObserver re-measures it when the layout changes. The page divider under the timeline sits inside the bar as its last element, so the same line (content width, never faded) is the pinned bar's bottom edge; the bar has no border of its own. While pinned, the contents column moves down below it (300 ms glide back up once the bar has gone; never overlapped). Jumping from the contents lands a section just below the pinned bar. The timeline info tip says where it lets go.

## D-100 · 2026-11-15 · "Select different site" on the site details page keeps the landing time
Status: confirmed (owner request, 2026-11-15)
Decision: the site details header has a tertiary "Select different site" link (pencil icon, muted underlined text, same style as "Back to landing") right after the site name, on the name's baseline. It links to the site selection page as `/?t=<landing time>`, so the date and time pickers there open on the landing time last chosen on the details page (the `t` in its URL, not the timeline cursor). The site itself is not carried over, because the user is choosing another one. With no `t` on the details page the link is plain `/` and the form starts at the current time as before. `SiteSelection` reads `?t=` on mount, and also when it changes after mount, because `cacheComponents` can keep the page's state alive between navigations. A full comparison queue (`?s=`) still takes precedence when it opens the last scenario for editing.

## D-101 · 2026-11-15 · Ignore extension-added attributes on `<body>` during hydration
Status: confirmed (owner request, 2026-11-15)
Decision: `<body>` in the root layout gets `suppressHydrationWarning`, like `<html>` already has. Browser extensions such as ColorZilla add attributes (`cz-shortcut-listen="true"`) to `<body>` before React hydrates, which raised a hydration-mismatch console error on every page. The flag only covers `<body>`'s own attributes, one level deep, so real mismatches in the app's components still show up.

## D-102 · 2026-11-15 · Metric category headings on the site details page at 26px
Status: confirmed (owner request, 2026-11-15)
Decision: each category heading under "Metrics" on the site details page (e.g. "Earth geometry, DTE comms & relay") is 26px (`text-[26px]`, was `text-lg`), for all three personas. The individual metric titles inside each category, their values, helper text and tooltips keep their sizes. The category icon that sat to the left of each heading is removed from this list (the comparison page keeps its category icons).

## D-103 · 2026-11-15 · Per-category CSV download on the site details page
Status: confirmed (owner request, 2026-11-15)
Decision: each category heading under "Metrics" on the site details page has a tertiary "Download CSV" button (download icon, muted underlined text, same style as "Select different site") beside its "N metrics" count, for all three personas. It downloads only that category's metrics, the same rows shown on screen (unavailable metrics stay hidden, D-041), as `<siteId>-<landing UTC>-<category>-metrics.csv`. Columns: site, latitude_deg, longitude_deg, landing_utc, category, metric_id, metric, question, value (the number behind the shown value, rounded to 6 decimals; blank when the value is text), display_value (as shown, with units), status, rating, sources, source_urls, note. Every row keeps its status and source links, so the file follows the same data rules as the page. The planner's full "Download time series (CSV)" stays as it is; both now share one CSV helper (`src/lib/csv.ts`, RFC 4180 quoting).

## D-104 · 2026-11-15 · Rating band strips fill the value column on metric rows
Status: confirmed (owner request, 2026-11-15)
Decision: on the site details page, the red/amber/green band strip under a metric's value now spans the full width of the right-hand value column (it was capped at 18rem). The wider bar shows more clearly where inside a band the result sits. It applies wherever the strip shows in metric rows (Educator and Mission planner). The same applies to the band strips in the Rating bands modal, which now fill their column (`BandStrip` `wide` prop). The band table on the comparison page (`BandsPanel`) keeps the 18rem cap.

## D-105 · 2026-11-15 · No "Reads as" line under the coordinate field on a custom site's details page
Status: confirmed (owner request, 2026-11-15)
Decision: on the site details page for a custom site (`/site/custom?lat&lon`), the "Any point on the Moon (lat, lon)" field no longer shows the "Reads as 86.7827°S, 21.8174°W" line under it. The page header already names the point. Errors for coordinates that can't be read still show in that place. The site selection page and the comparison page keep the line, through a new `readout` prop on `CustomCoordForm` (default on).

## D-106 · 2026-11-15 · No coordinate field on a custom site's details page (supersedes D-105)
Status: confirmed (owner request, 2026-11-15)
Decision: the site details page for a custom site (`/site/custom?lat&lon`) no longer shows the "Any point on the Moon (lat, lon)" field or its "Update" button, the same as for a named site. The header already shows the point's coordinates. To pick another point, use "Select different site", which keeps the landing time (D-100). This replaces D-105, and its `readout` prop on `CustomCoordForm` is removed again; the site selection and comparison pages keep the full form, including the "Reads as" line.

## D-107 · 2026-11-15 · "Customise rating bands" button uses the Steps icon
Status: confirmed (owner request, 2026-11-15)
Decision: the "Customise rating bands" button in the site details header uses Phosphor's `Steps` icon instead of `TrafficSignal`.

## D-108 · 2026-11-15 · Enthusiasts don't see metrics marked "Optional story / contextual layer"
Status: confirmed (owner request, 2026-11-15)
Decision: for the Enthusiast persona, the site details page hides every metric whose enthusiast copy in the metrics sheet (`views.enthusiast`) is "Optional story / contextual layer" (82 of the 196 metrics). They are left out of the metric list, the "N metrics" counts, the page contents and the per-category CSV (D-103). A category left with no metrics is dropped from the list and the contents. For example, at Peak near Cabeus B "Rover traversability & field ops" has no metrics left for enthusiasts, so they don't see that category (88 of 160 metrics shown, against 160 for the other personas). Educator and Mission planner still see them. The category status badge still rolls up all of a category's shown metrics, hidden ones included, so it reads the same for every persona. The comparison page's category scores are unchanged.

## D-109 · 2026-11-15 · Enthusiasts see only the main metrics, takeaways first, without repeated subtext (supersedes D-108's filter)
Status: confirmed (owner request, 2026-11-15); the curated picks await owner review
Decision: the Enthusiast persona's metrics on the site details page come from a curated list, `src/lib/enthusiast-metrics.ts` (27 of the 196 metrics; all 27 show at Peak near Cabeus B, against 88 under D-108). It keeps the main plain-language metrics of each category and drops the obscure or technical ones. That includes every metric the sheet marks "Optional story / contextual layer" (D-108, now guaranteed by a test) and most marked "Hidden unless requested". Categories with nothing picked or available (regolith, space weather, rover) drop out for enthusiasts. The list only chooses and labels computed metrics; it adds no values.
- **Takeaways first:** in each category, the headline metrics (16 marked `card`) are listed first under a short label (e.g. "Time in sunlight", "Longest without Earth"). They use the same row layout as the other metrics, stacked vertically. The owner first asked for small horizontal cards, then for rows. A rated takeaway gets a 2px accent bar in its rating colour plus the rating icon and word (good / trade-off / challenging). An unrated fact keeps a neutral bar. The other picked metrics follow, then (in Overall) the battery and solar power charts sit between the two groups.
- **Subtext:** the enthusiast line under a question (`views.enthusiast`) shows only when it adds something (2 metrics: "Find flatter ground with enough sunlight", "Longest time in darkness"). It is hidden when it repeats the question or rewords an already clear one. The sheet's "Hidden unless requested" placeholder is never shown.
- The category status badge still rolls up all of a category's shown metrics for every persona, as in D-108. "N metrics" and the per-category CSV (D-103) follow what the enthusiast sees. Educator and Mission planner are unchanged.

## D-110 · 2026-11-15 · The contents sidebar uses the same names as the page body for each persona
Status: confirmed (owner request, 2026-11-15)
Decision: the site details contents sidebar now lists every entry under the name the body shows for the current persona. Metric names come from one helper (`metricLabel`): the planner and educator see the metric name, enthusiasts the takeaway label or the question. Chart block titles (horizon, Sun, Earth, libration, battery, solar power) come from one per-persona table (`blockTitles`) shared by the body and the sidebar. Before this, the sidebar always showed the planner names. Entries follow the body order: enthusiast takeaways, then the battery and power charts, then the other metrics. A headless check matched every sidebar entry to a body heading for all three personas (45 / 181 / 181 entries).

## D-111 · 2026-11-15 · Enthusiast contents list the metric categories only
Status: confirmed (owner request, 2026-11-15)
Decision: for the Enthusiast persona, the "Metrics" part of the site details contents sidebar lists only the categories (e.g. "Sun geometry, illumination & energy"), with no expand/collapse caret and no list of metrics under each. Clicking a category still jumps to it, and the sidebar highlights the category being read. Educator and Mission planner keep the expandable per-metric lists, whose names match the body (D-110).

## D-112 · 2026-11-15 · Enthusiast tooltips written for enthusiasts
Status: confirmed (owner request, 2026-11-15)
Decision: in the Enthusiast view of the site details page, every metric tooltip uses plain-language copy written for that persona, in place of the metrics sheet's technical definition, unit and caveat lines. Each of the 27 curated metrics has its own text (`tip` in `src/lib/enthusiast-metrics.ts`); a test makes sure none is missing. Each was checked against what the app actually computes (`src/lib/metrics/compute.ts`), for example:
- the ranking is by multi-year sunlit share over 2026 to 2029;
- "Places to divert to" lists the three nearest south-pole sites in the app's list and doesn't check fuel;
- camera navigation checks that the site is sunlit and the Sun is above the minimum elevation.

Thresholds the user can change are written as "by default", and no site values appear in the copy. The only figures are cited reference values that are fixed in the app (the 2 km NASA 2011 heritage distance) and the 2026 to 2029 multi-year span. The tooltip title is the same name the row shows (takeaway label or question), not the planner's metric name. The source links stay as before. The category status tooltip becomes "Section verdict", in plain words that match the roll-up rule (`rollUp`). It says the verdict also counts rated results shown only to Educator and Mission planner, because the badge rolls up every shown metric for all personas (D-108). Educator and Mission planner tooltips are unchanged.

## D-113 · 2026-11-15 · Hovering a rating explains it in one short line
Status: confirmed (owner request, 2026-11-15)
Decision: on every page and for every persona, hovering a rating (icon + "Good", "Trade-off" or "Challenging") shows a small hint of at most two lines: "Good: this result suits the mission well." / "Trade-off: workable, but it limits the mission or needs extra planning." / "Challenging: a serious obstacle the mission would need to plan around." The wording is generic so it fits both a single metric's rating and a category's rolled-up verdict. The hint (`RagHint` in `RagBadge.tsx`) is portalled to `<body>` so card edges can't clip it. It sits above the rating, or below it near the top of the screen, and is 18rem wide at most. It covers every `RagBadge` (metric rows, category verdicts, status cards, Compare scores) and the planner and educator rating buttons that open the band editor. Those buttons lose their native "Change these rating bands" title so two tooltips never show at once; the sliders icon still marks them as editable. The compact Compare badge loses its native label title, since the hint now names the rating.

## D-114 · 2026-11-15 · Enthusiasts don't get mission assumptions or rating bands
Status: confirmed (owner request, 2026-11-15)
Decision: for the Enthusiast persona the site details page hides "Set mission assumptions" and "Customise rating bands" (and the divider before "Add to comparison"). It doesn't render either modal, and it closes an editor left open when the user switches to Enthusiast. "Mission length 30 Earth days" shows as plain text, without the pencil link, and its tooltip drops "Change it in Mission assumptions." "Your input" values in enthusiast metric rows are plain text, not editor links. Results still use the browser's saved mission assumptions and bands. The enthusiast tooltip for "Why is this option infeasible?" now says the limits can be changed in the Mission planner view. Educator and Mission planner are unchanged.

## D-115 · 2026-11-15 · No per-category count or CSV download for enthusiasts
Status: confirmed (owner request, 2026-11-15)
Decision: for the Enthusiast persona, category headings on the site details page no longer show "N metrics" or the "Download CSV" button (D-103). Educator and Mission planner keep both. The line above the list ("27 metrics for this site and date.") stays.

## D-116 · 2026-11-15 · Contents clicks land on the clicked entry and keep it selected
Status: confirmed (owner request, 2026-11-15)
Decision: clicking an entry in the site details contents scrolls the page so the entry's top sits on a "reading line": 16px below the app header, or below the pinned timeline bar when it is pinned (D-099). Pinning can change as the page moves, so the jump re-measures, then aligns again a frame later and at 150 ms once the timeline settles. The clicked entry stays selected until the user scrolls the page themselves (wheel, touch, scroll keys, or a press outside the contents such as the scrollbar), even near the bottom of the page where it can't reach the reading line. Scroll tracking now uses the same reading line: the selected entry is the last one whose top has reached it. Before, it used a line 30% down the screen, which is why a click often selected an entry two or three places away. A headless check clicked every entry in a shuffled order (enthusiast 16, educator 181, planner 181): every one was selected, and every one that wasn't at the bottom of the page landed on the line.

## D-117 · 2026-11-15 · The Enthusiast view always uses the default assumptions and bands
Status: confirmed (owner answer, 2026-11-15, to the open question raised with D-114)
Decision: Enthusiasts can't see or change mission assumptions or rating bands (D-114), so their results now always use the defaults: `DEFAULT_ASSUMPTIONS` (e.g. a 30-day mission) and no band overrides. This holds even when a planner has saved other values in this browser. It applies on the site details page and in Compare's scenario analyses, through one hook, `useEffectiveAssumptions(persona)` in `src/lib/assumptions-store.ts`. Educator and Mission planner still use the saved values, and nothing saved is changed or lost: switching back to Mission planner shows the saved assumptions and bands again. This replaces D-114's note that enthusiast results follow the saved values. The enthusiast tooltip for "Why is this option infeasible?" now says the limits come from the app's default mission assumptions. Checked with a saved 45-day mission and a custom sunlight band: Enthusiast showed 30 days and "Time in sunlight 55%, Trade-off" (default bands); Mission planner showed 45 days and 52%, Challenging (custom bands).

## D-118 · 2026-11-15 · Educator view: a curated, less technical version of the planner view
Status: confirmed (owner request, 2026-11-15); the curated picks await owner review
Decision:
- **Which metrics:** educators see a curated 89 of the 196 metrics (`src/lib/educator-metrics.ts`): every enthusiast pick plus the more teachable ones in every category. That is 89 at Peak near Cabeus B, against 27 for enthusiasts and 160 for mission planners. Skipped as too obscure for this level: Pareto set, suitability index, position sensitivity, evidence maturity, pixel counts, connectivity and grid-resolution checks, model cadence, f(t), the day/night threshold input, uniform-vs-ephemeris comparisons, Sun and Earth position-occupancy histograms, the Sun–Moon distance correction, view factors, panel incidence and irradiance, load and heater inputs, antenna pointing, link margin, data rate, multipath, the disk criterion, reference frame, map projection, footprint, the DEM name, spacecraft-visibility, cohesion, dielectric, thermal inertia, temperature-rate, dust charging, moonquakes, the footpad and descent-clearance details, approach direction, the science diversity score, instrument suitability, buffer, ground-station scheduling, plume exclusion, rover speed, comms-along-route, return margin and camera ergonomics, plasma and micrometeoroid flux, orbital coverage, in-situ chemistry and documented hazards. A test checks that the educator list includes every enthusiast pick, is smaller than the full catalog, and gives each pick a label and tooltip.
- **Names and tooltips:** each pick has a name and tooltip at high-school / first-year-university level (e.g. "Direct-to-Earth line of sight at landing", "Sun height above the horizon (elevation)"). Each tooltip says what the metric is, how the app gets it and any caveat, and was checked against `src/lib/metrics/compute.ts`. The only figures are fixed ones the app uses: 2026 to 2029, 1737.4 km, the 5° and 15° slope cut-offs, the 18.6-year cycle, the 10 m relay mast, and NASA's 2 km heritage distance. The body keeps the existing educator copy (D-034: the value in a sentence, the mechanism, how to read it), plus rating, bands, status and note. The page contents use the same names (D-110).
- **Category verdict tooltip:** the educator version says the verdict rolls up all rated metrics, including planner-only ones, and gives the rule in words.
- **Contents:** educators, like enthusiasts, see only the categories under "Metrics", with no metric dropdowns (extends D-111).
- **Coloured bars removed:** the enthusiast takeaway rows lose their coloured accent bars (D-109). They keep the rating icon and word and line up with the other rows.
- **Unchanged:** Mission planner is unchanged, and educators keep the mission assumptions and rating band editors.

## D-119 · 2026-11-15 · No per-category count or CSV download for educators either
Status: confirmed (owner request, 2026-11-15)
Decision: like enthusiasts (D-115), educators no longer see "N metrics" or "Download CSV" on each category heading on the site details page. Only Mission planner keeps them (D-103). The line above the list ("89 metrics for this site and date.") stays.

## D-120 · 2026-11-15 · Educators see each metric's value in the value column
Status: confirmed (owner request, 2026-11-15)
Decision: in the Educator view the right-hand column of every metric row now starts with the value itself, as for Mission planner, above the rating, status and band strip. Before, educators saw the value only inside the sentence on the left (D-034), so the right column showed just "Computed" or similar. "Your input" values link to Mission assumptions, as for planners. The sentence on the left is unchanged.

## D-121 · 2026-11-15 · Educators read the answer as a sentence in the value column (refines D-120)
Status: confirmed (owner request, 2026-11-15)
Decision: in the Educator view, each metric row's right-hand column now opens with the plain-English answer from the educator copy (D-034), with the computed value in bold (e.g. "The longest unbroken run of sunlight at this point is **15d 22h**."). It replaces the bare value added in D-120, so the value no longer appears twice. Below the answer come the rating, the status and, where the metric is rated, the red/amber/green band strip. The left column keeps the metric's name with its tooltip, then the mechanism and "How to read it". Copy written without a value placeholder shows its sentence, then "For this site and date: **value**". When no value is available, the reason shows instead. "Your input" values still open Mission assumptions through their status label. `EducatorText` is split into `EducatorAnswer` and `EducatorExplain`.

## D-122 · 2026-11-15 · No rating badge beside the category headings
Status: confirmed (owner request, 2026-11-15)
Decision: the site details page no longer shows the rolled-up rating (Good / Trade-off / Challenging, with its info tooltip) beside each category heading under "Metrics", for any persona. Individual metrics keep their ratings, hover hints (D-113) and band strips. The category tooltip copy written for enthusiasts and educators (D-112, D-118) is removed with it. `rollUp` stays, because the Compare page's category scores still use it.

## D-123 · 2026-11-15 · Mission assumptions editor: contents column and one field per row
Status: confirmed (owner request, 2026-11-15)
Decision: the Mission assumptions modal (Educator and Mission planner; enthusiasts don't get it, D-114) now has two columns that scroll separately. On the left is a contents list like the page's, with no heading: each group (Mission & visibility, Power, Landing, Communications, Rover) and its fields. Clicking an entry scrolls the fields column so that entry sits at its top and stays selected until the user scrolls the column themselves; otherwise the entry at the top is highlighted. On the right, the groups stack vertically, one field per row. Each row has the label (with "Edited" or "Custom"), the helper text and the default on the left, and the input or select, its unit and any error on the right. Nothing sits side by side any more: before, groups sat in two or three columns. Below 640 px a row stacks label over field, and below 768 px the contents column is hidden. Opening the editor at a field (e.g. from "Mission length") still scrolls to and highlights it.

## D-124 · 2026-11-15 · Modals: always-visible scrollbar, up to 85% of the screen height
Status: confirmed (owner request, 2026-11-15)
Decision: both editors (Mission assumptions and Rating bands) can now be up to 85% of the viewport height (was 80%). Each scrolling area shows a persistent scrollbar while its content overflows (`ScrollThumb`, as in the site list, D-064): the body of the Rating bands modal and any other default `Modal`, and both columns of the Mission assumptions modal. macOS hides native scrollbars until you scroll, so without this it wasn't clear there was more below. `Modal` gets a `customBody` option for editors that lay out their own scrolling columns.

## D-125 · 2026-11-15 · Editor subheaders and group headings
Status: confirmed (owner request, 2026-11-15)
Decision:
- **Rating bands:** the subheader reads "Thresholds that turn a value into red / amber / green bands".
- **Mission assumptions:** the subheader keeps "Inputs, not data. Defaults describe an example small solar-powered lander. Every value marked “Modelled” or “Your input” recomputes when you save." Modal subheaders are no longer capped at 48rem, and they span the full modal width under the title row and close button. The text needs 1084 px: it fits on one line from about a 1450 px wide window (1204 px available at 1600 px and wider) and wraps on narrower ones (1076 px available at 1440 px).
- **Group headings:** in the assumptions editor, the group headings (Mission & visibility, Power, Landing, Communications, Rover) are 20px, and their one-line hints (e.g. "How long, from what height, and what counts as sunlit or in view.") are removed.
- **Cleanup:** the enthusiast wording in both editors is removed, because enthusiasts never open them (D-114), and so is their unused `persona` prop.

## D-126 · 2026-11-15 · "Custom" labels styled like "Edited"
Status: confirmed (owner request, 2026-11-15)
Decision: in both editors, the "Custom" label beside a value that differs from its default now uses the same small accent-coloured text as "Edited", the label shown while a change is unsaved. Before, the Mission assumptions editor showed "Custom" in faint grey. The Rating bands editor already used the accent colour; it now also keeps the label from shrinking, as "Edited" does.

## D-127 · 2026-11-15 · Custom and edited fields highlighted in the assumptions contents
Status: confirmed (owner request, 2026-11-15)
Decision: in the Mission assumptions editor's contents column (D-123), a field entry is shown in the accent colour used for its "Custom" / "Edited" label (D-126) whenever its value differs from the saved value or from the default. It updates as you type, so the list shows at a glance which assumptions aren't defaults. The selected entry keeps its highlight background. Group headings are unchanged.

## D-128 · 2026-11-15 · "Add to comparison" opens a "Select Scenarios to Compare" step
Status: confirmed (owner request, 2026-11-15; changes D-066 entry and the Compare slot layout)
Decision:
- **Entry:** "Add to comparison" on the site details page no longer jumps to Compare. It opens the site selection page as a focused step: `/?s=<this site@time>&t=<time>&back=<this details URL>`. Scenario A is this site and landing time. Scenario B is active ("selecting now") and starts at the same landing time. Scenario C is an empty slot.
- **Header:** while `back` is in the URL on `/`, the header drops the page links (Select sites, Compare, Data & methods). The app title stays as plain text, not a link. The persona and theme toggles stay, because the persona toggle is on every page. Then, at the top right, come the heading "Select Scenarios to Compare" and a close (×). Closing returns to `back`.
- **Leaving:** × in the header, or × on the card being filled when at most one other scenario is left, returns to `back`. When the step was opened from inside the app, this is a history step back, so there is no duplicate entry. After a reload or from a shared link, it replaces the URL instead. In this step the scenario bar is always shown and the button always reads "Start comparison now" (never "Explore Site Details").
- **Fresh form:** opening or leaving the step resets the selection form (`flowKey` in `SiteSelection`), because Next keeps hidden pages' state (Activity), and B must never show an earlier pick. Browser back/forward still restores the form. New slots after B start at "now" as before (D-066).
- **Compare columns:** Compare shows one column per scenario, so 2 or 3 columns, instead of always 3 slots with empty "Add a site…" pickers. So that a third scenario can still be added, Compare gets "Add a scenario" (while fewer than 3), which opens the same step with `back` = this comparison. With no scenarios, Compare shows "Select scenarios", which opens the step.
- Helpers: `src/lib/compare-flow.ts` (entry URL, `back` validation, exit); header row in `src/components/HeaderBar.tsx`.

## D-129 · 2026-11-15 · Compare-step header: × at the left, title only
Status: confirmed (owner request, 2026-11-15; refines D-128)
Decision: in the "Select Scenarios to Compare" step, the header holds only the close (×) at the far left, followed by the heading "Select Scenarios to Compare". The app name, the persona toggle and the theme toggle are removed from the header in this state only. Every other page keeps the regular header. This is a deliberate exception to "persona toggle on every page" for this step; the persona chosen before entering still applies.
