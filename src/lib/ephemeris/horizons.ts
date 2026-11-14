/**
 * JPL Horizons API client for topocentric Sun/Earth positions as seen from a lunar surface site.
 * Docs: https://ssd-api.jpl.nasa.gov/doc/horizons.html
 *
 * Key facts (verified 2026-11-14, see LOGS D-004):
 *  - CENTER='coord@301' + COORD_TYPE='GEODETIC' + SITE_COORD='E-lon,lat,alt_km' gives a Moon-surface observer.
 *  - QUANTITIES='4' returns apparent azimuth/elevation. Elevation is relative to the *ideal* local
 *    horizontal plane (smooth sphere). It does NOT include terrain. Terrain blocking comes from the
 *    LOLA horizon mask (pipeline/compute_horizon_mask.py) and is applied on top.
 *  - Libration is inherent: Earth az/el from a fixed lunar site already moves with libration.
 *  - The API sends no CORS headers, so browsers must go through /api/horizons (or precomputed JSON).
 */

export const HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";

export const BODIES = { sun: "10", earth: "399" } as const;
export type Body = keyof typeof BODIES;

export type SiteCoord = {
  /** degrees, negative south */
  lat: number;
  /** degrees east, any range (normalised to [0, 360)) */
  lon: number;
  /** km above reference sphere */
  altKm: number;
};

export type AzElSample = {
  /** ISO 8601 UTC */
  t: string;
  /** degrees from north, clockwise */
  az: number;
  /** degrees above ideal horizontal (no terrain) */
  el: number;
};

const q = (v: string) => `'${v}'`;

export function buildHorizonsUrl(opts: {
  body: Body;
  site: SiteCoord;
  start: string; // "2026-12-01" or "2026-12-01 03:00"
  stop: string;
  step: string; // e.g. "1h", "10m", "1d"
}): string {
  const lonE = ((opts.site.lon % 360) + 360) % 360;
  const params = new URLSearchParams({
    format: "json",
    COMMAND: q(BODIES[opts.body]),
    OBJ_DATA: q("NO"),
    MAKE_EPHEM: q("YES"),
    EPHEM_TYPE: q("OBSERVER"),
    CENTER: q("coord@301"),
    COORD_TYPE: q("GEODETIC"),
    SITE_COORD: q(`${lonE},${opts.site.lat},${opts.site.altKm}`),
    START_TIME: q(opts.start),
    STOP_TIME: q(opts.stop),
    STEP_SIZE: q(opts.step),
    QUANTITIES: q("4"),
    ANG_FORMAT: q("DEG"),
    TIME_DIGITS: q("MINUTES"),
    CSV_FORMAT: q("NO"),
  });
  return `${HORIZONS_URL}?${params.toString()}`;
}

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/**
 * Parse the $$SOE..$$EOE block of a QUANTITIES='4' observer table.
 * Row example: " 2026-Dec-01 00:00 *i  136.439303  -2.009011"
 * (the optional solar-presence / interference flags between time and az are ignored).
 */
export function parseAzElTable(result: string): AzElSample[] {
  const start = result.indexOf("$$SOE");
  const end = result.indexOf("$$EOE");
  if (start < 0 || end < 0) {
    throw new Error("Horizons result has no $$SOE/$$EOE block: " + result.slice(0, 300));
  }
  const rows = result.slice(start + 5, end).trim().split("\n");
  const re = /^\s*(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?\s+(?:\S{1,2}\s+)?(-?\d+\.\d+)\s+(-?\d+\.\d+)\s*$/;
  return rows.map((line) => {
    const m = re.exec(line);
    if (!m) throw new Error(`Unparseable Horizons row: "${line}"`);
    const [, y, mon, d, hh, mm, ss, az, el] = m;
    const sec = ss ? ss.padStart(2, "0") : "00";
    return { t: `${y}-${MONTHS[mon]}-${d}T${hh}:${mm}:${sec}Z`, az: Number(az), el: Number(el) };
  });
}

/** Server-side fetch (route handler / pipeline). Throws on API-level errors. */
export async function fetchAzEl(opts: Parameters<typeof buildHorizonsUrl>[0]): Promise<AzElSample[]> {
  const res = await fetch(buildHorizonsUrl(opts));
  if (!res.ok) throw new Error(`Horizons HTTP ${res.status}`);
  const json = (await res.json()) as { result?: string; error?: string };
  if (json.error) throw new Error(`Horizons error: ${json.error}`);
  return parseAzElTable(json.result ?? "");
}
