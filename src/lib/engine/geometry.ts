/**
 * Pure geometry used everywhere (browser, API routes, pipeline). No I/O.
 *
 * Validated 2026-11-14 against JPL Horizons topocentric output (LOGS D-016):
 * computing az/el from Horizons sub-solar / sub-Earth points + distances reproduces
 * Horizons' own topocentric az/el to within 0.0002°.
 */

export const DEG = Math.PI / 180;
export const AU_KM = 149_597_870.7; // IAU 2012 exact definition (also printed in every Horizons header)

export type Site = { lat: number; lon: number; /** km above the 1737.4 km reference sphere */ hKm: number };
export type SubPoint = { lat: number; lon: number; distKm: number };
export type AzEl = { az: number; el: number; distKm: number };

/** Topocentric azimuth (deg, from north, clockwise) and elevation (deg, vs smooth-sphere horizontal). */
export function topocentric(site: Site, body: SubPoint, moonRadiusKm: number): AzEl {
  const la = site.lat * DEG;
  const lo = site.lon * DEG;
  const r = moonRadiusKm + site.hKm;
  const cla = Math.cos(la), sla = Math.sin(la), clo = Math.cos(lo), slo = Math.sin(lo);
  const sx = r * cla * clo, sy = r * cla * slo, sz = r * sla;
  const bl = body.lat * DEG, bo = body.lon * DEG;
  const cbl = Math.cos(bl);
  const vx = body.distKm * cbl * Math.cos(bo) - sx;
  const vy = body.distKm * cbl * Math.sin(bo) - sy;
  const vz = body.distKm * Math.sin(bl) - sz;
  const n = Math.hypot(vx, vy, vz);
  const up = (vx * cla * clo + vy * cla * slo + vz * sla) / n;
  const east = -vx * slo + vy * clo;
  const north = -vx * sla * clo - vy * sla * slo + vz * cla;
  const az = (Math.atan2(east, north) / DEG + 360) % 360;
  return { az, el: Math.asin(Math.max(-1, Math.min(1, up))) / DEG, distKm: n };
}

/** Unit vector for az/el (local ENU). */
export function enu(az: number, el: number): [number, number, number] {
  const a = az * DEG, e = el * DEG;
  return [Math.cos(e) * Math.sin(a), Math.cos(e) * Math.cos(a), Math.sin(e)];
}

/** Angular separation between two az/el directions, degrees. */
export function separation(a: { az: number; el: number }, b: { az: number; el: number }): number {
  const u = enu(a.az, a.el), v = enu(b.az, b.el);
  const d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  return Math.acos(Math.max(-1, Math.min(1, d))) / DEG;
}

/** Angular radius (deg) of a sphere of radius R at distance d. */
export function angularRadius(radiusKm: number, distKm: number): number {
  return Math.asin(Math.min(1, radiusKm / distKm)) / DEG;
}

/**
 * Fraction (0–1) of a disk of angular radius r whose centre sits at elevation `el`
 * that is above a locally flat horizon at elevation `h` (circular-segment area).
 * This is the solar visible-disk coefficient f(t) of Liu et al. (2023).
 */
export function diskAboveHorizon(el: number, r: number, h: number): number {
  const y = el - h;
  if (y >= r) return 1;
  if (y <= -r) return 0;
  const d = Math.abs(y) / r;
  const segment = (Math.acos(d) - d * Math.sqrt(1 - d * d)) / Math.PI; // fraction on the far side of the chord
  return y >= 0 ? 1 - segment : segment;
}

/** Fraction of disk 1 (radius r1) covered by disk 2 (radius r2) at centre separation s (all deg, small-angle). */
export function diskOverlapFraction(r1: number, r2: number, s: number): number {
  if (s >= r1 + r2) return 0;
  if (s <= Math.abs(r2 - r1)) return r2 >= r1 ? 1 : (r2 * r2) / (r1 * r1);
  const a1 = r1 * r1 * Math.acos((s * s + r1 * r1 - r2 * r2) / (2 * s * r1));
  const a2 = r2 * r2 * Math.acos((s * s + r2 * r2 - r1 * r1) / (2 * s * r2));
  const k = 0.5 * Math.sqrt((-s + r1 + r2) * (s + r1 - r2) * (s - r1 + r2) * (s + r1 + r2));
  return (a1 + a2 - k) / (Math.PI * r1 * r1);
}

/** Great-circle distance on a sphere, km. */
export function greatCircleKm(lat1: number, lon1: number, lat2: number, lon2: number, radiusKm: number): number {
  const p1 = lat1 * DEG, p2 = lat2 * DEG, dl = (lon2 - lon1) * DEG;
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from point 1 to point 2, degrees from north. */
export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * DEG, p2 = lat2 * DEG, dl = (lon2 - lon1) * DEG;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

/** Destination point given start, bearing (deg) and distance (km) on a sphere. */
export function destination(lat: number, lon: number, brgDeg: number, distKm: number, radiusKm: number) {
  const d = distKm / radiusKm, b = brgDeg * DEG, p1 = lat * DEG, l1 = lon * DEG;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { lat: p2 / DEG, lon: ((((l2 / DEG) + 540) % 360) - 180) };
}
