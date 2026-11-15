import { MethodsPage, type MethodsData } from "@/components/methods/MethodsPage";
import { ASSUMPTION_META, DEFAULT_ASSUMPTIONS } from "@/lib/assumptions";
import { catalog } from "@/lib/metrics";
import { GLOBAL_MAP, POLAR_MAP } from "@/lib/moon";
import { sourceList } from "@/lib/sources";
import { excludedSites, GROUP_LABELS, isPolar, sites, type SiteGroup } from "@/lib/sites";
import refs from "@/data/references.json";
import usage from "@/data/source-usage.json";
import validation from "@/data/validation.json";
import ephIndex from "../../../public/data/ephemeris/index.json";
import haworth from "../../../public/data/terrain/haworth.json";

export const metadata = { title: "Data & methods" };

/**
 * Data & methods (D-139): a landing-page style walk through how every number is fetched, computed,
 * checked and shown. Everything on it is read from the same generated files the app uses, so it can't
 * drift from the product: the source registry, source usage, validation results, the ephemeris index,
 * the site list, the cited reference values and the default assumptions.
 */
export default function SourcesPage() {
  const metricName = new Map(catalog.metrics.map((m) => [m.id, m.name]));
  const u = usage.usage as Record<string, string[]>;
  const groupCounts = new Map<SiteGroup, number>();
  for (const s of sites) groupCounts.set(s.group, (groupCounts.get(s.group) ?? 0) + 1);
  const years = Object.keys(ephIndex.years).map(Number).sort((a, b) => a - b);

  const data: MethodsData = {
    heroMask: haworth.masks[0],
    heroDem: haworth.dem.label,
    statusCounts: usage.status as Record<string, number>,
    usageBasis: usage.basedOn,
    categories: catalog.categories.map((c) => ({ id: c.id, label: c.label, count: c.metricIds.length })),
    metricTotal: catalog.metrics.length,
    sources: sourceList.map((s) => ({ ...s, usedIn: (u[s.id] ?? []).map((id) => metricName.get(id) ?? id) })),
    mapLayers: [
      ...POLAR_MAP.layers.map((l) => ({ id: l.id, map: "South-pole map" })),
      ...GLOBAL_MAP.layers.map((l) => ({ id: l.id, map: "Whole-Moon map" })),
    ],
    validation: validation.sites,
    ephemeris: { years, stepMinutes: ephIndex.stepMinutes, fields: ephIndex.fields, source: ephIndex.source },
    sites: {
      total: sites.length,
      polar: sites.filter((s) => isPolar(s.lat)).length,
      groups: [...groupCounts.entries()].map(([g, n]) => ({ label: GROUP_LABELS[g], count: n })).sort((a, b) => b.count - a.count),
      example: (() => {
        const s = sites.find((x) => x.id === "haworth")!;
        return { name: s.name, lat: s.lat, lon: s.lon, sourceUrl: s.sourceUrl, sourceQuote: s.sourceQuote ?? "" };
      })(),
      excluded: excludedSites.map((e) => ({ name: e.name, mission: e.mission, reason: e.reason, sourceUrl: e.sourceUrl })),
    },
    references: (refs.values as { key: string; value: string | number; unit: string; range?: string | null; context?: string; sourceTitle: string; sourceUrl: string; page?: string; quote?: string }[]).map((r) => ({
      key: r.key, value: String(r.value), unit: r.unit, range: r.range ?? null, context: r.context ?? "", sourceTitle: r.sourceTitle, sourceUrl: r.sourceUrl, page: r.page ?? "", quote: r.quote ?? "",
    })),
    assumptions: (Object.keys(DEFAULT_ASSUMPTIONS) as (keyof typeof DEFAULT_ASSUMPTIONS)[]).map((k) => ({
      key: k, label: ASSUMPTION_META[k].label, value: String(DEFAULT_ASSUMPTIONS[k]), unit: ASSUMPTION_META[k].unit, why: ASSUMPTION_META[k].why,
    })),
  };
  return <MethodsPage data={data} />;
}
