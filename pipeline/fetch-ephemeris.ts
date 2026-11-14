/**
 * Precompute the Moon-wide hourly ephemeris tables from JPL Horizons.
 *   npx tsx pipeline/fetch-ephemeris.ts 2024 2032
 * Output: public/data/ephemeris/<year>.bin (columnar Float32) + index.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EPHEMERIS_FIELDS, type EphemerisIndex } from "../src/lib/engine/ephemeris";
import { buildYearTable, TABLE_STEP_MIN } from "../src/lib/ephemeris/tables";

const OUT = join(process.cwd(), "public", "data", "ephemeris");

async function main() {
  const [a, b] = process.argv.slice(2).map(Number);
  if (!a) throw new Error("usage: tsx pipeline/fetch-ephemeris.ts <fromYear> [toYear]");
  mkdirSync(OUT, { recursive: true });
  const idxPath = join(OUT, "index.json");
  const index: EphemerisIndex = existsSync(idxPath)
    ? JSON.parse(readFileSync(idxPath, "utf8"))
    : { generatedAt: "", source: "", stepMinutes: TABLE_STEP_MIN, fields: [...EPHEMERIS_FIELDS], years: {} };
  for (let y = a; y <= (b || a); y++) {
    process.stdout.write(`year ${y}… `);
    const { buf, meta } = await buildYearTable(y);
    writeFileSync(join(OUT, `${y}.bin`), Buffer.from(buf.buffer));
    index.years[String(y)] = meta;
    console.log(`${meta.n} samples`);
  }
  index.generatedAt = new Date().toISOString();
  index.source = "JPL Horizons API (DE441): Moon from Earth geocentre QUANTITIES 14,15,19,20; Moon from DSN complexes QUANTITIES 4";
  writeFileSync(idxPath, JSON.stringify(index, null, 2) + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
