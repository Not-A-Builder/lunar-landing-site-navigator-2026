/**
 * Build data/deploy/: the compact, committed copy of the NASA layers that /api/terrain needs in
 * production (custom coordinates). Brotli keeps each file under GitHub's 100 MB limit (no Git LFS).
 *   npx tsx pipeline/build-deploy-bundle.ts      (needs data/raw from download-raw.sh)
 */
import { brotliCompressSync, constants } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readDbf, readShp } from "./lib/shapefile";

const RAW = join(process.cwd(), "data", "raw");
const OUT = join(process.cwd(), "data", "deploy");
const br = (b: Buffer) => brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 9, [constants.BROTLI_PARAM_LGWIN]: 24 } });
const files: Record<string, { bytes: number; from: string }> = {};
const put = (name: string, data: Buffer, from: string) => {
  writeFileSync(join(OUT, name), data);
  files[name] = { bytes: data.byteLength, from };
  console.log(name, (data.byteLength / 1e6).toFixed(1), "MB");
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  put("ldem_75s_120m.img.br", br(readFileSync(join(RAW, "ldem_75s_120m.img"))), "PDS LOLA GDR polar/img/ldem_75s_120m.img");
  put("ldem_16.img.br", br(readFileSync(join(RAW, "ldem_16.img"))), "PDS LOLA GDR cylindrical/img/ldem_16.img");

  const shp = readShp(join(RAW, "psr", "LOLA_PSR_75S_120M_82S_060M_5KM2_FINAL.shp"));
  const dbf = readDbf(join(RAW, "psr", "LOLA_PSR_75S_120M_82S_060M_5KM2_FINAL.dbf"));
  const psr = shp.flatMap((s, i) => s.parts.map((ring) => ({ id: dbf[i]?.PSR_ID ?? String(i), ring: ring.map(([x, y]) => [Math.round(x), Math.round(y)]) })));
  put("psr_south.json.br", br(Buffer.from(JSON.stringify(psr))), "LROC NAC_POLE_PSR_SOUTH.ZIP (LOLA_PSR_75S_120M_82S_060M_5KM2_FINAL)");

  const gaz = readDbf(join(RAW, "gaz", "MOON_nomenclature_center_pts.dbf"))
    .filter((r) => r.approval?.startsWith("Adopted"))
    .map((r) => [r.clean_name || r.name, (r.type || "").split(",")[0], +Number(r.center_lat).toFixed(4), +(((Number(r.center_lon) + 540) % 360) - 180).toFixed(4), r.diameter ? +Number(r.diameter).toFixed(2) : null]);
  put("gazetteer.json.br", br(Buffer.from(JSON.stringify(gaz))), "USGS MOON_nomenclature_center_pts.zip (IAU-adopted features)");

  const { fromFile } = await import("geotiff");
  const divMeta: Record<string, unknown> = {};
  for (const name of ["summer_max", "winter_min"]) {
    const img = await (await fromFile(join(RAW, `diviner_south80_${name}.tif`))).getImage();
    const ras = (await img.readRasters({ interleave: true })) as unknown as Float32Array;
    const i16 = new Int16Array(ras.length);
    for (let i = 0; i < ras.length; i++) i16[i] = Number.isFinite(ras[i]) ? Math.round(ras[i] * 10) : -32768;
    put(`diviner_south80_${name}.i16.br`, br(Buffer.from(i16.buffer)), `UCLA Diviner level4_polar polar_south_80_${name}-float.tif (stored as K×10)`);
    divMeta[name] = { w: img.getWidth(), h: img.getHeight(), origin: img.getOrigin(), resolution: img.getResolution(), scale: 0.1, nodata: -32768 };
  }
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify({ generatedAt: new Date().toISOString(), note: "Compact copies of NASA layers for /api/terrain in production. Rebuild: npx tsx pipeline/build-deploy-bundle.ts", files, diviner: divMeta }, null, 1) + "\n");
  console.log("total", (Object.values(files).reduce((a, f) => a + f.bytes, 0) / 1e6).toFixed(1), "MB");
}

main().catch((e) => { console.error(e); process.exit(1); });
