/** Minimal ESRI shapefile (.shp polygons/points) and dBASE (.dbf) readers. No dependencies. */
import { readFileSync } from "node:fs";

export type Ring = [number, number][];

export function readShp(path: string): { type: number; parts: Ring[] }[] {
  const b = readFileSync(path);
  const out: { type: number; parts: Ring[] }[] = [];
  let o = 100;
  while (o < b.length) {
    const len = b.readInt32BE(o + 4) * 2;
    const rec = o + 8;
    const type = b.readInt32LE(rec);
    if (type === 5 || type === 15) {
      const nParts = b.readInt32LE(rec + 36), nPts = b.readInt32LE(rec + 40);
      const partIdx: number[] = [];
      for (let i = 0; i < nParts; i++) partIdx.push(b.readInt32LE(rec + 44 + 4 * i));
      const pts = rec + 44 + 4 * nParts;
      const parts: Ring[] = [];
      for (let p = 0; p < nParts; p++) {
        const s = partIdx[p], e = p + 1 < nParts ? partIdx[p + 1] : nPts;
        const ring: Ring = [];
        for (let i = s; i < e; i++) ring.push([b.readDoubleLE(pts + 16 * i), b.readDoubleLE(pts + 16 * i + 8)]);
        parts.push(ring);
      }
      out.push({ type, parts });
    } else if (type === 1) {
      out.push({ type, parts: [[[b.readDoubleLE(rec + 4), b.readDoubleLE(rec + 12)]]] });
    } else out.push({ type, parts: [] });
    o = rec + len;
  }
  return out;
}

export function readDbf(path: string): Record<string, string>[] {
  const b = readFileSync(path);
  const nRec = b.readUInt32LE(4), hdrLen = b.readUInt16LE(8), recLen = b.readUInt16LE(10);
  const fields: { name: string; len: number }[] = [];
  for (let o = 32; b[o] !== 0x0d; o += 32) {
    fields.push({ name: b.toString("latin1", o, o + 11).replace(/\0.*$/, ""), len: b[o + 16] });
  }
  const rows: Record<string, string>[] = [];
  for (let r = 0; r < nRec; r++) {
    let o = hdrLen + r * recLen + 1;
    const row: Record<string, string> = {};
    for (const f of fields) {
      row[f.name] = b.toString("utf8", o, o + f.len).trim();
      o += f.len;
    }
    rows.push(row);
  }
  return rows;
}
