/**
 * Verifies the x-orientation of the PDS polar IMG grid (POLAR_X_SIGN) using IAU crater centres
 * (USGS Gazetteer): crater centres must be far below their rims. Run: npx tsx scripts/verify-dem-orientation.ts
 */
import { join } from "node:path";
import { polarDem } from "../src/lib/engine/dem-readers";
import { destination } from "../src/lib/engine/geometry";

const craters = [
  { name: "Shackleton", lat: -89.67, lon: 129.78, dKm: 20.92 },
  { name: "de Gerlache", lat: -88.4849, lon: -88.3447, dKm: 32 },
  { name: "Shoemaker", lat: -88.137, lon: 45.911, dKm: 51 },
  { name: "Faustini", lat: -87.1832, lon: 84.3099, dKm: 39 },
];
for (const sign of [1, -1] as const) {
  const dem = polarDem(join(process.cwd(), "data/raw/ldem_75s_120m.img"), sign);
  const depths = craters.map((c) => {
    const centre = dem.sample(c.lat, c.lon)!;
    const rim = [0, 45, 90, 135, 180, 225, 270, 315].map((b) => { const p = destination(c.lat, c.lon, b, c.dKm / 2, 1737.4); return dem.sample(p.lat, p.lon)!; });
    return { name: c.name, centre: Math.round(centre), rimMean: Math.round(rim.reduce((a, v) => a + v, 0) / rim.length) };
  });
  console.log(`xSign=${sign}:`, depths.map((d) => `${d.name} centre ${d.centre} m, rim ${d.rimMean} m, depth ${d.rimMean - d.centre} m`).join(" | "));
}
