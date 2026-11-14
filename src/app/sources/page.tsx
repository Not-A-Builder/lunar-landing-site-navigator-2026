import { ASSUMPTION_META, DEFAULT_ASSUMPTIONS } from "@/lib/assumptions";
import { catalog } from "@/lib/metrics";
import { sourceList } from "@/lib/sources";
import refs from "@/data/references.json";
import usage from "@/data/source-usage.json";
import validation from "@/data/validation.json";
import { excludedSites, sites } from "@/lib/sites";

export const metadata = { title: "Data & methods" };

const metricName = new Map(catalog.metrics.map((m) => [m.id, m.name]));

/** Provenance page: every source, where it is used, cited reference values, assumptions, validation. */
export default function SourcesPage() {
  const u = usage.usage as Record<string, string[]>;
  const st = usage.status as Record<string, number>;
  const val = validation.sites as { id: string; name: string; oursSun: number; lolaSun: number; oursEarth: number; lolaEarth: number | null }[];
  const meanAbs = val.length ? val.reduce((a, v) => a + Math.abs(v.oursSun - v.lolaSun), 0) / val.length : null;
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Data &amp; methods</h1>
        <p className="text-sm text-muted">
          Every number in this tool traces back to a NASA or partner-agency dataset, a cited reference, or an input you set. Where a value can&apos;t be computed from public data, the tool says so and explains why, instead of guessing.
        </p>
        {Object.keys(st).length > 0 && (
          <p className="text-sm">
            Of {catalog.metrics.length} metrics: <b>{st.computed ?? 0}</b> computed from NASA data for each site and date, <b>{st.modelled ?? 0}</b> modelled with your assumptions, <b>{st.reference ?? 0}</b> cited lunar reference values, <b>{st.assumption ?? 0}</b> your inputs, and <b>{st.unavailable ?? 0}</b> not available from public data.
          </p>
        )}
      </header>

      <section id="how">
        <h2 className="mb-2 text-lg font-semibold">How the core numbers are computed</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li><b className="text-fg">Ephemeris.</b> For every hour of 2024–2032 we take the sub-solar point, the sub-Earth point (that is the libration) and both distances from JPL Horizons (DE441). Other years are fetched live. Sun and Earth azimuth/elevation at any site are computed from these. We checked this against Horizons&apos; own site-specific output and it matches to within 0.0002°.</li>
          <li><b className="text-fg">Terrain horizon.</b> From LOLA elevation data (120 m/px south-polar grid, plus the 1.9 km global grid for far terrain), we trace 360 rays out to 200 km and account for the Moon&apos;s curvature. The Moon has no air, so there is no refraction. The Sun or Earth counts as visible when its disk clears this horizon. The share of the disk that is visible is computed geometrically (the f(t) of Liu et al. 2023).</li>
          <li><b className="text-fg">Windows and metrics.</b> We sample every 10 minutes over the mission and interpolate crossing times. Multi-year statistics use 2-hour steps over 2026–2029. Area statistics use a grid of horizon masks around the site.</li>
          <li><b className="text-fg">Ground stations.</b> The Moon&apos;s elevation at Goldstone, Canberra and Madrid comes from Horizons, using the antennas defined in DSN 810-005.</li>
        </ol>
      </section>

      {val.length > 0 && (
        <section id="validation">
          <h2 className="mb-1 text-lg font-semibold">Independent check against NASA&apos;s own illumination maps</h2>
          <p className="mb-2 text-sm text-muted">
            We compare our share of time with any part of the Sun visible at ground level against the LOLA team&apos;s average-illumination map (avgvisib_75s_120m, Mazarico et al. 2011 method). Ours covers 2026–2029. The LOLA map was simulated over a different period with its own time steps, so small differences are expected. Near peaks and rims, sunlight changes sharply over a single 120 m pixel (around the Malapert Massif pin, the LOLA map ranges from 0% to 66% within ±240 m), so a pin&apos;s exact position matters more than any model choice.
            {meanAbs !== null && <> Mean absolute difference across {val.length} sites: <b className="text-fg">{(meanAbs * 100).toFixed(1)} percentage points</b>.</>}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-130 text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="py-1 font-normal">Site</th><th className="font-normal">Sun: ours</th><th className="font-normal">Sun: LOLA</th><th className="font-normal">Earth: ours</th><th className="font-normal">Earth: LOLA</th></tr></thead>
              <tbody>
                {val.map((v) => (
                  <tr key={v.id} className="border-t border-line">
                    <td className="py-1.5">{v.name}</td>
                    <td className="font-mono">{(v.oursSun * 100).toFixed(1)}%</td>
                    <td className="font-mono">{(v.lolaSun * 100).toFixed(1)}%</td>
                    <td className="font-mono">{(v.oursEarth * 100).toFixed(1)}%</td>
                    <td className="font-mono">{v.lolaEarth === null ? "—" : `${(v.lolaEarth * 100).toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section id="sources">
        <h2 className="mb-2 text-lg font-semibold">Data sources and where they are used</h2>
        <ul className="space-y-3">
          {sourceList.map((s) => {
            const used = u[s.id] ?? [];
            return (
              <li key={s.id} id={`src-${s.id}`} className="rounded-lg border border-line bg-panel p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <a href={s.url} target={s.url.startsWith("/") ? undefined : "_blank"} rel="noreferrer" className="font-medium underline">{s.name}</a>
                  <span className="text-xs text-faint">{s.provider}</span>
                </div>
                <p className="text-sm text-muted">{s.use}</p>
                {used.length > 0 && (
                  <details className="mt-1 text-xs text-muted">
                    <summary className="cursor-pointer">Used in {used.length} metric{used.length === 1 ? "" : "s"}</summary>
                    <p className="mt-1">{used.map((id) => metricName.get(id) ?? id).join(" · ")}</p>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-faint">
          Curated site positions: LROC anthropogenic-objects catalogue (PDS), USGS Gazetteer of Planetary Nomenclature, LROC NAC mosaic pages and NASA mission pages. Every site page shows the original record. All {sites.length} listed sites have a coordinate copied from a cited source.
        </p>
        {excludedSites.length > 0 && (
          <details className="mt-2 text-xs text-muted">
            <summary className="cursor-pointer">Not listed: {excludedSites.length} missions or regions with no published coordinate</summary>
            <ul className="mt-1 space-y-1 pl-4">
              {excludedSites.map((e) => (
                <li key={e.name}>
                  <span className="text-fg">{e.name}</span>
                  {e.mission ? <span className="text-faint"> · {e.mission}</span> : null}. {e.reason}
                  {e.sourceUrl && (
                    <>
                      {" "}
                      <a href={e.sourceUrl} className="underline" target="_blank" rel="noreferrer">source</a>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section id="reference-values">
        <h2 className="mb-2 text-lg font-semibold">Cited reference values ({refs.values.length})</h2>
        <p className="mb-2 text-sm text-muted">These are lunar-wide values, not specific to a site. Each one quotes the document it came from.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-xs">
            <thead><tr className="text-left text-muted"><th className="py-1 font-normal">Quantity</th><th className="font-normal">Value</th><th className="font-normal">Source</th></tr></thead>
            <tbody>
              {(refs.values as { key: string; value: string | number; unit: string; range?: string; sourceTitle: string; sourceUrl: string; page?: string; quote?: string }[]).map((r) => (
                <tr key={r.key} className="border-t border-line align-top">
                  <td className="py-1.5 pr-2">{r.key.replace(/_/g, " ")}</td>
                  <td className="pr-2 font-mono">{String(r.value)} {r.unit}{r.range && r.range !== String(r.value) ? ` (${r.range})` : ""}</td>
                  <td title={r.quote}><a href={r.sourceUrl} target="_blank" rel="noreferrer" className="underline">{r.sourceTitle}</a>{r.page ? `, ${r.page}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="assumptions">
        <h2 className="mb-2 text-lg font-semibold">Mission assumptions (defaults)</h2>
        <p className="mb-2 text-sm text-muted">Inputs, not data. Mission planners can change them on any site page; metrics marked “Modelled” or “Your input” then recompute.</p>
        <table className="w-full text-xs">
          <tbody>
            {(Object.keys(DEFAULT_ASSUMPTIONS) as (keyof typeof DEFAULT_ASSUMPTIONS)[]).map((k) => (
              <tr key={k} className="border-t border-line align-top">
                <td className="py-1.5 pr-2">{ASSUMPTION_META[k].label}</td>
                <td className="pr-2 font-mono">{String(DEFAULT_ASSUMPTIONS[k])} {ASSUMPTION_META[k].unit}</td>
                <td className="text-muted">{ASSUMPTION_META[k].why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
