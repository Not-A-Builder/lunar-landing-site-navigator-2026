# Lunar VISTA

**Visibility & Illumination Site Trade-off Analyzer.** NASA Space Apps Challenge 2026 entry for the
challenge [Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/).

Compare lunar landing sites and dates at a glance. See where the Sun and Earth sit against the real
terrain horizon, how long until sunset or Earthset, and what that means for solar power and
direct-to-Earth communication. One interface serves enthusiasts, educators and mission planners; a single
toggle changes how technical the information is.

All data comes from NASA and partner-agency sources:
- JPL Horizons (DE441)
- LRO LOLA, LROC and Diviner
- NASA Moon Trek
- the DSN handbook
- the USGS Gazetteer
- cited literature

Every value shows its provenance; see [docs/data-sources.md](docs/data-sources.md) and the in-app Data & methods page.

## Pages

- **Site selection** (`/`): south-pole map (or the whole Moon, flat or as a 3D globe), curated site lists,
  custom coordinates, landing date and time.
- **Site details** (`/site/<id>`): horizon view, Sun and Earth against the horizon, a 30-day timeline,
  libration and 13 metric categories.
- **Compare** (`/compare`): up to three site + date scenarios side by side.
- **History** (`/history`): site details and comparisons opened in this browser, with starring.
- **Data & methods** (`/sources`): how every number is fetched, computed and cited.

## Run

```bash
npm install
npm run dev          # http://localhost:1313
npm test
```

Precomputed data is committed: ephemeris 2024–2032, terrain for the 65 curated sites, and a compact NASA
terrain bundle (`data/deploy`, 127 MB) so custom coordinates work without extra downloads. Only rebuilding
terrain needs the full raw rasters: `npm run pipeline:raw` (~500 MB, see [pipeline/README.md](pipeline/README.md)).

## Repo guide

- [CLAUDE.md](CLAUDE.md): project rules, layout, commands
- [MEMORY.md](MEMORY.md): current status, open questions, next steps
- [LOGS.md](LOGS.md): decision log (why things are the way they are)
- [SOURCES.md](SOURCES.md): every data source, its link and what it is used for (generated)
- [docs/](docs/): challenge brief, data sources, architecture
- [pipeline/](pipeline/): scripts that turn NASA data into the site's data files
