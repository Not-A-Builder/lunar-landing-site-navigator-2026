/**
 * Precompute terrain files for every curated site with verified coordinates.
 *   npx tsx pipeline/build-terrain.ts            # all sites
 *   npx tsx pipeline/build-terrain.ts haworth    # one site
 * Output: public/data/terrain/<site>.json and public/data/terrain/peers.json
 * Needs data/raw (pipeline/download-raw.sh) and public/data/ephemeris (fetch-ephemeris.ts).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_ASSUMPTIONS } from "../src/lib/assumptions";
import { decodeYear, EphemerisSet, type EphemerisIndex } from "../src/lib/engine/ephemeris";
import { computeSeries } from "../src/lib/engine/series";
import { buildTerrain } from "../src/lib/engine/terrain-build";
import { loadTerrainContext } from "../src/lib/engine/terrain-context";
import { maskForHeight, type TerrainFile } from "../src/lib/engine/terrain-file";
import sitesJson from "../src/data/sites.json";
import refsJson from "../src/data/references.json";
import { gridStats, landingDatePercentiles, multiYear, sensitivity } from "../src/lib/engine/analysis";
import { buildScenario } from "../src/lib/engine/scenario";
import { computeAllMetrics, type RefValue } from "../src/lib/metrics/compute";

const OUT = join(process.cwd(), "public", "data", "terrain");
const EPH = join(process.cwd(), "public", "data", "ephemeris");
const FROM = Date.UTC(2026, 0, 1), TO = Date.UTC(2030, 0, 1);

function loadEph() {
  const idx: EphemerisIndex = JSON.parse(readFileSync(join(EPH, "index.json"), "utf8"));
  const set = new EphemerisSet();
  for (const y of [2026, 2027, 2028, 2029]) {
    const b = readFileSync(join(EPH, `${y}.bin`));
    set.add(decodeYear(y, idx.years[String(y)], idx.stepMinutes, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)));
  }
  return set;
}

async function main() {
  const only = process.argv[2];
  // `--usage-only`: refresh src/data/source-usage.json from the existing terrain files (no raw data needed)
  if (only === "--usage-only") return sourceUsage(loadEph());
  mkdirSync(OUT, { recursive: true });
  const ctx = await loadTerrainContext();
  const eph = loadEph();
  const a = DEFAULT_ASSUMPTIONS;
  const sites = (sitesJson.sites as { id: string; name: string; lat: number | null; lon: number | null }[]).filter(
    (s) => s.lat !== null && s.lon !== null && (!only || s.id === only),
  );
  const validation: { id: string; name: string; oursSun: number; lolaSun: number; oursEarth: number; lolaEarth: number | null }[] = [];
  const peers: { id: string; name: string; sunlitFrac: number; dteFrac: number; slope: number | null; psrKm: number | null }[] = [];

  for (const s of sites) {
    const t0 = Date.now();
    const tf = buildTerrain(ctx, s.lat!, s.lon!) as TerrainFile;
    const site = { lat: s.lat!, lon: s.lon!, hKm: tf.groundM / 1000 };
    // Independent check against the LOLA team's maps: any part of the disk, at ground level (0 m mask)
    const g = computeSeries(eph, site, maskForHeight(tf, 0), FROM, TO, 2 * 3600_000, { dsnMinEl: a.dsnMinElevDeg });
    let anySun = 0, anyEarth = 0;
    for (let i = 0; i < g.n; i++) {
      if (g.sunFrac[i] > 0) anySun++;
      if (g.earthFrac[i] > 0) anyEarth++;
    }
    if (tf.validation) {
      tf.validation.oursAnySunVis = +(anySun / g.n).toFixed(4);
      tf.validation.oursAnyEarthVis = +(anyEarth / g.n).toFixed(4);
      tf.validation.window = "2026–2029, 2 h steps, ground level";
    }
    writeFileSync(join(OUT, `${s.id}.json`), JSON.stringify(tf));
    if (s.lat! <= -80) {
      const m = computeSeries(eph, { ...site, hKm: (tf.groundM + a.mastHeightM) / 1000 }, maskForHeight(tf, a.mastHeightM), FROM, TO, 2 * 3600_000, { dsnMinEl: a.dsnMinElevDeg });
      let lit = 0, dte = 0;
      for (let i = 0; i < m.n; i++) {
        if (m.sunFrac[i] >= a.sunDiskThreshold) lit++;
        if (m.earthFrac[i] >= a.earthDiskThreshold) dte++;
      }
      peers.push({ id: s.id, name: s.name, sunlitFrac: +(lit / m.n).toFixed(4), dteFrac: +(dte / m.n).toFixed(4), slope: tf.slope?.deg ?? null, psrKm: tf.psr?.nearestKm ?? null });
    }
    const v = tf.validation;
    if (v?.lolaAnySunVis != null && v.oursAnySunVis != null) validation.push({ id: s.id, name: s.name, oursSun: v.oursAnySunVis, lolaSun: +v.lolaAnySunVis.toFixed(4), oursEarth: v.oursAnyEarthVis ?? 0, lolaEarth: v.lolaAnyEarthVis != null ? +v.lolaAnyEarthVis.toFixed(4) : null });
    console.log(
      `${s.id.padEnd(44)} ${((Date.now() - t0) / 1000).toFixed(1)}s  slope ${tf.slope?.deg ?? "-"}°  psr ${tf.psr?.nearestKm ?? "-"} km` +
        (v?.lolaAnySunVis != null ? `  sun ours ${(100 * (v.oursAnySunVis ?? 0)).toFixed(1)}% vs LOLA ${(100 * v.lolaAnySunVis).toFixed(1)}%` : ""),
    );
  }
  if (!only) {
    writeFileSync(join(process.cwd(), "src", "data", "validation.json"), JSON.stringify({ generatedAt: new Date().toISOString(), note: "Share of time any part of the Sun/Earth disk is above the terrain horizon at ground level. Ours: 2026–2029 from JPL Horizons + LOLA LDEM_75S_120M. LOLA: avgvisib_75s_120m_201608 (Mazarico et al. 2011 method).", sites: validation }, null, 1));
    await sourceUsage(eph);
    writeFileSync(join(OUT, "peers.json"), JSON.stringify({ generatedAt: new Date().toISOString(), window: "2026–2029, default assumptions", sites: peers }, null, 1));
  }
}

/** Run every metric once for a representative site and record which sources each metric cites. */
async function sourceUsage(eph: EphemerisSet) {
  const id = "haworth";
  const tf = JSON.parse(readFileSync(join(OUT, `${id}.json`), "utf8")) as TerrainFile;
  const a = DEFAULT_ASSUMPTIONS;
  const landing = Date.UTC(2027, 0, 1);
  // ensure 2027–2028 loaded for the 1-year analyses
  const idx: EphemerisIndex = JSON.parse(readFileSync(join(EPH, "index.json"), "utf8"));
  for (const y of [2027, 2028]) if (!eph.has(y)) { const b = readFileSync(join(EPH, `${y}.bin`)); eph.add(decodeYear(y, idx.years[String(y)], idx.stepMinutes, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))); }
  const scenario = buildScenario({ eph, terrain: tf, landingMs: landing, assumptions: a });
  const multi = multiYear(eph, tf, scenario.mask, a, FROM, TO);
  const sens = sensitivity(eph, tf, a, landing, scenario);
  const p = landingDatePercentiles(eph, tf, scenario.mask, a, landing);
  const grid = gridStats(eph, tf, a, landing, scenario.mask);
  const refs = Object.fromEntries((refsJson.values as RefValue[]).map((r) => [r.key, r]));
  const vals = computeAllMetrics({ scenario, terrain: tf, site: { id, name: "Haworth", polar: true }, multi, grid, sens, pct: { sun: p.sun, earth: p.earth, bestDay: p.bestDay }, peers: [], allSites: [], refs });
  const usage: Record<string, string[]> = {};
  const status: Record<string, number> = {};
  for (const v of Object.values(vals)) {
    status[v.status] = (status[v.status] ?? 0) + 1;
    // Unavailable metrics are not shown anywhere (LOGS D-041), so they don't count as a use of a source.
    if (v.status === "unavailable") continue;
    for (const src of v.sources) (usage[src] ??= []).push(v.id);
  }
  writeFileSync(join(process.cwd(), "src", "data", "source-usage.json"), JSON.stringify({ generatedAt: new Date().toISOString(), basedOn: `${id} @ 2027-01-01`, status, usage }, null, 1) + "\n");
  console.log("metric status counts:", status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
