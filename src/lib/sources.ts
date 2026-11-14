/**
 * Data-source registry. Every metric, panel and map layer cites source ids from here; the
 * tooltip and the Data & methods page render from this list, so provenance is visible everywhere.
 * Add a source here AND log it in LOGS.md before using it.
 */
export type SourceId =
  | "jpl-horizons"
  | "trek-wmts"
  | "quickmap"
  | "lola-pds"
  | "pgda"
  | "nssdc-moon"
  | "nssdc-sun"
  | "nssdc-earth"
  | "dsn-810-005"
  | "usgs-gazetteer"
  | "diviner"
  | "psr-atlas"
  | "svs-libration"
  | "naif-spice"
  | "nasa-clps"
  | "nasa-artemis"
  | "lroc-sites"
  | "csa-moon"
  | "metrics-sheet"
  | "bryant-2009"
  | "liu-2023"
  | "reference-literature"
  | "mission-assumption";

export type Source = {
  id: SourceId;
  name: string;
  provider: string;
  url: string;
  /** what this project uses it for, shown on the Data & methods page */
  use: string;
};

export const SOURCES: Record<SourceId, Source> = {
  "jpl-horizons": {
    id: "jpl-horizons", name: "JPL Horizons System (API), DE441 ephemeris", provider: "NASA JPL",
    url: "https://ssd-api.jpl.nasa.gov/doc/horizons.html",
    use: "Hourly sub-solar point, sub-Earth point (libration) and distances for the whole Moon, 2024–2032; Moon elevation at DSN complexes. All Sun/Earth angles at every site come from these tables.",
  },
  "trek-wmts": {
    id: "trek-wmts", name: "Moon Trek map tiles (LRO LOLA / LROC WAC)", provider: "NASA JPL / Solar System Treks",
    url: "https://trek.nasa.gov/moon/",
    use: "South-pole and global basemap tiles.",
  },
  quickmap: {
    id: "quickmap", name: "LROC QuickMap", provider: "NASA LRO / Arizona State University",
    url: "https://quickmap.lroc.asu.edu/",
    use: "Cross-checking landing-site positions, terrain and imagery; link-outs from every site.",
  },
  "lola-pds": {
    id: "lola-pds", name: "LRO LOLA gridded elevation (PDS Geosciences Node)", provider: "NASA LRO / PDS",
    url: "https://pds-geosciences.wustl.edu/missions/lro/lola.htm",
    use: "Terrain heights for horizon masks, slopes, relief and site elevation.",
  },
  pgda: {
    id: "pgda", name: "NASA GSFC Planetary Geodesy Data Archive", provider: "NASA GSFC",
    url: "https://pgda.gsfc.nasa.gov/",
    use: "High-resolution LOLA polar products and illumination references for validation.",
  },
  "nssdc-moon": {
    id: "nssdc-moon", name: "NSSDCA Moon Fact Sheet", provider: "NASA GSFC",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html",
    use: "Physical constants: gravity, albedo, solar irradiance.",
  },
  "nssdc-sun": {
    id: "nssdc-sun", name: "NSSDCA Sun Fact Sheet", provider: "NASA GSFC",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html",
    use: "Solar radius (apparent size of the Sun's disk).",
  },
  "nssdc-earth": {
    id: "nssdc-earth", name: "NSSDCA Earth Fact Sheet", provider: "NASA GSFC",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html",
    use: "Earth radius (apparent size of Earth's disk seen from the Moon).",
  },
  "dsn-810-005": {
    id: "dsn-810-005", name: "DSN Telecommunications Link Design Handbook (810-005)", provider: "NASA JPL DSN",
    url: "https://deepspace.jpl.nasa.gov/dsndocs/810-005/",
    use: "DSN complex locations and antenna performance for ground-station visibility and link estimates.",
  },
  "usgs-gazetteer": {
    id: "usgs-gazetteer", name: "Gazetteer of Planetary Nomenclature", provider: "IAU / USGS (NASA-funded)",
    url: "https://planetarynames.wr.usgs.gov/",
    use: "Named craters and mountains: search, landmark distances, reference pins.",
  },
  diviner: {
    id: "diviner", name: "LRO Diviner Lunar Radiometer", provider: "NASA LRO / UCLA",
    url: "https://www.diviner.ucla.edu/",
    use: "Measured surface temperatures and thermal properties.",
  },
  "psr-atlas": {
    id: "psr-atlas", name: "Permanently shadowed regions (LOLA/LROC)", provider: "NASA LRO",
    url: "https://www.lroc.asu.edu/atlases/psr",
    use: "Location of permanently shadowed regions (cold traps) near each site.",
  },
  "svs-libration": {
    id: "svs-libration", name: "NASA SVS: Moon Phase and Libration", provider: "NASA GSFC Scientific Visualization Studio",
    url: "https://svs.gsfc.nasa.gov/gallery/moonphase/",
    use: "Educator explainer for libration (our libration numbers come from Horizons).",
  },
  "naif-spice": {
    id: "naif-spice", name: "NAIF SPICE toolkit and kernels", provider: "NASA JPL NAIF",
    url: "https://naif.jpl.nasa.gov/",
    use: "Reference for frames and ephemerides; Horizons serves the same DE441 data, so SPICE is the documented fallback.",
  },
  "nasa-clps": {
    id: "nasa-clps", name: "NASA Commercial Lunar Payload Services", provider: "NASA",
    url: "https://www.nasa.gov/commercial-lunar-payload-services/",
    use: "CLPS mission list, targets and dates.",
  },
  "nasa-artemis": {
    id: "nasa-artemis", name: "NASA Artemis candidate landing regions", provider: "NASA",
    url: "https://www.nasa.gov/artemis/",
    use: "The nine south-pole candidate landing regions NASA announced in Oct 2024 (then for Artemis III; the first crewed landing is now planned as Artemis IV).",
  },
  "lroc-sites": {
    id: "lroc-sites", name: "LROC landing-site imaging", provider: "NASA LRO / ASU",
    url: "https://www.lroc.asu.edu/",
    use: "Measured positions of landers seen in LRO images.",
  },
  "csa-moon": {
    id: "csa-moon", name: "CSA Moon exploration", provider: "Canadian Space Agency",
    url: "https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/",
    use: "Partner-agency context for educators and the public.",
  },
  "metrics-sheet": {
    id: "metrics-sheet", name: "Project metrics catalog (Draft 3)", provider: "This project",
    url: "https://docs.google.com/spreadsheets/d/151XYyyy9HRlFYEFu9zvzud_sK3iOMXjHK_wNixa7Cr8/edit?gid=380290889",
    use: "Definitions, units and persona wording for all 196 metrics.",
  },
  "bryant-2009": {
    id: "bryant-2009", name: "Bryant (2009), IPN Progress Report 42-176", provider: "NASA JPL",
    url: "https://ipnpr.jpl.nasa.gov/progress_report/42-176/176C.pdf",
    use: "Method: Sun/Earth visibility at the lunar poles, disk thresholds, tower-height effects.",
  },
  "liu-2023": {
    id: "liu-2023", name: "Liu et al. (2023), south-polar landing area selection", provider: "Journal of Deep Space Exploration",
    url: "https://doi.org/10.15982/j.issn.2096-9287.2023.20220091",
    use: "Method: visible solar-disk coefficient f(t), illumination + slope qualifying areas.",
  },
  "reference-literature": {
    id: "reference-literature", name: "Cited lunar reference values", provider: "NASA / peer-reviewed",
    url: "/sources#reference-values",
    use: "Global (not site-specific) reference values; each cites its own document.",
  },
  "mission-assumption": {
    id: "mission-assumption", name: "Mission assumptions (editable)", provider: "You",
    url: "/sources#assumptions",
    use: "Vehicle and mission inputs (array size, battery, thresholds). Defaults are examples; change them in the planner panel.",
  },
};

export const sourceList = Object.values(SOURCES);
