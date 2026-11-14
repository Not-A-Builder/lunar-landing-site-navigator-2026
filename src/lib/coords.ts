/**
 * Parse user-entered lunar coordinates. Accepts decimal degrees with optional hemisphere letters,
 * signed values, degree signs, and east longitudes in 0–360. Returns planetocentric lat and
 * east-positive lon in [-180, 180], or an error message.
 */
export type ParsedCoord = { ok: true; lat: number; lon: number } | { ok: false; error: string };

function parseOne(raw: string, pos: string, neg: string): number | null {
  const s = raw.trim().toUpperCase().replace(/°/g, "").replace(/\s+/g, "");
  if (!s) return null;
  const m = s.match(/^([+-]?\d+(?:\.\d+)?)([NSEW])?$/);
  if (!m) return null;
  let v = Number(m[1]);
  if (m[2] === neg) v = -Math.abs(v);
  else if (m[2] === pos) v = Math.abs(v);
  else if (m[2]) return null;
  return v;
}

export function parseLatLon(latStr: string, lonStr: string): ParsedCoord {
  const lat = parseOne(latStr, "N", "S");
  const lon = parseOne(lonStr, "E", "W");
  if (lat === null) return { ok: false, error: "Latitude: use a number like -85.2 or 85.2S." };
  if (lon === null) return { ok: false, error: "Longitude: use a number like 30.1, 30.1E, 329.9 or 30.1W." };
  if (lat < -90 || lat > 90) return { ok: false, error: "Latitude must be between 90°S and 90°N." };
  if (lon < -180 || lon > 360) return { ok: false, error: "Longitude must be between 180°W and 360°E." };
  const lonE = ((lon + 540) % 360) - 180;
  return { ok: true, lat: +lat.toFixed(5), lon: +lonE.toFixed(5) };
}

/** Parse a single "lat, lon" string such as "85.2S 30.1E" or "-85.2, 30.1". */
export function parseCoordString(s: string): ParsedCoord {
  const parts = s.trim().split(/[,\s;]+/).filter(Boolean);
  if (parts.length !== 2) return { ok: false, error: "Enter latitude and longitude, e.g. 85.2S 30.1E or -85.2, 30.1." };
  return parseLatLon(parts[0], parts[1]);
}

export const customSiteId = (lat: number, lon: number) => `custom:${lat},${lon}`;
