import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONST } from "./constants";
import { decodeYear, EphemerisSet } from "./ephemeris";
import { diskAboveHorizon, diskOverlapFraction, topocentric } from "./geometry";
import { complement, intersect, intervalsFromMargin } from "./windows";

const root = join(__dirname, "../../..");
const idx = JSON.parse(readFileSync(join(root, "public/data/ephemeris/index.json"), "utf8"));
const eph = new EphemerisSet();
const buf = readFileSync(join(root, "public/data/ephemeris/2026.bin"));
eph.add(decodeYear(2026, idx.years["2026"], idx.stepMinutes, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)));

describe("ephemeris table + topocentric engine vs JPL Horizons", () => {
  // Horizons topocentric output (fixture captured 2026-11-14) for site lat -89.45, E-lon 230.22, 1.9 km
  const site = { lat: -89.45, lon: 230.22, hKm: 1.9 };
  it("reproduces Earth az/el within 0.01°", () => {
    const e = eph.sample(Date.UTC(2026, 11, 1, 0));
    const r = topocentric(site, e.earth, CONST.moonRadiusKm);
    expect(r.az).toBeCloseTo(136.439303, 1);
    expect(Math.abs(r.el - -2.009011)).toBeLessThan(0.01);
  });
  it("reproduces Sun az/el within 0.01°, including between hourly samples", () => {
    const e0 = eph.sample(Date.UTC(2026, 11, 1, 0));
    const s0 = topocentric(site, e0.sun, CONST.moonRadiusKm);
    expect(Math.abs(s0.az - 49.855897)).toBeLessThan(0.01);
    expect(Math.abs(s0.el - 1.824772)).toBeLessThan(0.01);
    const e3 = eph.sample(Date.UTC(2026, 11, 1, 3));
    const s3 = topocentric(site, e3.sun, CONST.moonRadiusKm);
    expect(Math.abs(s3.az - 48.33575)).toBeLessThan(0.01);
  });
  it("DSN elevation columns are physical", () => {
    const e = eph.sample(Date.UTC(2026, 5, 1, 12));
    for (const v of e.dsn) expect(Math.abs(v)).toBeLessThanOrEqual(90);
  });
});

describe("geometry", () => {
  it("disk fraction is 0, 0.5 and 1 at the right offsets", () => {
    expect(diskAboveHorizon(1, 0.25, 0)).toBe(1);
    expect(diskAboveHorizon(-1, 0.25, 0)).toBe(0);
    expect(diskAboveHorizon(0, 0.25, 0)).toBeCloseTo(0.5, 6);
    expect(diskAboveHorizon(0.1, 0.25, 0)).toBeGreaterThan(0.5);
  });
  it("disk overlap handles contained, partial and separate", () => {
    expect(diskOverlapFraction(0.25, 0.9, 0)).toBe(1);
    expect(diskOverlapFraction(0.25, 0.9, 2)).toBe(0);
    const p = diskOverlapFraction(0.25, 0.9, 1.0);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });
});

describe("windows", () => {
  it("interpolates crossings and builds complements/intersections", () => {
    const t = [0, 10, 20, 30, 40];
    const v = [-1, 1, 1, -1, -1];
    const iv = intervalsFromMargin(t, (i) => v[i]);
    expect(iv).toHaveLength(1);
    expect(iv[0].start).toBeCloseTo(5);
    expect(iv[0].end).toBeCloseTo(25);
    expect(complement(iv, 0, 40)).toEqual([{ start: 0, end: iv[0].start }, { start: iv[0].end, end: 40 }]);
    expect(intersect(iv, [{ start: 10, end: 50 }])).toEqual([{ start: 10, end: iv[0].end }]);
  });
});
