"use client";

// Row cells are passed as arrays and placed by index inside Row's own keyed column wrappers, so the
// elements in those arrays need no keys of their own.
/* eslint-disable react/jsx-key */

import { ArrowCounterClockwise, ArrowRight, Pause, PencilSimple, Play, Plus, SignOut, SlidersHorizontal, Steps, Warning } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BodyTimeline } from "@/components/charts/BodyTimeline";
import { HorizonPanorama } from "@/components/charts/HorizonPanorama";
import { LibrationChart } from "@/components/charts/LibrationChart";
import { ComparisonMode } from "@/components/charts/chart-kit";
import { PowerCharts } from "@/components/charts/PowerCharts";
import { CategoryIcon } from "@/components/CategoryIcon";
import { InfoTip } from "@/components/InfoTip";
import { NumText } from "@/components/Num";
import { RAG_META, RagBadge, RagHint, RagIcon } from "@/components/RagBadge";
import { AssumptionsModal } from "@/components/site-details/AssumptionsModal";
import { BandsModal } from "@/components/site-details/BandsModal";
import { useEditor } from "@/components/site-details/editor-store";
import { ScenarioCard, ScenarioLines } from "@/components/site-selection/ScenarioBar";
import { MetricAnswerCell, MetricLabelCell, metricLabel } from "@/components/site-details/MetricList";
import type { TocItem } from "@/components/site-details/PageToc";
import { blockCopy, blockTitles, by, LibrationText, statusCardHeads, statusCards, viewsLead } from "@/components/site-details/views-copy";
import type { Assumptions } from "@/lib/assumptions";
import { useEffectiveAssumptions } from "@/lib/assumptions-store";
import { compareFlowHref, markFlowEntry } from "@/lib/compare-flow";
import { historyHref } from "@/lib/history";
import { MAX_COMPARE } from "@/lib/config";
import { enthusiastPick } from "@/lib/enthusiast-metrics";
import { educatorPick } from "@/lib/educator-metrics";
import { powerModel } from "@/lib/engine/analysis";
import { CONST } from "@/lib/engine/constants";
import { greatCircleKm } from "@/lib/engine/geometry";
import { DAY_MS, HOUR_MS, type Scenario as Run } from "@/lib/engine/scenario";
import { catalog, metricsInCategory, type MetricDef } from "@/lib/metrics";
import { fmtDeg, fmtElevation, fmtHours, fmtLat, fmtLon, fmtUTC } from "@/lib/metrics/format";
import { rollUp, type MetricValue } from "@/lib/metrics/types";
import { usePersona, type Persona } from "@/lib/persona";
import { parseScenarios, resolveScenarioSite, SCENARIO_LETTERS, serialiseScenarios, type Scenario } from "@/lib/scenarios";
import { GROUP_LABELS, isPolar } from "@/lib/sites";
import { useAnalysis, type Analysis } from "@/lib/use-analysis";
import { useNowHour } from "@/lib/use-now";
import { btnPrimary } from "@/lib/ui";
import { CompareToc } from "./CompareToc";
import { ExitCompareDialog, useExitCompare } from "./ExitCompareDialog";

const LETTERS = SCENARIO_LETTERS;
const resolveSite = resolveScenarioSite;
type Resolved = ReturnType<typeof resolveSite>;

/** Identity of a scenario's analysis: same site + time ⇒ same result, whatever slot it sits in. */
const scenarioId = (sc: Scenario) => `${sc.siteId}|${sc.t}`;

/** Column resize when a scenario is removed or added (ms); matches the CSS transition below. */
const COL_MS = 480;

/** Runs the analysis for one scenario and reports it upward under its scenario id. */
function Runner({ id, sc, nowHour, onResult }: { id: string; sc: Scenario; nowHour: number | null; onResult: (id: string, a: Analysis) => void }) {
  // Enthusiasts always compare with the default assumptions and bands (D-117).
  const persona = usePersona((s) => s.persona);
  const { a, bands: bandOverrides } = useEffectiveAssumptions(persona);
  const r = useMemo(() => resolveSite(sc.siteId), [sc.siteId]);
  const key = useMemo(() => (r ? (r.site ? { siteId: r.site.id } : { lat: r.lat, lon: r.lon }) : null), [r]);
  const t = sc.t ? Date.parse(sc.t) : nowHour;
  const an = useAnalysis(key, r?.site ?? null, Number.isFinite(t) ? t : null, a, bandOverrides);
  useEffect(() => onResult(id, an), [id, an, onResult]);
  return null;
}

/**
 * Everything a row needs to lay out its cells: stable column keys (they survive a removal, so charts keep
 * their state) and the persona (best-cell style). Which columns are folding or opening is CSS only (a
 * generated style rule per column key), so starting an animation doesn't re-render the rows.
 */
type Cols = { keys: string[]; persona: Persona };

/**
 * The comparison (D-130). Full viewport width, one row per piece of information: on wide screens a label
 * column (3 of 12) then one column per scenario (the other 9, split 2 or 3 ways); below 1280 px the label
 * sits above its row. Each scenario column shows exactly what its solo site details page shows for the
 * current persona. Rated rows give the most favourable cell(s) a soft green fill, in every view (D-134, D-136).
 */
