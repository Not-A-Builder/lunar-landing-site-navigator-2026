# Data pipeline

Offline scripts that turn NASA data into the files the website reads. The website never invents numbers:
it shows what these produce (plus live JPL Horizons for years outside 2024–2032).

| Step | Script | Input | Output |
|---|---|---|---|
| 1 | `npm run catalog` (`build_metrics_catalog.py`) | Draft 3 sheet snapshot `data/source/metrics-draft3.csv` | `src/data/metrics-catalog.json` |
| 2 | `npm run pipeline:sites` (`build_sites.py`) | `data/source/sites-research.json` (LROC/USGS/NASA, quoted) | `src/data/sites.json` |
| 3 | `npm run pipeline:ephemeris` (`fetch-ephemeris.ts`) | JPL Horizons API | `public/data/ephemeris/<year>.bin` + `index.json` |
| 4 | `npm run pipeline:raw` (`download-raw.sh`) | PDS LOLA DEMs + illumination maps, LROC PSR, USGS gazetteer, Diviner | `data/raw/` (git-ignored, ~500 MB) |
| 5 | `npm run pipeline:terrain` (`build-terrain.ts`) | steps 2–4 | `public/data/terrain/<site>.json`, `peers.json`, `src/data/validation.json`, `src/data/source-usage.json`, then regenerates `SOURCES.md` |
| 6 | `npm run pipeline:deploy` (`build-deploy-bundle.ts`) | step 4 | `data/deploy/` (127 MB, committed): brotli DEMs, PSR polygons, gazetteer, Diviner, shipped with `/api/terrain` |

TypeScript steps run with `tsx` and reuse `src/lib/engine` (the same code the browser and API use).
Python steps use only the standard library. Reference values (`src/data/references.json`) are a snapshot of
`data/source/references-research.json`; every entry quotes its source document.
