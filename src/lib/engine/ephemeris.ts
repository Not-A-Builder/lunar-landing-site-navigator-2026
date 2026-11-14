/**
 * Moon-wide ephemeris tables (one per calendar year, hourly, from JPL Horizons) and interpolation.
 *
 * Per year, columns (Float32):
 *   sunLon, sunLat   sub-solar point on the Moon (deg, east-positive)       Horizons QUANTITIES 15
 *   sunAU            Sun–Moon distance (AU)                                  Horizons QUANTITIES 19 (r)
 *   earthLon, earthLat  sub-Earth point on the Moon (deg) = optical libration  Horizons QUANTITIES 14
 *   earthAU          Earth–Moon distance (AU)                                Horizons QUANTITIES 20 (delta)
 *   dsnGold, dsnCanb, dsnMadr  Moon elevation above the local horizon at the three DSN complexes (deg)
 * Each year file includes the first sample of the next year so interpolation never crosses files.
 */
import { AU_KM, type SubPoint } from "./geometry";

export const EPHEMERIS_FIELDS = [
  "sunLon", "sunLat", "sunAU", "earthLon", "earthLat", "earthAU", "dsnGold", "dsnCanb", "dsnMadr",
] as const;
export type EphemerisField = (typeof EPHEMERIS_FIELDS)[number];

export type EphemerisYear = {
  year: number;
  t0: number; // epoch ms of first sample (UTC)
  stepMs: number;
  n: number;
  cols: Record<EphemerisField, Float32Array>;
};

export type EphemerisIndex = {
  generatedAt: string;
  source: string;
  stepMinutes: number;
  fields: EphemerisField[];
  years: Record<string, { t0: string; n: number }>;
};

export type EphemerisSample = { sun: SubPoint; earth: SubPoint; dsn: [number, number, number] };

/** Decode a year file (columnar Float32, little-endian). */
export function decodeYear(year: number, meta: { t0: string; n: number }, stepMinutes: number, buf: ArrayBuffer): EphemerisYear {
  const all = new Float32Array(buf);
  const n = meta.n;
  if (all.length !== n * EPHEMERIS_FIELDS.length) throw new Error(`Ephemeris ${year}: size mismatch`);
  const cols = {} as Record<EphemerisField, Float32Array>;
  EPHEMERIS_FIELDS.forEach((f, i) => (cols[f] = all.subarray(i * n, (i + 1) * n)));
  return { year, t0: Date.parse(meta.t0), stepMs: stepMinutes * 60_000, n, cols };
}

function lerpAngle(a: number, b: number, f: number) {
  let d = b - a;
  if (d > 180) d -= 360;
  else if (d < -180) d += 360;
  return a + d * f;
}

export class EphemerisSet {
  private years = new Map<number, EphemerisYear>();

  add(y: EphemerisYear) {
    this.years.set(y.year, y);
  }

  has(year: number) {
    return this.years.has(year);
  }

  covers(t: number) {
    return this.yearFor(t) !== undefined;
  }

  private yearFor(t: number) {
    const yr = new Date(t).getUTCFullYear();
    const y = this.years.get(yr);
    if (y) return y;
    // Each table includes the first sample of the next year, so the previous year can serve that instant.
    const prev = this.years.get(yr - 1);
    if (prev && t <= prev.t0 + (prev.n - 1) * prev.stepMs) return prev;
    return undefined;
  }

  sample(t: number): EphemerisSample {
    const y = this.yearFor(t);
    if (!y) throw new Error(`No ephemeris loaded for ${new Date(t).toISOString()}`);
    const x = (t - y.t0) / y.stepMs;
    const i = Math.max(0, Math.min(y.n - 2, Math.floor(x)));
    const f = x - i;
    const c = y.cols;
    const lin = (k: EphemerisField) => c[k][i] + (c[k][i + 1] - c[k][i]) * f;
    return {
      sun: { lon: lerpAngle(c.sunLon[i], c.sunLon[i + 1], f), lat: lin("sunLat"), distKm: lin("sunAU") * AU_KM },
      earth: { lon: lerpAngle(c.earthLon[i], c.earthLon[i + 1], f), lat: lin("earthLat"), distKm: lin("earthAU") * AU_KM },
      dsn: [lin("dsnGold"), lin("dsnCanb"), lin("dsnMadr")],
    };
  }
}

/** Years (UTC) touched by [start, end]. */
export function yearsBetween(startMs: number, endMs: number): number[] {
  const a = new Date(startMs).getUTCFullYear(), b = new Date(endMs).getUTCFullYear();
  return Array.from({ length: b - a + 1 }, (_, k) => a + k);
}