export function CompareView() {
  const router = useRouter();
  const params = useSearchParams();
  const persona = usePersona((s) => s.persona);
  const nowHour = useNowHour();
  const scenarios = useMemo(() => parseScenarios(params.get("s")), [params]);
  const n = scenarios.length;
  // Results are keyed by scenario id (not slot index), so adding, changing or removing one
  // scenario never discards the finished analyses of the others (their Runners stay mounted).
  const [byId, setById] = useState<Record<string, Analysis>>({});
  const onResult = useCallback((id: string, a: Analysis) => setById((r) => (r[id] === a ? r : { ...r, [id]: a })), []);
  const ids = scenarios.map(scenarioId);
  const runnerKeys = ids.map((id, i) => `${id}#${ids.slice(0, i).filter((x) => x === id).length}`);
  const idKey = ids.join("\n"); // ids contain "|", so join on a newline
  // Stable while nothing finishes, so memoised rows (and the power model) don't redo work on every frame of playback.
  const results: Analysis[] = useMemo(() => idKey.split("\n").map((id) => byId[id]), [byId, idKey]);
  const resolved = useMemo(() => scenarios.map((s) => resolveSite(s.siteId)), [scenarios]);

  const { a } = useEffectiveAssumptions(persona);
  const enthusiast = persona === "enthusiast";
  const openEditor = useEditor((s) => s.open);
  const closeEditor = useEditor((s) => s.close);
  const askExit = useExitCompare((s) => s.setOpen);
  useEffect(() => {
    if (enthusiast) closeEditor();
  }, [enthusiast, closeEditor]);

  // ── Stable column keys + collapse/open animation ──
  const [cols, setCols] = useState(() => ({ keys: scenarios.map((_, i) => `col${i}`), next: scenarios.length, removing: null as string | null, appearing: [] as string[] }));
  if (cols.keys.length !== n) {
    // The URL caught up with a removal we animated: drop that column's key.
    if (cols.removing && n === cols.keys.length - 1) setCols({ ...cols, keys: cols.keys.filter((k) => k !== cols.removing), removing: null });
    else if (n > cols.keys.length) {
      // A scenario was added (back from the selection step, or a shared link): it opens from zero width.
      const added = Array.from({ length: n - cols.keys.length }, (_, k) => `col${cols.next + k}`);
      setCols({ keys: [...cols.keys, ...added], next: cols.next + added.length, removing: null, appearing: added });
    } else setCols({ ...cols, keys: cols.keys.slice(0, n), removing: null });
  }
  useEffect(() => {
    if (!cols.appearing.length) return;
    // Two frames: the zero-width layout must be painted once for the opening to animate.
    let r2 = 0;
    const r1 = requestAnimationFrame(() => (r2 = requestAnimationFrame(() => setCols((c) => ({ ...c, appearing: [] })))));
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [cols.appearing]);
  const keys = cols.keys.length === n ? cols.keys : scenarios.map((_, i) => cols.keys[i] ?? `tmp${i}`);
  const hidden = useMemo(() => new Set([...(cols.removing ? [cols.removing] : []), ...cols.appearing]), [cols.removing, cols.appearing]);
  const shown = keys.filter((k) => !hidden.has(k)).length || 1;
  const pct = keys.map((k) => (hidden.has(k) ? 0 : 100 / shown));
  const gridVars = {
    "--cmp-lg": `25% ${pct.map((p) => `${(p * 0.75).toFixed(4)}%`).join(" ")}`,
    "--cmp-sm": pct.map((p) => `${p.toFixed(4)}%`).join(" "),
    // Content width of a full column: a column that is folding or opening keeps it, so its text never
    // re-wraps into a tall sliver while the track animates (the column is transparent meanwhile).
    "--cmp-freeze-lg": `calc((100vw - 48px) * ${(0.75 / Math.max(1, n)).toFixed(4)} - 40px)`,
    "--cmp-freeze-sm": `calc((100vw - 32px) / ${Math.max(1, n)} - 40px)`,
  } as CSSProperties;
  const keyStr = keys.join(",");
  const C: Cols = useMemo(() => ({ keys: keyStr.split(","), persona }), [keyStr, persona]);
  // Folding / opening columns: transparent, inert, and their content keeps a full column's width.
  const hideCss = [...hidden].map((k) => `[data-col="${k}"]{opacity:0;pointer-events:none;overflow:hidden;border-color:transparent}[data-col="${k}"]>div{width:var(--cmp-freeze-sm)}@media (min-width:80rem){[data-col="${k}"]>div{width:var(--cmp-freeze-lg)}}`).join("");

  const removeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (removeTimer.current) clearTimeout(removeTimer.current); }, []);
  /**
   * × on a card: the column folds away, then the page shows the rest. With two scenarios the one left
   * opens in full on its site details page (D-145); Back returns to the two-scenario comparison.
   */
  const remove = (i: number) => {
    if (n < 2 || cols.removing) return;
    const k = keys[i];
    setCols((c) => ({ ...c, removing: k }));
    const next = scenarios.filter((_, j) => j !== i);
    removeTimer.current = setTimeout(() => {
      if (next.length === 1 && next[0].siteId) router.push(historyHref(next));
      else router.replace(`/compare?s=${serialiseScenarios(next)}`, { scroll: false });
    }, COL_MS);
  };
  const setScenarioTime = useCallback((i: number, ms: number) => {
    const next = scenarios.map((s, j) => (j === i ? { ...s, t: new Date(ms).toISOString().replace(".000Z", "Z") } : s));
    router.replace(`/compare?s=${serialiseScenarios(next)}`, { scroll: false });
  }, [scenarios, router]);

  // ── Shared selected time: hours after each scenario's own landing ──
  const [{ offset, playing }, timeAct] = useReducer(timeReducer, { offset: 0, playing: false });
  const spanMs = Math.max(...results.map((r) => (r?.scenario ? r.scenario.end - r.scenario.start : 0)), a.missionDays * DAY_MS);
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      // One mission day per second, looping (as on the site details timeline, D-093).
      const dt = now - last;
      last = now;
      timeAct({ type: "advance", ms: (dt / 1000) * DAY_MS, spanMs });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, spanMs]);

  // The card bar's height, so the pinned timeline row sits right under it (`--cmp-sub-h`).
  const pageRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const comparing = n >= 2;
  useEffect(() => {
    const page = pageRef.current, sub = subRef.current;
    if (!comparing || !page || !sub) return;
    const ro = new ResizeObserver(() => page.style.setProperty("--cmp-sub-h", `${sub.offsetHeight}px`));
    ro.observe(sub);
    return () => ro.disconnect();
  }, [comparing]);

  const here = n ? `/compare?s=${serialiseScenarios(scenarios)}` : "/compare";
  const addHref = compareFlowHref(scenarios, here, scenarios.at(-1)?.t || undefined);
  const kind = compareKind(scenarios);
  const toc = useMemo(() => compareToc(persona, results), [persona, results]);

  if (n < 2) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        {scenarios.map((sc, i) => <Runner key={runnerKeys[i]} id={ids[i]} sc={sc} nowHour={nowHour} onResult={onResult} />)}
        <div className="flex flex-col items-center gap-4 rounded-sm border border-dashed border-line p-8 text-center text-sm text-muted">
          <p>{n === 0 ? "No scenarios yet." : "Only one scenario so far."} Pick two or three site and landing-time combinations, or open any site and press “Add to comparison”.</p>
          <Link href={addHref} onClick={() => markFlowEntry(here)} className={btnPrimary}>
            <Plus size={18} weight="bold" aria-hidden /> Select scenarios
          </Link>
        </div>
      </div>
    );
  }

  const ctrl = "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border border-line bg-panel-2 px-2 text-sm font-medium text-fg transition-colors hover:border-muted";
  return (
    <div ref={pageRef} data-cmp-page style={gridVars} className="pb-24">
      {scenarios.map((sc, i) => <Runner key={runnerKeys[i]} id={ids[i]} sc={sc} nowHour={nowHour} onResult={onResult} />)}
      {hideCss && <style>{hideCss}</style>}

      {/* ── Subheader: what is compared, global controls, one card per scenario (no empty cards) ── */}
      <div ref={subRef} data-sticky-top className="sticky top-[65px] z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className={`${GRID} px-4 sm:px-6 md:pl-16`}>
          <div className="col-span-full flex min-w-0 flex-col justify-center gap-2.5 py-3 pr-4 xl:col-span-1">
            <h1 className="sr-only">Compare {n} scenarios</h1>
            {kind && <p className="text-sm text-muted">{kind}</p>}
            <div className="flex flex-wrap gap-2">
              {/* Enthusiasts don't get the editors (D-114); they compare with the defaults (D-117). */}
              {!enthusiast && <>
                <button type="button" onClick={() => openEditor({ kind: "assumptions" })} className={ctrl} title="Set mission assumptions (applies to every scenario)">
                  <SlidersHorizontal size={16} aria-hidden /> Assumptions
                </button>
                <button type="button" onClick={() => openEditor({ kind: "bands" })} className={ctrl} title="Customise rating bands (applies to every scenario)">
                  <Steps size={16} aria-hidden /> Rating bands
                </button>
              </>}
              {n < MAX_COMPARE && (
                <Link href={addHref} onClick={() => markFlowEntry(here)} className={ctrl} title="Add a third scenario">
                  <Plus size={16} aria-hidden /> Add scenario
                </Link>
              )}
              <button type="button" onClick={() => askExit(true)} className={`${ctrl} border-transparent bg-transparent text-muted hover:border-line hover:text-fg`} title="Exit comparison and go back to site selection">
                <SignOut size={16} aria-hidden /> Exit comparison
              </button>
            </div>
          </div>
          {/* The same cards as the "Select Scenarios to Compare" step (D-131). Clicking one opens that step
              with this scenario in the form, ready to change; × folds its column away (with 2, the other opens on its own, D-145). */}
          {keys.map((k, i) => (
            <div key={k} data-col={k} className="flex min-w-0 flex-col justify-center px-1.5 py-3 transition-opacity duration-300">
              <ScenarioCard as="div" className="cmp-card" i={i} letter={LETTERS[i]} label={`Scenario ${LETTERS[i]}`} editTitle="Change this scenario's date, time or site"
                onEdit={() => { markFlowEntry(here); router.push(compareFlowHref(scenarios, here, undefined, i)); }}
                onRemove={() => remove(i)}
                removeTitle={n === 2 ? `Remove from comparison and open Scenario ${LETTERS[1 - i]} on its own` : "Remove from comparison"}>
                <ScenarioLines name={resolved[i]?.name ?? "Unknown site"} when={scenarios[i].t ? Date.parse(scenarios[i].t) : null} />
              </ScenarioCard>
            </div>
          ))}
        </div>
      </div>

      {/* Charts in narrow columns: tooltips outside the plot, key / value summaries stacked (D-131). */}
      <ComparisonMode.Provider value={true}>
      <div className="px-4 sm:px-6 md:pl-16">
        <Overview C={C} scenarios={scenarios} resolved={resolved} results={results} a={a} onTime={setScenarioTime} />
        {/* The category roll-up (words only, D-140) is for enthusiasts only; educators and planners compare metric by metric (D-131). */}
        {enthusiast && (
          <Section id="cmp-scores" title="At a glance, by category" lead="How each scenario fares in each category, from its main results. There is no single right answer: a less favourable category can still be the right trade for a given mission."
            tip={<InfoTip title="How this is worked out" sources={["mission-assumption"]}>Each rated result is favourable, conditional or unfavourable against planning thresholds. A category combines its rated results into one overall word, and the green cell is the scenario that does best in that category. Hover a rating to see which results fed it.</InfoTip>}>
            <Scores C={C} results={results} />
          </Section>
        )}
        <Views C={C} results={results} a={a} offset={offset} spanMs={spanMs} playing={playing} timeAct={timeAct} />
        <Metrics C={C} results={results} a={a} offset={offset} timeAct={timeAct} />
      </div>
      </ComparisonMode.Provider>

      {!enthusiast && <AssumptionsModal />}
      {!enthusiast && <BandsModal values={results[0]?.metrics} />}
      <CompareToc items={toc} collapsible={persona === "planner"} />
      <ExitCompareDialog />
    </div>
  );
}

