# Data sources

Rule: every value shown in the app comes from a source listed here (and in `src/lib/sources.ts`, which
drives the tooltips and the Data & methods page), from an input the user sets, or is marked unavailable.
Add a source here and log it in `LOGS.md` before using it. All endpoints below were tested on 2026-11-14.

## In use

| Source | Exact product / endpoint | Used for |
|---|---|---|
| JPL Horizons API (DE441) | `ssd.jpl.nasa.gov/api/horizons.api`. Moon from 500@399 with QUANTITIES 14,15,19,20. Moon from DSN `-14@399`, `-43@399`, `-63@399` with QUANTITIES 4 | Hourly Moon-wide tables 2024–2032 (`public/data/ephemeris`) and live years via `/api/ephemeris/[year]`. All Sun/Earth geometry, libration, eclipses and DSN visibility |
| NASA Moon Trek WMTS | `trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_Shade_SPole{45_100mp,75_30mp,875_5mp}_v04`, `.../EQ/LRO_WAC_Mosaic_Global_303ppd_v02` | South-pole and whole-Moon basemaps (`src/lib/moon.ts`) |
| LRO LOLA GDR (PDS Geosciences) | `lola_gdr/polar/img/ldem_75s_120m.img` (7624², 120 m, int16 × 0.5 m), `lola_gdr/cylindrical/img/ldem_16.img` (16 ppd) | Horizon masks, slope, relief and elevation (`pipeline/build-terrain.ts`, `/api/terrain`) |
| LOLA average illumination (PDS extras; PGDA product 69 method) | `extras/illumination/img/avgvisib_75s_120m_201608{,_earth}.img` | Independent validation of our Sun and Earth visibility (`src/data/validation.json`) |
| LROC / LOLA PSR polygons | `LROLRC_2001/EXTRAS/BROWSE/NAC_POLE/NAC_POLE_PSR_SOUTH/NAC_POLE_PSR_SOUTH.ZIP` (653 polygons, ≥5 km²) | Distance to the nearest permanently shadowed region |
| LRO Diviner polar maps (Williams et al. 2019, UCLA) | `luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/additional_maps/polar_south_80_{summer_max,winter_min}-float.tif` | Measured seasonal temperature extremes poleward of 80°S |
| USGS Gazetteer of Planetary Nomenclature | `asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.zip` (9,087 features) | Landmarks, science targets, reference pins |
| LROC anthropogenic-objects catalogue (PDS) | `pds.lroc.im-ldi.com/.../LROLRC_2001/EXTRAS/...` shapefile | Positions of landers, impacts and Apollo LMs |
| DSN 810-005 | Module 301 Rev P, Table 5 (station coordinates); module 104 (34 m X-band gain, Tsys) | DSN availability, default G/T 55.0 dB/K |
| NSSDCA fact sheets | Moon, Sun, Earth | Physical constants |
| Cited literature | `data/source/references-research.json` (123 quoted values: Lunar Sourcebook, NASA DSNE, Hayne 2017, Schwadron 2012, NASA HRP, MEO, NASA 2011 heritage recommendations, VIPER NTRS) | Regolith, space-weather and heritage reference metrics; some assumption defaults |
| NASA CLPS / Artemis pages | nasa.gov, science.nasa.gov | Mission status and dates |
| LROC QuickMap | quickmap.lroc.asu.edu | Link-out only (no public tile service) |
| NASA SVS Moon Phase & Libration | svs.gsfc.nasa.gov | Educator explainer link |
| NAIF SPICE | naif.jpl.nasa.gov | Documented fallback; Horizons already serves DE441 |
| CSA Moon exploration | asc-csa.gc.ca | Partner context |

## Curated sites

`data/source/sites-research.json` holds 71 records, each with `sourceUrl` and `sourceQuote` copied from a
fetched source. `pipeline/build_sites.py` builds `src/data/sites.json`. Every listed site must have a cited
coordinate (LOGS D-038). The 6 records without one (Slater Plain, Chandrayaan-4, Luna 26/27, Argonaut,
Peregrine, Blue Ghost 4) go to `excluded` with a short reason, are shown only in the Data & methods
"Not listed" note, and come back automatically once a cited coordinate is added to the research file.

Known source caveats:
- **Artemis III pins** are the centres of LROC NAC mosaics for each candidate region, not official region
  centres (NASA publishes none). Mons Mouton and Nobile Rim 1 share one mosaic.
- **Moon Trek `A3_Named_regions`** is the superseded 13-region set from 2022.
- **Programme change:** in Feb 2026 NASA made Artemis III an Earth-orbit test flight. The first crewed landing is Artemis IV (2028).
- **Griffin-1 and VIPER targets** differ between older and newer NASA pages; the newest are used and the conflict is noted.

## Metrics catalog

[Draft 3 sheet](https://docs.google.com/spreadsheets/d/151XYyyy9HRlFYEFu9zvzud_sK3iOMXjHK_wNixa7Cr8/edit?gid=380290889):
196 metrics × 13 columns, snapshot in `data/source/metrics-draft3.csv`.
