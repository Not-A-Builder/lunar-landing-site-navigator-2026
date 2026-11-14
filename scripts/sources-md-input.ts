/** Collects the inputs for SOURCES.md (shared by the generator script and the staleness test). */
import { generateSourcesMd, parseDownloads } from "../src/lib/sources-doc";
import catalog from "../src/data/metrics-catalog.json";
import refs from "../src/data/references.json";
import sites from "../src/data/sites.json";
import usage from "../src/data/source-usage.json";

export function buildSourcesMd(read: (p: string, enc: "utf8") => string) {
  return generateSourcesMd({
    references: refs.values as { key: string; sourceTitle: string; sourceUrl: string }[],
    sites: sites.sites as { name: string; sourceUrl: string | null; verification: string }[],
    usage: usage.usage as Record<string, string[]>,
    metricNames: Object.fromEntries(catalog.metrics.map((m) => [m.id, m.name])),
    rawDownloads: parseDownloads(read("pipeline/download-raw.sh", "utf8")),
  });
}
