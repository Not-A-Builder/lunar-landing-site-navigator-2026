/**
 * Heavier analyses built on the scenario: multi-year statistics, landing-date risk percentiles,
 * candidate-area grid statistics, sensitivity runs, power and link models.
 * All run in the browser in well under a second for one site.
 */
import type { Assumptions } from "@/lib/assumptions";
import { CONST } from "./constants";
import { EphemerisSet } from "./ephemeris";
import { DEG, angularRadius, diskAboveHorizon, topocentric } from "./geometry";
import { buildScenario, DAY_MS, gridMask, HOUR_MS, longSeries, type Scenario } from "./scenario";
import type { Series } from "./series";
import { asMask, maskForHeight, type TerrainFile } from "./terrain-file";
import { horizonAt, type HorizonMask } from "./terrain";
import { complement, intervalsFromMargin, longestMs, totalMs, type Interval } from "./windows";

export const SYNODIC_MS = 29.530589 * DAY_MS;

/* ---------------- multi-year ---------------- */

export type MultiYear = {
  from: number;
  to: number;
  stepH: number;
  meanDiskFrac: number;
  sunlitFrac: number;
  longestDarkH: number;
  dte0: number; // any part of Earth's disk visible
  dte50: number;
  dte100: number;
  dteSelected: number;
  months: { start: number; sunlitFrac: number; longestDarkH: number; meanSunLat: number }[];
  continuousSolarMonthsPerYear: number;
  winter: { start: number; darkDays: number; longestDarkDays: number } | null;
  sunLatRange: [number, number];
  uniformSunlitFrac: number;
  uniformDteFrac: number;
  sunOccupancy: { azBin: number; elBin: number; hours: number }[];
  earthOccupancy: { azBin: number; elBin: number; hours: number }[];
  libLonRange: [number, number];
  libLatRange: [number, number];
};

function occupancy(s: Series, az: Float32Array, el: Float32Array, azStep: number, elStep: number) {
  const m = new Map<string, number>();
  const h = s.stepMs / HOUR_MS;
  for (let i = 0; i < s.n; i++) {
    const a = Math.floor(az[i] / azStep) * azStep;
    const e = Math.floor(el[i] / elStep) * elStep;
    const k = `${a}|${e}`;
    m.set(k, (m.get(k) ?? 0) + h);
  }
  return [...m.entries()].map(([k, hours]) => {
    const [azBin, elBin] = k.split("|").map(Number);
    return { azBin, elBin, hours };
  });
}

