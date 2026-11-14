import { MAX_COMPARE } from "@/lib/config";
import { fmtLat, fmtLon } from "@/lib/metrics/format";
import { getSite, hasCoordinates, type Site } from "@/lib/sites";

/** A scenario is one site at one landing time. URL: ?s=siteId@ISO,custom:lat,lon@ISO */
export type Scenario = { siteId: string; t: string };

export const SCENARIO_LETTERS = ["A", "B", "C", "D"];

export function parseScenarios(s: string | null): Scenario[] {
  if (!s) return [];
  return s
    .split(/,(?![-\d.]+@)/)
    .map((part) => {
      const at = part.lastIndexOf("@");
      const siteId = decodeURIComponent(at >= 0 ? part.slice(0, at) : part);
      const t = at >= 0 ? decodeURIComponent(part.slice(at + 1)) : "";
      return { siteId, t };
    })
    .filter((x) => x.siteId)
    .slice(0, MAX_COMPARE);
}

export const serialiseScenarios = (list: Scenario[]) =>
  list.map((x) => `${encodeURIComponent(x.siteId)}@${encodeURIComponent(x.t)}`).join(",");

/** Site id for a custom point, as used in scenarios. */
export const customScenarioId = (lat: number, lon: number) => `custom:${lat},${lon}`;

/** A scenario's site: a curated site, or a custom point parsed from `custom:lat,lon`. */
export function resolveScenarioSite(id: string): { site: Site | null; lat: number; lon: number; name: string } | null {
  if (id.startsWith("custom:")) {
    const [la, lo] = id.slice(7).split(",").map(Number);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
    return { site: null, lat: la, lon: lo, name: `Custom ${fmtLat(la)}, ${fmtLon(lo)}` };
  }
  const s = getSite(id);
  return s && hasCoordinates(s) ? { site: s, lat: s.lat, lon: s.lon, name: s.name } : null;
}
