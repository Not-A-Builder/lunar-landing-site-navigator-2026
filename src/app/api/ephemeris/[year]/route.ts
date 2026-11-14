import { buildYearTable, TABLE_STEP_MIN } from "@/lib/ephemeris/tables";

/**
 * GET /api/ephemeris/1969 -> one year of the Moon-wide ephemeris table, built live from JPL Horizons.
 * Used for years outside the precomputed range in /data/ephemeris (e.g. Apollo landing dates).
 * Body: columnar Float32 (see engine/ephemeris.ts). Header X-Ephemeris-Meta: {"t0","n","stepMinutes"}.
 */
const memo = new Map<number, Promise<Awaited<ReturnType<typeof buildYearTable>>>>();

export async function GET(_req: Request, ctx: RouteContext<"/api/ephemeris/[year]">) {
  const { year: y } = await ctx.params;
  const year = Number(y);
  if (!Number.isInteger(year) || year < 1960 || year > 2100) {
    return Response.json({ error: "year must be an integer between 1960 and 2100" }, { status: 400 });
  }
  try {
    if (!memo.has(year)) memo.set(year, buildYearTable(year));
    const { buf, meta } = await memo.get(year)!;
    return new Response(new Blob([new Uint8Array(buf.buffer as ArrayBuffer)]), {
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Ephemeris-Meta": JSON.stringify({ ...meta, stepMinutes: TABLE_STEP_MIN }),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    memo.delete(year);
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
