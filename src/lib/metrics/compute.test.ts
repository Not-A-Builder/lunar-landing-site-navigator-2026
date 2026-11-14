import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS } from "@/lib/assumptions";
import { decodeYear, EphemerisSet } from "@/lib/engine/ephemeris";
import { buildScenario } from "@/lib/engine/scenario";
import type { TerrainFile } from "@/lib/engine/terrain-file";
import { catalog } from "@/lib/metrics";
import refsJson from "@/data/references.json";
import { computeAllMetrics, type RefValue } from "./compute";

const root = join(__dirname, "../../..");
const idx = JSON.parse(readFileSync(join(root, "public/data/ephemeris/index.json"), "utf8"));
const eph = new EphemerisSet();
for (const y of [2026, 2027]) {
  const b = readFileSync(join(root, `public/data/ephemeris/${y}.bin`));
  eph.add(decodeYear(y, idx.years[String(y)], idx.stepMinutes, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)));
}

// Synthetic flat terrain (horizon at 0°) at a south-polar coordinate: exercises every code path.
const flat = new Array(360).fill(0);
const terrain: TerrainFile = {
  version: 1,
  site: { lat: -86.7, lon: -23.7 },
  dem: { id: "synthetic", resolutionM: 120, label: "synthetic flat" },
  groundM: 0,
  stepDeg: 1,
  heightsM: [0, 2, 10],
  masks: [flat, flat, flat],
  maskDistKm: new Array(360).fill(10),
  offsets: [0, 90, 180, 270].map((b) => ({ bearingDeg: b, km: 1, mask: flat })),
  slope: { deg: 3, aspectDeg: 10, baselineM: 120 },
  reliefM: 50,
  maxDropM: 20,
  grid: { spacingKm: 1, halfSizeKm: 1, maskStepDeg: 2, observerHeightM: 2, points: [] },
  psr: { nearestKm: 4.2, bearingDeg: 120, label: "test" },
  features: [{ name: "Test crater", type: "Crater", distKm: 3, bearingDeg: 40, diameterKm: 10 }],
  computedAt: "",
  maxRangeKm: 200,
};

describe("computeAllMetrics", () => {
  const refs = Object.fromEntries((refsJson.values as RefValue[]).map((r) => [r.key, r]));
  const scenario = buildScenario({ eph, terrain, landingMs: Date.UTC(2026, 11, 1), assumptions: DEFAULT_ASSUMPTIONS });
  const vals = computeAllMetrics({ scenario, terrain, site: { id: "t", name: "T", polar: true }, multi: null, grid: null, sens: null, pct: null, peers: [], allSites: [], refs });

  it("returns a value for every catalog metric, none silently unhandled", () => {
    for (const m of catalog.metrics) {
      expect(vals[m.id], m.id).toBeDefined();
      expect(vals[m.id].reason ?? "", m.id).not.toBe("Not modelled yet.");
    }
  });

  it("every non-unavailable value cites at least one source", () => {
    for (const v of Object.values(vals)) if (v.status !== "unavailable") expect(v.sources.length, v.id).toBeGreaterThan(0);
  });

  it("flat horizon at 86.7°S gives physically sensible sunlight", () => {
    const lit = vals["sun.solar-availability-fraction"].value!;
    expect(lit).toBeGreaterThanOrEqual(0);
    expect(lit).toBeLessThanOrEqual(100);
    expect(vals["earth.two-way-light-time-and-latency"].display).toMatch(/s round trip/);
  });
});

describe("educator copy", () => {
  it("exists for every metric, with {value} only in the lead", async () => {
    const copy = (await import("@/data/educator-copy.json")).default as { metrics: Record<string, { lead: string; explain: string; readIt: string }> };
    for (const m of catalog.metrics) {
      const c = copy.metrics[m.id];
      expect(c, m.id).toBeDefined();
      expect(c.explain.includes("{value}") || c.readIt.includes("{value}"), m.id).toBe(false);
    }
  });
});
