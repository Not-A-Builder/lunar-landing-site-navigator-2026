/** Lunar constants and Moon Trek basemap configuration (all tile grids verified 2026-11-14, LOGS D-019). */

export const MOON_RADIUS_M = 1_737_400;

/** South polar stereographic on a sphere (matches Moon Trek "SP" tile sets: lon 0° up, 90°E right). */
export const SOUTH_POLAR_PROJ = {
  code: "MOON:SPS",
  proj4: `+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=${MOON_RADIUS_M} +units=m +no_defs`,
};

export type TileLayerConfig = { id: string; url: string; maxZoom: number; extent: [number, number, number, number] };

export type MapLayerConfig = {
  projection: string;
  projExtent: [number, number, number, number];
  origin: [number, number];
  tileSize: number;
  level0Resolution: number;
  maxLevel: number;
  layers: TileLayerConfig[];
  dataExtent: [number, number, number, number];
  center: [number, number];
  startResolution: number;
  /** extent the view fits on first load */
  fitExtent: [number, number, number, number];
  attribution: string;
};

const SP = (layer: string) => `https://trek.nasa.gov/tiles/Moon/SP/${layer}/1.0.0//default/default028mm/{z}/{y}/{x}.png`;
const SP_RES0 = 3.0578404017857101e7 * 0.00028; // 8561.953 m/px
const sq = (h: number): [number, number, number, number] => [-h, -h, h, h];

/**
 * South pole: three LOLA hillshade mosaics stacked on one grid, coarse to fine.
 *   SPole45 100 m/px (±1,095,930 m ≈ 55°S, z0–4) → SPole75 30 m/px (±457,440 m ≈ 75°S, z0–6)
 *   → SPole875 5 m/px (±75,840 m ≈ 87.5°S, z0–9).
 */
export const POLAR_MAP: MapLayerConfig = {
  projection: SOUTH_POLAR_PROJ.code,
  projExtent: sq(1_095_930),
  origin: [-1_095_930, 1_095_930],
  tileSize: 256,
  level0Resolution: SP_RES0,
  maxLevel: 10,
  layers: [
    { id: "LRO_LOLA_Shade_SPole45_100mp_v04", url: SP("LRO_LOLA_Shade_SPole45_100mp_v04"), maxZoom: 4, extent: sq(1_095_930) },
    { id: "LRO_LOLA_Shade_SPole75_30mp_v04", url: SP("LRO_LOLA_Shade_SPole75_30mp_v04"), maxZoom: 6, extent: sq(457_440) },
    { id: "LRO_LOLA_Shade_SPole875_5mp_v04", url: SP("LRO_LOLA_Shade_SPole875_5mp_v04"), maxZoom: 9, extent: sq(75_840) },
  ],
  dataExtent: sq(1_095_930),
  center: [0, 0],
  startResolution: SP_RES0 / 2 ** 3,
  fitExtent: sq(240_000),
  attribution: "LRO LOLA hillshade · NASA Moon Trek",
};

/** Whole Moon: LRO WAC global mosaic (EPSG:104903 lat/lon, 0.703125°/px at z0, z0–8). */
export const GLOBAL_MAP: MapLayerConfig = {
  projection: "MOON:EQC",
  projExtent: [-180, -90, 180, 90],
  origin: [-180, 90],
  tileSize: 256,
  level0Resolution: 0.703125,
  maxLevel: 10,
  layers: [
    { id: "LRO_WAC_Mosaic_Global_303ppd_v02", url: "https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0//default/default028mm/{z}/{y}/{x}.jpg", maxZoom: 8, extent: [-180, -90, 180, 90] },
  ],
  dataExtent: [-180, -90, 180, 90],
  center: [0, 0],
  startResolution: 0.703125 / 2,
  fitExtent: [-180, -90, 180, 90],
  attribution: "LRO WAC global mosaic · NASA Moon Trek",
};
