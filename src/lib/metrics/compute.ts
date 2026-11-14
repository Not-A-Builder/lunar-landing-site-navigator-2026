/**
 * Compute every metric in the Draft 3 catalog for one scenario.
 * Each metric returns a value with an honest status (see types.ts). Nothing here invents data:
 * values come from the ephemeris + LOLA terrain engine, from your assumptions, from cited
 * references (src/data/references.json), or are marked unavailable with the reason.
 */
import type { Assumptions } from "@/lib/assumptions";
import { CONST } from "@/lib/engine/constants";
import { angularRadius, greatCircleKm, bearing as brg, DEG } from "@/lib/engine/geometry";
import type { GridStats, MultiYear } from "@/lib/engine/analysis";
import { equilibriumTemps, linkModel, powerModel, skyViewFactor } from "@/lib/engine/analysis";
import { HOUR_MS, type Scenario } from "@/lib/engine/scenario";
import type { TerrainFile } from "@/lib/engine/terrain-file";
import { horizonAt } from "@/lib/engine/terrain";
import { containing, hours, intersect, longestMs, nextAfter, totalMs } from "@/lib/engine/windows";
import { catalog } from "@/lib/metrics";
import type { SourceId } from "@/lib/sources";
import { compass, fmtDeg, fmtHours, fmtNum, fmtPct, fmtUTC } from "./format";
import { resolveBands, type BandKey } from "@/lib/bands";
import { rate, type MetricValue, type RatingSpec } from "./types";

export type SiteLite = { id: string; name: string; lat: number; lon: number; group: string; status?: string; date?: string | null; mission?: string; notes?: string };

export type RefValue = { key: string; value: number | string; unit: string; range?: string; context?: string; sourceTitle: string; sourceUrl: string; page?: string; quote?: string };

export type Sensitivity = {
  base: { lit: number; dte: number };
  time: { lit: number; dte: number }[];
  pos: { bearingDeg: number; km: number; lit: number; dte: number }[];
  heights: { heightM: number; lit: number; dte: number; dte0: number; dte100: number }[];
};

export type Percentiles = { sun: { p5: number; p50: number; p95: number }; earth: { p5: number; p50: number; p95: number }; bestDay: number };

export type PeerSummary = { id: string; name: string; sunlitFrac: number; dteFrac: number; slope: number | null; psrKm: number | null };

export type MetricInputs = {
  scenario: Scenario;
  terrain: TerrainFile;
  site: { id: string; name: string; polar: boolean; group?: string };
  multi: MultiYear | null;
  grid: GridStats | null;
  sens: Sensitivity | null;
  pct: Percentiles | null;
  peers: PeerSummary[];
  allSites: SiteLite[];
  refs: Record<string, RefValue>;
  /** resolved rating bands (defaults + planner overrides); defaults used if omitted */
  bands?: Record<BandKey, RatingSpec>;
};

const H = (ms: number) => ms / HOUR_MS;

