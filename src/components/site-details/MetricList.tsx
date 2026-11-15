"use client";

import { CaretRight, DownloadSimple, PencilSimple, SlidersHorizontal } from "@phosphor-icons/react";
import { memo, type ReactNode } from "react";
import { HoverCard } from "@/components/HoverCard";
import { InfoTip } from "@/components/InfoTip";
import { NumText } from "@/components/Num";
import { BandStrip, RAG_META, RagBadge, RagHint, RagIcon } from "@/components/RagBadge";
import { downloadCsv, toCsv } from "@/lib/csv";
import { educatorPick } from "@/lib/educator-metrics";
import { enthusiastPick } from "@/lib/enthusiast-metrics";
import { catalog, getMetric, metricsInCategory, type MetricDef } from "@/lib/metrics";
import type { MetricValue, ValueStatus } from "@/lib/metrics/types";
import type { Persona } from "@/lib/persona";
import { SOURCES, type SourceId } from "@/lib/sources";
import { EducatorAnswer, EducatorExplain } from "./EducatorText";
import { useEditor } from "./editor-store";

export const STATUS_META: Record<ValueStatus, { label: string; hint: string }> = {
  computed: { label: "Computed", hint: "Calculated for this site and date from NASA data. Hover to see the calculation." },
  modelled: { label: "Modelled", hint: "NASA data combined with your mission assumptions. Hover to see the calculation." },
  reference: { label: "Reference", hint: "A cited lunar-wide value, not specific to this site. Hover for the citation." },
  assumption: { label: "Your input", hint: "A mission assumption. Click to change it." },
  unavailable: { label: "Not available", hint: "No public dataset or model supports this yet; the reason is given." },
};

export const metricAnchor = (id: string) => `m-${id.replace(/\./g, "-")}`;
export const categoryAnchor = (id: string) => `cat-${id}`;

/**
 * Metrics shown for each category, in catalog order. Unavailable ones are hidden (D-041). Enthusiasts
 * see only their curated main metrics (`src/lib/enthusiast-metrics.ts`, D-109), educators a larger
 * curated set (`src/lib/educator-metrics.ts`, D-118), mission planners everything.
 */
export function shownMetrics(values: Record<string, MetricValue> | undefined, persona?: Persona) {
  return catalog.categories.map((cat) => ({
    cat,
    items: metricsInCategory(cat.id)
      .filter((m) => (persona === "enthusiast" ? !!enthusiastPick(m.id) : persona === "educator" ? !!educatorPick(m.id) : true))
      .map((m) => ({ m, v: values?.[m.id] }))
      .filter((x) => x.v && x.v.status !== "unavailable") as { m: MetricDef; v: MetricValue }[],
  }));
}

/**
 * The 13 metric categories as anchored sections (the page's table of contents links to each one).
 * Enthusiast: the question, a plain answer and the category status. Educator: the value in a sentence,
 * the mechanism, how to read it, and the colour bands. Mission planner: values with status, the
 * calculation behind each one, bands and the data rows (D-089).
 */
/** The name a metric goes by for this persona: the body and the page contents both use it (D-110). */
export function metricLabel(m: MetricDef, persona: Persona) {
  if (persona === "educator") return educatorPick(m.id)?.label ?? m.name;
  if (persona !== "enthusiast") return m.name;
  return enthusiastPick(m.id)?.card ?? m.question;
}