/** Shared selected time (hours after each landing) and playback. Picking a time stops playback (D-093). */
type TimeState = { offset: number; playing: boolean };
type TimeAct = { type: "pick"; ms: number } | { type: "play"; on: boolean } | { type: "advance"; ms: number; spanMs: number };
function timeReducer(s: TimeState, a: TimeAct): TimeState {
  if (a.type === "pick") return { offset: Math.max(0, a.ms), playing: false };
  if (a.type === "play") return { ...s, playing: a.on };
  return { ...s, offset: (s.offset + a.ms) % a.spanMs };
}

function compareKind(scenarios: Scenario[]) {
  if (scenarios.length < 2) return null;
  const sameSite = scenarios.every((s) => s.siteId === scenarios[0].siteId);
  const sameDate = scenarios.every((s) => s.t === scenarios[0].t);
  return sameSite ? "Same site, different dates" : sameDate ? "Different sites, same date" : "Different sites and dates";
}

// ─────────────────────────────── Layout primitives ───────────────────────────────

/** Rows share one column template (CSS variables set on the page), so every row lines up and resizes together. */
const GRID = "grid [grid-template-columns:var(--cmp-sm)] xl:[grid-template-columns:var(--cmp-lg)] transition-[grid-template-columns] duration-[480ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none";

/** A section: heading across the full width, then its rows. */
function Section({ id, title, lead, tip, children, level = 2 }: { id: string; title: string; lead?: string; tip?: ReactNode; children: ReactNode; level?: 2 | 3 }) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={level === 2 ? "mt-14" : "mt-10"}>
      <div className="pb-4">
        <H id={`${id}-h`} className={`flex items-center font-semibold tracking-tight ${level === 2 ? "text-2xl" : "text-[22px]"}`}>{title}{tip}</H>
        {lead && <p className="mt-1 max-w-4xl text-sm leading-relaxed text-muted">{lead}</p>}
      </div>
      {/* Each section is a bounded table: hairlines on all four sides (D-131). */}
      <div className="border-x border-b border-line">{children}</div>
    </section>
  );
}

/**
 * Which columns lead a row: the highest score, when at least two columns have one. Every cell tied for the
 * lead counts: the same score, or the same value as shown (e.g. both "31%"), so two equally good cells are
 * both marked (D-134). When every cell ties, none is.
 */
function leaders(scores: (number | null | undefined)[] | undefined, shown?: (string | undefined)[]) {
  if (!scores) return new Set<number>();
  const vis = scores.map((s) => (typeof s !== "number" || !Number.isFinite(s) ? null : s));
  const valid = vis.filter((s): s is number => s !== null);
  if (valid.length < 2) return new Set<number>();
  const max = Math.max(...valid);
  const top = vis.indexOf(max);
  const tied = (i: number) => vis[i] !== null && (vis[i]! >= max - 0.05 || (!!shown?.[i] && shown[i] === shown?.[top]));
  const lead = vis.flatMap((_, i) => (tied(i) ? [i] : []));
  return lead.length === valid.length ? new Set<number>() : new Set(lead);
}

/**
 * One row: the label on the left, then one cell per scenario, side by side. `scores` (higher = better, 0–10)
 * marks the leading cell(s) with a soft green fill.
 */
