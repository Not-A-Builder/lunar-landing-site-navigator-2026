/**
 * Server-side builder for one year of the Moon-wide ephemeris table (see engine/ephemeris.ts).
 * Shared by pipeline/fetch-ephemeris.ts (precompute) and /api/ephemeris/[year] (on demand).
 */
import { DSN_COMPLEXES } from "@/lib/engine/dsn";
import { EPHEMERIS_FIELDS } from "@/lib/engine/ephemeris";
import { HORIZONS_URL } from "./horizons";

export const TABLE_STEP_MIN = 60;

async function horizons(params: Record<string, string>): Promise<string> {
  const q = new URLSearchParams({
    format: "json", OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'OBSERVER'",
    ANG_FORMAT: "'DEG'", CSV_FORMAT: "'YES'", ...params,
  });
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${HORIZONS_URL}?${q}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { result?: string; error?: string };
      if (j.error) throw new Error(j.error);
      return j.result!;
    } catch (e) {
      if (attempt >= 4) throw e;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

function rows(result: string): string[][] {
  const a = result.indexOf("$$SOE"), b = result.indexOf("$$EOE");
  if (a < 0 || b < 0) throw new Error("No $$SOE block: " + result.slice(0, 400));
  return result.slice(a + 5, b).trim().split("\n").map((l) => l.split(",").map((x) => x.trim()));
}

/** Returns the columnar Float32 buffer and its metadata for `year` (includes Jan 1 of year+1). */
export async function buildYearTable(year: number): Promise<{ buf: Float32Array; meta: { t0: string; n: number } }> {
  const common = { START_TIME: `'${year}-01-01 00:00'`, STOP_TIME: `'${year + 1}-01-01 00:00'`, STEP_SIZE: `'${TABLE_STEP_MIN}m'` };
  const geo = rows(await horizons({ COMMAND: "'301'", CENTER: "'500@399'", QUANTITIES: "'14,15,19,20'", ...common }));
  // CSV: date, sol-flag, lun-flag, ObsSub-LON, ObsSub-LAT, SunSub-LON, SunSub-LAT, r, rdot, delta, deldot
  const n = geo.length;
  const cols: Record<string, Float32Array> = Object.fromEntries(EPHEMERIS_FIELDS.map((f) => [f, new Float32Array(n)]));
  geo.forEach((r, i) => {
    cols.earthLon[i] = +r[3]; cols.earthLat[i] = +r[4];
    cols.sunLon[i] = +r[5]; cols.sunLat[i] = +r[6];
    cols.sunAU[i] = +r[7]; cols.earthAU[i] = +r[9];
  });
  const dsnFields = ["dsnGold", "dsnCanb", "dsnMadr"] as const;
  for (const [k, c] of DSN_COMPLEXES.entries()) {
    const rr = rows(await horizons({
      COMMAND: "'301'", CENTER: `'${c.horizonsCenter}'`, QUANTITIES: "'4'", ...common,
    }));
    if (rr.length !== n) throw new Error(`DSN ${c.id}: ${rr.length} rows vs ${n}`);
    // CSV: date, sol-flag, lun-flag, Azi, Elev
    rr.forEach((r, i) => (cols[dsnFields[k]][i] = +r[4]));
  }
  const buf = new Float32Array(n * EPHEMERIS_FIELDS.length);
  EPHEMERIS_FIELDS.forEach((f, i) => buf.set(cols[f], i * n));
  return { buf, meta: { t0: `${year}-01-01T00:00:00Z`, n } };
}
