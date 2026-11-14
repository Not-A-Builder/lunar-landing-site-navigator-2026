/**
 * A scenario = one site + one landing time + assumptions. Builds every time series and interval
 * that the metrics and charts need.
 */
import type { Assumptions } from "@/lib/assumptions";
import { CONST } from "./constants";
import { EphemerisSet } from "./ephemeris";
import type { Site } from "./geometry";
import { computeSeries, type Series } from "./series";
import { asMask, maskForHeight, type TerrainFile } from "./terrain-file";
import type { HorizonMask } from "./terrain";
import { complement, intersect, intervalsFromMargin, type Interval } from "./windows";

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;

export type Windows = {
  sunlit: Interval[];
  dark: Interval[];
  dte: Interval[];
  noDte: Interval[];
  dsn: Interval[];
  dteDsn: Interval[];
  joint: Interval[];
  jointGap: Interval[];
  eclipse: Interval[];
};

export type Scenario = {
  site: Site;
  start: number;
  end: number;
  mask: HorizonMask;
  series: Series;
  windows: Windows;
  assumptions: Assumptions;
};

export function windowsFor(s: Series, a: Assumptions, from: number, to: number): Windows {
  const sunlit = intervalsFromMargin(s.t, (i) => s.sunFrac[i] - a.sunDiskThreshold + 1e-9);
  const dte = intervalsFromMargin(s.t, (i) => s.earthFrac[i] - a.earthDiskThreshold + 1e-9);
  const dsn = intervalsFromMargin(s.t, (i) => s.dsnCount[i] - 0.5);
  const dteDsn = intersect(dte, dsn);
  const joint = intersect(sunlit, dte);
  const eclipse = intervalsFromMargin(s.t, (i) => s.eclipse[i] - 1e-6);
  return {
    sunlit, dark: complement(sunlit, from, to), dte, noDte: complement(dte, from, to),
    dsn, dteDsn, joint, jointGap: complement(joint, from, to), eclipse,
  };
}

export function buildScenario(opts: {
  eph: EphemerisSet;
  terrain: TerrainFile;
  landingMs: number;
  assumptions: Assumptions;
  stepMs?: number;
  heightOverrideM?: number;
  maskOverride?: HorizonMask;
}): Scenario {
  const a = opts.assumptions;
  const t = opts.terrain;
  const mask = opts.maskOverride ?? maskForHeight(t, opts.heightOverrideM ?? a.mastHeightM);
  const site: Site = { lat: t.site.lat, lon: t.site.lon, hKm: (t.groundM + (opts.heightOverrideM ?? a.mastHeightM)) / 1000 };
  const start = opts.landingMs;
  const end = start + a.missionDays * DAY_MS;
  const series = computeSeries(opts.eph, site, mask, start, end, opts.stepMs ?? 10 * 60_000, { dsnMinEl: a.dsnMinElevDeg });
  return { site, start, end, mask, series, windows: windowsFor(series, a, start, end), assumptions: a };
}

/** Lightweight long-window series (e.g. multi-year) for one mask. */
export function longSeries(eph: EphemerisSet, terrain: TerrainFile, mask: HorizonMask, from: number, to: number, stepMs: number, a: Assumptions) {
  const site: Site = { lat: terrain.site.lat, lon: terrain.site.lon, hKm: terrain.groundM / 1000 };
  return computeSeries(eph, site, mask, from, to, stepMs, { dsnMinEl: a.dsnMinElevDeg });
}

export function gridMask(terrain: TerrainFile, k: number) {
  return asMask(terrain.grid.points[k].mask, terrain.grid.maskStepDeg);
}

export { CONST };