function Row({ C, id, label, cells, scores, shown, align = "start" }: {
  C: Cols; id?: string; label: ReactNode; cells: ReactNode[]; scores?: (number | null | undefined)[]; shown?: (string | undefined)[]; align?: "start" | "center";
}) {
  const best = leaders(scores, shown);
  return (
    <div id={id} className={`${GRID} border-t border-line`}>
      {/* Label column: a very subtle fill sets it apart from the scenario cells (D-131). */}
      <div className={`col-span-full min-w-0 bg-panel px-5 pb-2 pt-5 text-[15px] xl:col-span-1 xl:pb-5 xl:pr-6 ${align === "center" ? "flex flex-col justify-center" : ""}`}>{label}</div>
      {C.keys.map((k, i) => {
        const isBest = best.has(i);
        return (
          <div key={k} data-col={k}
            className={`relative min-w-0 border-l border-line px-5 pb-5 pt-2 transition-[opacity,background-color,box-shadow,border-color] duration-300 xl:pt-5 ${align === "center" ? "flex flex-col justify-center" : ""} ${isBest ? "bg-(--best-fill)" : ""}`}>
            {/* Every persona: a soft green fill on the leading cell(s), ties included (D-134); no corner score or ▲ (D-136).
                The fill is a theme token, lighter in dark mode (D-137), applied as a Tailwind utility so a CSS rule
                references it (an inline style alone let the build drop the token). */}
            {isBest && <span className="sr-only">Most favourable of the compared scenarios.</span>}
            <div>{cells[i]}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Label column content: a title with its tooltip, and helper text under it. */
function Label({ title, tip, sub, children }: { title: ReactNode; tip?: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <>
      {/* The tip sits right after the last word, also when the title wraps. */}
      <h4 className="font-medium leading-snug">{title}{tip && <span className="inline-block align-middle">{tip}</span>}</h4>
      {sub && <p className="mt-1 text-sm leading-relaxed text-muted">{sub}</p>}
      {children}
    </>
  );
}

const Pending = ({ res }: { res?: Analysis }) =>
  res?.stage === "error" ? <p className="text-sm text-critical">Could not compute: {res.error}</p> : <p className="text-sm text-muted">Computing…</p>;

// ─────────────────────────────── Overview ───────────────────────────────

const Overview = memo(function Overview({ C, scenarios, resolved, results, a, onTime }: {
  C: Cols; scenarios: Scenario[]; resolved: Resolved[]; results: Analysis[]; a: Assumptions; onTime: (i: number, ms: number) => void;
}) {
  const persona = C.persona;
  const openEditor = useEditor((s) => s.open);
  const sep = <span aria-hidden className="mx-2 text-faint">•</span>;
  const whys = whyItDiffers(scenarios, results, resolved);
  return (
    <Section id="cmp-overview" title="Site and landing" lead={by(persona,
      "Where and when each landing happens.",
      "The location, ground height and landing time of each scenario. Everything below follows from these.",
      "Site, coordinates (east-positive), LOLA ground height and landing epoch (UTC) per scenario.")}>
      <Row C={C} label={<Label title="Site" sub="Name, list and mission record." />} cells={resolved.map((r, i) => {
        if (!r) return <p className="text-sm text-muted">Unknown site</p>;
        const t = scenarios[i].t;
        const feature = !r.site ? results[i]?.terrain?.features[0] : undefined;
        const href = r.site ? `/site/${r.site.id}?t=${encodeURIComponent(t)}` : `/site/custom?lat=${r.lat}&lon=${r.lon}&t=${encodeURIComponent(t)}`;
        return (
          <>
            <div className="text-lg font-semibold leading-snug">{r.name}</div>
            {/* One fact per line: in a narrow column, run-on "a • b • c" lines start with stray bullets. */}
            <div className="mt-1 space-y-0.5 text-sm leading-snug text-muted">
              {r.site ? (
                <>
                  <div>{GROUP_LABELS[r.site.group]}</div>
                  {r.site.mission && r.site.mission !== r.site.name && <div>{r.site.mission}</div>}
                  {(r.site.status || r.site.date) && (
                    <div>
                      {r.site.status && <span className="capitalize">{r.site.status}</span>}
                      {r.site.status && r.site.date && sep}
                      {r.site.date && <span className="num">{r.site.date.slice(0, 10)}</span>}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>Custom coordinates</div>
                  {feature && <div>Nearest named feature: {feature.name} ({feature.type}), <span className="num">{feature.distKm.toFixed(1)}</span> km away</div>}
                </>
              )}
            </div>
            {!isPolar(r.lat) && (
              <p className="mt-2 flex gap-1.5 text-sm text-muted">
                <Warning size={17} className="mt-0.5 shrink-0 text-warn" aria-hidden />
                <span><b className="font-semibold text-fg">Not a south-pole site.</b> The Sun climbs high and sets on a regular ~<span className="num">29.5</span>-day cycle here, so differences against polar sites mostly reflect latitude.</span>
              </p>
            )}
            <Link href={href} className="mt-2 inline-flex items-center gap-1 text-sm text-muted underline decoration-faint underline-offset-4 hover:text-fg">Open site details <ArrowRight size={14} aria-hidden /></Link>
          </>
        );
      })} />
      <Row C={C} label={<Label title="Coordinates" sub="Latitude and longitude, east-positive." />} cells={resolved.map((r) => r && (
        <span className="inline-flex items-center">
          <span className="num">{fmtLat(r.lat)}</span><span aria-hidden className="mx-2 text-faint">•</span><span className="num">{fmtLon(r.lon)}</span>
          {r.site?.sourceUrl ? (
            <InfoTip title="Where this location comes from" sources={r.site.group === "feature" ? ["usgs-gazetteer"] : ["lroc-sites"]} sourceLabel="Original record" sourceUrl={r.site.sourceUrl}>
              {r.site.sourceQuote ? <span className="block wrap-break-word font-mono text-xs">{r.site.sourceQuote.slice(0, 400)}</span> : null}
              {r.site.notes && <span className="mt-1 block">{r.site.notes}</span>}
            </InfoTip>
          ) : !r.site && <InfoTip title="Custom coordinates" sources={["lola-pds"]}>A point you entered. Its terrain horizon is computed from LOLA elevation data.</InfoTip>}
        </span>
      ))} />
      <Row C={C} label={<Label title="Ground height" tip={<InfoTip title="Ground height" sources={["lola-pds"]}>
        The Moon has no sea level, so NASA&apos;s LOLA laser altimeter measures heights against a perfect sphere 1,737.4 km in radius (0 m = exactly 1,737.4 km from the Moon&apos;s centre). A value &ldquo;below&rdquo; simply means the ground is lower than that sphere. Lower ground tends to sit under a higher skyline, so the Sun and Earth must climb further before they are visible.
      </InfoTip>} sub="Height against the lunar reference sphere." />} cells={results.map((res) => res?.terrain ? (
        <span><span className="num font-medium">{fmtElevation(res.terrain.groundM)}</span> <span className="text-muted">the lunar reference sphere</span></span>
      ) : <Pending res={res} />)} />
      <Row C={C}
        label={<Label title="Landing date & time" tip={<InfoTip title="Landing date and time" sources={["jpl-horizons"]}>
          Near the pole the Sun skims the horizon, so a shift of a few days can decide whether the site is lit and whether Earth is up. All times are UTC. The buttons move that scenario&apos;s landing by 1 or 7 days.
        </InfoTip>}>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            Mission length
            {persona === "enthusiast" ? <span className="font-medium text-fg"><span className="num">{a.missionDays}</span> Earth days</span> : (
              <button type="button" onClick={() => openEditor({ kind: "assumptions", focus: "missionDays" })} title="Change the mission length in Mission assumptions (all scenarios)"
                className="inline-flex items-center gap-1 font-medium text-fg underline decoration-dotted decoration-faint underline-offset-4 hover:decoration-fg">
                <span className="num">{a.missionDays}</span> Earth days <PencilSimple size={14} className="text-faint" aria-hidden />
              </button>
            )}
            <InfoTip title="Mission length" sources={["mission-assumption"]}>
              Everything below covers the time from each scenario&apos;s landing to the end of its mission. The default, 30 Earth days, is about one full lunar day (29.5 days).{persona !== "enthusiast" && " Change it in Mission assumptions; it applies to every scenario."}
            </InfoTip>
          </div>
        </Label>}
        cells={scenarios.map((sc, i) => {
          const ms = Date.parse(sc.t);
          return (
            <>
              <div className="num text-lg font-semibold">{fmtUTC(Number.isFinite(ms) ? ms : null)}</div>
              <div className="mt-2 inline-flex h-9 divide-x divide-line rounded-sm border border-line" role="group" aria-label={`Move the landing date of scenario ${LETTERS[i]}`}>
                {[-7, -1, 1, 7].map((d) => (
                  <button key={d} type="button" disabled={!Number.isFinite(ms)} onClick={() => onTime(i, ms + d * DAY_MS)} title={`Move scenario ${LETTERS[i]}'s landing ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} ${d < 0 ? "earlier" : "later"}`}
                    className="num cursor-pointer px-3 text-sm text-muted hover:bg-panel-2 hover:text-fg">
                    {d > 0 ? `+${d}d` : `−${-d}d`}
                  </button>
                ))}
              </div>
            </>
          );
        })} />
      <Row C={C} label={<Label title="Why these scenarios differ" tip={<InfoTip title="How this is explained" sources={["jpl-horizons", "lola-pds"]}>Generated from the computed geometry: horizon height toward the Sun, distances, elevations and libration. Each scenario is explained against scenario A.</InfoTip>}
        sub="What changes between them, explained against scenario A." />}
        cells={whys.map((lines, i) => i === 0
          ? <p className="text-sm text-muted">The reference: the other scenarios are explained against this one.</p>
          : lines === null ? <p className="text-sm text-muted">Computing…</p>
          : <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted marker:text-faint">{lines.map((l, k) => <li key={k}><NumText>{l}</NumText></li>)}</ul>)} />
    </Section>
  );
});

/** Per scenario: sentences explaining how it differs from scenario A (null while either is computing). */
function whyItDiffers(scenarios: Scenario[], results: Analysis[], resolved: Resolved[]): (string[] | null)[] {
  const a0 = results[0]?.scenario;
  const meanOf = (arr: Float32Array) => arr.reduce((p, q) => p + q, 0) / arr.length;
  return scenarios.map((_, i) => {
    if (i === 0) return [];
    const b = results[i]?.scenario;
    if (!a0 || !b) return null;
    const lines: string[] = [];
    const L = LETTERS[i];
    const litA = results[0]?.metrics?.["sun.solar-availability-fraction"]?.value ?? 0;
    const litB = results[i]?.metrics?.["sun.solar-availability-fraction"]?.value ?? 0;
    const ra = resolved[0], rb = resolved[i];
    if (ra && rb && (ra.lat !== rb.lat || ra.lon !== rb.lon)) {
      const km = greatCircleKm(ra.lat, ra.lon, rb.lat, rb.lon, CONST.moonRadiusKm);
      lines.push(`${L} is ${km.toFixed(km < 10 ? 1 : 0)} km from A. Sunlit share: A ${litA.toFixed(0)}% vs ${L} ${litB.toFixed(0)}%.`);
      const hzA = meanOf(a0.series.sunHz), hzB = meanOf(b.series.sunHz);
      if (!isPolar(ra.lat) || !isPolar(rb.lat)) {
        const maxA = Math.max(...a0.series.sunEl), maxB = Math.max(...b.series.sunEl);
        lines.push(`${!isPolar(rb.lat) ? L : "A"} is not a south-pole site: the Sun climbs to ${fmtDeg(!isPolar(rb.lat) ? maxB : maxA, 0)} there on a regular ~29.5-day day/night cycle, against ${fmtDeg(!isPolar(rb.lat) ? maxA : maxB, 1)} at the polar site. The difference is mostly latitude, not local terrain.`);
      } else lines.push(`Toward the Sun, the terrain horizon averages ${fmtDeg(hzA, 2)} at A and ${fmtDeg(hzB, 2)} at ${L}. With the Sun only about ${fmtDeg(meanOf(a0.series.sunEl), 1)} high on average, a fraction of a degree of horizon decides light or shadow: that is why ${km < 30 ? "nearby sites" : "sites"} can differ so much.`);
      const ga = results[0]?.terrain?.groundM, gb = results[i]?.terrain?.groundM;
      if (ga !== undefined && gb !== undefined) lines.push(`Elevation: A ${Math.round(ga)} m vs ${L} ${Math.round(gb)} m. Higher ground usually sees over more of the surrounding terrain.`);
    }
    if (a0.start !== b.start) {
      const days = (b.start - a0.start) / DAY_MS;
      const slA = meanOf(a0.series.libLat), slB = meanOf(b.series.libLat);
      lines.push(`${L} lands ${Math.abs(days).toFixed(1)} days ${days > 0 ? "later" : "earlier"}. The Sun circles the polar sky once per ~29.5-day lunar day, so a shift moves which parts of the horizon it is behind during the mission. Sunlit share: A ${litA.toFixed(0)}% vs ${L} ${litB.toFixed(0)}%.`);
      lines.push(`Earth's average sub-Earth latitude (libration) is ${fmtDeg(slA, 2)} for A and ${fmtDeg(slB, 2)} for ${L}; at the south pole, Earth is higher in the sky when this is negative, so this shift changes Earth visibility (A ${results[0]?.metrics?.["earth.total-dte-visibility-fraction"]?.display ?? "—"} vs ${L} ${results[i]?.metrics?.["earth.total-dte-visibility-fraction"]?.display ?? "—"}).`);
    }
    if (!lines.length) lines.push(`Same site and landing time as A, so the results are identical.`);
    return lines;
  });
}

// ─────────────────────────────── Scores ───────────────────────────────

const Scores = memo(function Scores({ C, results }: { C: Cols; results: Analysis[] }) {
  return (
    <>
      {catalog.categories.map((c) => {
        const per = results.map((res) => {
          const m = res?.metrics;
          const rated = metricsInCategory(c.id).map((d) => ({ d, v: m?.[d.id] })).filter((x) => x.v?.rating);
          return { m, rated, r: rollUp(rated.map((x) => x.v!.rating!)) };
        });
        // A category with no score ("n/a") for any computed scenario has no row (D-132).
        if (per.some((p) => p.m && !p.r)) return null;
        return (
          <Row key={c.id} C={C} align="center" scores={per.map((p) => p.r?.score ?? null)}
            label={<span className="inline-flex items-center gap-2.5 font-medium"><CategoryIcon id={c.id} />{c.label}</span>}
            cells={per.map(({ m, rated, r }) => (
              <span title={rated.length ? `${rated.length} rated metric${rated.length === 1 ? "" : "s"}:\n` + rated.map((x) => `${x.d.name}: ${x.v!.display} (${RAG_META[x.v!.rating!.rag].label})`).join("\n") : "No rated metrics in this category"}>
                {!m ? <span className="text-muted">…</span> : r ? (
                  // Words only, no numeric score (D-140): enthusiasts are the only ones who see this table (D-131).
                  <RagHint rag={r.rag} className="inline-flex cursor-default items-center gap-2 whitespace-nowrap font-medium"><RagIcon rag={r.rag} size={20} />{RAG_META[r.rag].label}</RagHint>
                ) : <span className="text-faint">n/a</span>}
              </span>
            ))} />
        );
      })}
    </>
  );
});

// ─────────────────────────────── Views ───────────────────────────────

const Views = memo(function Views({ C, results, a, offset, spanMs, playing, timeAct }: {
  C: Cols; results: Analysis[]; a: Assumptions; offset: number; spanMs: number; playing: boolean; timeAct: (a: TimeAct) => void;
}) {
  const onOffset = (ms: number) => timeAct({ type: "pick", ms });
  const onPlaying = (on: boolean) => timeAct({ type: "play", on });
  const persona = C.persona;
  const P = <T,>(e: T, ed: T, pl: T) => by(persona, e, ed, pl);
  const ref = results.find((r) => r?.scenario);
  const B = blockCopy(persona, a, { maxRangeKm: ref?.terrain?.maxRangeKm, stepMin: ref?.scenario ? ref.scenario.series.stepMs / 60000 : undefined });
  const curOf = (sc: Run) => sc.start + Math.min(offset, sc.end - sc.start);
  const pick = (sc: Run) => (t: number) => onOffset(t - sc.start);
  const cards = results.map((res) => (res?.scenario && res.metrics ? statusCards(persona, a, res.scenario, res.metrics, curOf(res.scenario)) : null));
  const heads = statusCardHeads(persona, a);
  const chart = (render: (sc: Run, res: Analysis) => ReactNode) => results.map((res) => (res?.scenario ? render(res.scenario, res) : <Pending res={res} />));
  const day = Math.floor(offset / DAY_MS) + 1;
  const { trackRef, barRef, pinned } = useStickyRow();

  return (
    <Section id="cmp-views" title="Horizon, Sun & Earth views" lead={viewsLead(persona)}>
      {/* The selected time is the same number of hours after each scenario's own landing. The row stays
          pinned under the card bar down to Array power, as on the site details page (D-099, D-133). */}
      <div ref={trackRef} id="cmp-timeline" className="pointer-events-none">
      <div ref={barRef} data-sticky-top={pinned ? "" : undefined} className="pointer-events-auto sticky z-10 bg-bg transition-shadow duration-200"
        style={{ top: "calc(65px + var(--cmp-sub-h, 0px))", boxShadow: pinned ? "-1px 0 0 var(--line), 1px 0 0 var(--line), 0 1px 0 var(--line), 0 8px 16px -12px rgb(0 0 0 / 0.5)" : undefined }}>
      <Row C={C}
        label={<Label title="Timeline" tip={<InfoTip title="Timeline" sources={["jpl-horizons", "lola-pds"]}>
          Each scenario from its own landing to the end of its mission, on the same scale. The orange lane shows when the site is sunlit, the blue lane when Earth is in view. Click a lane, or any chart below, to pick a time: every scenario then shows the same number of hours after its own landing. Press play to run the missions forward, one day per second.
        </InfoTip>}>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
            <button type="button" onClick={() => onPlaying(!playing)} aria-label={playing ? "Pause" : "Play"} title={playing ? "Pause" : "Play: one mission day per second"}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm border border-primary bg-primary text-primary-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
              {playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
            </button>
            <span><span className="num text-fg">Day {day}</span> · <span className="num">+{fmtHours(offset / HOUR_MS)}</span> after landing</span>
          </div>
          {/* Its own line, reserved even at landing, so the row never shifts when it appears. */}
          <button type="button" onClick={() => onOffset(0)} disabled={offset === 0} aria-hidden={offset === 0} tabIndex={offset === 0 ? -1 : undefined}
            className={`mt-2 inline-flex items-center gap-1 text-sm text-muted underline decoration-faint underline-offset-4 hover:text-fg ${offset === 0 ? "invisible" : ""}`}>
            <ArrowCounterClockwise size={15} aria-hidden /> Back to landing
          </button>
        </Label>}
        cells={chart((sc) => <Strip sc={sc} offset={offset} spanMs={spanMs} onOffset={onOffset} sunLabel={P("Sun up", "Sunlit", "Sunlit")} earthLabel={P("Earth up", "Earth", "DTE")} />)} />
      </div>
      </div>

      {heads.map((h, k) => (
        <Row key={h.id} C={C} shown={cards.map((cs) => cs?.[k]?.value)}
          scores={h.id === "sunlit" ? results.map((r) => r?.metrics?.["sun.solar-availability-fraction"]?.rating?.score) : h.id === "joint" ? results.map((r) => r?.metrics?.["overall.joint-sunlit-dte-window"]?.rating?.score) : undefined}
          label={<Label title={<span className="inline-flex items-center gap-2">{h.color && <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: h.color }} />}{h.label}</span>}
            tip={<InfoTip title={h.label} sources={h.sources}>{h.tip}</InfoTip>} />}
          cells={cards.map((cs, i) => {
            const c = cs?.[k];
            if (!c) return <Pending res={results[i]} />;
            return (
              <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-semibold leading-snug"><span><NumText>{c.value}</NumText></span>{c.rag && <RagBadge rag={c.rag} />}</div>
                {/* "a · b · c" / "a; b" read one part per line in a narrow column (D-131). */}
                {c.sub && <ul className="mt-1 space-y-0.5 text-sm leading-snug text-muted">{c.sub.split(/ · |; /).map((p, j) => <li key={j}><NumText>{p}</NumText></li>)}</ul>}
              </>
            );
          })} />
      ))}

      <Row C={C} id="cmp-horizon" label={<Label title={B.horizon.title} tip={B.horizon.tip} sub={B.horizon.lead} />}
        cells={chart((sc, res) => <HorizonPanorama sc={sc} cursor={curOf(sc)} persona={persona} onCursor={pick(sc)} distKm={res.terrain?.maskDistKm} distStepDeg={res.terrain?.stepDeg} />)} />
      <Row C={C} id="cmp-sun-view" label={<Label title={B.sunView.title} tip={B.sunView.tip} sub={B.sunView.lead} />}
        cells={chart((sc) => <BodyTimeline sc={sc} body="sun" cursor={curOf(sc)} onCursor={pick(sc)} persona={persona} />)} />
      <Row C={C} id="cmp-earth-view" label={<Label title={B.earthView.title} tip={B.earthView.tip} sub={B.earthView.lead} />}
        cells={chart((sc) => <BodyTimeline sc={sc} body="earth" cursor={curOf(sc)} onCursor={pick(sc)} persona={persona} />)} />
      <Row C={C} id="cmp-libration" label={<Label title={B.libration.title} tip={B.libration.tip}><div className="mt-2 text-sm leading-relaxed text-muted"><LibrationText persona={persona} multi={ref?.multi} /></div></Label>}
        cells={chart((sc, res) => {
          const cur = curOf(sc);
          const i = Math.max(0, Math.min(sc.series.n - 1, Math.round((cur - sc.series.t[0]) / sc.series.stepMs)));
          return (
            <>
              {persona === "planner" && (
                <dl className="mb-4 space-y-2 text-sm">
                  <Stat k="Selected time" v={fmtUTC(cur)} />
                  <Stat k="Sub-Earth point" v={`${fmtDeg(sc.series.libLon[i], 3)} lon · ${fmtDeg(sc.series.libLat[i], 3)} lat`} />
                  <Stat k="Earth from the site" v={`az ${fmtDeg(sc.series.earthAz[i], 3)} · el ${fmtDeg(sc.series.earthEl[i], 3)}`} />
                  {res.metrics?.["earth.libration-of-earth-in-lunar-sky"] && <Stat k="2026–2029 range" v={res.metrics["earth.libration-of-earth-in-lunar-sky"].display.replace("Sub-Earth point wanders ", "")} />}
                </dl>
              )}
              <LibrationChart sc={sc} cursor={cur} persona={persona} onCursor={pick(sc)} />
            </>
          );
        })} />
    </Section>
  );
});

/** The timeline row lets go when the bottom of this row (the last chart that follows the selected time) passes under it. */
const STICKY_END_ID = "cmp-array-power";

/**
 * Sticky timeline row (D-133), the same technique as the site details timeline (D-099): the row is CSS
 * `position: sticky` inside a "track" that runs from the row's place in the page to the bottom of the
 * Array power row, so the browser does the pinning and the push-out at the end. The track is that tall but
 * gives the space back with a negative bottom margin, so the layout is unchanged. JS only re-measures when
 * the layout changes, and flips `pinned` on scroll (for the edge lines and shadow).
 */
function useStickyRow() {
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const track = trackRef.current, bar = barRef.current;
    const page = track?.closest("[data-cmp-page]") ?? document.body;
    if (!track || !bar) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const topPx = parseFloat(getComputedStyle(bar).top) || 0;
      const t = track.getBoundingClientRect(), b = bar.getBoundingClientRect();
      const next = t.top < topPx - 0.5 && b.bottom > topPx + 8;
      setPinned((p) => (p === next ? p : next));
    };
    const measure = () => {
      const end = document.getElementById(STICKY_END_ID);
      const barH = bar.offsetHeight;
      const span = end ? end.getBoundingClientRect().bottom - track.getBoundingClientRect().top : 0;
      const h = Math.max(barH, span);
      track.style.height = `${h}px`;
      track.style.marginBottom = `${barH - h}px`;
      read();
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };
    // Rows above the end change height as results, persona and fonts arrive.
    const ro = new ResizeObserver(measure);
    ro.observe(page);
    ro.observe(bar);
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      if (raf) cancelAnimationFrame(raf);
      track.style.height = "";
      track.style.marginBottom = "";
    };
  }, []);
  return { trackRef, barRef, pinned };
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-faint">{k}</dt>
      <dd className="text-fg"><NumText>{v}</NumText></dd>
    </div>
  );
}

/** Sunlit and Earth-in-view lanes for one scenario, on the shared mission scale, with the selected time. */
function Strip({ sc, offset, spanMs, onOffset, sunLabel, earthLabel }: { sc: Run; offset: number; spanMs: number; onOffset: (ms: number) => void; sunLabel: string; earthLabel: string }) {
  const pos = (t: number) => `${(100 * (t - sc.start)) / spanMs}%`;
  const wid = (a: number, b: number) => `${Math.max(0.2, (100 * (b - a)) / spanMs)}%`;
  const days = Math.round(spanMs / DAY_MS);
  const at = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onOffset(Math.max(0, Math.min(sc.end - sc.start, ((e.clientX - r.left) / r.width) * spanMs)));
  };
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-sm">
      <span className="text-muted">{sunLabel}</span>
      <div className="row-span-2 col-start-2 row-start-1 relative cursor-pointer py-0.5" onPointerDown={at}
        role="slider" tabIndex={0} aria-label="Time after landing" aria-valuemin={0} aria-valuemax={Math.round(spanMs / HOUR_MS)} aria-valuenow={Math.round(offset / HOUR_MS)} aria-valuetext={`${fmtHours(offset / HOUR_MS)} after landing`}
        onKeyDown={(e) => {
          const d = (e.shiftKey ? DAY_MS : HOUR_MS) * (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0);
          if (!d) return;
          e.preventDefault();
          onOffset(Math.max(0, Math.min(sc.end - sc.start, offset + d)));
        }}>
        {(["sunlit", "dte"] as const).map((k) => (
          <div key={k} className={`relative h-3.5 rounded-sm bg-panel-2 ${k === "dte" ? "mt-2.5" : ""}`}>
            {sc.windows[k].map((w, j) => (
              <div key={j} className="absolute top-0 h-full rounded-sm" title={`${fmtUTC(w.start)} → ${fmtUTC(w.end)} (${fmtHours((w.end - w.start) / HOUR_MS)})`}
                style={{ left: pos(w.start), width: wid(w.start, w.end), background: k === "sunlit" ? "var(--sun)" : "var(--earth)" }} />
            ))}
          </div>
        ))}
        <div aria-hidden className="pointer-events-none absolute -bottom-0.5 -top-0.5 w-0.5 -translate-x-1/2 bg-fg" style={{ left: pos(sc.start + Math.min(offset, sc.end - sc.start)) }} />
      </div>
      <span className="text-muted">{earthLabel}</span>
      <div className="col-start-2 flex justify-between text-xs text-faint">
        {Array.from({ length: 5 }, (_, k) => <span key={k}>day <span className="num">{Math.round((k * days) / 4)}</span></span>)}
      </div>
    </div>
  );
}

// ─────────────────────────────── Metrics ───────────────────────────────

/**
 * Every category with the metrics this persona sees on the site details page (same names, same order:
 * enthusiast takeaways first, then the battery and power charts under Overall, then the rest). A metric
 * shows when at least one scenario has it; a scenario without it says so.
 */
/** Enthusiast takeaways come first in each category, as on the site details page (D-109). */
const isTakeaway = (persona: Persona, id: string) => persona === "enthusiast" && !!enthusiastPick(id)?.card;

/** Categories and the metrics this persona sees that at least one scenario has, in catalog order. */
function metricGroups(results: Analysis[], persona: Persona) {
  const picked = (id: string) => (persona === "enthusiast" ? !!enthusiastPick(id) : persona === "educator" ? !!educatorPick(id) : true);
  return catalog.categories.map((cat) => ({
    cat,
    items: metricsInCategory(cat.id).filter((m) => picked(m.id) && results.some((r) => {
      const v = r?.metrics?.[m.id];
      return v && v.status !== "unavailable";
    })),
  })).filter((g) => g.items.length);
}

/** Row anchors the contents jump to (D-135). */
const metricRowId = (id: string) => `cmp-m-${id.replace(/\./g, "-")}`;

/**
 * The comparison's contents (D-135): the same entries, names and order as the site details contents for this
 * persona (D-110, D-111, D-118), plus the comparison's own sections. Mission planners also get each
 * category's metrics, collapsible.
 */
function compareToc(persona: Persona, results: Analysis[]): TocItem[] {
  const t = blockTitles(persona);
  const metricsLabel = (m: MetricDef) => metricLabel(m, persona);
  return [
    { id: "cmp-overview", label: "Site and landing" },
    ...(persona === "enthusiast" ? [{ id: "cmp-scores", label: "At a glance, by category" }] : []),
    {
      id: "cmp-views", label: "Horizon, Sun & Earth views", children: [
        { id: "cmp-timeline", label: "Timeline and status" },
        { id: "cmp-horizon", label: t.horizon },
        { id: "cmp-sun-view", label: t.sunView },
        { id: "cmp-earth-view", label: t.earthView },
        { id: "cmp-libration", label: t.libration },
      ],
    },
    {
      id: "cmp-metrics", label: "Metrics", children: metricGroups(results, persona).map(({ cat, items }) => {
        if (persona !== "planner") return { id: `cmp-cat-${cat.id}`, label: cat.label };
        const row = (m: MetricDef) => ({ id: metricRowId(m.id), label: metricsLabel(m) });
        return {
          id: `cmp-cat-${cat.id}`, label: cat.label, children: [
            ...items.filter((m) => isTakeaway(persona, m.id)).map(row),
            ...(cat.id === "overall" ? [{ id: "cmp-battery", label: t.battery }, { id: STICKY_END_ID, label: t.arrayPower }] : []),
            ...items.filter((m) => !isTakeaway(persona, m.id)).map(row),
          ],
        };
      }),
    },
  ];
}

const Metrics = memo(function Metrics({ C, results, a, offset, timeAct }: { C: Cols; results: Analysis[]; a: Assumptions; offset: number; timeAct: (a: TimeAct) => void }) {
  const onOffset = (ms: number) => timeAct({ type: "pick", ms });
  const persona = C.persona;
  const step = results.find((r) => r?.scenario)?.scenario?.series.stepMs;
  const B = blockCopy(persona, a, { stepMin: step ? step / 60000 : undefined });
  const powers = useMemo(() => results.map((r) => (r?.scenario ? powerModel(r.scenario) : null)), [results]);
  const takeaway = (id: string) => isTakeaway(persona, id);
  const groups = metricGroups(results, persona);

  const metricRow = (m: MetricDef) => {
    const vals = results.map((r) => r?.metrics?.[m.id]);
    const tk = takeaway(m.id);
    return (
      <Row key={m.id} C={C} id={metricRowId(m.id)} scores={vals.map((v) => (v?.status !== "unavailable" ? v?.rating?.score : null))} shown={vals.map((v) => v?.display)}
        label={<MetricLabelCell m={m} v={vals.find((v) => v && v.status !== "unavailable")} persona={persona} takeaway={tk} />}
        cells={vals.map((v, i) => <MetricCell key={i} m={m} v={v} persona={persona} takeaway={tk} res={results[i]} />)} />
    );
  };
  const curOf = (sc: Run) => sc.start + Math.min(offset, sc.end - sc.start);
  const powerRow = (key: "battery" | "arrayPower", only: "battery" | "array") => (
    <Row C={C} id={key === "arrayPower" ? STICKY_END_ID : "cmp-battery"} label={<Label title={B[key].title} tip={B[key].tip} sub={B[key].lead} />}
      cells={results.map((res, i) => (res?.scenario && powers[i] ? (
        <PowerCharts sc={res.scenario} power={powers[i]!} cursor={curOf(res.scenario)} onCursor={(t) => onOffset(t - res.scenario!.start)} persona={persona} only={only} />
      ) : <Pending res={res} />))} />
  );

  return (
    <section id="cmp-metrics" aria-labelledby="cmp-metrics-h" className="mt-16">
      <h2 id="cmp-metrics-h" className="text-2xl font-semibold tracking-tight">Metrics</h2>
      <p className="mt-1 text-sm text-muted">
        The same metrics as each site&apos;s details page, side by side.{" A green cell is the most favourable of the scenarios for that row (all of them when tied)."}{persona === "planner" ? " Metrics with no public data source are hidden." : ""}
      </p>
      {groups.map(({ cat, items }) => (
        <Section key={cat.id} id={`cmp-cat-${cat.id}`} title={cat.label} level={3}>
          {items.filter((m) => takeaway(m.id)).map(metricRow)}
          {cat.id === "overall" && <>{powerRow("battery", "battery")}{powerRow("arrayPower", "array")}</>}
          {items.filter((m) => !takeaway(m.id)).map(metricRow)}
        </Section>
      ))}
    </section>
  );
});

function MetricCell({ m, v, persona, takeaway, res }: { m: MetricDef; v?: MetricValue; persona: Persona; takeaway: boolean; res?: Analysis }) {
  if (!v) return res?.stage === "full" ? <p className="text-sm text-faint">Not available for this scenario.</p> : <Pending res={res} />;
  if (v.status === "unavailable") return <p className="text-sm leading-relaxed text-faint">Not available for this scenario{v.reason ? `: ${v.reason}` : "."}</p>;
  return <MetricAnswerCell m={m} v={v} persona={persona} takeaway={takeaway} />;
}
