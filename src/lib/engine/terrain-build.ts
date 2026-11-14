/**
 * Build a TerrainFile for any coordinate from LOLA DEMs plus optional context layers.
 * Server/pipeline only. Shared by pipeline/build-terrain.ts and /api/terrain.
 */
import { CONST } from "./constants";
import { DEG, bearing, greatCircleKm } from "./geometry";
import { computeHorizonMasks, gridAround, slopeAspect, type Dem } from "./terrain";
import type { TerrainFile } from "./terrain-file";

export type PsrPolygon = { id: string; ring: [number, number][]; bbox: [number, number, number, number] };
export type Feature = { name: string; type: string; lat: number; lon: number; diameterKm: number | null };
export type Sampler = (lat: number, lon: number) => number | null;

export type TerrainContext = {
  dems: Dem[]; // finest first
  psr?: PsrPolygon[];
  features?: Feature[];
  lolaSunVis?: Sampler;
  lolaEarthVis?: Sampler;
  divinerSummerMax?: Sampler;
  divinerWinterMin?: Sampler;
};

export const MASK_HEIGHTS_M = [0, 2, 5, 10, 20, 50];

/** polar stereographic x/y (m) for the south pole, x toward 90°E, y toward 0° */
export function toPolarXY(lat: number, lon: number): [number, number] {
  const rho = 2 * CONST.moonRadiusKm * 1000 * Math.tan(((90 + lat) / 2) * DEG);
  return [rho * Math.sin(lon * DEG), rho * Math.cos(lon * DEG)];
}

