/**
 * Generates SOURCES.md from the same registries the product uses, so the document can't drift:
 * src/lib/sources.ts (data sources), src/lib/moon.ts (map layers), pipeline/download-raw.sh (raw
 * datasets), src/data/references.json (cited documents), src/data/sites.json (site records) and
 * src/data/source-usage.json (where each source is used). Run `npm run sources:doc`; a test fails
 * if SOURCES.md is stale (LOGS D-035).
 */
import { GLOBAL_MAP, POLAR_MAP } from "./moon";
import { sourceList } from "./sources";

type Ref = { key: string; sourceTitle: string; sourceUrl: string; page?: string };
type SiteRec = { name: string; sourceUrl: string | null; verification: string };

export function generateSourcesMd(input: {
  references: Ref[];
  sites: SiteRec[];
  usage: Record<string, string[]>;
  metricNames: Record<string, string>;
  rawDownloads: { file: string; url: string }[];
}): string {
  const L: string[] = [];
  const esc = (s: string) => s.replace(/\|/g, "\\|");
  L.push("# Sources");
  L.push("");
  L.push("Every data source used by the Lunar Landing Site Navigator, its link, and what it is used for.");
  L.push("**Generated, do not edit by hand:** run `npm run sources:doc` after adding or removing a source");
  L.push("(the test suite fails if this file is out of date). In the app, the same information appears in every");
  L.push("tooltip and on the Data & methods page.");
  L.push("");

  L.push("## 1. Data sources");
  L.push("");
  L.push("| Source | Provider | Link | Used for | Used in |");
  L.push("|---|---|---|---|---|");
  for (const s of sourceList) {
    const used = input.usage[s.id]?.length ?? 0;
    const url = s.url.startsWith("/") ? `in-app ${s.url}` : s.url;
    L.push(`| ${esc(s.name)} | ${esc(s.provider)} | ${url} | ${esc(s.use)} | ${used ? `${used} metric${used === 1 ? "" : "s"}` : "panels / pages"} |`);
  }
  L.push("");

  L.push("## 2. Map tile layers (NASA Moon Trek WMTS)");
  L.push("");
  L.push("| Layer | Map | Tile URL template |");
  L.push("|---|---|---|");
  for (const l of POLAR_MAP.layers) L.push(`| ${l.id} | South pole | ${l.url} |`);
  for (const l of GLOBAL_MAP.layers) L.push(`| ${l.id} | Whole Moon | ${l.url} |`);
  L.push("");

  L.push("## 3. Raw datasets downloaded by the pipeline");
  L.push("");
  L.push("Downloaded by `pipeline/download-raw.sh` into `data/raw/`. A compact copy of the ones needed for custom coordinates ships in `data/deploy/`.");
  L.push("");
  L.push("| File | URL |");
  L.push("|---|---|");
  for (const d of input.rawDownloads) L.push(`| ${d.file} | ${d.url} |`);
  L.push("");

  L.push("## 4. Cited documents (reference values)");
  L.push("");
  L.push("Moon-wide reference values shown with status “Reference”. Each value quotes its document in `src/data/references.json`.");
  L.push("");
  L.push("| Document | Link | Values used |");
  L.push("|---|---|---|");
  const docs = new Map<string, { title: string; url: string; keys: string[] }>();
  for (const r of input.references) {
    const k = `${r.sourceTitle}|${r.sourceUrl}`;
    if (!docs.has(k)) docs.set(k, { title: r.sourceTitle, url: r.sourceUrl, keys: [] });
    docs.get(k)!.keys.push(r.key.replace(/_/g, " "));
  }
  for (const d of [...docs.values()].sort((a, b) => a.title.localeCompare(b.title))) L.push(`| ${esc(d.title)} | ${d.url} | ${esc(d.keys.join("; "))} |`);
  L.push("");

  L.push("## 5. Site location records");
  L.push("");
  L.push("Each curated site's coordinates are copied from one of these records (the exact quote is shown on the site page).");
  L.push("");
  L.push("| Record | Link | Sites |");
  L.push("|---|---|---|");
  const byUrl = new Map<string, string[]>();
  for (const s of input.sites) {
    if (!s.sourceUrl) continue;
    if (!byUrl.has(s.sourceUrl)) byUrl.set(s.sourceUrl, []);
    byUrl.get(s.sourceUrl)!.push(s.name);
  }
  for (const [url, names] of [...byUrl.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) {
    const label = url.includes("pds.lroc") ? "LROC anthropogenic-objects catalogue (PDS)" : url.includes("planetarynames") ? "USGS Gazetteer of Planetary Nomenclature" : url.includes("lroc.im-ldi.com/lroc/view_rdr") ? "LROC NAC mosaic / terrain-model page" : url.includes("nasa.gov") ? "NASA web page" : "Web page";
    L.push(`| ${label} | ${url} | ${esc(names.join(", "))} |`);
  }
  L.push("");

  L.push("## 6. Where each source is used");
  L.push("");
  for (const s of sourceList) {
    const ids = input.usage[s.id] ?? [];
    if (!ids.length) continue;
    L.push(`- **${s.name}:** ${ids.map((id) => input.metricNames[id] ?? id).join(", ")}`);
  }
  L.push("");
  return L.join("\n");
}

/** Extract `get <url> <file>` lines from pipeline/download-raw.sh. */
export function parseDownloads(script: string) {
  const vars: Record<string, string> = {};
  for (const m of script.matchAll(/^(\w+)=(\S+)$/gm)) vars[m[1]] = m[2];
  return [...script.matchAll(/^get (\S+) (\S+)/gm)].map((m) => ({ url: m[1].replace(/\$(\w+)/g, (_, v) => vars[v] ?? ""), file: m[2] }));
}
