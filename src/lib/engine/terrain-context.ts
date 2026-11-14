/**
 * Loads the NASA layers for terrain building once per process (pipeline and /api/terrain).
 *   1. data/raw/ (full downloads from pipeline/download-raw.sh): used when present (local dev, pipeline).
 *   2. data/deploy/ (committed brotli bundle from pipeline/build-deploy-bundle.ts): used in production.
 * Set TERRAIN_SOURCE=deploy to force the bundle (used to test production behaviour locally).
 * The LOLA average-visibility validation maps exist only in data/raw; production omits that check.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { readDbf, readShp } from "../../../pipeline/lib/shapefile";
import { globalDem, PolarGrid, polarDem } from "./dem-readers";
import type { Feature, PsrPolygon, Sampler, TerrainContext } from "./terrain-build";
import { toPolarXY } from "./terrain-build";

export const RAW = join(process.cwd(), "data", "raw");
export const DEPLOY = join(process.cwd(), "data", "deploy");
/** Orientation of PDS polar IMG samples relative to +x (90°E). Verified against crater depths and PSR floors (LOGS D-025). */
export const POLAR_X_SIGN: 1 | -1 = 1;

let ctxP: Promise<TerrainContext & { source: "raw" | "deploy" }> | null = null;

const bbox = (ring: [number, number][]) => {
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [number, number, number, number];
};

function gridSampler(get: (c: number, r: number) => number | null, w: number, h: number, origin: number[], res: number[]): Sampler {
  return (lat, lon) => {
    if (lat > -80) return null;
    const [x, y] = toPolarXY(lat, lon);
    const c = Math.floor((x - origin[0]) / res[0]), r = Math.floor((y - origin[1]) / res[1]);
    if (c < 0 || r < 0 || c >= w || r >= h) return null;
    return get(c, r);
  };
}

async function geotiffSampler(file: string): Promise<Sampler | undefined> {
  if (!existsSync(file)) return undefined;
  const { fromFile } = await import("geotiff");
  const img = await (await fromFile(file)).getImage();
  const w = img.getWidth(), h = img.getHeight();
  const ras = (await img.readRasters({ interleave: true })) as unknown as Float32Array;
  return gridSampler((c, r) => (Number.isFinite(ras[r * w + c]) ? ras[r * w + c] : null), w, h, img.getOrigin(), img.getResolution());
}

const rawComplete = () => ["ldem_75s_120m.img", "ldem_16.img"].every((f) => existsSync(join(RAW, f)));

async function loadRaw(): Promise<TerrainContext> {
  const polar = polarDem(join(RAW, "ldem_75s_120m.img"), POLAR_X_SIGN);
  const global = globalDem(join(RAW, "ldem_16.img"));
  let psr: PsrPolygon[] | undefined;
  const psrShp = join(RAW, "psr", "LOLA_PSR_75S_120M_82S_060M_5KM2_FINAL.shp");
  if (existsSync(psrShp)) {
    const shapes = readShp(psrShp), rows = readDbf(psrShp.replace(/\.shp$/, ".dbf"));
    psr = shapes.flatMap((s, i) => s.parts.map((ring) => ({ id: rows[i]?.PSR_ID ?? String(i), ring, bbox: bbox(ring) })));
  }
  let features: Feature[] | undefined;
  const gaz = join(RAW, "gaz", "MOON_nomenclature_center_pts.dbf");
  if (existsSync(gaz)) {
    features = readDbf(gaz)
      .filter((r) => r.approval?.startsWith("Adopted"))
      .map((r) => ({ name: r.clean_name || r.name, type: (r.type || "").split(",")[0], lat: Number(r.center_lat), lon: ((Number(r.center_lon) + 540) % 360) - 180, diameterKm: r.diameter ? Number(r.diameter) : null }));
  }
  const vis = (f: string): Sampler | undefined => {
    const p = join(RAW, f);
    if (!existsSync(p) || readFileSync(p).byteLength !== 7624 * 7624 * 2) return undefined;
    const g = new PolarGrid({ id: f, file: p, size: 7624, scaleM: 120, offset: 3811.5, scaling: 0.00004, add: 0, xSign: POLAR_X_SIGN, limitLat: -75 });
    return (la, lo) => g.nearest(la, lo);
  };
  return {
    dems: [polar, global], psr, features,
    lolaSunVis: vis("avgvisib_75s_120m_sun.img"),
    lolaEarthVis: vis("avgvisib_75s_120m_earth.img"),
    divinerSummerMax: await geotiffSampler(join(RAW, "diviner_south80_summer_max.tif")),
    divinerWinterMin: await geotiffSampler(join(RAW, "diviner_south80_winter_min.tif")),
  };
}

function loadDeploy(): TerrainContext {
  const read = (f: string) => brotliDecompressSync(readFileSync(join(DEPLOY, f)));
  const manifest = JSON.parse(readFileSync(join(DEPLOY, "manifest.json"), "utf8"));
  const polar = polarDem(read("ldem_75s_120m.img.br"), POLAR_X_SIGN);
  const global = globalDem(read("ldem_16.img.br"));
  const psr = (JSON.parse(read("psr_south.json.br").toString()) as { id: string; ring: [number, number][] }[]).map((p) => ({ ...p, bbox: bbox(p.ring) }));
  const features = (JSON.parse(read("gazetteer.json.br").toString()) as [string, string, number, number, number | null][]).map(([name, type, lat, lon, diameterKm]) => ({ name, type, lat, lon, diameterKm }));
  const div = (name: "summer_max" | "winter_min"): Sampler => {
    const m = manifest.diviner[name];
    const b = read(`diviner_south80_${name}.i16.br`);
    const a = new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2);
    return gridSampler((c, r) => { const v = a[r * m.w + c]; return v === m.nodata ? null : v * m.scale; }, m.w, m.h, m.origin, m.resolution);
  };
  return { dems: [polar, global], psr, features, divinerSummerMax: div("summer_max"), divinerWinterMin: div("winter_min") };
}

export function loadTerrainContext() {
  ctxP ??= (async () => {
    const forceDeploy = process.env.TERRAIN_SOURCE === "deploy";
    if (!forceDeploy && rawComplete()) return { ...(await loadRaw()), source: "raw" as const };
    if (existsSync(join(DEPLOY, "manifest.json"))) return { ...loadDeploy(), source: "deploy" as const };
    throw new Error("No LOLA terrain data on the server (expected data/deploy or data/raw). Run pipeline/build-deploy-bundle.ts.");
  })();
  return ctxP;
}