export function MetricList({ values, persona, computing, extras, exportMeta }: { values: Record<string, MetricValue> | undefined; persona: Persona; computing: boolean; extras?: Record<string, ReactNode>; exportMeta?: CsvMeta }) {
  const groups = shownMetrics(values, persona);
  return (
    <div>
      <p className="text-sm text-muted">
        {computing ? "Computing multi-year, area and sensitivity results…" : "All results computed."}
        {values && <> <span className="num">{groups.reduce((n, g) => n + g.items.length, 0)}</span> metrics for this site and date{persona === "planner" ? "; metrics with no public data source are hidden." : "."}</>}
      </p>
      {groups.map(({ cat, items }) => {
        if (!items.length) return null;
        return (
          <section key={cat.id} id={categoryAnchor(cat.id)} aria-labelledby={`${categoryAnchor(cat.id)}-h`} className="mt-10 scroll-mt-24">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line pb-3">
              <h3 id={`${categoryAnchor(cat.id)}-h`} className="text-[26px] font-semibold">{cat.label}</h3>
              {/* Only mission planners get the count and the CSV download (D-115, D-119). */}
              {persona === "planner" && <div className="ml-auto flex items-center gap-4">
                <span className="text-xs text-faint"><span className="num">{items.length}</span> metric{items.length === 1 ? "" : "s"}</span>
                {exportMeta && (
                  <button type="button" onClick={() => downloadCategoryCsv(cat, items, exportMeta)} title={`Download the ${cat.label} metrics for this site and date as a CSV file`} aria-label={`Download ${cat.label} metrics (CSV)`}
                    className="inline-flex items-center gap-1 text-sm text-muted underline decoration-faint underline-offset-4 hover:text-fg">
                    <DownloadSimple size={15} aria-hidden /> Download CSV
                  </button>
                )}
              </div>}
            </div>
            {persona === "enthusiast" && <TakeawayRows items={items.filter(({ m }) => enthusiastPick(m.id)?.card)} />}
            {extras?.[cat.id]}
            <ul className="divide-y divide-line">
              {items.filter(({ m }) => persona !== "enthusiast" || !enthusiastPick(m.id)?.card).map(({ m, v }) => <MetricRow key={m.id} m={m} v={v} persona={persona} />)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Site and landing time written into each per-category CSV (D-103). */
export type CsvMeta = { siteId: string; site: string; lat: number | null; lon: number | null; landingMs: number };

/** One category's shown metrics (the same rows as on screen) as a CSV download (D-103). */
function downloadCategoryCsv(cat: { id: string; label: string }, items: { m: MetricDef; v: MetricValue }[], meta: CsvMeta) {
  const landing = new Date(meta.landingMs).toISOString();
  const rows = [["site", "latitude_deg", "longitude_deg", "landing_utc", "category", "metric_id", "metric", "question", "value", "display_value", "status", "rating", "sources", "source_urls", "note"]];
  for (const { m, v } of items) {
    const src = [...new Set(v.sources)];
    rows.push([
      meta.site, meta.lat ?? "", meta.lon ?? "", landing, cat.label, m.id, m.name, m.question,
      typeof v.value === "number" && Number.isFinite(v.value) ? String(+v.value.toFixed(6)) : "", v.display,
      STATUS_META[v.status].label, v.rating ? RAG_META[v.rating.rag].label : "",
      src.map((s) => SOURCES[s]?.name ?? s).join("; "), src.map((s) => SOURCES[s]?.url ?? "").filter(Boolean).join(" "), v.note ?? "",
    ].map(String));
  }
  const stamp = landing.slice(0, 16).replace(/:/g, "") + "Z";
  downloadCsv(`${meta.siteId}-${stamp}-${cat.id}-metrics.csv`, toCsv(rows));
}

/**
 * Enthusiast takeaways (D-109): the category's headline metrics, first in its list, in the same row
 * layout as the other metrics. Rated ones show the rating icon and word; there is no coloured bar (D-118).
 */
function TakeawayRows({ items }: { items: { m: MetricDef; v: MetricValue }[] }) {
  if (!items.length) return null;
  return (
    <ul className="divide-y divide-line border-b border-line" aria-label="Main takeaways">
      {items.map(({ m, v }) => {
        const rag = v.rating?.rag;
        return (
          <li key={m.id} id={metricAnchor(m.id)} className="grid scroll-mt-24 gap-x-10 gap-y-2 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div className="flex min-w-0 items-start gap-1">
              <h4 className="font-medium leading-snug">{enthusiastPick(m.id)?.card ?? m.question}</h4>
              <span className="-mt-0.5 shrink-0">
                <InfoTip title={enthusiastPick(m.id)?.card ?? m.question} sources={v.sources?.length ? v.sources : ["metrics-sheet"]}>
                  {enthusiastPick(m.id)?.tip ?? m.definition}
                </InfoTip>
              </span>
            </div>
            <div className="min-w-0">
              <Value v={v} large readOnly />
              {rag && <div className="mt-1.5"><RagBadge rag={rag} /></div>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Memoised: rows don't depend on the selected time, so timeline playback (D-093) skips them. */
const MetricRow = memo(function MetricRow({ m, v, persona }: { m: MetricDef; v: MetricValue; persona: Persona }) {
  const planner = persona === "planner", educator = persona === "educator", enthusiast = persona === "enthusiast";
  return (
    <li id={metricAnchor(m.id)} className="grid scroll-mt-24 gap-x-10 gap-y-3 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="min-w-0">
        <div className="flex items-start gap-1">
          <h4 className="font-medium leading-snug">{metricLabel(m, persona)}</h4>
          <span className="-mt-0.5 shrink-0">
            <InfoTip title={metricLabel(m, persona)} sources={v.sources?.length ? v.sources : ["metrics-sheet"]}>
              {/* Enthusiasts and educators get copy written for them (D-112, D-118); planners get the sheet's definition and detail. */}
              {enthusiast ? enthusiastPick(m.id)?.tip ?? m.definition : educator ? educatorPick(m.id)?.tip ?? m.definition : <>
              <span className="block">{m.definition}</span>
              {!enthusiast && <span className="mt-1.5 block"><b className="font-medium text-fg">Why it matters:</b> {m.significance}</span>}
              {planner && (m.role || m.dependencies) && <span className="mt-1.5 block">Role: {m.role}{m.dependencies ? ` · depends on ${m.dependencies}` : ""}</span>}
              {m.unit && <span className="mt-1.5 block">Unit: {m.unit}</span>}
              {m.caveats && <span className="mt-1.5 block">Caveat: {m.caveats}</span>}
              </>}
            </InfoTip>
          </span>
        </div>
        {enthusiast && enthusiastPick(m.id)?.subtext && <p className="mt-1 text-sm leading-relaxed text-muted">{m.views.enthusiast}</p>}
        {educator && <div className="mt-1.5"><EducatorExplain id={m.id} /></div>}
        {planner && <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted">{m.definition}</p>}
      </div>
      <div className="min-w-0">
        {/* The answer: educators read it as a plain-English sentence with the value in bold (D-121); the others see the value. */}
        {educator ? <EducatorAnswer id={m.id} v={v} /> : <Value v={v} large={!enthusiast} readOnly={enthusiast} />}
        {!enthusiast && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {v.rating && <RatingButton rating={v.rating} />}
            <StatusLabel v={v} />
          </div>
        )}
        {!enthusiast && v.rating && typeof v.value === "number" && (
          <BandsTrigger k={v.rating.key} className="mt-3 block w-full text-left">
            <BandStrip rating={v.rating} value={v.value} wide />
          </BandsTrigger>
        )}
        {planner && v.note && <p className="mt-2.5 text-sm leading-relaxed text-muted"><NumText>{v.note}</NumText></p>}
        {educator && v.note && <p className="mt-2 text-xs text-faint">{v.note}</p>}
        {planner && v.detail && v.status !== "reference" && <DataRows detail={v.detail} />}
      </div>
    </li>
  );
});

/** The value, split into readable lines when it lists several parts ("a · b · c" or "a; b"). */
function Value({ v, large, readOnly }: { v: MetricValue; large: boolean; readOnly?: boolean }) {
  const parts = v.display.split(/ · |; /).map((p) => p.trim()).filter(Boolean);
  // "Your input" values open Mission assumptions, except for enthusiasts, who don't get the editors (D-114).
  const editable = !readOnly && v.status === "assumption" && v.inputs?.length;
  const body = parts.length > 1 ? (
    <ul className="space-y-0.5">
      {parts.map((p, i) => (
        <li key={i} className={`${i === 0 && large ? "text-base font-medium text-fg" : "text-sm text-fg"} leading-snug`}><NumText>{p}</NumText></li>
      ))}
    </ul>
  ) : (
    <div className={`${large ? "text-base font-medium" : "text-sm"} leading-snug text-fg`}><NumText>{v.display}</NumText></div>
  );
  if (!editable) return body;
  return <AssumptionTrigger inputs={v.inputs!} className="group block text-left">
    <span className="underline decoration-dotted decoration-faint underline-offset-4 group-hover:decoration-fg">{body}</span>
  </AssumptionTrigger>;
}

function AssumptionTrigger({ inputs, className, children }: { inputs: string[]; className?: string; children: ReactNode }) {
  const open = useEditor((s) => s.open);
  return (
    <button type="button" onClick={() => open({ kind: "assumptions", focus: inputs[0] })} title="Change in Mission assumptions" className={className}>
      {children}
    </button>
  );
}

function BandsTrigger({ k, className, children, title = "Change these rating bands" }: { k?: string; className?: string; children: ReactNode; title?: string }) {
  const open = useEditor((s) => s.open);
  return (
    <button type="button" onClick={() => open({ kind: "bands", focus: k })} title={title} aria-label="Change these rating bands" className={className}>
      {children}
    </button>
  );
}

function RatingButton({ rating }: { rating: NonNullable<MetricValue["rating"]> }) {
  return (
    // No native title here: the rating's own hover hint explains it (D-113); the sliders icon signals the editor.
    <BandsTrigger k={rating.key} title="" className="inline-flex items-center gap-1 rounded-sm text-xs text-fg hover:underline hover:decoration-dotted hover:underline-offset-4">
      <RagHint rag={rating.rag} className="inline-flex items-center gap-1">
        <RagIcon rag={rating.rag} />
        {RAG_META[rating.rag].label}
      </RagHint>
      <SlidersHorizontal size={14} className="text-faint" aria-hidden />
    </BandsTrigger>
  );
}

const STATUS_TEXT = "text-xs text-muted underline decoration-dotted decoration-faint underline-offset-4 hover:text-fg hover:decoration-fg";

function StatusLabel({ v }: { v: MetricValue }) {
  if (v.status === "assumption") {
    return v.inputs?.length ? (
      <AssumptionTrigger inputs={v.inputs} className={`inline-flex items-center gap-1 ${STATUS_TEXT}`}>
        {STATUS_META.assumption.label}<PencilSimple size={14} aria-hidden />
      </AssumptionTrigger>
    ) : <span className="text-xs text-muted">{STATUS_META.assumption.label}</span>;
  }
  if (v.status === "reference") {
    return (
      <HoverCard ariaLabel="Where this reference value comes from" className={STATUS_TEXT} label={STATUS_META.reference.label}>
        <div className="mb-1.5 font-semibold">Cited reference value</div>
        {v.note && <p className="text-muted">{v.note}</p>}
        {v.detail && <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap border-t border-line pt-2 font-sans text-xs text-muted">{v.detail}</pre>}
      </HoverCard>
    );
  }
  return (
    <HoverCard ariaLabel={`How this ${v.status} value was calculated`} className={STATUS_TEXT} label={STATUS_META[v.status].label}>
      <CalcCard v={v} />
    </HoverCard>
  );
}

const METHOD: Partial<Record<SourceId, string>> = {
  "jpl-horizons": "Sun and Earth positions from JPL Horizons (DE441) tables, converted to this site's azimuth and elevation.",
  "lola-pds": "Terrain from LRO LOLA elevation data: horizon, slopes and heights around the site.",
  "dsn-810-005": "Deep Space Network station positions and limits from DSN 810-005.",
  "psr-atlas": "Permanently shadowed regions from the LROC PSR atlas.",
  "usgs-gazetteer": "Named features from the USGS Gazetteer of Planetary Nomenclature.",
  "lroc-sites": "Landing-site coordinates from LROC / cited mission records.",
  "nssdc-moon": "Physical constants from the NSSDCA Moon fact sheet.",
  "mission-assumption": "Your mission assumptions.",
  diviner: "Surface temperatures from LRO Diviner polar maps.",
};

function CalcCard({ v }: { v: MetricValue }) {
  const name = getMetric(v.id)?.name ?? v.id;
  const method = v.sources.map((s) => METHOD[s]).filter(Boolean);
  return (
    <div>
      <div className="font-semibold">How this was calculated</div>
      <div className="text-faint">{name} · {STATUS_META[v.status].label.toLowerCase()} for this site and date</div>
      {v.calc?.length ? (
        <ol className="mt-2 space-y-1.5">
          {v.calc.map((l, i) => (
            <li key={i} className="flex gap-2">
              <span className="num w-4 shrink-0 text-right text-faint">{i + 1}</span>
              <span className={l.includes("=") ? "text-fg" : "text-muted"}><NumText>{l}</NumText></span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-muted">
          {method.map((m) => <li key={m}>{m}</li>)}
          {v.note && <li><NumText>{v.note}</NumText></li>}
        </ul>
      )}
      <div className="mt-2.5 flex items-center gap-1.5 border-t border-line pt-2 text-xs">
        <span className="text-muted">Result</span>
        <CaretRight size={12} className="text-faint" aria-hidden />
        <span className="font-medium"><NumText>{v.display}</NumText></span>
      </div>
      <div className="mt-1.5 text-faint">Data: {[...new Set(v.sources)].map((s) => SOURCES[s]?.name ?? s).join(" · ")}</div>
    </div>
  );
}

function DataRows({ detail }: { detail: string }) {
  const lines = detail.split("\n").filter(Boolean);
  return (
    <details className="group mt-2.5">
      <summary className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
        <CaretRight size={12} className="caret transition-transform" aria-hidden />
        {lines.length === 1 ? "Show the data row" : `Show ${lines.length} data rows`}
      </summary>
      <ul className="mt-1.5 max-h-48 space-y-0.5 overflow-auto border-l border-line pl-3 text-xs text-muted">
        {lines.map((l, i) => <li key={i}><NumText>{l}</NumText></li>)}
      </ul>
    </details>
  );
}
