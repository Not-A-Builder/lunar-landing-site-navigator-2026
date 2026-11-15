import { NextRequest } from "next/server";
import { buildTerrain } from "@/lib/engine/terrain-build";
import { loadTerrainContext } from "@/lib/engine/terrain-context";

/**
 * GET /api/terrain?lat=-85.2&lon=30.1 -> TerrainFile for a custom coordinate, computed from LOLA
 * (same code as the pipeline). Reads data/raw when present, else the committed data/deploy bundle
 * (see terrain-context.ts).
 */
const memo = new Map<string, unknown>();

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon)) {
    return Response.json({ error: "lat (−90…90) and lon (degrees east) are required" }, { status: 400 });
  }
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  try {
    if (!memo.has(key)) {
      const ctx = await loadTerrainContext();
      memo.set(key, buildTerrain(ctx, +lat.toFixed(4), ((+lon.toFixed(4) + 540) % 360) - 180));
    }
    return Response.json(memo.get(key), { headers: { "Cache-Control": "public, s-maxage=31536000, immutable" } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
  }
}
