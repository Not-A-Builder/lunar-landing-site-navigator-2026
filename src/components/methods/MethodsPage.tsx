"use client";

import { ArrowDown, ArrowUpRight, CaretRight, Check, X } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { InfoTip } from "@/components/InfoTip";
import { NameFooter } from "@/components/NameFooter";
import { PageToc, type TocItem } from "@/components/site-details/PageToc";
import type { Assumptions } from "@/lib/assumptions";
import { SITE_TITLE } from "@/lib/config";
import type { SourceId } from "@/lib/sources";
import { btnPrimary, btnSecondary } from "@/lib/ui";
import { DiskExplorer } from "./DiskExplorer";
import { EphemerisExplorer } from "./EphemerisExplorer";
import { HorizonExplorer } from "./HorizonExplorer";
import { MetricsBreakdown } from "./MetricsBreakdown";
import { Chapter, Code, Eyebrow, Section, SectionHead } from "./parts";
import { PipelineExplorer } from "./PipelineExplorer";
import { ReferenceTable, type RefRow } from "./ReferenceTable";
import { SourceGrid, type SourceCard } from "./SourceGrid";
import { ValidationChart, type ValRow } from "./ValidationChart";
import { useWidth } from "./use-width";

export type MethodsData = {
  heroMask: number[];
  heroDem: string;
  statusCounts: Record<string, number>;
  usageBasis: string;
  categories: { id: string; label: string; count: number }[];
  metricTotal: number;
  sources: SourceCard[];
  mapLayers: { id: string; map: string }[];
  validation: ValRow[];
  ephemeris: { years: number[]; stepMinutes: number; fields: string[]; source: string };
  sites: {
    total: number;
    polar: number;
    groups: { label: string; count: number }[];
    example: { name: string; lat: number; lon: number; sourceUrl: string; sourceQuote: string };
    excluded: { name: string; mission: string | null; reason: string; sourceUrl: string | null }[];
  };
  references: RefRow[];
  assumptions: { key: string; label: string; value: string; unit: string; why: string }[];
};

/** Sites offered in the horizon explorer: Artemis candidate regions with distinct horizons, plus Shackleton's floor. */
const HORIZON_SITES = [
  { id: "mons-mouton-plateau", name: "Mons Mouton Plateau" },
  { id: "haworth", name: "Haworth" },
  { id: "malapert-massif", name: "Malapert Massif" },
  { id: "peak-near-cabeus-b", name: "Peak near Cabeus B" },
  { id: "feature-shackleton-crater", name: "Shackleton crater" },
];

const ASSUMPTION_GROUP: Record<keyof Assumptions, string> = {
  missionDays: "Mission & visibility", mastHeightM: "Mission & visibility", sunDiskThreshold: "Mission & visibility", earthDiskThreshold: "Mission & visibility", dsnMinElevDeg: "Mission & visibility",
  panelAreaM2: "Power", panelEfficiency: "Power", panelTracking: "Power", panelFixedAzDeg: "Power", batteryWh: "Power", loadW: "Power", survivalLoadW: "Power",
  slopeToleranceDeg: "Landing", approachAzDeg: "Landing", footprintRadiusM: "Landing", landerMassKg: "Landing", footpadAreaM2: "Landing",
  txPowerW: "Communication link", landerAntennaGainDbi: "Communication link", freqGHz: "Communication link", groundGTdBK: "Communication link", requiredEbN0dB: "Communication link", linkMarginDb: "Communication link",
  roverSpeedMPerH: "Rover & operations", roverWhPerKm: "Rover & operations", minSunElevForOpticalNavDeg: "Rover & operations",
};

const TOC: TocItem[] = [
  { id: "overview", label: "Overview" },
  { id: "principles", label: "Ground rules" },
  {
    id: "how", label: "How it works", children: [
      { id: "pipeline", label: "From NASA archives to your screen" },
      { id: "ephemeris", label: "Where the Sun and Earth are" },
      { id: "horizon", label: "The terrain horizon" },
      { id: "disk", label: "The Sun is a disk" },
      { id: "metrics", label: "From geometry to metrics" },
    ],
  },
  { id: "validation", label: "Checked against NASA" },
  {
    id: "inventory", label: "Inventory", children: [
      { id: "sources", label: "Data sources" },
      { id: "sites", label: "Site positions" },
      { id: "reference-values", label: "Cited reference values" },
      { id: "assumptions", label: "Mission assumptions" },
    ],
  },
  { id: "faq", label: "Questions" },
];

