/**
 * Readers for LOLA gridded products from the PDS Geosciences Node (server/pipeline only: uses fs).
 *   Polar: ldem_75s_120m.img (7624², 120 m/px, polar stereographic, int16 LE × 0.5 m)
 *   Global: ldem_16.img (5760×2880, 16 px/deg, simple cylindrical, int16 LE × 0.5 m)
 * Heights are metres above the 1,737,400 m reference sphere (label OFFSET = 1737400, SCALING_FACTOR = 0.5).
 * Raster products on the same polar grid (e.g. avgvisib_75s_120m) reuse PolarGrid with their own scaling.
 */
import { readFileSync } from "node:fs";
import { DEG } from "./geometry";
import type { Dem } from "./terrain";

const R_REF = 1_737_400;

export type PolarGridSpec = {
  id: string;
  /** path to the raw .img, or pass `buffer` (e.g. decompressed from the deploy bundle) */
  file?: string;
  buffer?: Buffer;
  size: number; // lines = samples
  scaleM: number; // m/px
  offset: number; // LINE/SAMPLE_PROJECTION_OFFSET (pixel of the pole, 0-based centre convention)
  scaling: number;
  add: number;
  /** +1 if image sample increases toward +x (90°E), -1 if mirrored (verified against features) */
  xSign: 1 | -1;
  limitLat: number;
};

/** South polar stereographic grid, bilinear sampling. */
export class PolarGrid {
  private data: Int16Array;
  constructor(public spec: PolarGridSpec) {
    const buf = spec.buffer ?? readFileSync(spec.file!);
    this.data = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
    if (this.data.length !== spec.size * spec.size) throw new Error(`${spec.id}: unexpected size ${this.data.length}`);
  }
  /** fractional (line, sample) for lat/lon */
  pixel(lat: number, lon: number) {
    const rho = 2 * R_REF * Math.tan(((90 + lat) / 2) * DEG);
    const x = rho * Math.sin(lon * DEG);
    const y = rho * Math.cos(lon * DEG);
    return { line: this.spec.offset - y / this.spec.scaleM, sample: this.spec.offset + (this.spec.xSign * x) / this.spec.scaleM };
  }
  raw(line: number, sample: number) {
    const n = this.spec.size;
    if (line < 0 || sample < 0 || line >= n || sample >= n) return null;
    return this.data[line * n + sample];
  }
  sample(lat: number, lon: number): number | null {
    if (lat > this.spec.limitLat) return null;
    const { line, sample } = this.pixel(lat, lon);
    const l0 = Math.floor(line), s0 = Math.floor(sample);
    const a = this.raw(l0, s0), b = this.raw(l0, s0 + 1), c = this.raw(l0 + 1, s0), d = this.raw(l0 + 1, s0 + 1);
    if (a === null || b === null || c === null || d === null) return null;
    const fl = line - l0, fs = sample - s0;
    const v = (a * (1 - fs) + b * fs) * (1 - fl) + (c * (1 - fs) + d * fs) * fl;
    return v * this.spec.scaling + this.spec.add;
  }
  /** nearest-pixel value (for categorical rasters) */
  nearest(lat: number, lon: number): number | null {
    if (lat > this.spec.limitLat) return null;
    const { line, sample } = this.pixel(lat, lon);
    const v = this.raw(Math.round(line), Math.round(sample));
    return v === null ? null : v * this.spec.scaling + this.spec.add;
  }
}

export function polarDem(src: string | Buffer, xSign: 1 | -1): Dem & { grid: PolarGrid } {
  const grid = new PolarGrid({ id: "ldem_75s_120m", ...(typeof src === "string" ? { file: src } : { buffer: src }), size: 7624, scaleM: 120, offset: 3811.5, scaling: 0.5, add: 0, xSign, limitLat: -75 });
  return { id: "LOLA LDEM_75S_120M", resolutionM: 120, grid, sample: (la, lo) => grid.sample(la, lo) };
}

/** Simple-cylindrical global DEM (east longitude 0–360, line 0 = 90°N). */
export function globalDem(src: string | Buffer): Dem {
  const ppd = 16, w = 360 * ppd, h = 180 * ppd;
  const buf = typeof src === "string" ? readFileSync(src) : src;
  const data = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
  if (data.length !== w * h) throw new Error("ldem_16: unexpected size");
  const at = (l: number, s: number) => data[Math.max(0, Math.min(h - 1, l)) * w + (((s % w) + w) % w)];
  return {
    id: "LOLA LDEM_16",
    resolutionM: 1895.21,
    sample(lat, lon) {
      // pixel centres: line = (90 - lat)*ppd - 0.5, sample = lonE*ppd - 0.5 (LINE/SAMPLE_PROJECTION_OFFSET 1439.5/2879.5)
      const line = (90 - lat) * ppd - 0.5;
      const sample = ((((lon % 360) + 360) % 360) * ppd) - 0.5;
      const l0 = Math.floor(line), s0 = Math.floor(sample);
      const fl = line - l0, fs = sample - s0;
      const v = (at(l0, s0) * (1 - fs) + at(l0, s0 + 1) * fs) * (1 - fl) + (at(l0 + 1, s0) * (1 - fs) + at(l0 + 1, s0 + 1) * fs) * fl;
      return v * 0.5;
    },
  };
}
