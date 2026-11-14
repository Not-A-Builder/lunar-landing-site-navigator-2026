/**
 * Terrain: DEM sampling, horizon masks (ray-march with lunar curvature, no refraction) and slope stats.
 * Used by the pipeline (curated sites) and /api/terrain (custom sites).
 */
import { DEG, bearing, destination } from "./geometry";

/** Anything that can return height (m above the reference sphere) at a lat/lon, or null if off-grid. */
export interface Dem {
  id: string;
  /** metres per pixel */
  resolutionM: number;
  sample(lat: number, lon: number): number | null;
}

export type HorizonMask = {
  stepDeg: number;
  /** horizon elevation (deg) per azimuth bin, starting at az 0 (north), clockwise */
  elev: number[];
  /** distance (km) to the point that sets the horizon in each bin */
  distKm: number[];
};

export type MaskOptions = {
  moonRadiusKm: number;
  stepDeg?: number;
  maxKm?: number;
  /** observer height above local ground (m), e.g. camera/antenna/array mast */
  observerHeightM?: number;
};

/** Horizon elevation at an arbitrary azimuth (linear interpolation, wraps at 360). */
export function horizonAt(mask: HorizonMask, az: number): number {
  const n = mask.elev.length;
  const x = (((az % 360) + 360) % 360) / mask.stepDeg;
  const i = Math.floor(x) % n;
  const f = x - Math.floor(x);
  return mask.elev[i] + (mask.elev[(i + 1) % n] - mask.elev[i]) * f;
}

/**
 * Compute a 360° horizon mask. For each azimuth, march outward along the great circle and take the
 * maximum elevation angle of terrain above the observer's tangent plane:
 *   angle = atan2(rT·cosθ − rO, rT·sinθ),  θ = d / R
 * which includes the drop-off of a spherical Moon. Step size grows with distance.
 */
export function computeHorizonMask(dems: Dem[], lat: number, lon: number, opts: MaskOptions): HorizonMask & { groundM: number } {
  const R = opts.moonRadiusKm * 1000;
  const step = opts.stepDeg ?? 1;
  const maxM = (opts.maxKm ?? 200) * 1000;
  const sample = (la: number, lo: number) => {
    for (const d of dems) {
      const v = d.sample(la, lo);
      if (v !== null) return v;
    }
    return null;
  };
  const ground = sample(lat, lon);
  if (ground === null) throw new Error(`No DEM coverage at ${lat}, ${lon}`);
  const rO = R + ground + (opts.observerHeightM ?? 0);
  const finest = Math.min(...dems.map((d) => d.resolutionM));
  const n = Math.round(360 / step);
  const elev = new Array<number>(n);
  const distKm = new Array<number>(n);

  for (let k = 0; k < n; k++) {
    const az = k * step;
    let best = -90, bestD = 0;
    let d = finest;
    while (d <= maxM) {
      const p = destination(lat, lon, az, d / 1000, R / 1000);
      const h = sample(p.lat, p.lon);
      if (h !== null) {
        const th = d / R;
        const rT = R + h;
        const ang = Math.atan2(rT * Math.cos(th) - rO, rT * Math.sin(th)) / DEG;
        if (ang > best) {
          best = ang;
          bestD = d;
        }
      }
      d += Math.max(finest, d * 0.004);
    }
    elev[k] = best;
    distKm[k] = bestD / 1000;
  }
  return { stepDeg: step, elev, distKm, groundM: ground };
}

/**
 * Same ray-march as computeHorizonMask, but for several observer heights in one pass over the DEM
 * (sampling dominates the cost, so this is ~heights× faster than separate calls).
 */
export function computeHorizonMasks(
  dems: Dem[],
  lat: number,
  lon: number,
  heightsM: number[],
  opts: Omit<MaskOptions, "observerHeightM">,
): { masks: number[][]; distKm: number[]; groundM: number; stepDeg: number } {
  const R = opts.moonRadiusKm * 1000;
  const step = opts.stepDeg ?? 1;
  const maxM = (opts.maxKm ?? 200) * 1000;
  const sample = (la: number, lo: number) => {
    for (const d of dems) {
      const v = d.sample(la, lo);
      if (v !== null) return v;
    }
    return null;
  };
  const ground = sample(lat, lon);
  if (ground === null) throw new Error(`No DEM coverage at ${lat}, ${lon}`);
  const rOs = heightsM.map((h) => R + ground + h);
  const finest = Math.min(...dems.map((d) => d.resolutionM));
  const n = Math.round(360 / step);
  const masks = heightsM.map(() => new Array<number>(n).fill(-90));
  const distKm = new Array<number>(n).fill(0);
  for (let k = 0; k < n; k++) {
    const az = k * step;
    let d = finest;
    while (d <= maxM) {
      const p = destination(lat, lon, az, d / 1000, R / 1000);
      const h = sample(p.lat, p.lon);
      if (h !== null) {
        const th = d / R, rT = R + h, c = rT * Math.cos(th), sn = rT * Math.sin(th);
        for (let j = 0; j < rOs.length; j++) {
          const ang = Math.atan2(c - rOs[j], sn) / DEG;
          if (ang > masks[j][k]) {
            masks[j][k] = ang;
            if (j === 0) distKm[k] = d / 1000;
          }
        }
      }
      d += Math.max(finest, d * 0.004);
    }
  }
  return { masks, distKm, groundM: ground, stepDeg: step };
}

/** Slope (deg) and aspect (deg from north, direction the slope faces downhill) from a 3x3 stencil. */
export function slopeAspect(dem: Dem, lat: number, lon: number, moonRadiusKm: number, baselineM?: number) {
  const b = baselineM ?? dem.resolutionM;
  const R = moonRadiusKm;
  const at = (brg: number) => {
    const p = destination(lat, lon, brg, b / 1000, R);
    return dem.sample(p.lat, p.lon);
  };
  const n = at(0), s = at(180), e = at(90), w = at(270);
  if (n === null || s === null || e === null || w === null) return null;
  const dzdn = (n - s) / (2 * b);
  const dzde = (e - w) / (2 * b);
  const slope = Math.atan(Math.hypot(dzdn, dzde)) / DEG;
  const aspect = (Math.atan2(-dzde, -dzdn) / DEG + 360) % 360; // downhill direction
  return { slope, aspect, baselineM: b };
}

/** Sample points on a square grid (spacing km, half-size km) around a site, as lat/lon. */
export function gridAround(lat: number, lon: number, spacingKm: number, halfSizeKm: number, moonRadiusKm: number) {
  const pts: { lat: number; lon: number; dx: number; dy: number }[] = [];
  const m = Math.round(halfSizeKm / spacingKm);
  for (let iy = -m; iy <= m; iy++) {
    for (let ix = -m; ix <= m; ix++) {
      const dx = ix * spacingKm, dy = iy * spacingKm;
      const dist = Math.hypot(dx, dy);
      if (dist === 0) {
        pts.push({ lat, lon, dx, dy });
        continue;
      }
      const brg = (Math.atan2(dx, dy) / DEG + 360) % 360;
      const p = destination(lat, lon, brg, dist, moonRadiusKm);
      pts.push({ ...p, dx, dy });
    }
  }
  return pts;
}

export { bearing };
