/** Shape of the per-site terrain file produced by pipeline/build-terrain.ts and /api/terrain. */
import type { HorizonMask } from "./terrain";

export type GridPoint = {
  dx: number; // km east of site
  dy: number; // km north of site
  lat: number;
  lon: number;
  hM: number | null;
  slope: number | null;
  /** horizon elevation per `grid.maskStepDeg` bin at `grid.observerHeightM` */
  mask: number[];
};

export type TerrainFile = {
  version: 1;
  site: { lat: number; lon: number };
  dem: { id: string; resolutionM: number; label: string };
  groundM: number;
  stepDeg: number;
  /** observer heights (m above ground) for which full masks exist */
  heightsM: number[];
  masks: number[][];
  /** distance (km) to the horizon-setting terrain for the heightsM[0] mask */
  maskDistKm: number[];
  /** masks at 1 km offsets (observer 2 m) for position sensitivity */
  offsets: { bearingDeg: number; km: number; mask: number[] }[];
  slope: { deg: number; aspectDeg: number; baselineM: number } | null;
  reliefM: number | null;
  maxDropM: number | null;
  grid: { spacingKm: number; halfSizeKm: number; maskStepDeg: number; observerHeightM: number; points: GridPoint[] };
  psr: { nearestKm: number; bearingDeg: number; label: string } | null;
  features: { name: string; type: string; distKm: number; bearingDeg: number; diameterKm: number | null }[];
  computedAt: string;
  maxRangeKm: number;
  /** independent check: LOLA team average visibility maps (Mazarico et al. 2011 method), any part of disk, ground level */
  validation?: { lolaAnySunVis: number | null; lolaAnyEarthVis: number | null; oursAnySunVis?: number; oursAnyEarthVis?: number; window?: string };
  /** LRO Diviner measured seasonal extremes (Williams et al. 2019 polar maps), poleward of 80°S */
  diviner?: { summerMaxK: number | null; winterMinK: number | null };
};

/** Horizon mask for an arbitrary observer height, interpolating between precomputed heights. */
export function maskForHeight(t: TerrainFile, heightM: number): HorizonMask {
  const hs = t.heightsM;
  let i = hs.findIndex((h) => h >= heightM);
  if (i === -1) i = hs.length - 1;
  if (i === 0 || hs[i] === heightM) return { stepDeg: t.stepDeg, elev: t.masks[i], distKm: t.maskDistKm };
  const f = (heightM - hs[i - 1]) / (hs[i] - hs[i - 1]);
  const a = t.masks[i - 1], b = t.masks[i];
  return { stepDeg: t.stepDeg, elev: a.map((v, k) => v + (b[k] - v) * f), distKm: t.maskDistKm };
}

export function asMask(elev: number[], stepDeg: number): HorizonMask {
  return { stepDeg, elev, distKm: [] };
}