export function computeAllMetrics(inp: MetricInputs): Record<string, MetricValue> {
  const { scenario: sc, terrain: tr, multi, grid, sens, pct, refs } = inp;
  const a: Assumptions = sc.assumptions;
  const s = sc.series;
  const w = sc.windows;
  const t0 = sc.start, t1 = sc.end;
  const spanH = H(t1 - t0);
  const out: Record<string, MetricValue> = {};

  const put = (id: string, v: Omit<MetricValue, "id">) => {
    out[id] = { id, ...v };
  };
  const comp = (id: string, display: string, value: number | null, sources: SourceId[], extra: Partial<MetricValue> = {}) =>
    put(id, { status: "computed", display, value, sources, ...extra });
  const model = (id: string, display: string, value: number | null, sources: SourceId[], extra: Partial<MetricValue> = {}) =>
    put(id, { status: "modelled", display, value, sources: [...sources, "mission-assumption"], ...extra });
  const assume = (id: string, display: string, value: number | null, note?: string) =>
    put(id, { status: "assumption", display, value, sources: ["mission-assumption"], note });
  const na = (id: string, reason: string, sources: SourceId[] = []) =>
    put(id, { status: "unavailable", display: "Not available", value: null, sources, reason });
  const refLine = (r: RefValue) => `${r.value}${r.unit ? " " + r.unit : ""}${r.range && r.range !== String(r.value) ? ` (${r.range})` : ""}`;
  const ref = (id: string, key: string, fallbackReason: string, extra: string[] = []) => {
    const r = refs[key];
    if (!r) return na(id, fallbackReason, ["reference-literature"]);
    const more = extra.map((k) => refs[k]).filter(Boolean);
    put(id, {
      status: "reference",
      display: refLine(r),
      value: typeof r.value === "number" ? r.value : null,
      sources: ["reference-literature"],
      note: `${r.context ? r.context + ". " : ""}Global lunar value, not specific to this site. Source: ${r.sourceTitle}${r.page ? `, ${r.page}` : ""}.${more.length ? " Also: " + more.map((m) => `${m.key.replace(/_/g, " ")} = ${refLine(m)} (${m.sourceTitle})`).join("; ") + "." : ""}`,
      detail: [r, ...more].map((m) => `${m.sourceTitle}${m.page ? `, ${m.page}` : ""}\n${m.sourceUrl}${m.quote ? `\n“${m.quote}”` : ""}`).join("\n\n"),
    });
  };
  const rated = (spec: RatingSpec, v: number | null) => (v === null || !Number.isFinite(v) ? undefined : rate(v, spec));

  const EPH: SourceId[] = ["jpl-horizons"];
  const TER: SourceId[] = ["lola-pds"];
  const BOTH: SourceId[] = ["jpl-horizons", "lola-pds"];

  /* ------------ shared derived values ------------ */
  const litH = H(totalMs(w.sunlit));
  const darkH = spanH - litH;
  const dteH = H(totalMs(w.dte));
  const jointH = H(totalMs(w.joint));
  const longestLitH = H(longestMs(w.sunlit));
  const longestDarkH = H(longestMs(w.dark));
  const longestNoDteH = H(longestMs(w.noDte));
  const longestJointGapH = H(longestMs(w.jointGap));
  const dteDsnH = H(totalMs(w.dteDsn));
  const i0 = 0;
  const sunNow = { az: s.sunAz[i0], el: s.sunEl[i0], hz: s.sunHz[i0], frac: s.sunFrac[i0] };
  const earthNow = { az: s.earthAz[i0], el: s.earthEl[i0], hz: s.earthHz[i0], frac: s.earthFrac[i0] };
  const litNow = containing(w.sunlit, t0);
  const nextSunrise = litNow ? null : nextAfter(w.sunlit, t0);
  const dteNow = containing(w.dte, t0);
  const rSun = angularRadius(CONST.sunRadiusKm, s.sunAU[i0] * 149_597_870.7);
  const rEarth = angularRadius(CONST.earthRadiusKm, s.earthKm[i0]);
  const pw = powerModel(sc);
  const ln = linkModel(sc);
  const svf = skyViewFactor(sc.mask);
  const slope = tr.slope?.deg ?? null;
  const aspect = tr.slope?.aspectDeg ?? null;
  const temps = slope !== null && aspect !== null ? equilibriumTemps(sc, slope, aspect) : null;
  let tMin = Infinity, tMax = -Infinity, maxRate = 0;
  if (temps) {
    for (let i = 0; i < temps.length; i++) {
      tMin = Math.min(tMin, temps[i]);
      tMax = Math.max(tMax, temps[i]);
      if (i) maxRate = Math.max(maxRate, Math.abs(temps[i] - temps[i - 1]) / (s.stepMs / HOUR_MS));
    }
  }
  const others = inp.allSites.filter((x) => x.id !== inp.site.id);
  const nearest = (filter: (x: SiteLite) => boolean) =>
    others
      .filter(filter)
      .map((x) => ({ x, d: greatCircleKm(tr.site.lat, tr.site.lon, x.lat, x.lon, CONST.moonRadiusKm) }))
      .sort((p, q) => p.d - q.d)[0] ?? null;
  const survivableDarkH = pw.survivableDarkH;

  /* ------------ rating bands (defaults + planner overrides, see src/lib/bands.ts, LOGS D-033) ------------ */
  const R = inp.bands ?? resolveBands(a);

  /* ================= 🍀 overall ================= */
  comp("overall.joint-sunlit-dte-window",
    `${fmtHours(jointH)} (${fmtPct(jointH / spanH)} of mission)`, (100 * jointH) / spanH, BOTH,
    { detail: w.joint.slice(0, 6).map((x) => `${fmtUTC(x.start)} → ${fmtUTC(x.end)}`).join("\n") + (w.joint.length > 6 ? `\n… ${w.joint.length - 6} more` : ""), rating: rated(R.jointPct, (100 * jointH) / spanH) });
  comp("overall.longest-gap-without-simultaneous-sun-and-dte-visibility", fmtHours(longestJointGapH), longestJointGapH, BOTH,
    { rating: rated(R.blackoutH, longestJointGapH) });
  const feasible = H(totalMs(intersect(w.joint, w.dsn)));
  model("overall.feasible-operational-hours-total", `${fmtHours(feasible)} (${fmtPct(feasible / spanH)})`, (100 * feasible) / spanH, [...BOTH, "dsn-810-005"],
    { note: "Hours with sunlight, Earth in view and at least one DSN complex able to see the Moon.", rating: rated(R.jointPct, (100 * feasible) / spanH) });
  const gates = [
    { ok: slope === null || slope <= a.slopeToleranceDeg, why: `slope ${fmtDeg(slope, 1)} exceeds your ${a.slopeToleranceDeg}° tolerance` },
    { ok: longestDarkH <= survivableDarkH, why: `longest darkness ${fmtHours(longestDarkH)} exceeds battery survival ${fmtHours(survivableDarkH)}` },
    { ok: dteH > 0, why: "Earth never rises above the horizon during the mission" },
    { ok: pw.depletedAt === null, why: `battery runs out at ${fmtUTC(pw.depletedAt)}` },
  ];
  const failing = gates.filter((g) => !g.ok);
  model("overall.mission-constraint-compatibility", failing.length ? `Fails ${failing.length} of ${gates.length} checks` : `Passes all ${gates.length} checks`, failing.length ? 0 : 1, BOTH,
    { detail: gates.map((g) => `${g.ok ? "✓" : "✗"} ${g.ok ? g.why.replace(/exceeds|runs out|never rises/, "within limits:") : g.why}`).join("\n") });
  const polarPeers = inp.peers.filter((p) => p.id !== inp.site.id);
  if (multi && polarPeers.length) {
    const mine = multi.sunlitFrac;
    const better = polarPeers.filter((p) => p.sunlitFrac > mine).length;
    comp("overall.comparison-against-site-alternatives", `Sunlight ranks #${better + 1} of ${polarPeers.length + 1} curated south-pole sites`, better + 1, BOTH,
      { note: "Ranked by multi-year sunlit fraction (2026–2029). Use Compare for date-specific side-by-side." });
    const dominated = polarPeers.some((p) => p.sunlitFrac >= mine && p.dteFrac >= multi.dteSelected && (p.slope ?? 99) <= (slope ?? 99) && (p.sunlitFrac > mine || p.dteFrac > multi.dteSelected || (p.slope ?? 99) < (slope ?? 99)));
    comp("overall.pareto-optimal-sites", dominated ? "Not Pareto-optimal" : "Pareto-optimal", dominated ? 0 : 1, BOTH,
      { note: "Pareto-optimal = no other curated south-pole site is at least as good on sunlight, Earth visibility and slope, and better on one." });
  } else {
    na("overall.comparison-against-site-alternatives", inp.site.polar ? "Peer statistics are loading or unavailable." : "Ranking is only defined among south-pole sites.");
    na("overall.pareto-optimal-sites", inp.site.polar ? "Peer statistics are loading or unavailable." : "Pareto set is only defined among south-pole sites.");
  }
  const suit = Math.round(
    100 * (0.35 * (litH / spanH) + 0.25 * (dteH / spanH) + 0.2 * (jointH / spanH) + 0.2 * (slope === null ? 0.5 : Math.max(0, 1 - slope / (2 * a.slopeToleranceDeg)))),
  );
  model("overall.mission-weighted-suitability-index", `${suit} / 100`, suit, BOTH,
    { note: "Weights: sunlight 35%, Earth view 25%, both together 20%, gentle slope 20%. Example weights; the real ones depend on mission goals." });
  if (sens) {
    const dLit = Math.max(...sens.time.map((x) => Math.abs(x.lit)));
    const rel = sens.base.lit ? (100 * dLit) / sens.base.lit : 0;
    comp("overall.sensitivity-to-time-shift", `±1 day shifts sunlit time by up to ${fmtHours(dLit)} (${rel.toFixed(0)}%)`, rel, BOTH,
      { detail: sens.time.map((x, k) => `${k ? "+1 day" : "−1 day"}: sunlight ${x.lit >= 0 ? "+" : ""}${x.lit.toFixed(1)} h, Earth ${x.dte >= 0 ? "+" : ""}${x.dte.toFixed(1)} h`).join("\n"), rating: rated(R.sensPct, rel) });
    const dPos = Math.max(...sens.pos.map((x) => Math.abs(x.lit)));
    const relP = sens.base.lit ? (100 * dPos) / sens.base.lit : 0;
    comp("overall.sensitivity-to-position-shift", `Moving 1 km changes sunlit time by up to ${fmtHours(dPos)} (${relP.toFixed(0)}%)`, relP, BOTH,
      { detail: sens.pos.map((x) => `${compass(x.bearingDeg)} ${x.km} km: sunlight ${x.lit >= 0 ? "+" : ""}${x.lit.toFixed(1)} h, Earth ${x.dte >= 0 ? "+" : ""}${x.dte.toFixed(1)} h`).join("\n"), rating: rated(R.sensPct, relP) });
    const h0 = sens.heights[0], hTop = sens.heights[sens.heights.length - 1];
    const perM = (hTop.lit - h0.lit) / (hTop.heightM - h0.heightM || 1);
    comp("overall.sensitivity-to-mast-height", `+${perM.toFixed(2)} sunlit h per metre of mast (0→${hTop.heightM} m)`, perM, BOTH,
      { detail: sens.heights.map((x) => `${x.heightM} m: sunlight ${x.lit.toFixed(1)} h, Earth ${x.dte.toFixed(1)} h`).join("\n") });
  } else {
    for (const id of ["overall.sensitivity-to-time-shift", "overall.sensitivity-to-position-shift", "overall.sensitivity-to-mast-height"]) na(id, "Sensitivity runs are still computing.");
  }
  if (pct) {
    comp("overall.risk-weighted-percentile-performance", `Sunlight P5 ${fmtPct(pct.sun.p5)} · P50 ${fmtPct(pct.sun.p50)} · P95 ${fmtPct(pct.sun.p95)}`, pct.sun.p50 * 100, BOTH,
      { note: "Spread of the mission sunlit fraction if you landed on any day in the 365 days from your landing date.", detail: `Earth in view: P5 ${fmtPct(pct.earth.p5)} · P50 ${fmtPct(pct.earth.p50)} · P95 ${fmtPct(pct.earth.p95)}\nBest landing day for sunlight: ${fmtUTC(pct.bestDay).slice(0, 10)}` });
  } else na("overall.risk-weighted-percentile-performance", "Landing-date percentiles are still computing.");
  model("overall.constraint-failure-explanation", failing.length ? failing.map((f) => f.why).join("; ") : "No checks fail", failing.length, BOTH);
  na("overall.opportunity-cost-science-gained", "Needs your science objectives and their value weights; there is no neutral, data-only score for this.");
  const val = tr.validation;
  comp("overall.evidence-maturity-analysis-confidence", `Orbital data · ${tr.dem.label} terrain · DE441 ephemeris`, null, [...BOTH, "pgda"],
    { note: "No in-situ measurements at this site. Terrain detail is limited by the DEM resolution; small rocks and craters below it are not modelled.",
      detail: val && val.lolaAnySunVis != null ? `Independent check against NASA LOLA average-illumination maps (Mazarico et al. 2011 method, ground level, any part of the disk):\n  Sun visible: ours ${fmtPct(val.oursAnySunVis ?? null, 1)} (${val.window}) vs LOLA ${fmtPct(val.lolaAnySunVis, 1)}\n  Earth visible: ours ${fmtPct(val.oursAnyEarthVis ?? null, 1)} vs LOLA ${fmtPct(val.lolaAnyEarthVis, 1)}\nDifferences come from the time window and model choices.` : undefined });
  if (grid) {
    comp("overall.joint-illumination-and-slope-qualifying-area", `${fmtNum(grid.qualifyingKm2, 1, "km²")} (${fmtPct(grid.qualifyingFrac)} of the ${fmtNum((2 * tr.grid.halfSizeKm) ** 2, 0, "km²")} area)`, grid.qualifyingFrac * 100, BOTH,
      { note: `Grid cells with slope ≤ ${a.slopeToleranceDeg}° and sunlit ≥ 50% of the next year (Liu et al. 2023 method, ${tr.grid.spacingKm} km grid).`, rating: rated(R.areaPct, grid.qualifyingFrac * 100) });
    comp("overall.qualifying-pixel-count-per-landing-area-grid-cell", `${grid.points.filter((p) => p.qualifies).length} of ${grid.points.length} cells`, grid.points.filter((p) => p.qualifies).length, BOTH,
      { note: `Each cell is ${fmtNum(grid.cellKm2, 2, "km²")}.` });
    comp("overall.connectivity-fragmentation-of-qualifying-terrain", `${grid.components} patch${grid.components === 1 ? "" : "es"}; largest ${fmtNum(grid.largestComponentKm2, 1, "km²")}`, grid.largestComponentKm2, BOTH);
    const cf = grid.coarseVsFineKm2;
    comp("overall.illumination-slope-qualifying-area-resolution-sensitivity", cf ? `${fmtNum(cf.fine, 1, "km²")} at ${tr.grid.spacingKm} km vs ${fmtNum(cf.coarse, 1, "km²")} at ${tr.grid.spacingKm * 2} km` : "—", cf ? cf.fine - cf.coarse : null, BOTH);
  } else {
    for (const id of ["overall.joint-illumination-and-slope-qualifying-area", "overall.qualifying-pixel-count-per-landing-area-grid-cell", "overall.connectivity-fragmentation-of-qualifying-terrain", "overall.illumination-slope-qualifying-area-resolution-sensitivity"]) na(id, "Area grid statistics are still computing.");
  }

  /* ================= ☀️ Sun ================= */
  comp("sun.sun-azimuth", `${fmtDeg(sunNow.az, 1)} (${compass(sunNow.az)})`, sunNow.az, EPH, { note: "At the landing time." });
  comp("sun.sun-elevation", fmtDeg(sunNow.el, 2), sunNow.el, EPH,
    { note: `At the landing time. Terrain horizon in that direction: ${fmtDeg(sunNow.hz, 2)}.`, rating: rated(R.sunElev, sunNow.el) });
  comp("sun.sun-angular-diameter", `${fmtDeg(2 * rSun, 3)}; ${fmtPct(sunNow.frac)} of disk visible`, 2 * rSun, BOTH);
  comp("sun.instantaneous-terrain-shadow-state", litNow ? "Sunlit" : sunNow.frac > 0 ? "Partly lit (below threshold)" : "In shadow", sunNow.frac * 100, BOTH);
  const crossings = [...w.sunlit.map((x) => ({ t: x.start, k: "sunrise" })), ...w.sunlit.map((x) => ({ t: x.end, k: "sunset" }))]
    .filter((x) => x.t > t0 && x.t < t1).sort((p, q) => p.t - q.t);
  comp("sun.sunrise-sunset-crossings", crossings.length ? `${crossings.length} crossing${crossings.length === 1 ? "" : "s"}; next ${crossings[0].k} ${fmtUTC(crossings[0].t)}` : "No sunrise or sunset during the mission", crossings.length, BOTH,
    { detail: crossings.slice(0, 12).map((x) => `${x.k}: ${fmtUTC(x.t)}`).join("\n") });
  comp("sun.illumination-time-series", `${s.n} samples every ${s.stepMs / 60000} min (see Sun timeline)`, null, BOTH);
  comp("sun.solar-availability-fraction", fmtPct(litH / spanH), (100 * litH) / spanH, BOTH, { rating: rated(R.sunPct, (100 * litH) / spanH) });
  let full = 0, part = 0;
  for (let i = 0; i < s.n; i++) {
    if (s.sunFrac[i] >= 0.999) full++;
    else if (s.sunFrac[i] > 0) part++;
  }
  comp("sun.full-vs-partial-solar-illumination", `Full disk ${fmtPct(full / s.n)} · partial ${fmtPct(part / s.n)} · none ${fmtPct(1 - (full + part) / s.n)}`, (100 * full) / s.n, BOTH);
  comp("sun.longest-continuous-darkness", fmtHours(longestDarkH), longestDarkH, BOTH, { rating: rated(R.darkH, longestDarkH) });
  comp("sun.total-dark-duration", fmtHours(darkH), darkH, BOTH);
  comp("sun.longest-continuous-sunlight", fmtHours(longestLitH), longestLitH, BOTH, { rating: rated(R.litH, longestLitH) });
  if (multi) {
    comp("sun.illumination-seasonality-multiyear-average", `${fmtPct(multi.sunlitFrac)} sunlit (2026–2029)`, multi.sunlitFrac * 100, BOTH,
      { detail: `Monthly sunlit fraction ranges ${fmtPct(Math.min(...multi.months.map((m) => m.sunlitFrac)))}–${fmtPct(Math.max(...multi.months.map((m) => m.sunlitFrac)))}`, rating: rated(R.sunPct, multi.sunlitFrac * 100) });
  } else na("sun.illumination-seasonality-multiyear-average", "Multi-year statistics are still computing.");
  const incNow = a.panelTracking === "horizontal" ? 90 - Math.max(0, sunNow.el) : a.panelTracking === "vertical-tracking" ? Math.max(0, sunNow.el) : Math.acos(Math.cos(sunNow.el * DEG) * Math.max(0, Math.cos((sunNow.az - a.panelFixedAzDeg) * DEG))) / DEG;
  model("sun.solar-incidence-on-panel", `${fmtDeg(incNow, 1)} from panel normal (cos ${Math.cos(incNow * DEG).toFixed(3)})`, Math.cos(incNow * DEG), EPH);
  const shadowLen = sunNow.el > 0 ? 1 / Math.tan(sunNow.el * DEG) : Infinity;
  comp("sun.surface-shadow-length-direction", sunNow.el > 0 ? `A 1 m rock casts a ${fmtNum(shadowLen, 0, "m")} shadow toward ${compass((sunNow.az + 180) % 360)}` : "Sun below the smooth horizon: no direct shadows", sunNow.el > 0 ? shadowLen : null, EPH);
  assume("sun.observer-or-panel-height", `${a.mastHeightM} m`, a.mastHeightM);
  na("sun.mutual-artificial-shadowing", "Needs the layout of your hardware (lander, towers, other assets).");
  comp("sun.solar-eclipse-intervals", w.eclipse.length ? w.eclipse.map((x) => `${fmtUTC(x.start)} (${fmtHours(H(x.end - x.start))})`).join("; ") : "None during the mission", w.eclipse.length, EPH,
    { note: "Earth passing in front of the Sun as seen from the site (a lunar eclipse seen from Earth)." });
  comp("sun.illumination-model-cadence", `${s.stepMs / 60000} min (mission) · 2 h (multi-year) · 1 h source tables`, s.stepMs / 60000, EPH);
  if (multi) comp("sun.solar-polar-latitude-envelope", `Sub-solar latitude ${fmtDeg(multi.sunLatRange[0], 2)} to ${fmtDeg(multi.sunLatRange[1], 2)}`, multi.sunLatRange[1] - multi.sunLatRange[0], EPH);
  else na("sun.solar-polar-latitude-envelope", "Multi-year statistics are still computing.");
  assume("sun.solar-disk-visibility-threshold-for-day-night", `Sunlit when ≥ ${Math.round(a.sunDiskThreshold * 100)}% of the Sun's disk is visible`, a.sunDiskThreshold, "Liu et al. (2023) and Bryant (2009) use 0, 50% and 100% disk levels.");
  comp("sun.solar-visible-disk-coefficient-f-t", `f = ${sunNow.frac.toFixed(3)} at landing`, sunNow.frac, BOTH, { sources: [...BOTH, "liu-2023"] });
  if (multi) {
    comp("sun.disk-weighted-annual-illumination-rate", fmtPct(multi.meanDiskFrac, 1), multi.meanDiskFrac * 100, [...BOTH, "liu-2023"]);
    comp("sun.continuous-solar-months-per-year-disk-threshold", `${multi.continuousSolarMonthsPerYear.toFixed(1)} months/year with no darkness`, multi.continuousSolarMonthsPerYear, [...BOTH, "bryant-2009"]);
    comp("sun.total-dark-days-during-polar-winter-synodic-month", multi.winter ? `${multi.winter.darkDays.toFixed(1)} days` : "—", multi.winter?.darkDays ?? null, [...BOTH, "bryant-2009"],
      { note: multi.winter ? `Worst (winter) month starting ${fmtUTC(multi.winter.start).slice(0, 10)}.` : undefined });
    comp("sun.winter-month-longest-uninterrupted-darkness", multi.winter ? `${multi.winter.longestDarkDays.toFixed(1)} days` : "—", multi.winter?.longestDarkDays ?? null, [...BOTH, "bryant-2009"]);
    comp("sun.uniform-vs-ephemeris-solar-illumination-comparison", `Ephemeris ${fmtPct(multi.sunlitFrac)} vs uniform-azimuth ${fmtPct(multi.uniformSunlitFrac)} (${((multi.sunlitFrac - multi.uniformSunlitFrac) * 100).toFixed(1)} pp)`, (multi.sunlitFrac - multi.uniformSunlitFrac) * 100, [...BOTH, "bryant-2009"]);
    const top = [...multi.sunOccupancy].sort((p, q) => q.hours - p.hours)[0];
    comp("sun.sun-position-temporal-occupancy-distribution", top ? `Most time at az ${top.azBin}–${top.azBin + 30}°, el ${top.elBin}–${top.elBin + 0.5}°` : "—", null, EPH,
      { detail: `${multi.sunOccupancy.length} occupied 30°×0.5° bins over 2026–2029.` });
  } else {
    for (const id of ["sun.disk-weighted-annual-illumination-rate", "sun.continuous-solar-months-per-year-disk-threshold", "sun.total-dark-days-during-polar-winter-synodic-month", "sun.winter-month-longest-uninterrupted-darkness", "sun.uniform-vs-ephemeris-solar-illumination-comparison", "sun.sun-position-temporal-occupancy-distribution"]) na(id, "Multi-year statistics are still computing.");
  }
  if (temps) {
    let sum = 0;
    for (let i = 0; i < s.n; i++) {
      const el = s.sunEl[i] * DEG, az = s.sunAz[i] * DEG;
      const n = [Math.sin(slope! * DEG) * Math.sin(aspect! * DEG), Math.sin(slope! * DEG) * Math.cos(aspect! * DEG), Math.cos(slope! * DEG)];
      const cosi = Math.max(0, Math.cos(el) * Math.sin(az) * n[0] + Math.cos(el) * Math.cos(az) * n[1] + Math.sin(el) * n[2]);
      sum += (1 - CONST.bondAlbedo) * (CONST.solarConstant / s.sunAU[i] ** 2) * cosi * s.sunFrac[i];
    }
    comp("sun.time-resolved-absorbed-surface-solar-flux", `${fmtNum(sum / s.n, 1, "W/m²")} mission average on the local slope`, sum / s.n, [...BOTH, "nssdc-moon", "liu-2023"]);
  } else na("sun.time-resolved-absorbed-surface-solar-flux", "Needs local slope from the DEM, which is unavailable here.");
  comp("sun.sun-moon-distance-correction-to-irradiance", `${s.sunAU[i0].toFixed(5)} AU → ${fmtNum(CONST.solarConstant / s.sunAU[i0] ** 2, 0, "W/m²")} (${((1 / s.sunAU[i0] ** 2 - 1) * 100).toFixed(1)}% vs 1 AU)`, s.sunAU[i0], [...EPH, "nssdc-moon"]);
  if (sens) {
    const g = sens.heights[0], top = sens.heights[sens.heights.length - 1];
    comp("sun.surface-versus-elevated-solar-visibility-profile", `Sunlit ${fmtPct(g.lit / spanH)} at ground vs ${fmtPct(top.lit / spanH)} at ${top.heightM} m`, ((top.lit - g.lit) / spanH) * 100, BOTH);
  } else na("sun.surface-versus-elevated-solar-visibility-profile", "Sensitivity runs are still computing.");
  if (grid) {
    comp("sun.fraction-of-candidate-landing-area-illuminated-at-time-t", `${fmtPct(grid.litAtLandingFrac)} of the area lit at landing`, grid.litAtLandingFrac * 100, BOTH);
    comp("sun.candidate-area-illumination-episode-windows", grid.areaEpisodes.length ? `${grid.areaEpisodes.length} episode${grid.areaEpisodes.length === 1 ? "" : "s"} with ≥50% of the area lit; longest ${fmtHours(H(longestMs(grid.areaEpisodes)))}` : "Never ≥50% of the area lit", grid.areaEpisodes.length, BOTH);
    comp("sun.area-above-chosen-annual-illumination-threshold", `${fmtNum(grid.points.filter((p) => p.annualLit >= 0.5).length * grid.cellKm2, 1, "km²")} sunlit ≥50% of the year`, grid.points.filter((p) => p.annualLit >= 0.5).length * grid.cellKm2, BOTH);
  } else for (const id of ["sun.fraction-of-candidate-landing-area-illuminated-at-time-t", "sun.candidate-area-illumination-episode-windows", "sun.area-above-chosen-annual-illumination-threshold"]) na(id, "Area grid statistics are still computing.");
  const bridged = w.dark.filter((g) => H(g.end - g.start) <= survivableDarkH);
  model("sun.shadow-gap-bridging-sustained-operation-window", `${bridged.length} of ${w.dark.length} dark periods survivable on battery`, bridged.length, BOTH);
  comp("sun.radiative-view-factors", `Sky view factor ${svf.toFixed(3)}`, svf, TER, { note: "Share of the sky hemisphere not blocked by terrain (1 = flat open plain)." });
  const irrNow = (CONST.solarConstant / s.sunAU[i0] ** 2) * sunNow.frac * Math.cos(incNow * DEG);
  model("sun.solar-irradiance-at-site-panel", `${fmtNum(irrNow, 0, "W/m²")} on the array at landing`, irrNow, [...EPH, "nssdc-moon"]);
  model("sun.solar-array-generating-power", `${fmtNum(pw.avgW, 0, "W")} average · ${fmtNum(pw.peakW, 0, "W")} peak`, pw.avgW, [...EPH, "nssdc-moon"]);
  model("sun.battery-charge-energy-reserve", `Lowest charge ${fmtPct(pw.minSoc)} at ${fmtUTC(pw.minSocAt)}`, pw.minSoc * 100, BOTH, { rating: rated(R.soc, pw.minSoc * 100) });
  model("sun.maximum-survivable-darkness", `${fmtHours(survivableDarkH)} (battery ÷ survival load)`, survivableDarkH, [], { note: refs.viper_shadow_survival ? `For scale: NASA VIPER was designed for about ${refs.viper_shadow_survival.value} h of shadow survival.` : undefined });
  assume("sun.duty-cycle-power-load", `${a.loadW} W operating · ${a.survivalLoadW} W survival`, a.loadW);
  assume("sun.heater-power-survival-mode", `${a.survivalLoadW} W`, a.survivalLoadW);
  model("sun.peak-power-deficit-minimum-energy-margin", pw.deficitWh > 0 ? `Short by ${fmtNum(pw.deficitWh, 0, "Wh")}` : `Lowest margin ${fmtNum(pw.minSoc * a.batteryWh, 0, "Wh")}`, pw.deficitWh > 0 ? -pw.deficitWh : pw.minSoc * a.batteryWh, BOTH);
  assume("sun.array-orientation-and-tracking-limits", a.panelTracking === "vertical-tracking" ? "Vertical, rotating to face the Sun" : a.panelTracking === "vertical-fixed" ? `Vertical, fixed facing ${a.panelFixedAzDeg}°` : "Horizontal (flat)", null);
  na("sun.dust-fouling-degradation-over-time", "Depends on plume and dust exposure of your hardware; no site-level dataset exists.");

  /* ================= 🌎 Earth ================= */
  comp("earth.earth-azimuth", `${fmtDeg(earthNow.az, 1)} (${compass(earthNow.az)})`, earthNow.az, EPH, { note: "At the landing time." });
  comp("earth.earth-elevation", fmtDeg(earthNow.el, 2), earthNow.el, EPH, { note: `At the landing time. Terrain horizon in that direction: ${fmtDeg(earthNow.hz, 2)}.` });
  if (multi) comp("earth.libration-of-earth-in-lunar-sky", `Sub-Earth point wanders ${fmtDeg(multi.libLonRange[0], 1)}…${fmtDeg(multi.libLonRange[1], 1)} lon, ${fmtDeg(multi.libLatRange[0], 1)}…${fmtDeg(multi.libLatRange[1], 1)} lat`, multi.libLatRange[1] - multi.libLatRange[0], [...EPH, "svs-libration"]);
  else comp("earth.libration-of-earth-in-lunar-sky", `Sub-Earth point at landing: ${fmtDeg(s.libLon[i0], 2)} lon, ${fmtDeg(s.libLat[i0], 2)} lat`, s.libLat[i0], [...EPH, "svs-libration"]);
  comp("earth.earth-angular-diameter-disk-visibility", `${fmtDeg(2 * rEarth, 2)}; ${fmtPct(earthNow.frac)} of disk visible`, 2 * rEarth, [...BOTH, "nssdc-earth"]);
  comp("earth.dte-geometric-line-of-sight", dteNow ? "Yes, Earth in view at landing" : "No, Earth hidden at landing", dteNow ? 1 : 0, BOTH);
  comp("earth.dte-visibility-intervals", `${w.dte.length} window${w.dte.length === 1 ? "" : "s"}`, w.dte.length, BOTH,
    { detail: w.dte.slice(0, 8).map((x) => `${fmtUTC(x.start)} → ${fmtUTC(x.end)} (${fmtHours(H(x.end - x.start))})`).join("\n") });
  comp("earth.total-dte-visibility-fraction", fmtPct(dteH / spanH), (100 * dteH) / spanH, BOTH, { rating: rated(R.dtePct, (100 * dteH) / spanH) });
  comp("earth.longest-dte-blackout", fmtHours(longestNoDteH), longestNoDteH, BOTH, { rating: rated(R.blackoutH, longestNoDteH) });
  comp("earth.dte-visibility-ground-station-availability", `${fmtHours(dteDsnH)} (${fmtPct(dteDsnH / spanH)}) with a DSN complex in view`, (100 * dteDsnH) / spanH, [...BOTH, "dsn-810-005"],
    { note: `Earth above the site's horizon and the Moon ≥ ${a.dsnMinElevDeg}° above the horizon at Goldstone, Canberra or Madrid.`, rating: rated(R.dtePct, (100 * dteDsnH) / spanH) });
  const marginNow = earthNow.el - earthNow.hz;
  comp("earth.earth-elevation-margin-horizon-clearance", `${fmtDeg(marginNow, 2)} at landing`, marginNow, BOTH, { rating: rated(R.margin, marginNow) });
  let azMin = 360, azMax = 0, elMin = 90, elMax = -90;
  for (let i = 0; i < s.n; i++) {
    if (s.earthFrac[i] < a.earthDiskThreshold) continue;
    azMin = Math.min(azMin, s.earthAz[i]); azMax = Math.max(azMax, s.earthAz[i]);
    elMin = Math.min(elMin, s.earthEl[i]); elMax = Math.max(elMax, s.earthEl[i]);
  }
  comp("earth.antenna-field-of-view-and-tracking", dteH ? `Antenna must cover az ${azMin.toFixed(1)}–${azMax.toFixed(1)}°, el ${elMin.toFixed(1)}–${elMax.toFixed(1)}°` : "Earth not in view", dteH ? azMax - azMin : null, EPH);
  model("earth.rf-link-margin-received-signal", `Pr/N0 ${ln.prn0Worst.toFixed(1)}–${ln.prn0Best.toFixed(1)} dB-Hz`, ln.prn0Worst, [...EPH, "dsn-810-005"],
    { detail: `Free-space loss ${ln.fsplWorstDb.toFixed(1)} dB at ${fmtNum(ln.dMaxKm, 0, "km")}; EIRP ${(10 * Math.log10(a.txPowerW) + a.landerAntennaGainDbi).toFixed(1)} dBW; G/T ${a.groundGTdBK} dB/K` });
  const volGB = (ln.maxRateWorstBps * dteDsnH * 3600) / 8 / 1e9;
  model("earth.data-rate-downlink-volume", `${fmtNum(ln.maxRateWorstBps / 1e6, 2, "Mbit/s")} → ${fmtNum(volGB, 1, "GB")} over the mission`, volGB, [...EPH, "dsn-810-005"]);
  let lowEl = 0;
  for (let i = 0; i < s.n; i++) if (s.earthFrac[i] >= a.earthDiskThreshold && s.earthEl[i] - s.earthHz[i] < 2) lowEl++;
  comp("earth.radio-multipath-terrain-scattering", `${fmtPct(lowEl / s.n)} of the time Earth is within 2° of the horizon (grazing, multipath-prone)`, (100 * lowEl) / s.n, BOTH,
    { note: "Proxy only: grazing geometry raises multipath risk. A full model needs surface RF properties." });
  na("earth.relay-satellite-visibility", "Needs a chosen relay orbiter and its orbit; none is assumed here.");
  na("earth.relay-infrastructure-availability", "Depends on which relay services your mission contracts.");
  comp("earth.two-way-light-time-and-latency", `${(2 * ln.owltMinS).toFixed(2)}–${(2 * ln.owltMaxS).toFixed(2)} s round trip`, 2 * ln.owltMaxS, EPH);
  comp("earth.contact-concurrency-with-sunlight", `${fmtHours(jointH)} with both (${fmtPct(dteH ? jointH / dteH : 0)} of Earth-view time is also sunlit)`, dteH ? (100 * jointH) / dteH : 0, BOTH);
  comp("earth.earth-disk-visibility-criterion-any-half-full", `Using ≥${Math.round(a.earthDiskThreshold * 100)}% of Earth's disk`, a.earthDiskThreshold, [...BOTH, "bryant-2009"]);
  if (multi) {
    comp("earth.multiyear-dte-fraction-for-0-50-100-earth-disk", `Any ${fmtPct(multi.dte0)} · half ${fmtPct(multi.dte50)} · full ${fmtPct(multi.dte100)}`, multi.dte50 * 100, [...BOTH, "bryant-2009"]);
    const top = [...multi.earthOccupancy].sort((p, q) => q.hours - p.hours)[0];
    comp("earth.earth-position-temporal-occupancy-distribution", top ? `Most time at az ${top.azBin}–${top.azBin + 10}°, el ${top.elBin}–${top.elBin + 1}°` : "—", null, EPH);
    comp("earth.uniform-vs-ephemeris-earth-visibility-comparison", `Ephemeris ${fmtPct(multi.dteSelected)} vs uniform-azimuth ${fmtPct(multi.uniformDteFrac)}`, (multi.dteSelected - multi.uniformDteFrac) * 100, [...BOTH, "bryant-2009"]);
  } else for (const id of ["earth.multiyear-dte-fraction-for-0-50-100-earth-disk", "earth.earth-position-temporal-occupancy-distribution", "earth.uniform-vs-ephemeris-earth-visibility-comparison"]) na(id, "Multi-year statistics are still computing.");
  if (grid?.bestDte) {
    const b = grid.bestDte;
    comp("earth.high-ground-terrestrial-los-reflector-relay-opportunity", `Best nearby point ${b.distKm.toFixed(1)} km ${compass((Math.atan2(b.dx, b.dy) / DEG + 360) % 360)} sees Earth ${fmtPct(b.annualDte)} of the year; ${b.visibleFromSite ? "in line of sight" : "not in line of sight"} from the site`, b.annualDte * 100, BOTH,
      { note: "Within the analysis grid around the site; assumes a 10 m mast at the high point." });
  } else na("earth.high-ground-terrestrial-los-reflector-relay-opportunity", "Area grid statistics are still computing.");
  if (sens) comp("earth.earth-visibility-sensitivity-to-tower-height-three-disk-levels", sens.heights.map((h) => `${h.heightM} m: ${fmtPct(h.dte0 / spanH)}/${fmtPct(h.dte / spanH)}/${fmtPct(h.dte100 / spanH)}`).join(" · "), null, [...BOTH, "bryant-2009"], { note: "Any / selected / full Earth disk visible, by mast height." });
  else na("earth.earth-visibility-sensitivity-to-tower-height-three-disk-levels", "Sensitivity runs are still computing.");

  /* ================= 🌕 Spatial ================= */
  comp("spatial.selenographic-latitude", fmtDeg(tr.site.lat, 4), tr.site.lat, ["lroc-sites"]);
  comp("spatial.selenographic-longitude", `${fmtDeg(tr.site.lon, 4)} E`, tr.site.lon, ["lroc-sites"]);
  comp("spatial.site-elevation-above-datum", `${fmtNum(tr.groundM, 0, "m")} above the 1737.4 km sphere`, tr.groundM, TER);
  comp("spatial.planetographic-reference-frame", "Moon Mean Earth/Polar Axis (as used by LOLA and Horizons)", null, ["naif-spice", "jpl-horizons"]);
  comp("spatial.map-projection-grid", tr.dem.label, tr.dem.resolutionM, TER);
  const dPole = greatCircleKm(tr.site.lat, tr.site.lon, tr.site.lat < 0 ? -90 : 90, 0, CONST.moonRadiusKm);
  comp("spatial.distance-to-pole", fmtNum(dPole, 1, "km"), dPole, ["lroc-sites", "lola-pds"], { note: "Great-circle distance on the 1737.4 km LOLA reference sphere." });
  const lonAbs = Math.abs(tr.site.lon);
  comp("spatial.nearside-farside-orientation", lonAbs <= 90 ? `Near side (${fmtPct(dteH / spanH)} Earth view this mission)` : `Far side (${fmtPct(dteH / spanH)} Earth view this mission)`, lonAbs, EPH);
  const f0 = tr.features[0];
  comp("spatial.named-region-landmark-proximity", f0 ? `${f0.name} (${f0.type}) ${f0.distKm.toFixed(1)} km ${compass(f0.bearingDeg)}` : "No named feature nearby", f0?.distKm ?? null, ["usgs-gazetteer"],
    { detail: tr.features.slice(0, 6).map((f) => `${f.name}: ${f.distKm.toFixed(1)} km ${compass(f.bearingDeg)}`).join("\n") });
  assume("spatial.landing-site-area-footprint", `${a.footprintRadiusM} m radius (${fmtNum((Math.PI * a.footprintRadiusM ** 2) / 1e6, 3, "km²")})`, a.footprintRadiusM);
  const nOther = nearest(() => true);
  comp("spatial.nearby-infrastructures-exclusion-zones", nOther ? `Nearest other site: ${nOther.x.name}, ${nOther.d.toFixed(1)} km` : "No other curated site", nOther?.d ?? null, ["nasa-clps", "lroc-sites"]);

  /* ================= 🪨 Terrain ================= */
  comp("terrain.terrain-elevation-model-dem", tr.dem.label, tr.dem.resolutionM, TER);
  comp("terrain.local-slope-magnitude", slope === null ? "—" : `${fmtDeg(slope, 1)} over ${tr.slope!.baselineM} m baseline`, slope, TER, { rating: rated(R.slope, slope) });
  comp("terrain.slope-aspect", aspect === null ? "—" : `Faces ${compass(aspect)} (${fmtDeg(aspect, 0)})`, aspect, TER);
  comp("terrain.micro-roughness-relief", tr.reliefM === null ? "—" : `${fmtNum(tr.reliefM, 0, "m")} relief within 1 km`, tr.reliefM, TER, { note: `At ${tr.dem.resolutionM} m DEM scale; metre-scale roughness needs LROC NAC data.` });
  na("terrain.boulder-size-and-abundance", "Needs boulder mapping from LROC NAC images at this site; no ready-made polar dataset at landing-hazard scale.", ["lroc-sites"]);
  na("terrain.crater-size-and-abundance", "Needs a crater catalogue at metre scale (from LROC NAC); the named-feature gazetteer only lists large craters.", ["usgs-gazetteer"]);
  if (grid) comp("terrain.obstacle-free-landing-area", `${fmtPct(grid.lowSlopeFrac)} of the area has slope ≤ ${a.slopeToleranceDeg}°`, grid.lowSlopeFrac * 100, TER, { note: "Slope only, at DEM scale; rocks and small craters not included.", rating: rated(R.areaPct, grid.lowSlopeFrac * 100) });
  else na("terrain.obstacle-free-landing-area", "Area grid statistics are still computing.");
  const maxHz = Math.max(...sc.mask.elev);
  const maxHzAz = sc.mask.elev.indexOf(maxHz) * sc.mask.stepDeg;
  comp("terrain.horizon-elevation-profile-mask", `Highest horizon ${fmtDeg(maxHz, 2)} toward ${compass(maxHzAz)}; mean ${fmtDeg(sc.mask.elev.reduce((p, q) => p + q, 0) / sc.mask.elev.length, 2)}`, maxHz, TER);
  const k0 = tr.heightsM.indexOf(0) >= 0 ? 0 : 0;
  const farIdx = tr.masks[k0].indexOf(Math.max(...tr.masks[k0]));
  comp("terrain.horizon-azimuth-far-field-occlusion", `Horizon-setting terrain toward ${compass(farIdx * tr.stepDeg)} is ${fmtNum(tr.maskDistKm[farIdx], 1, "km")} away`, tr.maskDistKm[farIdx], TER,
    { note: `Masks are traced out to ${tr.maxRangeKm} km, including the Moon's curvature.` });
  comp("terrain.vertical-clearance-edge-drop", tr.maxDropM === null ? "—" : `Up to ${fmtNum(tr.maxDropM, 0, "m")} lower within 500 m`, tr.maxDropM, TER);
  model("terrain.terrain-visibility-from-spacecraft", sunNow.el >= a.minSunElevForOpticalNavDeg && litNow ? "Lit with long shadows: good relief contrast for cameras" : "Dark or Sun too low at landing: camera navigation unlikely", sunNow.el, EPH);
  na("terrain.surface-material-blockiness", "Needs rock-abundance mapping; Diviner rock abundance does not cover polar latitudes reliably.", ["diviner"]);

  /* ================= 🪨 Regolith ================= */
  ref("regolith.regolith-thickness", "regolith_thickness_highlands", "No measured regolith thickness exists at this site; reference values are pending citation.");
  ref("regolith.particle-size-distribution", "regolith_median_particle_size", "Reference value pending citation.");
  ref("regolith.bulk-density-porosity", "regolith_bulk_density_0_60cm", "Reference value pending citation.", ["regolith_bulk_density_top15cm", "regolith_porosity_0_60cm"]);
  ref("regolith.cohesion-and-internal-friction", "regolith_cohesion_0_60cm", "Reference value pending citation.", ["regolith_friction_angle_0_60cm", "regolith_cohesion_0_15cm"]);
  const pressureKPa = (a.landerMassKg * CONST.moonGravity) / a.footpadAreaM2 / 1000;
  model("regolith.bearing-capacity-and-expected-sinkage", `Footpad pressure ${fmtNum(pressureKPa, 1, "kPa")}`, pressureKPa, ["nssdc-moon"],
    { note: refs.regolith_ultimate_bearing_capacity_1m_footing ? `Reference ultimate bearing capacity (1 m footing): ${refs.regolith_ultimate_bearing_capacity_1m_footing.value} ${refs.regolith_ultimate_bearing_capacity_1m_footing.unit} (${refs.regolith_ultimate_bearing_capacity_1m_footing.sourceTitle}).` : "Compare with your soil-strength assumption." });
  na("regolith.soil-abrasiveness-dust-adhesion", "No quantitative, cited abrasiveness index exists for this site; lunar dust is known to be abrasive and adhesive (Lunar Sourcebook), but a number would be invented.", ["reference-literature"]);
  let termH = 0;
  for (let i = 0; i < s.n; i++) if (Math.abs(s.sunEl[i] - s.sunHz[i]) < 1) termH += s.stepMs / HOUR_MS;
  comp("regolith.electrostatic-charging-dust-lofting", `${fmtHours(termH)} with the Sun within 1° of the horizon (terminator-like charging conditions)`, termH, BOTH,
    { note: refs.surface_potential_terminator ? `Reference terminator surface potential: ${refs.surface_potential_terminator.value} ${refs.surface_potential_terminator.unit} (${refs.surface_potential_terminator.sourceTitle}).` : "Proxy: the strongest surface-charge contrasts occur near the lit/shadow boundary." });
  na("regolith.local-magnetic-anomalies", "Lunar Prospector/Kaguya magnetic maps are not yet ingested.");
  {
    const rho = refs.regolith_bulk_density_0_60cm ? Number(refs.regolith_bulk_density_0_60cm.value) : null;
    if (rho && refs.regolith_dielectric_permittivity_vs_density) {
      const k = Math.pow(1.9, rho);
      const tand = Math.pow(10, 0.44 * rho - 2.943);
      put("regolith.surface-dielectric-rf-properties", {
        status: "reference", value: k, display: `ε′ ≈ ${k.toFixed(2)}, tan δ ≈ ${tand.toFixed(4)} (at ${rho} g/cm³)`, sources: ["reference-literature"],
        note: `From the Lunar Sourcebook relations k′ = 1.9^ρ and tan δ = 10^(0.440ρ − 2.943) at the reference 0–60 cm bulk density. Global, not site-specific; ice or composition would change it.`,
        detail: [refs.regolith_dielectric_permittivity_vs_density, refs.regolith_loss_tangent_vs_density].filter(Boolean).map((m) => `${m.sourceTitle}${m.page ? `, ${m.page}` : ""}\n${m.sourceUrl}`).join("\n\n"),
      });
    } else na("regolith.surface-dielectric-rf-properties", "Reference relation not loaded.");
  }
  ref("regolith.lunar-seismic-moonquake-environment", "deep_moonquakes_total_apollo", "Reference value pending citation.", ["shallow_moonquakes_total_apollo", "meteoroid_impacts_seismic_rate"]);
  if (temps) {
    comp("regolith.surface-temperature-time-series", `Modelled ${fmtNum(tMin, 0, "K")}–${fmtNum(tMax, 0, "K")} during the mission`, tMax, [...BOTH, "nssdc-moon"],
      { note: "Instant radiative-equilibrium estimate from sunlight on the local slope (no heat storage); real nights are warmer than this model's floor." });
    const dv = tr.diviner;
    if (dv && dv.summerMaxK !== null) {
      comp("regolith.minimum-maximum-surface-temperature", `Measured: summer max ${fmtNum(dv.summerMaxK, 0, "K")} · winter min ${fmtNum(dv.winterMinK, 0, "K")}`, dv.summerMaxK, ["diviner"],
        { note: `LRO Diviner seasonal polar maps (240 m pixels). This mission's model range: ${fmtNum(Math.max(tMin, 0), 0, "K")}–${fmtNum(tMax, 0, "K")}.${refs.coldest_psr_temperature_dsne ? ` Coldest measured PSR anywhere: ${refs.coldest_psr_temperature_dsne.value} K.` : ""}` });
    } else {
      comp("regolith.minimum-maximum-surface-temperature", `${fmtNum(Math.max(tMin, 0), 0, "K")} / ${fmtNum(tMax, 0, "K")} (model)`, tMax, [...BOTH, "nssdc-moon"],
        { note: `Diviner polar maps only cover poleward of 80°S.${refs.equatorial_max_temperature_dsne ? ` NASA design values at the equator: max ${refs.equatorial_max_temperature_dsne.value} K, min ${refs.equatorial_min_temperature_dsne?.value ?? "—"} K.` : ""}` });
    }
    comp("regolith.temperature-gradient-cycling-rate", `Up to ${fmtNum(maxRate, 1, "K/h")} (model)`, maxRate, BOTH);
  } else for (const id of ["regolith.surface-temperature-time-series", "regolith.minimum-maximum-surface-temperature", "regolith.temperature-gradient-cycling-rate"]) na(id, "Needs local slope from the DEM.");
  ref("regolith.regolith-thermal-inertia", "diviner_thermal_inertia_global_mean", "Reference value pending citation.", ["diviner_thermal_inertia_diurnal_range"]);

  /* ================= 🛬 Landing ================= */
  assume("landing.touchdown-dispersion-ellipse", `${a.footprintRadiusM} m radius`, a.footprintRadiusM);
  model("landing.terrain-relative-navigation-capability", sunNow.el >= a.minSunElevForOpticalNavDeg && litNow ? "Optical navigation feasible at landing" : "Too dark for optical navigation at landing", sunNow.el, EPH);
  na("landing.hazard-detection-and-avoidance-envelope", "Vehicle sensor and propulsion envelope; enter it from your lander's specification.");
  assume("landing.lander-slope-tilt-tolerance", `${a.slopeToleranceDeg}°`, a.slopeToleranceDeg);
  model("landing.landing-footpad-bearing-pressure", `${fmtNum(pressureKPa, 1, "kPa")} (mass × lunar g ÷ pad area)`, pressureKPa, ["nssdc-moon"]);
  na("landing.plume-surface-interaction", "Needs engine and plume modelling for your vehicle.");
  const glareSep = Math.abs((((sunNow.az - a.approachAzDeg + 540) % 360) - 180));
  model("landing.descent-sun-glare-and-visual-contrast", glareSep < 30 && sunNow.el > -1 ? `Sun ${glareSep.toFixed(0)}° from the approach direction: glare risk` : `Sun ${glareSep.toFixed(0)}° off the approach direction`, glareSep, EPH);
  const hzApproach = horizonAt(sc.mask, a.approachAzDeg);
  model("landing.descent-path-terrain-clearance", `Terrain toward the approach (${compass(a.approachAzDeg)}) rises to ${fmtDeg(hzApproach, 2)} above horizontal`, hzApproach, TER);
  if (grid) model("landing.landing-area-hazard-probability", `${fmtPct(1 - grid.lowSlopeFrac)} of the surrounding area is steeper than ${a.slopeToleranceDeg}°`, (1 - grid.lowSlopeFrac) * 100, TER, { note: "Slope hazard only at DEM scale.", rating: rated(R.hazardPct, (1 - grid.lowSlopeFrac) * 100) });
  else na("landing.landing-area-hazard-probability", "Area grid statistics are still computing.");
  model("landing.post-landing-stability-and-egress", slope === null ? "—" : slope <= a.slopeToleranceDeg ? `Stable: slope ${fmtDeg(slope, 1)} within tolerance` : `Unstable: slope ${fmtDeg(slope, 1)} above tolerance`, slope, TER, { rating: rated(R.slope, slope) });

  /* ================= 🌀 Trajectory ================= */
  na("trajectory.earth-launch-window-availability", "Needs your launch vehicle and transfer design.");
  na("trajectory.translunar-transfer-type-time", "Mission design choice (direct, phasing loops or low-energy transfer).");
  na("trajectory.arrival-orbit-geometry", "Mission design choice (e.g. low polar orbit or NRHO).");
  na("trajectory.orbital-phasing-descent-opportunities", "Needs the arrival orbit to compute overflight times.");
  assume("trajectory.approach-direction-azimuth", `${a.approachAzDeg}° (${compass(a.approachAzDeg)})`, a.approachAzDeg);
  na("trajectory.delta-v-budget-reserve", "Needs vehicle mass and propulsion data.");
  const descentLit = litNow ? "lit" : "dark";
  model("trajectory.descent-lighting-comm-continuity", `At landing: site ${descentLit}, Earth ${dteNow ? "in view" : "hidden"}`, (litNow ? 1 : 0) + (dteNow ? 1 : 0), BOTH);
  na("trajectory.propellant-and-payload-mass-margin", "Needs vehicle mass and propulsion data.");
  na("trajectory.departure-ascent-rendezvous-timing", "Only applies to crewed ascent missions; needs the orbit design.");
  const alt = others.filter((x) => Math.abs(x.lat) > 80).map((x) => ({ x, d: greatCircleKm(tr.site.lat, tr.site.lon, x.lat, x.lon, CONST.moonRadiusKm) })).sort((p, q) => p.d - q.d).slice(0, 3);
  comp("trajectory.landing-abort-alternate-sites", alt.length ? alt.map((p) => `${p.x.name} ${p.d.toFixed(0)} km`).join(" · ") : "No alternates in the curated list", alt[0]?.d ?? null, ["nasa-artemis", "nasa-clps"]);

  /* ================= 🔬 Science ================= */
  comp("science.scientific-target-identification", tr.features.length ? tr.features.slice(0, 4).map((f) => f.name).join(", ") + (tr.psr ? `; nearest PSR ${tr.psr.nearestKm.toFixed(1)} km` : "") : "—", tr.features.length, ["usgs-gazetteer", "psr-atlas"]);
  comp("science.distance-to-science-targets", tr.psr ? `Nearest permanently shadowed region ${tr.psr.nearestKm.toFixed(1)} km ${compass(tr.psr.bearingDeg)}` : "No PSR within the analysis range", tr.psr?.nearestKm ?? null, ["psr-atlas", "lola-pds"], { rating: rated(R.psrKm, tr.psr?.nearestKm ?? null) });
  na("science.geologic-units-stratigraphy", "The USGS Unified Geologic Map of the Moon is not yet ingested.");
  na("science.rock-composition-spectral-minerals", "Orbital spectral maps are unreliable in polar shadow; not ingested.");
  na("science.geologic-age-crater-chronology", "Needs crater counts for the local surface unit.");
  if (grid) comp("science.permanently-shadowed-region-psr-coverage", `${grid.neverLitPoints} of ${grid.points.length} grid cells never sunlit in the next year (${fmtNum(grid.neverLitPoints * grid.cellKm2, 1, "km²")})`, grid.neverLitPoints * grid.cellKm2, BOTH,
    { note: "True PSRs are defined over the 18.6-year cycle; one year over-counts slightly." });
  else na("science.permanently-shadowed-region-psr-coverage", "Area grid statistics are still computing.");
  if (tr.psr) model("science.psr-access-distance-and-difficulty", `${tr.psr.nearestKm.toFixed(1)} km ≈ ${fmtHours((tr.psr.nearestKm * 1000) / a.roverSpeedMPerH)} drive, ${fmtNum(tr.psr.nearestKm * a.roverWhPerKm, 0, "Wh")}`, tr.psr.nearestKm, ["psr-atlas", "lola-pds"]);
  else na("science.psr-access-distance-and-difficulty", "No PSR within the analysis range.");
  na("science.hydrogen-proxy-concentration", "LEND / Lunar Prospector neutron maps are not yet ingested.");
  na("science.water-ice-abundance-estimate", "No direct measurement at this site; orbital estimates are coarse and model-dependent.");
  na("science.ice-physical-state-and-depth", "Needs in-situ or radar sounding data.");
  if (tr.diviner?.summerMaxK != null) comp("science.cold-trap-thermal-stability", `Measured summer maximum ${fmtNum(tr.diviner.summerMaxK, 0, "K")} at the site${tr.psr ? `; nearest PSR ${tr.psr.nearestKm.toFixed(1)} km` : ""}`, tr.diviner.summerMaxK, ["diviner", "psr-atlas"],
    { note: "Colder maximum temperatures retain volatiles longer. The site itself is usually lit; cold traps are in nearby shadowed regions." });
  else na("science.cold-trap-thermal-stability", "Diviner polar temperature maps cover only poleward of 80°S.", ["diviner"]);
  na("science.other-volatiles-organics", "Needs in-situ measurements.");
  na("science.resource-extraction-feasibility", "Needs ice abundance and extraction hardware assumptions.");
  const kinds = new Set(tr.features.filter((f) => f.distKm <= 30).map((f) => f.type));
  comp("science.science-diversity-score", `${kinds.size} feature type${kinds.size === 1 ? "" : "s"} within 30 km${tr.psr && tr.psr.nearestKm < 15 ? " + PSR" : ""}`, kinds.size + (tr.psr && tr.psr.nearestKm < 15 ? 1 : 0), ["usgs-gazetteer", "psr-atlas"]);
  model("science.instrument-deployment-suitability", slope !== null && slope <= a.slopeToleranceDeg && litH > 0 ? "Suitable: gentle slope with sunlight" : "Limited: steep or dark", slope, BOTH);

  /* ================= 🧰 Logistics ================= */
  const firstJoint = w.joint[0];
  model("logistics.activity-timeline-critical-path", firstJoint ? `First joint power+comm window ${fmtUTC(firstJoint.start)} (${fmtHours(H(firstJoint.end - firstJoint.start))})` : "No joint window", firstJoint ? H(firstJoint.start - t0) : null, BOTH);
  comp("logistics.operational-mode-autonomy-rules", `Must run autonomously for up to ${fmtHours(longestNoDteH)} without Earth contact`, longestNoDteH, BOTH, { rating: rated(R.blackoutH, longestNoDteH) });
  na("logistics.consumables-spares-reserves", "Mission architecture input.");
  model("logistics.command-telemetry-buffer", `${fmtNum((ln.maxRateWorstBps * 0.1 * longestNoDteH * 3600) / 8 / 1e9, 2, "GB")} to store (10% of link rate during the longest blackout)`, longestNoDteH, BOTH);
  if (grid) comp("logistics.deployment-and-workspace-area", `${fmtNum(grid.points.filter((p) => p.slope !== null && p.slope <= 5).length * grid.cellKm2, 1, "km²")} with slope ≤ 5°`, grid.points.filter((p) => p.slope !== null && p.slope <= 5).length * grid.cellKm2, TER);
  else na("logistics.deployment-and-workspace-area", "Area grid statistics are still computing.");
  na("logistics.anchor-structure-erectability", "Needs soil-strength measurements at the site.");
  comp("logistics.ground-station-schedules-downlink-priority", `DSN can see the Moon ${fmtPct(H(totalMs(w.dsn)) / spanH)} of the mission`, (100 * H(totalMs(w.dsn))) / spanH, ["dsn-810-005", "jpl-horizons"],
    { note: "Geometric visibility only; actual DSN time is scheduled and shared.", rating: rated(R.dtePct, (100 * H(totalMs(w.dsn))) / spanH) });
  const nb = nearest(() => true);
  comp("logistics.nearby-landings-plume-exclusion", nb ? `${nb.x.name} is ${nb.d.toFixed(1)} km away` : "No nearby curated landing", nb?.d ?? null, ["nasa-clps", "lroc-sites"]);
  const sunsetNext = litNow ? litNow.end : null;
  comp("logistics.operational-safety-margins-reserve-time", sunsetNext ? `${fmtHours(H(sunsetNext - t0))} until first sunset` : nextSunrise ? `Wait ${fmtHours(H(nextSunrise.start - t0))} for sunrise` : "No sunlight in the window", sunsetNext ? H(sunsetNext - t0) : null, BOTH);
  const prior = nearest((x) => ["apollo", "clps-past", "international-past", "commercial-past"].includes(x.group));
  comp("logistics.site-infrastructure-reuse-potential", prior ? `Nearest past landing: ${prior.x.name}, ${prior.d.toFixed(0)} km` : "No prior landing nearby", prior?.d ?? null, ["lroc-sites"]);

  /* ================= 🛞 Rover ================= */
  if (grid) {
    const steep = grid.points.filter((p) => p.slope !== null && p.slope > 15).length;
    comp("rover.traversable-slope-cross-slope", `${fmtPct(1 - steep / grid.points.length)} of the area under 15°`, (1 - steep / grid.points.length) * 100, TER, { note: refs.viper_slope_capability ? `15° = NASA VIPER rover slope capability (${refs.viper_slope_capability.sourceTitle}).` : undefined, rating: rated(R.areaPct, (1 - steep / grid.points.length) * 100) });
  } else na("rover.traversable-slope-cross-slope", "Area grid statistics are still computing.");
  na("rover.route-obstacle-density", "Needs boulder and crater mapping at metre scale.");
  if (tr.psr) {
    const routeKm = tr.psr.nearestKm;
    comp("rover.route-length-and-cumulative-ascent", `${routeKm.toFixed(1)} km straight-line to the nearest PSR`, routeKm, ["psr-atlas", "lola-pds"], { note: "Straight line; a real route is longer." });
    model("rover.travel-speed-slip", `${a.roverSpeedMPerH} m/h → ${fmtHours((routeKm * 1000) / a.roverSpeedMPerH)} one way`, a.roverSpeedMPerH, []);
    model("rover.traverse-energy-consumption", `${fmtNum(routeKm * a.roverWhPerKm * 2, 0, "Wh")} round trip`, routeKm * a.roverWhPerKm * 2, ["psr-atlas"]);
    model("rover.route-temporal-feasibility-return-margin", sunsetNext ? (H(sunsetNext - t0) > (2 * routeKm * 1000) / a.roverSpeedMPerH ? "Round trip fits before sunset" : "Round trip does not fit before sunset") : "No sunlit window at landing", sunsetNext ? H(sunsetNext - t0) - (2 * routeKm * 1000) / a.roverSpeedMPerH : null, BOTH);
  } else for (const id of ["rover.route-length-and-cumulative-ascent", "rover.travel-speed-slip", "rover.traverse-energy-consumption", "rover.route-temporal-feasibility-return-margin"]) na(id, "No PSR target within the analysis range to plan a route to.");
  if (grid) {
    const meanLit = grid.points.reduce((p, q) => p + q.missionLit, 0) / grid.points.length;
    comp("rover.dynamic-sunlight-along-route", `Area around the site averages ${fmtPct(meanLit)} sunlit this mission`, meanLit * 100, BOTH, { rating: rated(R.sunPct, meanLit * 100) });
    const meanDte = grid.points.reduce((p, q) => p + q.annualDte, 0) / grid.points.length;
    comp("rover.dynamic-communications-along-route", `Area around the site averages ${fmtPct(meanDte)} Earth view (year)`, meanDte * 100, BOTH);
    comp("rover.safe-haven-waypoints", grid.safeHaven ? `Best lit, gentle cell ${grid.safeHaven.distKm.toFixed(1)} km away (${fmtPct(grid.safeHaven.missionLit)} sunlit)` : "None found", grid.safeHaven?.distKm ?? null, BOTH);
  } else for (const id of ["rover.dynamic-sunlight-along-route", "rover.dynamic-communications-along-route", "rover.safe-haven-waypoints"]) na(id, "Area grid statistics are still computing.");
  na("rover.localization-navigation-uncertainty", "Depends on rover sensors and software.");
  comp("rover.visibility-visual-ergonomics", sunNow.el > 0 ? `Sun ${fmtDeg(sunNow.el, 1)} high: shadows ${fmtNum(shadowLen, 0, "×")} object height` : "Sun below horizon: lights needed", sunNow.el, EPH);
  na("rover.route-science-yield-vs-cost", "Needs science objectives and their value weights.");

  /* ================= ☄️ Space weather ================= */
  ref("space-weather.solar-energetic-particle-sep-events", "large_spe_dose_range_average_shielding", "Reference value pending citation.", ["crater_sep_event_dose_june2011"]);
  ref("space-weather.galactic-cosmic-ray-exposure", "crater_gcr_dose_rate_peak_lunar_orbit", "Reference value pending citation.", ["lunar_surface_dose_scaling_dsne", "lunar_surface_dose_equivalent_change4"]);
  na("space-weather.radiation-dose-behind-shielding", "Needs your shielding design (material and thickness).");
  ref("space-weather.surface-plasma-solar-wind-environment", "solar_wind_proton_flux_1au", "Reference value pending citation.", ["surface_potential_dayside_solar_wind", "surface_potential_nightside_solar_wind"]);
  ref("space-weather.micrometeoroid-background-impact-flux", "meteoroid_flux_30g_lunar_impact_monitoring", "Reference value pending citation.", ["meteoroid_velocity_at_moon"]);
  na("space-weather.predictable-meteor-stream-exposure", "Meteor shower forecasts for the Moon are not yet ingested.");
  na("space-weather.known-asteroid-or-comet-lunar-impact-risk", "Needs a lunar-impact assessment feed for catalogued asteroids; none is ingested.");
  ref("space-weather.recent-local-impact-detection-new-craters", "lroc_new_craters_count", "Reference value pending citation.", ["lroc_temporal_pair_timespan", "lroc_new_crater_size_range"]);
  comp("space-weather.eclipse-occultation-by-orbital-bodies", w.eclipse.length ? `${w.eclipse.length} Earth eclipse(s) of the Sun` : "No eclipses during the mission", w.eclipse.length, EPH);
  na("space-weather.radiation-impact-event-alert-confidence", "Needs a live space-weather forecast feed.");

  /* ================= 📌 Heritage ================= */
  const prev = nearest((x) => ["apollo", "clps-past", "international-past", "commercial-past"].includes(x.group));
  comp("heritage.previous-landing-impact-locations", prev ? `${prev.x.name}: ${prev.d.toFixed(0)} km ${compass(brg(tr.site.lat, tr.site.lon, prev.x.lat, prev.x.lon))}` : "None in the curated list", prev?.d ?? null, ["lroc-sites", "nasa-clps"]);
  comp("heritage.mission-outcome-and-anomaly-history", prev ? `${prev.x.name}: ${prev.x.status ?? "outcome recorded on the site page"}` : "—", null, ["nasa-clps", "lroc-sites"], { detail: prev?.x.notes });
  comp("heritage.prior-orbital-coverage-repeat-imagery", "Covered by LRO LOLA, LROC and Diviner (global, polar-focused orbit since 2009)", null, ["lola-pds", "lroc-sites", "diviner"]);
  const insitu = nearest((x) => ["apollo", "clps-past", "international-past"].includes(x.group) && (x.status ?? "").startsWith("landed"));
  comp("heritage.prior-in-situ-chemistry-soil-observations", insitu ? `Nearest successful lander: ${insitu.x.name}, ${insitu.d.toFixed(0)} km` : "None", insitu?.d ?? null, ["lroc-sites"]);
  comp("heritage.documented-hazard-or-rover-traverse-events", prev?.x.notes ? `${prev.x.name}: ${prev.x.notes}` : "None recorded nearby", null, ["nasa-clps", "lroc-sites"]);
  const fut = nearest((x) => ["clps-future", "commercial-future", "international-future", "artemis-region"].includes(x.group));
  comp("heritage.nearby-active-planned-missions-interference", fut ? `${fut.x.name}: ${fut.d.toFixed(0)} km` : "None", fut?.d ?? null, ["nasa-clps", "nasa-artemis"]);
  const apollo = nearest((x) => x.group === "apollo");
  const artifact = nearest((x) => ["apollo", "clps-past", "commercial-past", "international-past"].includes(x.group));
  comp("heritage.cultural-heritage-preservation-zones", artifact ? `Nearest historic artifact: ${artifact.x.name}, ${artifact.d.toFixed(1)} km${apollo ? ` · nearest Apollo site ${apollo.d.toFixed(0)} km` : ""}` : "—", artifact?.d ?? null, ["lroc-sites", "reference-literature"],
    { note: refs.heritage_touchdown_targeting_min_distance ? `NASA 2011 guidance: target touchdown at least ${refs.heritage_touchdown_targeting_min_distance.value} ${refs.heritage_touchdown_targeting_min_distance.unit} from U.S. Government lunar artifacts (it applies to U.S. sites; used here as a general courtesy distance).` : undefined,
      rating: rated(R.heritageKm, artifact?.d ?? null) });

  // Safety net: anything in the catalog not handled above is reported, never silently blank.
  for (const m of catalog.metrics) if (!out[m.id]) na(m.id, "Not modelled yet.");
  return out;
}

/** Category → its metric ratings, for roll-ups. */
export function categoryRatings(values: Record<string, MetricValue>) {
  const res: Record<string, ReturnType<typeof Object.values>> = {};
  for (const c of catalog.categories) res[c.id] = c.metricIds.map((id) => values[id]?.rating).filter(Boolean);
  return res as Record<string, NonNullable<MetricValue["rating"]>[]>;
}

export { hours };
