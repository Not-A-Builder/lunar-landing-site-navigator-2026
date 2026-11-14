"use client";

/**
 * Browser-side data access with caching: ephemeris years, terrain files, peer summaries.
 * Precomputed files are served from /data; anything missing falls back to the live API.
 */
import { decodeYear, EphemerisSet, type EphemerisIndex, yearsBetween } from "@/lib/engine/ephemeris";
import type { TerrainFile } from "@/lib/engine/terrain-file";

const eph = new EphemerisSet();
let indexP: Promise<EphemerisIndex> | null = null;
const yearP = new Map<number, Promise<void>>();
const terrainP = new Map<string, Promise<TerrainFile>>();

function index() {
  indexP ??= fetch("/data/ephemeris/index.json").then((r) => {
    if (!r.ok) throw new Error("Ephemeris index missing");
    return r.json();
  });
  return indexP;
}

async function loadYear(year: number) {
  const idx = await index();
  const meta = idx.years[String(year)];
  if (meta) {
    const buf = await fetch(`/data/ephemeris/${year}.bin`).then((r) => r.arrayBuffer());
    eph.add(decodeYear(year, meta, idx.stepMinutes, buf));
    return;
  }
  const res = await fetch(`/api/ephemeris/${year}`);
  if (!res.ok) throw new Error(`Ephemeris for ${year} unavailable (${res.status})`);
  const m = JSON.parse(res.headers.get("X-Ephemeris-Meta")!);
  eph.add(decodeYear(year, m, m.stepMinutes, await res.arrayBuffer()));
}

/** Ensure every year touched by [from, to] is loaded; returns the shared EphemerisSet. */
export async function ensureEphemeris(from: number, to: number): Promise<EphemerisSet> {
  await Promise.all(
    yearsBetween(from, to).map((y) => {
      if (!yearP.has(y)) yearP.set(y, loadYear(y).catch((e) => { yearP.delete(y); throw e; }));
      return yearP.get(y)!;
    }),
  );
  return eph;
}

export async function precomputedYears(): Promise<number[]> {
  const idx = await index();
  return Object.keys(idx.years).map(Number).sort();
}

/** Terrain for a curated site (precomputed) or a custom coordinate (computed on the server). */
export function loadTerrain(key: { siteId: string } | { lat: number; lon: number }): Promise<TerrainFile> {
  const k = "siteId" in key ? key.siteId : `${key.lat.toFixed(4)},${key.lon.toFixed(4)}`;
  if (!terrainP.has(k)) {
    const url = "siteId" in key ? `/data/terrain/${key.siteId}.json` : `/api/terrain?lat=${key.lat}&lon=${key.lon}`;
    terrainP.set(
      k,
      fetch(url).then(async (r) => {
        if (!r.ok) {
          terrainP.delete(k);
          const msg = await r.json().then((j) => j.error).catch(() => r.statusText);
          throw new Error(msg || `Terrain unavailable (${r.status})`);
        }
        return r.json();
      }),
    );
  }
  return terrainP.get(k)!;
}

export type PeerIndex = { generatedAt: string; window: string; sites: { id: string; name: string; sunlitFrac: number; dteFrac: number; slope: number | null; psrKm: number | null }[] };
let peersP: Promise<PeerIndex> | null = null;
export function loadPeers(): Promise<PeerIndex> {
  peersP ??= fetch("/data/terrain/peers.json").then((r) => (r.ok ? r.json() : { generatedAt: "", window: "", sites: [] }));
  return peersP;
}