export function multiYear(eph: EphemerisSet, terrain: TerrainFile, mask: HorizonMask, a: Assumptions, from: number, to: number): MultiYear {
  const stepMs = 2 * HOUR_MS;
  const s = longSeries(eph, terrain, mask, from, to, stepMs, a);
  const n = s.n;
  let disk = 0, lit = 0, d0 = 0, d50 = 0, d100 = 0, dsel = 0;
  for (let i = 0; i < n; i++) {
    disk += s.sunFrac[i];
    if (s.sunFrac[i] >= a.sunDiskThreshold) lit++;
    if (s.earthFrac[i] > 0) d0++;
    if (s.earthFrac[i] >= 0.5) d50++;
    if (s.earthFrac[i] >= 0.999) d100++;
    if (s.earthFrac[i] >= a.earthDiskThreshold) dsel++;
  }
  const sunlit = intervalsFromMargin(s.t, (i) => s.sunFrac[i] - a.sunDiskThreshold + 1e-9);
  const dark = complement(sunlit, from, to);

  const months: MultiYear["months"] = [];
  for (let m0 = from; m0 + SYNODIC_MS <= to; m0 += SYNODIC_MS) {
    const i0 = Math.floor((m0 - from) / stepMs), i1 = Math.floor((m0 + SYNODIC_MS - from) / stepMs);
    let l = 0, lat = 0;
    for (let i = i0; i < i1; i++) {
      if (s.sunFrac[i] >= a.sunDiskThreshold) l++;
      lat += sunLatAt(eph, s.t[i]);
    }
    const mDark = dark
      .map((g) => ({ start: Math.max(g.start, m0), end: Math.min(g.end, m0 + SYNODIC_MS) }))
      .filter((g) => g.end > g.start);
    months.push({ start: m0, sunlitFrac: l / (i1 - i0), longestDarkH: longestMs(mDark) / HOUR_MS, meanSunLat: lat / (i1 - i0) });
  }
  const years = (to - from) / (365.25 * DAY_MS);
  const southern = terrain.site.lat < 0;
  const winterMonth = months.length
    ? months.reduce((w, m) => ((southern ? m.meanSunLat > w.meanSunLat : m.meanSunLat < w.meanSunLat) ? m : w))
    : null;
  let winter: MultiYear["winter"] = null;
  if (winterMonth) {
    const ws = winterMonth.start, we = ws + SYNODIC_MS;
    const wDark = dark.map((g) => ({ start: Math.max(g.start, ws), end: Math.min(g.end, we) })).filter((g) => g.end > g.start);
    winter = { start: ws, darkDays: totalMs(wDark) / DAY_MS, longestDarkDays: longestMs(wDark) / DAY_MS };
  }

  // "Uniform" estimate (Bryant 2009 comparison): Sun/Earth equally likely at every azimuth.
  let uSun = 0, uEarth = 0;
  const azs = 72;
  for (let i = 0; i < n; i += 3) {
    const rS = angularRadius(CONST.sunRadiusKm, s.sunAU[i] * 149_597_870.7);
    const rE = angularRadius(CONST.earthRadiusKm, s.earthKm[i]);
    for (let k = 0; k < azs; k++) {
      const h = horizonAt(mask, (k * 360) / azs);
      if (diskAboveHorizon(s.sunEl[i], rS, h) >= a.sunDiskThreshold) uSun++;
      if (diskAboveHorizon(s.earthEl[i], rE, h) >= a.earthDiskThreshold) uEarth++;
    }
  }
  const samples = Math.ceil(n / 3) * azs;

  let sMin = 99, sMax = -99, lonMin = 99, lonMax = -99, latMin = 99, latMax = -99;
  for (let i = 0; i < n; i++) {
    const sl = sunLatAt(eph, s.t[i]);
    sMin = Math.min(sMin, sl); sMax = Math.max(sMax, sl);
    lonMin = Math.min(lonMin, s.libLon[i]); lonMax = Math.max(lonMax, s.libLon[i]);
    latMin = Math.min(latMin, s.libLat[i]); latMax = Math.max(latMax, s.libLat[i]);
  }

  return {
    from, to, stepH: 2,
    meanDiskFrac: disk / n, sunlitFrac: lit / n, longestDarkH: longestMs(dark) / HOUR_MS,
    dte0: d0 / n, dte50: d50 / n, dte100: d100 / n, dteSelected: dsel / n,
    months,
    continuousSolarMonthsPerYear: months.filter((m) => m.longestDarkH === 0).length / years,
    winter,
    sunLatRange: [sMin, sMax],
    uniformSunlitFrac: uSun / samples,
    uniformDteFrac: uEarth / samples,
    sunOccupancy: occupancy(s, s.sunAz, s.sunEl, 30, 0.5),
    earthOccupancy: occupancy(s, s.earthAz, s.earthEl, 10, 1),
    libLonRange: [lonMin, lonMax],
    libLatRange: [latMin, latMax],
  };
}

function sunLatAt(eph: EphemerisSet, t: number) {
  return eph.sample(t).sun.lat;
}

/* ---------------- landing-date risk percentiles ---------------- */

export function landingDatePercentiles(eph: EphemerisSet, terrain: TerrainFile, mask: HorizonMask, a: Assumptions, from: number, days = 365) {
  const stepMs = HOUR_MS;
  const winH = Math.round(a.missionDays * 24);
  const s = longSeries(eph, terrain, mask, from, from + (days * 24 + winH) * stepMs, stepMs, a);
  const lit = new Float64Array(s.n + 1);
  const dte = new Float64Array(s.n + 1);
  for (let i = 0; i < s.n; i++) {
    lit[i + 1] = lit[i] + (s.sunFrac[i] >= a.sunDiskThreshold ? 1 : 0);
    dte[i + 1] = dte[i] + (s.earthFrac[i] >= a.earthDiskThreshold ? 1 : 0);
  }
  const sun: number[] = [], earth: number[] = [];
  for (let d = 0; d < days; d++) {
    const i0 = d * 24, i1 = Math.min(s.n, i0 + winH);
    sun.push((lit[i1] - lit[i0]) / (i1 - i0));
    earth.push((dte[i1] - dte[i0]) / (i1 - i0));
  }
  const pct = (arr: number[], p: number) => {
    const x = [...arr].sort((u, v) => u - v);
    return x[Math.min(x.length - 1, Math.floor((p / 100) * x.length))];
  };
  const bestDay = sun.indexOf(Math.max(...sun));
  return {
    sun: { p5: pct(sun, 5), p50: pct(sun, 50), p95: pct(sun, 95) },
    earth: { p5: pct(earth, 5), p50: pct(earth, 50), p95: pct(earth, 95) },
    daily: sun.map((v, d) => ({ day: from + d * DAY_MS, sun: v, earth: earth[d] })),
    bestDay: from + bestDay * DAY_MS,
  };
}

