import { NextRequest } from "next/server";
import { BODIES, fetchAzEl, type Body } from "@/lib/ephemeris/horizons";

/**
 * GET /api/horizons?body=sun|earth&lat=-89.45&lon=-129.78&alt=1.9&start=2026-12-01&stop=2026-12-02&step=1h
 * Thin proxy so the browser can reach JPL Horizons (no CORS on the upstream API).
 * Returns { body, site, samples: [{t, az, el}], source }.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const body = p.get("body") as Body | null;
  const lat = Number(p.get("lat"));
  const lon = Number(p.get("lon"));
  const altKm = Number(p.get("alt") ?? 0);
  const start = p.get("start");
  const stop = p.get("stop");
  const step = p.get("step") ?? "1h";

  if (!body || !(body in BODIES)) return bad("body must be 'sun' or 'earth'");
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return bad("lat must be in [-90, 90]");
  if (!Number.isFinite(lon)) return bad("lon is required");
  if (!Number.isFinite(altKm)) return bad("alt must be a number (km)");
  if (!start || !stop) return bad("start and stop are required");
  if (!/^\d+\s*[mhd]$/.test(step)) return bad("step must look like 10m, 1h or 1d");

  try {
    const samples = await fetchAzEl({ body, site: { lat, lon, altKm }, start, stop, step });
    return Response.json(
      { body, site: { lat, lon, altKm }, samples, source: "JPL Horizons (ssd.jpl.nasa.gov/api/horizons.api)" },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}

function bad(msg: string) {
  return Response.json({ error: msg }, { status: 400 });
}
