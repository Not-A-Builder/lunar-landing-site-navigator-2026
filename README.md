# Lunar Landing Site Navigator

NASA Space Apps Challenge 2026 entry for
[Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/).

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

## Run

```bash
npm install
npm run dev:1313     # http://localhost:1313
npm test
```

Precomputed data (ephemeris, terrain for 65 curated sites) is committed. Rebuilding terrain or analysing
custom coordinates needs the raw rasters: `npm run pipeline:raw` (see [pipeline/README.md](pipeline/README.md)).

## Repo guide

- [CLAUDE.md](CLAUDE.md): project rules, layout, commands
- [MEMORY.md](MEMORY.md): current status, open questions, next steps
- [LOGS.md](LOGS.md): decision log (why things are the way they are)
- [SOURCES.md](SOURCES.md): every data source, its link and what it is used for (generated)
- [docs/](docs/): challenge brief, data sources, architecture
- [pipeline/](pipeline/): scripts that turn NASA data into the site's data files