/* ---------------- candidate-area grid ---------------- */

export type GridStats = {
  cellKm2: number;
  points: { dx: number; dy: number; slope: number | null; missionLit: number; annualLit: number; annualDte: number; litAtLanding: boolean; qualifies: boolean }[];
  qualifyingKm2: number;
  qualifyingFrac: number;
  components: number;
  largestComponentKm2: number;
  litAtLandingFrac: number;
  areaEpisodes: Interval[];
  lowSlopeFrac: number;
  neverLitPoints: number;
  bestDte: { dx: number; dy: number; annualDte: number; distKm: number; visibleFromSite: boolean } | null;
  safeHaven: { dx: number; dy: number; missionLit: number; distKm: number } | null;
  coarseVsFineKm2: { fine: number; coarse: number } | null;
};

export function gridStats(eph: EphemerisSet, terrain: TerrainFile, a: Assumptions, landingMs: number, siteMask: HorizonMask, annualIllumThreshold = 0.5): GridStats {
  const g = terrain.grid;
  const cellKm2 = g.spacingKm * g.spacingKm;
  const missionEnd = landingMs + a.missionDays * DAY_MS;
  const yearEnd = landingMs + 365 * DAY_MS;
  const litSeriesAll: Float32Array[] = [];
  const pts = g.points.map((p, k) => {
    const mask = gridMask(terrain, k);
    const tf = { ...terrain, site: { lat: p.lat, lon: p.lon }, groundM: p.hM ?? terrain.groundM };
    const ms = longSeries(eph, tf, mask, landingMs, missionEnd, HOUR_MS, a);
    const ys = longSeries(eph, tf, mask, landingMs, yearEnd, 6 * HOUR_MS, a);
    let ml = 0, yl = 0, yd = 0;
    for (let i = 0; i < ms.n; i++) if (ms.sunFrac[i] >= a.sunDiskThreshold) ml++;
    for (let i = 0; i < ys.n; i++) {
      if (ys.sunFrac[i] >= a.sunDiskThreshold) yl++;
      if (ys.earthFrac[i] >= a.earthDiskThreshold) yd++;
    }
    litSeriesAll.push(ms.sunFrac);
    const annualLit = yl / ys.n;
    return {
      dx: p.dx, dy: p.dy, slope: p.slope,
      missionLit: ml / ms.n, annualLit, annualDte: yd / ys.n,
      litAtLanding: ms.sunFrac[0] >= a.sunDiskThreshold,
      qualifies: p.slope !== null && p.slope <= a.slopeToleranceDeg && annualLit >= annualIllumThreshold,
    };
  });

  // connected components of qualifying cells (4-neighbour)
  const key = (x: number, y: number) => `${Math.round(x / g.spacingKm)},${Math.round(y / g.spacingKm)}`;
  const q = new Set(pts.filter((p) => p.qualifies).map((p) => key(p.dx, p.dy)));
  const seen = new Set<string>();
  let components = 0, largest = 0;
  for (const k of q) {
    if (seen.has(k)) continue;
    components++;
    let size = 0;
    const stack = [k];
    seen.add(k);
    while (stack.length) {
      const c = stack.pop()!;
      size++;
      const [x, y] = c.split(",").map(Number);
      for (const nb of [`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]) {
        if (q.has(nb) && !seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    largest = Math.max(largest, size);
  }

  // area-illumination episodes: times when at least half of the grid is lit
  const nT = litSeriesAll[0]?.length ?? 0;
  const t = Array.from({ length: nT }, (_, i) => landingMs + i * HOUR_MS);
  const areaFrac = (i: number) => litSeriesAll.filter((s) => s[i] >= a.sunDiskThreshold).length / litSeriesAll.length;
  const areaEpisodes = nT ? intervalsFromMargin(t, (i) => areaFrac(i) - 0.5 + 1e-9) : [];

  // high ground with best Earth visibility, and whether the site can see it
  const R = CONST.moonRadiusKm * 1000;
  const centre = g.points.find((p) => p.dx === 0 && p.dy === 0);
  const hSite = (centre?.hM ?? terrain.groundM) + a.mastHeightM;
  let bestDte: GridStats["bestDte"] = null;
  pts.forEach((p, k) => {
    if (p.dx === 0 && p.dy === 0) return;
    if (!bestDte || p.annualDte > bestDte.annualDte) {
      const distKm = Math.hypot(p.dx, p.dy);
      const brg = (Math.atan2(p.dx, p.dy) / DEG + 360) % 360;
      const th = (distKm * 1000) / R;
      const rT = R + (g.points[k].hM ?? 0) + 10; // 10 m relay mast at the high point
      const rO = R + hSite;
      const ang = Math.atan2(rT * Math.cos(th) - rO, rT * Math.sin(th)) / DEG;
      bestDte = { dx: p.dx, dy: p.dy, annualDte: p.annualDte, distKm, visibleFromSite: ang >= horizonAt(siteMask, brg) - 0.05 };
    }
  });
  let safeHaven: GridStats["safeHaven"] = null;
  for (const p of pts) {
    if (p.slope !== null && p.slope > a.slopeToleranceDeg) continue;
    if (!safeHaven || p.missionLit > safeHaven.missionLit) safeHaven = { dx: p.dx, dy: p.dy, missionLit: p.missionLit, distKm: Math.hypot(p.dx, p.dy) };
  }

  // resolution sensitivity: recompute qualifying area using only every other grid point (2× spacing)
  const coarse = pts.filter((p) => Math.round(p.dx / g.spacingKm) % 2 === 0 && Math.round(p.dy / g.spacingKm) % 2 === 0);
  const coarseKm2 = coarse.filter((p) => p.qualifies).length * cellKm2 * 4;

  return {
    cellKm2,
    points: pts,
    qualifyingKm2: q.size * cellKm2,
    qualifyingFrac: q.size / pts.length,
    components,
    largestComponentKm2: largest * cellKm2,
    litAtLandingFrac: pts.filter((p) => p.litAtLanding).length / pts.length,
    areaEpisodes,
    lowSlopeFrac: pts.filter((p) => p.slope !== null && p.slope <= a.slopeToleranceDeg).length / pts.length,
    neverLitPoints: pts.filter((p) => p.annualLit === 0).length,
    bestDte,
    safeHaven,
    coarseVsFineKm2: { fine: q.size * cellKm2, coarse: coarseKm2 },
  };
}

/* ---------------- sensitivity ---------------- */

export function sensitivity(eph: EphemerisSet, terrain: TerrainFile, a: Assumptions, landingMs: number, base: Scenario) {
  const litH = (sc: Scenario) => totalMs(sc.windows.sunlit) / HOUR_MS;
  const dteH = (sc: Scenario) => totalMs(sc.windows.dte) / HOUR_MS;
  const b = { lit: litH(base), dte: dteH(base) };
  const step = 30 * 60_000;
  const shifted = [-DAY_MS, DAY_MS].map((d) => buildScenario({ eph, terrain, landingMs: landingMs + d, assumptions: a, stepMs: step }));
  const time = shifted.map((sc) => ({ lit: litH(sc) - b.lit, dte: dteH(sc) - b.dte }));
  const pos = terrain.offsets.map((o) => {
    const sc = buildScenario({ eph, terrain, landingMs, assumptions: a, stepMs: step, maskOverride: asMask(o.mask, terrain.stepDeg) });
    return { bearingDeg: o.bearingDeg, km: o.km, lit: litH(sc) - b.lit, dte: dteH(sc) - b.dte };
  });
  const heights = terrain.heightsM.map((h) => {
    const sc = buildScenario({ eph, terrain, landingMs, assumptions: a, stepMs: step, heightOverrideM: h });
    return { heightM: h, lit: litH(sc), dte: dteH(sc), dte0: hoursWhere(sc.series, (i) => sc.series.earthFrac[i] > 0), dte100: hoursWhere(sc.series, (i) => sc.series.earthFrac[i] >= 0.999) };
  });
  return { base: b, time, pos, heights };
}

function hoursWhere(s: Series, f: (i: number) => boolean) {
  let c = 0;
  for (let i = 0; i < s.n; i++) if (f(i)) c++;
  return (c * s.stepMs) / HOUR_MS;
}

/* ---------------- power ---------------- */

export function powerModel(sc: Scenario) {
  const a = sc.assumptions;
  const s = sc.series;
  const dtH = s.stepMs / HOUR_MS;
  const power = new Float32Array(s.n);
  const soc = new Float32Array(s.n);
  let e = a.batteryWh, minE = e, minAt = s.t[0], deficitWh = 0, depletedAt: number | null = null;
  let sumP = 0, peakP = 0, flux = 0;
  for (let i = 0; i < s.n; i++) {
    const irr = (CONST.solarConstant / (s.sunAU[i] * s.sunAU[i])) * s.sunFrac[i];
    const el = Math.max(0, s.sunEl[i]) * DEG;
    let inc: number;
    if (a.panelTracking === "vertical-tracking") inc = Math.cos(el);
    else if (a.panelTracking === "vertical-fixed") inc = Math.cos(el) * Math.max(0, Math.cos((s.sunAz[i] - a.panelFixedAzDeg) * DEG));
    else inc = Math.sin(el);
    const p = irr * inc * a.panelAreaM2 * a.panelEfficiency;
    power[i] = p;
    sumP += p;
    peakP = Math.max(peakP, p);
    flux += irr * Math.sin(el);
    const load = p > 0 ? a.loadW : a.survivalLoadW;
    e += (p - load) * dtH;
    if (e > a.batteryWh) e = a.batteryWh;
    if (e < 0) {
      deficitWh += -e;
      e = 0;
      if (depletedAt === null) depletedAt = s.t[i];
    }
    soc[i] = e / a.batteryWh;
    if (e < minE) {
      minE = e;
      minAt = s.t[i];
    }
  }
  return {
    power, soc,
    avgW: sumP / s.n, peakW: peakP,
    minSoc: minE / a.batteryWh, minSocAt: minAt, depletedAt, deficitWh,
    survivableDarkH: a.batteryWh / a.survivalLoadW,
    meanHorizontalFluxWm2: flux / s.n,
  };
}

/* ---------------- link ---------------- */

export function linkModel(sc: Scenario) {
  const a = sc.assumptions;
  const s = sc.series;
  let dMin = Infinity, dMax = 0;
  for (let i = 0; i < s.n; i++) {
    dMin = Math.min(dMin, s.earthKm[i]);
    dMax = Math.max(dMax, s.earthKm[i]);
  }
  const f = a.freqGHz * 1e9;
  const fspl = (dKm: number) => 20 * Math.log10((4 * Math.PI * dKm * 1000 * f) / 299_792_458);
  const eirp = 10 * Math.log10(a.txPowerW) + a.landerAntennaGainDbi;
  const prn0 = (dKm: number) => eirp - fspl(dKm) + a.groundGTdBK + 228.6; // dB-Hz
  const rate = (dKm: number) => Math.pow(10, (prn0(dKm) - a.requiredEbN0dB - a.linkMarginDb) / 10);
  return {
    dMinKm: dMin, dMaxKm: dMax,
    prn0Worst: prn0(dMax), prn0Best: prn0(dMin),
    maxRateWorstBps: rate(dMax), maxRateBestBps: rate(dMin),
    fsplWorstDb: fspl(dMax),
    owltMinS: dMin / CONST.cKmS, owltMaxS: dMax / CONST.cKmS,
  };
}

/* ---------------- surface temperature (radiative-equilibrium estimate) ---------------- */

export function equilibriumTemps(sc: Scenario, slopeDeg: number, aspectDeg: number, emissivity = 0.95) {
  const s = sc.series;
  const temps = new Float32Array(s.n);
  const n = [Math.sin(slopeDeg * DEG) * Math.sin(aspectDeg * DEG), Math.sin(slopeDeg * DEG) * Math.cos(aspectDeg * DEG), Math.cos(slopeDeg * DEG)];
  for (let i = 0; i < s.n; i++) {
    const el = s.sunEl[i] * DEG, az = s.sunAz[i] * DEG;
    const u = [Math.cos(el) * Math.sin(az), Math.cos(el) * Math.cos(az), Math.sin(el)];
    const cosi = Math.max(0, u[0] * n[0] + u[1] * n[1] + u[2] * n[2]);
    const absorbed = (1 - CONST.bondAlbedo) * (CONST.solarConstant / (s.sunAU[i] * s.sunAU[i])) * cosi * s.sunFrac[i];
    temps[i] = Math.pow(absorbed / (emissivity * CONST.sigma), 0.25);
  }
  return temps;
}

/* ---------------- sky view factor ---------------- */

/** Fraction of the sky hemisphere not blocked by terrain (isotropic), from the horizon mask. */
export function skyViewFactor(mask: HorizonMask) {
  const m = mask.elev;
  return m.reduce((acc, h) => acc + (1 - Math.sin(Math.max(0, h) * DEG) ** 2), 0) / m.length;
}

/** The sky point straight above the site, for quick sanity checks in tests. */
export function zenithCheck(eph: EphemerisSet, lat: number, lon: number, t: number) {
  const e = eph.sample(t);
  return topocentric({ lat, lon, hKm: 0 }, e.sun, CONST.moonRadiusKm);
}

export { maskForHeight };