/** Data & methods as a landing page (D-139b): hero, then a 3 / 9 split with sticky contents like site details. */
export function MethodsPage({ data }: { data: MethodsData }) {
  const unavailable = data.statusCounts.unavailable ?? 0;
  const shown = data.metricTotal - unavailable;
  const valSun = data.validation.map((v) => Math.abs(v.oursSun - v.lolaSun));
  const meanSun = valSun.reduce((a, b) => a + b, 0) / valSun.length;
  const years = data.ephemeris.years;
  const span = `${years[0]}–${years[years.length - 1]}`;
  const [basisSite, basisDate] = data.usageBasis.split(" @ ");
  const basisName = basisSite.charAt(0).toUpperCase() + basisSite.slice(1);

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-24">
      <Hero data={data} shown={shown} unavailable={unavailable} meanSun={meanSun} basisName={basisName} basisDate={basisDate} />

      <div className="mt-4 grid grid-cols-12 lg:gap-x-10">
        <aside className="col-span-3 hidden lg:block">
          <div data-toc-scroll className="no-scrollbar sticky top-[88px] max-h-[calc(100vh-112px)] overflow-y-auto pb-8 pr-2">
            <PageToc items={TOC} />
          </div>
        </aside>

        <div className="col-span-12 min-w-0 lg:col-span-9">
          {/* ── Ground rules ── */}
          <Section id="principles">
            <SectionHead id="principles" n="00" kicker="Ground rules" title="Four promises behind every number">
              The tool is built to compare real landing sites, so a plausible-looking guess is worse than a blank. These rules apply on every page.
            </SectionHead>
            <div className="mt-10 grid gap-px overflow-hidden rounded-sm border border-line bg-line md:grid-cols-2">
              <RuleColumn title="We never" icon={<X size={16} weight="bold" />} tone="never" items={[
                "Type in a value from memory or fill a gap with a placeholder.",
                "Show a metric that no public dataset or model supports.",
                "Ask JPL about each site from your browser.",
                "Hide the assumptions behind a modelled number.",
              ]} />
              <RuleColumn title="We do" icon={<Check size={16} weight="bold" />} tone="do" items={[
                "Trace each value to a NASA or partner dataset, a cited document, or an input you set.",
                `Hide those metrics and record why: ${unavailable} of ${data.metricTotal} at ${basisName} on the reference run.`,
                "Use Moon-wide hourly tables from JPL Horizons and turn them into each site's view on your device.",
                "List every input a modelled value uses. Mission planners can change them and see it recompute.",
              ]} />
            </div>
          </Section>

          {/* ── Part 1 ── */}
          <Chapter id="how" part="Part 1" title="How it works">
            Five steps take raw NASA data to the numbers on a site page. Each one below is interactive and runs on the same files and code as the rest of the tool.
          </Chapter>

          <Section id="pipeline">
            <SectionHead id="pipeline" n="01" kicker="Pipeline" title="From NASA archives to your screen">
              The heavy work happens once, offline. What reaches your browser is small: hourly sky tables and one terrain file per site. Your device does the rest in a few seconds.
            </SectionHead>
            <PipelineExplorer years={years} siteCount={data.sites.total} />
          </Section>

          <Section id="ephemeris">
            <SectionHead id="ephemeris" n="02" kicker="Sky" title="Where the Sun and Earth are, every hour">
              Instead of asking JPL about each site, we store, for every hour of {span}, where on the Moon the Sun and Earth are straight overhead, and how far away they are. Exact vector geometry then gives the Sun&apos;s and Earth&apos;s direction from any site.
            </SectionHead>
            <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="reveal overflow-x-auto rounded-sm border border-line">
                <table className="w-full min-w-130 text-sm">
                  <thead>
                    <tr className="bg-panel text-left text-xs text-faint">
                      <th className="px-4 py-2.5 font-normal">Column</th>
                      <th className="px-4 py-2.5 font-normal">What it holds</th>
                      <th className="px-4 py-2.5 font-normal">From Horizons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["sunLon, sunLat", "Sub-solar point: where the Sun is overhead (degrees, east-positive)", "QUANTITIES 15"],
                      ["sunAU", "Sun–Moon distance", "QUANTITIES 19"],
                      ["earthLon, earthLat", "Sub-Earth point: where Earth is overhead. This is the optical libration", "QUANTITIES 14"],
                      ["earthAU", "Earth–Moon distance", "QUANTITIES 20"],
                      ["dsnGold, dsnCanb, dsnMadr", "The Moon's elevation at the 70 m Deep Space Network antennas in Goldstone (DSS 14), Canberra (DSS 43) and Madrid (DSS 63)", "QUANTITIES 4"],
                    ].map(([c, w, q]) => (
                      <tr key={c} className="border-t border-line align-top">
                        <td className="px-4 py-2.5 font-mono text-xs leading-6 whitespace-nowrap text-fg">{c}</td>
                        <td className="px-4 py-2.5 text-muted">{w}</td>
                        <td className="num px-4 py-2.5 text-xs leading-6 whitespace-nowrap text-faint">{q}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="reveal self-start divide-y divide-line overflow-hidden rounded-sm border border-line">
                <BigFact value="0.0002°" tip="A test point near the pole (89.45°S), 1 Dec 2026: Sun and Earth azimuth and elevation from our tables against JPL Horizons' own site-specific output. The largest difference was 0.00019°." sources={["jpl-horizons"]}>
                  largest difference from JPL Horizons&apos; own site-specific Sun and Earth angles in our test
                </BigFact>
                <BigFact value={`${data.ephemeris.stepMinutes} min`} tip={`Every row of the ${span} tables is one Horizons sample. Times in between are interpolated linearly.`} sources={["jpl-horizons"]}>
                  between rows, {span}; other years are built live from Horizons when needed
                </BigFact>
              </div>
            </div>
            <div className="mt-6">
              <EphemerisExplorer years={years} />
            </div>
            <p className="reveal mt-4 max-w-3xl text-sm leading-relaxed text-muted">
              Seen from the south pole, Earth hangs near the horizon, so this few-degree wobble decides whether it is above the local terrain. Libration is already part of the Horizons numbers for a fixed point on the Moon, so nothing is added on top.
            </p>
          </Section>

          <Section id="horizon">
            <SectionHead id="horizon" n="03" kicker="Terrain" title="The terrain horizon, traced from LOLA">
              Horizons measures elevation against a smooth sphere. Real sites sit among crater rims and massifs, so for each site we trace 360 rays across LOLA elevation data, one per degree of azimuth, and keep the highest angle each ray meets. The Moon&apos;s curve is built in. There is no air, so there is no refraction.
            </SectionHead>
            <div className="mt-10 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="reveal grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-4 xl:grid-cols-2">
                <Spec value="360" label="rays, 1° apart" />
                <Spec value="200 km" label="how far each ray reaches" />
                <Spec value="120 m" label="first step; later steps grow to 0.4% of the distance" />
                <Spec value="6" label="observer heights: 0, 2, 5, 10, 20, 50 m" />
              </div>
              <div className="reveal rounded-sm border border-line bg-panel p-5">
                <Eyebrow>Angle to terrain at distance d</Eyebrow>
                <p className="mt-3 font-mono text-sm text-fg">angle = atan2(r<sub>T</sub>·cos θ − r<sub>O</sub>, r<sub>T</sub>·sin θ)</p>
                <p className="mt-1 font-mono text-sm text-fg">θ = d / R</p>
                <ul className="mt-3 space-y-1 text-xs leading-relaxed text-muted">
                  <li><span className="font-mono text-fg">R</span> = 1,737.4 km, the LOLA reference sphere</li>
                  <li><span className="font-mono text-fg">r<sub>T</sub></span> = R + terrain height at distance d</li>
                  <li><span className="font-mono text-fg">r<sub>O</sub></span> = R + site height + observer height</li>
                </ul>
                <p className="mt-3 text-xs leading-relaxed text-faint">Where the 120 m polar grid ends (75°S), rays continue on the global LOLA grid (16 pixels per degree).</p>
              </div>
            </div>
            <div className="mt-6">
              <HorizonExplorer options={HORIZON_SITES} initial="mons-mouton-plateau" />
            </div>
          </Section>

          <Section id="disk">
            <SectionHead id="disk" n="04" kicker="Visibility" title="The Sun is a disk, not a point">
              At the pole the Sun skims the horizon, so it is often only partly up. For every sample we compute the share of the Sun&apos;s disk above the terrain horizon in its direction (the visible-disk coefficient f(t) of Liu et al. 2023), and remove any part Earth covers during an eclipse. Earth&apos;s disk is handled the same way, with its radius from the NSSDCA Earth fact sheet and its distance from Horizons.
            </SectionHead>
            <div className="mt-10">
              <DiskExplorer />
            </div>
          </Section>

          <Section id="metrics">
            <SectionHead id="metrics" n="05" kicker="Metrics" title={`From geometry to ${data.metricTotal} metrics`}>
              The Sun and Earth visibility series feed sunlit and Earth-in-view windows, power and battery models, communication links and the rest of the catalog. Each value is tagged with how it was obtained.
            </SectionHead>
            <div className="reveal mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line md:grid-cols-4">
              <Spec value="10 min" label="steps along the mission (30 days by default); rise and set times interpolated between steps" />
              <Spec value="2 h" label="steps for multi-year statistics, 1 Jan 2026 to 31 Dec 2029" />
              <Spec value="7 × 7" label="horizon masks on a 1 km grid around the site, for area statistics" />
              <Spec value="±1 day · 1 km" label="sensitivity: landing a day earlier or later, or 1 km away in four directions" />
            </div>
            <div className="mt-6">
              <MetricsBreakdown counts={data.statusCounts} basis={data.usageBasis} total={data.metricTotal} categories={data.categories} />
            </div>
            <p className="reveal mt-4 max-w-3xl text-sm leading-relaxed text-muted">
              Rated values are placed in red, amber or green bands, each with a written basis, and given a 0–10 position used for comparison scores. Mission planners can change the bands; enthusiasts always see the defaults.
            </p>
          </Section>

          {/* ── Validation ── */}
          <Section id="validation">
            <SectionHead id="validation" n="06" kicker="Proof" title="Checked against NASA's own maps">
              The LOLA team publishes average-visibility maps of the south pole. We compare our share of time with any part of the Sun (or Earth) above the horizon at ground level with theirs for every listed south-polar site. Their maps cover a different period with their own time steps, so small differences are expected.
            </SectionHead>
            <div className="mt-10">
              <ValidationChart rows={data.validation} />
            </div>
            <p className="reveal mt-4 max-w-3xl text-sm leading-relaxed text-muted">
              The larger differences sit on peaks and rims, where sunlight changes sharply within a single 120 m pixel. Within 240 m of the Malapert Massif pin, the LOLA map itself ranges from about 15% to 61%. There, the pin&apos;s exact position matters more than any model choice.
            </p>
          </Section>

          {/* ── Part 2 ── */}
          <Chapter id="inventory" part="Part 2" title="Inventory">
            Everything the tool draws on, in one place: data sources, site coordinates, cited lunar values and the default mission inputs.
          </Chapter>

          <Section id="sources">
            <SectionHead id="sources" n="07" kicker="Sources" title="Every source, and where it is used">
              The same registry feeds every tooltip in the tool. Counts are metrics that cite the source on the reference run ({basisName}, {basisDate}).
            </SectionHead>
            <div className="mt-10">
              <SourceGrid sources={data.sources} mapLayers={data.mapLayers} />
            </div>
          </Section>

          <Section id="sites">
            <SectionHead id="sites" n="08" kicker="Sites" title={`${data.sites.total} sites, each with a cited coordinate`}>
              Positions come from the LROC landed-objects catalogue, the USGS Gazetteer of Planetary Nomenclature, LROC NAC mosaic pages and NASA mission pages. Every record keeps its link and the exact text the coordinate was copied from. {data.sites.polar} of them lie in the south polar region (poleward of 80°S).
            </SectionHead>
            <div className="mt-10 grid gap-6 xl:grid-cols-2">
              <div className="reveal rounded-sm border border-line bg-panel p-5 md:p-6">
                <Eyebrow>Sites by list</Eyebrow>
                <ul className="mt-4 space-y-2">
                  {data.sites.groups.map((g) => (
                    <li key={g.label} className="grid grid-cols-[minmax(0,1fr)_minmax(60px,40%)_28px] items-center gap-3 text-sm">
                      <span className="truncate text-muted">{g.label}</span>
                      <span className="h-2 rounded-[2px] bg-panel-2"><span className="block h-full rounded-[2px] bg-fg/70" style={{ width: `${(g.count / data.sites.groups[0].count) * 100}%` }} /></span>
                      <span className="num text-right text-fg">{g.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="reveal rounded-sm border border-line bg-panel p-5 md:p-6">
                <Eyebrow>Example record</Eyebrow>
                <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-lg font-semibold">{data.sites.example.name}</span>
                  <span className="num text-sm text-muted">{Math.abs(data.sites.example.lat)}°S, {Math.abs(data.sites.example.lon)}°{data.sites.example.lon < 0 ? "W" : "E"}</span>
                </div>
                <blockquote className="mt-3 border-l-2 border-line pl-3 text-sm leading-relaxed text-muted italic">{data.sites.example.sourceQuote}</blockquote>
                <a href={data.sites.example.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-fg underline decoration-line underline-offset-4 hover:decoration-current">
                  Open the source record <ArrowUpRight size={14} aria-hidden />
                </a>
              </div>
            </div>
            {data.sites.excluded.length > 0 && (
              <details className="reveal mt-6 text-sm">
                <summary className="inline-flex cursor-pointer items-center gap-1 text-muted hover:text-fg">
                  <CaretRight size={14} className="caret transition-transform" aria-hidden /> Not listed: {data.sites.excluded.length} missions or regions with no published coordinate
                </summary>
                <ul className="mt-3 space-y-2 pl-5">
                  {data.sites.excluded.map((e) => (
                    <li key={e.name} className="text-muted">
                      <span className="text-fg">{e.name}</span>
                      {e.mission ? <span className="text-faint"> · {e.mission}</span> : null}. {e.reason}
                      {e.sourceUrl && <> <a href={e.sourceUrl} className="underline decoration-line underline-offset-4 hover:text-fg" target="_blank" rel="noreferrer">source</a></>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Section>

          <Section id="reference-values">
            <SectionHead id="reference-values" n="09" kicker="References" title={`${data.references.length} cited reference values`}>
              Lunar-wide values, the same for every site: regolith properties, radiation, link parameters and more. Each one quotes the document and page it came from. Open a row to read the quote.
            </SectionHead>
            <div className="mt-10">
              <ReferenceTable rows={data.references} />
            </div>
          </Section>

          <Section id="assumptions">
            <SectionHead id="assumptions" n="10" kicker="Inputs" title="Mission assumptions: inputs, not data">
              Defaults describe a generic small solar-powered lander and are examples. Mission planners can change them on any site page; values marked &ldquo;Modelled&rdquo; or &ldquo;Your input&rdquo; then recompute.
            </SectionHead>
            <div className="mt-10 gap-6 xl:columns-2">
              {[...new Set(Object.values(ASSUMPTION_GROUP))].map((g) => (
                <div key={g} className="reveal mb-6 break-inside-avoid rounded-sm border border-line bg-panel">
                  <div className="border-b border-line px-5 py-3 text-sm font-semibold">{g}</div>
                  <dl className="divide-y divide-line">
                    {data.assumptions.filter((a) => ASSUMPTION_GROUP[a.key as keyof Assumptions] === g).map((a) => (
                      <div key={a.key} className="px-5 py-3">
                        <div className="flex items-baseline justify-between gap-4">
                          <dt className="text-sm text-fg">{a.label}</dt>
                          <dd className="num shrink-0 text-sm text-fg">{a.value}{a.unit ? <span className="text-faint"> {a.unit}</span> : null}</dd>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted">{a.why}</p>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </Section>

          {/* ── FAQ ── */}
          <Section id="faq" className="min-h-[calc(100vh-88px)]">
            <SectionHead id="faq" n="11" kicker="Questions" title="Common questions" />
            <div className="mt-8 border-t border-line">
              <Faq q="Why are some metrics missing for a site?">
                A metric is shown only when it can be computed from public data, modelled from that data plus your inputs, or quoted from a cited document. The rest are hidden rather than guessed, and each has a recorded reason. On the reference run ({basisName}, {basisDate}) that is {unavailable} of {data.metricTotal}, so {shown} have a value.
              </Faq>
              <Faq q="Is anything fetched live while I use the tool?">
                Map tiles come from NASA Moon Trek. A landing date outside {span} makes our server build that year&apos;s table from JPL Horizons, and a typed-in coordinate makes it build that point&apos;s terrain file from the LOLA layers. Everything else is precomputed files served with the site.
              </Faq>
              <Faq q="Why might a number differ from another illumination study?">
                Studies differ in the period they simulate, their time step, the elevation grid, the exact position of the point and what counts as &ldquo;lit&rdquo; (any part of the disk, half of it, or all of it). Our validation above uses &ldquo;any part&rdquo; at ground level to match the LOLA maps; site pages use your sunlit threshold (half the disk by default).
              </Faq>
              <Faq q="How can I check a specific number?">
                Hover its status label on a site page. Computed and modelled values list the calculation steps with that site&apos;s numbers, and every tooltip links to its sources. The pipeline commands in <Code>package.json</Code> rebuild every data file from the original downloads.
              </Faq>
              <Faq q="Can I change the assumptions?">
                Yes, as a Mission planner: open &ldquo;Set mission assumptions&rdquo; or &ldquo;Customise rating bands&rdquo; on a site page or in a comparison. The Enthusiast view always uses the defaults.
              </Faq>
            </div>
          </Section>
        </div>
      </div>

      <NameFooter sites={data.sites.total} metrics={data.metricTotal} className="mt-24" />
    </div>
  );
}

function Hero({ data, shown, unavailable, meanSun, basisName, basisDate }: { data: MethodsData; shown: number; unavailable: number; meanSun: number; basisName: string; basisDate: string }) {
  return (
    <section id="overview" aria-labelledby="overview-h" className="scroll-mt-24 pt-14">
      <div className="max-w-4xl">
        <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-faint">
          <span className="text-fg">Data &amp; methods</span>
          <span className="h-px w-8 bg-line" aria-hidden />
          <span>{SITE_TITLE}</span>
        </div>
        <h1 id="overview-h" className="mt-5 text-[2.75rem] leading-[1.05] font-semibold tracking-tight text-balance sm:text-[4rem]">
          Every number here traces back to NASA.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          Sun and Earth positions from JPL Horizons, terrain from the Lunar Orbiter Laser Altimeter, and checks against the LOLA team&apos;s own maps. Here is how the data is fetched, computed, verified and shown, with nothing filled in from memory.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#how" className={btnPrimary}>See how it works <ArrowDown size={16} aria-hidden /></a>
          <a href="#sources" className={btnSecondary}>Browse all sources</a>
        </div>
      </div>

      <HeroHorizon mask={data.heroMask} dem={data.heroDem} />

      <div className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line md:grid-cols-3 xl:grid-cols-6">
        <HeroStat value={String(data.metricTotal)} label={`metrics in ${data.categories.length} categories`} tip="The project's metrics catalog (Draft 3 sheet): definitions, units and persona wording." sources={["metrics-sheet"]} />
        <HeroStat value={String(shown)} label={`with a value at ${basisName}; ${unavailable} hidden, not guessed`} tip={`Reference run: ${basisName}, landing ${basisDate} 00:00 UTC, default assumptions.`} sources={["metrics-sheet"]} />
        <HeroStat value="0.0002°" label="largest difference from Horizons' own site angles in our test" tip="Test point near the pole (89.45°S), 1 Dec 2026, Sun and Earth azimuth and elevation." sources={["jpl-horizons"]} />
        <HeroStat value={`${(meanSun * 100).toFixed(1)} points`} label={`average gap between our sunlight figures and NASA's LOLA map, across ${data.validation.length} south-pole sites`} tip="For each site: the share of time any part of the Sun is visible at ground level, ours (2026–2029) against the LOLA team's average-visibility map (avgvisib_75s_120m). The gap is in percentage points, e.g. 32.4% vs 32.2% is 0.2 points; this is the average gap, ignoring direction." sources={["lola-pds", "pgda"]} />
        <HeroStat value={String(data.sites.total)} label="landing sites, each with a cited coordinate" tip="Every site record keeps the source link and the exact text its coordinate was copied from." sources={["lroc-sites", "usgs-gazetteer", "nasa-artemis", "nasa-clps"]} />
        <HeroStat value={String(data.references.length)} label="lunar reference values, each quoted from its source" tip="Lunar-wide values; each row quotes its document and page." sources={["reference-literature"]} />
      </div>
    </section>
  );
}

/**
 * Haworth's real ground-level horizon (LOLA ray-march, 1° bins) drawn across the hero; vertical scale stretched.
 * Drawn in real pixels (not a stretched viewBox): the draw-on animation measures the path length, which a
 * non-uniformly scaled SVG gets wrong, so the line used to stop short of the fill.
 */
function HeroHorizon({ mask, dem }: { mask: number[]; dem: string }) {
  const [box, W] = useWidth<HTMLDivElement>(1400);
  const H = W < 640 ? 160 : 208, top = 16, bottom = H - 24;
  const lo = Math.min(0, ...mask) - 1, hi = Math.max(0, ...mask) + 1;
  const y = (v: number) => top + ((hi - v) / (hi - lo)) * (bottom - top);
  const pts = [...mask, mask[0]].map((v, i) => [(i / mask.length) * W, y(v)] as const);
  const line = pts.map(([x, yy], i) => `${i ? "L" : "M"}${x.toFixed(1)},${yy.toFixed(1)}`).join("");
  return (
    <figure className="mt-14">
      <div ref={box}>
        <svg width={W} height={H} className="block" aria-hidden>
          <path d={`${line}L${W},${H}L0,${H}Z`} className="draw-fade fill-terrain" fillOpacity={0.35} />
          <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="stroke-faint" strokeDasharray="4 6" />
          <path d={line} pathLength={1} className="draw-line fill-none stroke-fg" strokeWidth={1.5} strokeLinejoin="round" />
        </svg>
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-faint">
        <span>The real horizon around Haworth, all 360° from north, traced from {dem}. Dashed: a flat horizon. Height stretched to show the shape.</span>
        <InfoTip title="Haworth horizon" sources={["lola-pds"]}>
          Ground-level horizon mask from Haworth&apos;s terrain file: the highest terrain angle in each 1° of azimuth, out to 200 km. Every Sun and Earth calculation for this site is compared against this line.
        </InfoTip>
      </figcaption>
    </figure>
  );
}

function HeroStat({ value, label, tip, sources }: { value: string; label: string; tip: string; sources: SourceId[] }) {
  return (
    <div className="bg-bg p-5">
      <div className="num text-2xl text-fg sm:text-[2rem] sm:leading-10">{value}</div>
      <div className="mt-1 flex items-start gap-1 text-sm leading-snug text-muted">
        <span>{label}</span>
        <InfoTip title={label} sources={sources}>{tip}</InfoTip>
      </div>
    </div>
  );
}

function BigFact({ value, children, tip, sources }: { value: string; children: ReactNode; tip: string; sources: SourceId[] }) {
  return (
    <div className="bg-panel p-5">
      <div className="num text-[2rem] leading-10 text-fg">{value}</div>
      <div className="mt-1 flex items-start gap-1 text-sm leading-snug text-muted">
        <span>{children}</span>
        <InfoTip title="Source" sources={sources} align="right">{tip}</InfoTip>
      </div>
    </div>
  );
}

function Spec({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-panel p-5">
      <div className="num text-xl text-fg">{value}</div>
      <div className="mt-1 text-sm leading-snug text-muted">{label}</div>
    </div>
  );
}

function RuleColumn({ title, icon, items, tone }: { title: string; icon: ReactNode; items: string[]; tone: "never" | "do" }) {
  return (
    <div className={`p-6 md:p-8 ${tone === "do" ? "bg-panel" : "bg-bg"}`}>
      <div className="text-xs font-medium uppercase tracking-wider text-faint">{title}</div>
      <ul className="mt-4 space-y-4">
        {items.map((t, i) => (
          <li key={i} className="reveal flex gap-3 text-base leading-relaxed">
            <span className={`mt-1 grid size-6 shrink-0 place-items-center rounded-sm ${tone === "do" ? "bg-fg text-bg" : "border border-line text-faint"}`}>{icon}</span>
            <span className={tone === "do" ? "text-fg" : "text-muted"}>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="faq group border-b border-line">
      <summary className="flex cursor-pointer items-center justify-between gap-4 py-5 text-lg font-medium transition-colors hover:text-fg">
        {q}
        <CaretRight size={18} className="caret shrink-0 text-faint transition-transform duration-300" aria-hidden />
      </summary>
      <div className="max-w-3xl pb-6 text-base leading-relaxed text-muted">{children}</div>
    </details>
  );
}
