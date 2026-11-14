import sitesJson from "@/data/sites.json";

/**
 * Curated landing sites. Every coordinate is copied from a cited source (sourceUrl + sourceQuote)
 * and marked verified. Records with no cited coordinate are not sites; they are listed in
 * `excludedSites` with the reason. See docs/data-sources.md#curated-sites, LOGS D-018 and D-038.
 */
export type SiteGroup =
  | "artemis-region"
  | "clps-future"
  | "clps-past"
  | "commercial-future"
  | "commercial-past"
  | "apollo"
  | "international-past"
  | "international-future"
  | "feature";

export type Site = {
  id: string;
  name: string;
  group: SiteGroup;
  lat: number;
  lon: number;
  elevationKm?: number | null;
  kind: "point" | "region" | "feature";
  polygon?: [number, number][] | null;
  mission?: string;
  date?: string | null;
  status?: string;
  sourceUrl: string;
  sourceQuote?: string;
  verification: "verified";
  notes?: string;
};

export const GROUP_LABELS: Record<SiteGroup, string> = {
  "artemis-region": "Artemis candidate landing regions",
  "clps-future": "CLPS: future targets",
  "clps-past": "CLPS: past missions",
  "commercial-future": "Other commercial: future",
  "commercial-past": "Other commercial: past",
  apollo: "Apollo",
  "international-past": "Other nations: past",
  "international-future": "Other nations: future",
  feature: "Named south-pole features",
};

/** South polar region (Artemis-style polar trade-offs apply) for callouts and comparison. */
export const SOUTH_POLAR_LIMIT = -80;

/** Sites at or south of this latitude are drawn on the south-polar map (its basemap reaches ~55°S). */
export const POLAR_MAP_LIMIT = -60;
export const onPolarMap = (lat: number) => lat <= POLAR_MAP_LIMIT;

export const isPolar = (lat: number) => lat <= SOUTH_POLAR_LIMIT;

export const sites = sitesJson.sites as Site[];

/** Missions/regions with no published, cited coordinate: not shown as sites (LOGS D-038). */
export type ExcludedSite = { name: string; group: SiteGroup; mission: string | null; sourceUrl: string | null; reason: string; notes: string | null };
export const excludedSites = sitesJson.excluded as ExcludedSite[];

export function getSite(id: string): Site | undefined {
  return sites.find((s) => s.id === id);
}

export function hasCoordinates(s: Site): s is Site & { lat: number; lon: number } {
  return Number.isFinite(s.lat) && Number.isFinite(s.lon);
}
