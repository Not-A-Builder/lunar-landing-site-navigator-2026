export function fmtHours(h: number | null | undefined): string {
  if (h === null || h === undefined || !Number.isFinite(h)) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0)}h`;
  const d = Math.floor(h / 24);
  const r = Math.round(h - d * 24);
  // no space between the number and d / h (D-085): "6d 14h"
  return r === 24 ? `${d + 1}d` : r ? `${d}d ${r}h` : `${d}d`;
}

export const fmtPct = (x: number | null | undefined, digits = 0) =>
  x === null || x === undefined || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(digits)}%`;

export const fmtDeg = (x: number | null | undefined, digits = 2) =>
  x === null || x === undefined || !Number.isFinite(x) ? "—" : `${x.toFixed(digits)}°`;

export const fmtNum = (x: number | null | undefined, digits = 1, unit = "") =>
  x === null || x === undefined || !Number.isFinite(x) ? "—" : `${x.toFixed(digits)}${unit ? " " + unit : ""}`;

/**
 * Height relative to the LOLA reference sphere, worded by sign so negatives never read as "−1922 m above":
 * 312 → "312 m above", −1922 → "1,922 m below", 0 → "0 m, level with". Caller appends the datum name.
 */
export function fmtElevation(m: number | null | undefined): string {
  if (m === null || m === undefined || !Number.isFinite(m)) return "—";
  const r = Math.round(m);
  const abs = Math.abs(r).toLocaleString("en-US");
  return r > 0 ? `${abs} m above` : r < 0 ? `${abs} m below` : "0 m, level with";
}

export function fmtUTC(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  return new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export function compass(az: number): string {
  const names = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return names[Math.round((((az % 360) + 360) % 360) / 22.5) % 16];
}

export function fmtLat(lat: number) {
  return `${Math.abs(lat).toFixed(4)}°${lat < 0 ? "S" : "N"}`;
}
export function fmtLon(lon: number) {
  return `${Math.abs(lon).toFixed(4)}°${lon < 0 ? "W" : "E"}`;
}
