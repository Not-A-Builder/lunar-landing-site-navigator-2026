/** Export each metric's definition + an example computed value (Haworth, 2027-01-01) for writing persona copy. */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_ASSUMPTIONS } from "../src/lib/assumptions";
import { decodeYear, EphemerisSet, type EphemerisIndex } from "../src/lib/engine/ephemeris";
import { gridStats, landingDatePercentiles, multiYear, sensitivity } from "../src/lib/engine/analysis";
import { buildScenario } from "../src/lib/engine/scenario";
import type { TerrainFile } from "../src/lib/engine/terrain-file";
import { catalog } from "../src/lib/metrics";
import { computeAllMetrics, type RefValue } from "../src/lib/metrics/compute";
import refsJson from "../src/data/references.json";

const EPH = join(process.cwd(), "public/data/ephemeris");
const idx: EphemerisIndex = JSON.parse(readFileSync(join(EPH, "index.json"), "utf8"));
const eph = new EphemerisSet();
for (const y of [2026, 2027, 2028, 2029]) { const b = readFileSync(join(EPH, `${y}.bin`)); eph.add(decodeYear(y, idx.years[String(y)], idx.stepMinutes, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))); }
const tf = JSON.parse(readFileSync("public/data/terrain/haworth.json", "utf8")) as TerrainFile;
const a = DEFAULT_ASSUMPTIONS, landing = Date.UTC(2027, 0, 1);
const sc = buildScenario({ eph, terrain: tf, landingMs: landing, assumptions: a });
const multi = multiYear(eph, tf, sc.mask, a, Date.UTC(2026, 0, 1), Date.UTC(2030, 0, 1));
const sens = sensitivity(eph, tf, a, landing, sc);
const p = landingDatePercentiles(eph, tf, sc.mask, a, landing);
const grid = gridStats(eph, tf, a, landing, sc.mask);
const refs = Object.fromEntries((refsJson.values as RefValue[]).map((r) => [r.key, r]));
const vals = computeAllMetrics({ scenario: sc, terrain: tf, site: { id: "haworth", name: "Haworth", polar: true }, multi, grid, sens, pct: { sun: p.sun, earth: p.earth, bestDay: p.bestDay }, peers: [], allSites: [], refs });
const out = catalog.metrics.map((m) => ({
  id: m.id, category: m.categoryId, name: m.name, question: m.question, definition: m.definition, unit: m.unit,
  significance: m.significance, enthusiast: m.views.enthusiast, status: vals[m.id].status, exampleDisplay: vals[m.id].display,
  note: vals[m.id].note ?? null, reason: vals[m.id].reason ?? null,
}));
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log("wrote", out.length);