function pointInRing(x: number, y: number, ring: [number, number][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Nearest permanently shadowed region (edge distance; 0 if inside). Planar in polar stereographic. */
export function nearestPsr(psr: PsrPolygon[], lat: number, lon: number, maxKm = 60) {
  if (lat > -70) return null;
  const [x, y] = toPolarXY(lat, lon);
  const m = maxKm * 1000;
  let best: { d: number; px: number; py: number; id: string } | null = null;
  for (const p of psr) {
    const [x0, y0, x1, y1] = p.bbox;
    if (x < x0 - m || x > x1 + m || y < y0 - m || y > y1 + m) continue;
    if (pointInRing(x, y, p.ring)) return { nearestKm: 0, bearingDeg: 0, label: p.id };
    for (let i = 1; i < p.ring.length; i++) {
      const [ax, ay] = p.ring[i - 1], [bx, by] = p.ring[i];
      const d = distToSegment(x, y, ax, ay, bx, by);
      if (!best || d < best.d) {
        const dx = bx - ax, dy = by - ay;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
        best = { d, px: ax + t * dx, py: ay + t * dy, id: p.id };
      }
    }
  }
  if (!best || best.d > m) return null;
  // bearing: convert the nearest edge point back to lat/lon
  const rho = Math.hypot(best.px, best.py);
  const plat = -90 + (2 * Math.atan(rho / (2 * CONST.moonRadiusKm * 1000))) / DEG;
  const plon = Math.atan2(best.px, best.py) / DEG;
  return { nearestKm: best.d / 1000, bearingDeg: bearing(lat, lon, plat, plon), label: best.id };
}

export function buildTerrain(ctx: TerrainContext, lat: number, lon: number, opts: { maxKm?: number; gridHalfKm?: number; gridSpacingKm?: number } = {}): TerrainFile & {
  validation?: { lolaAnySunVis: number | null; lolaAnyEarthVis: number | null };
  diviner?: { summerMaxK: number | null; winterMinK: number | null };
} {
  const R = CONST.moonRadiusKm;
  const maxKm = opts.maxKm ?? 200;
  const finest = ctx.dems[0];
  const sample = (la: number, lo: number) => {
    for (const d of ctx.dems) {
      const v = d.sample(la, lo);
      if (v !== null) return v;
    }
    return null;
  };
  const demAtSite = ctx.dems.find((d) => d.sample(lat, lon) !== null);
  if (!demAtSite) throw new Error("No LOLA coverage at this location");

  const main = computeHorizonMasks(ctx.dems, lat, lon, MASK_HEIGHTS_M, { moonRadiusKm: R, stepDeg: 1, maxKm });
  const round = (a: number[], k = 3) => a.map((v) => +v.toFixed(k));

  const offsets = [0, 90, 180, 270].map((b) => {
    const p = gridAround(lat, lon, 1, 1, R).find((q) => Math.round(Math.atan2(q.dx, q.dy) / DEG + 360) % 360 === b && Math.hypot(q.dx, q.dy) === 1)!;
    const m = computeHorizonMasks(ctx.dems, p.lat, p.lon, [2], { moonRadiusKm: R, stepDeg: 1, maxKm });
    return { bearingDeg: b, km: 1, mask: round(m.masks[0]) };
  });

  const sa = slopeAspect(demAtSite, lat, lon, R);
  // local relief within 1 km and max drop within 500 m
  let hMin = Infinity, hMax = -Infinity, dropMin = Infinity;
  const ring = gridAround(lat, lon, Math.max(0.1, demAtSite.resolutionM / 1000), 1, R);
  for (const p of ring) {
    const h = sample(p.lat, p.lon);
    if (h === null) continue;
    hMin = Math.min(hMin, h);
    hMax = Math.max(hMax, h);
    if (Math.hypot(p.dx, p.dy) <= 0.5) dropMin = Math.min(dropMin, h);
  }

  const spacing = opts.gridSpacingKm ?? (demAtSite.resolutionM > 500 ? 5 : 1);
  const half = opts.gridHalfKm ?? spacing * 3;
  const gridPts = gridAround(lat, lon, spacing, half, R).map((p) => {
    const h = sample(p.lat, p.lon);
    const s = slopeAspect(demAtSite, p.lat, p.lon, R);
    let mask: number[] = [];
    try {
      mask = round(computeHorizonMasks(ctx.dems, p.lat, p.lon, [2], { moonRadiusKm: R, stepDeg: 2, maxKm: Math.min(maxKm, 150) }).masks[0], 2);
    } catch {
      mask = new Array(180).fill(0);
    }
    return { dx: p.dx, dy: p.dy, lat: +p.lat.toFixed(5), lon: +p.lon.toFixed(5), hM: h === null ? null : Math.round(h), slope: s ? +s.slope.toFixed(2) : null, mask };
  });

  const features = (ctx.features ?? [])
    .map((f) => ({ ...f, distKm: greatCircleKm(lat, lon, f.lat, f.lon, R) }))
    .filter((f) => f.distKm <= 150)
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, 12)
    .map((f) => ({ name: f.name, type: f.type, distKm: +f.distKm.toFixed(2), bearingDeg: +bearing(lat, lon, f.lat, f.lon).toFixed(1), diameterKm: f.diameterKm }));

  const psr = ctx.psr ? nearestPsr(ctx.psr, lat, lon) : null;

  return {
    version: 1,
    site: { lat, lon },
    dem: {
      id: demAtSite.id,
      resolutionM: demAtSite.resolutionM,
      label: `${demAtSite.id} (${demAtSite.resolutionM >= 1000 ? (demAtSite.resolutionM / 1000).toFixed(1) + " km" : Math.round(demAtSite.resolutionM) + " m"}/px)${ctx.dems.length > 1 && demAtSite === finest ? `, far terrain from ${ctx.dems[ctx.dems.length - 1].id}` : ""}`,
    },
    groundM: +main.groundM.toFixed(1),
    stepDeg: 1,
    heightsM: MASK_HEIGHTS_M,
    masks: main.masks.map((m) => round(m)),
    maskDistKm: round(main.distKm, 2),
    offsets,
    slope: sa ? { deg: +sa.slope.toFixed(2), aspectDeg: +sa.aspect.toFixed(1), baselineM: Math.round(sa.baselineM) } : null,
    reliefM: Number.isFinite(hMax) ? Math.round(hMax - hMin) : null,
    maxDropM: Number.isFinite(dropMin) ? Math.max(0, Math.round(main.groundM - dropMin)) : null,
    grid: { spacingKm: spacing, halfSizeKm: half, maskStepDeg: 2, observerHeightM: 2, points: gridPts },
    psr: psr ? { nearestKm: +psr.nearestKm.toFixed(2), bearingDeg: +psr.bearingDeg.toFixed(1), label: psr.label } : null,
    features,
    computedAt: new Date().toISOString(),
    maxRangeKm: maxKm,
    validation: ctx.lolaSunVis ? { lolaAnySunVis: ctx.lolaSunVis(lat, lon), lolaAnyEarthVis: ctx.lolaEarthVis?.(lat, lon) ?? null } : undefined,
    diviner: ctx.divinerSummerMax ? { summerMaxK: ctx.divinerSummerMax(lat, lon), winterMinK: ctx.divinerWinterMin?.(lat, lon) ?? null } : undefined,
  };
}
