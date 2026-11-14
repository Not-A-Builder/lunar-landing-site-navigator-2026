"use client";

import { ArrowRight, Copy, Warning, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BandsPanel } from "@/components/BandsPanel";
import { CategoryIcon } from "@/components/CategoryIcon";
import { CustomCoordForm } from "@/components/CustomCoordForm";
import { InfoTip } from "@/components/InfoTip";
import { NumText } from "@/components/Num";
import { RAG_META, RagBadge } from "@/components/RagBadge";
import { useAssumptions } from "@/lib/assumptions-store";
import { MAX_COMPARE } from "@/lib/config";
import { CONST } from "@/lib/engine/constants";
import { greatCircleKm } from "@/lib/engine/geometry";
import { DAY_MS, HOUR_MS } from "@/lib/engine/scenario";
import { catalog, metricsInCategory } from "@/lib/metrics";
import { fmtDeg, fmtHours, fmtLat, fmtLon, fmtUTC } from "@/lib/metrics/format";
import { rollUp } from "@/lib/metrics/types";
import { usePersona } from "@/lib/persona";
import { customSiteId } from "@/lib/coords";
import { parseScenarios, resolveScenarioSite, SCENARIO_LETTERS, serialiseScenarios, type Scenario } from "@/lib/scenarios";
import { hasCoordinates, isPolar, sites } from "@/lib/sites";
import { useAnalysis, type Analysis } from "@/lib/use-analysis";
import { useNowHour } from "@/lib/use-now";

const LETTERS = SCENARIO_LETTERS;
const serialise = serialiseScenarios;
const resolveSite = resolveScenarioSite;
const PICKABLE = sites.filter(hasCoordinates).filter((s) => s.group !== "feature" || s.lat! < -80);

/** Identity of a scenario's analysis: same site + time ⇒ same result, whatever slot it sits in. */
const scenarioId = (sc: Scenario) => `${sc.siteId}|${sc.t}`;

/** Runs the analysis for one scenario and reports it upward under its scenario id. */
function Runner({ id, sc, nowHour, onResult }: { id: string; sc: Scenario; nowHour: number | null; onResult: (id: string, a: Analysis) => void }) {
  const a = useAssumptions((s) => s.a);
  const bandOverrides = useAssumptions((s) => s.bands);
  const r = useMemo(() => resolveSite(sc.siteId), [sc.siteId]);
  const key = useMemo(() => (r ? (r.site ? { siteId: r.site.id } : { lat: r.lat, lon: r.lon }) : null), [r]);
  const t = sc.t ? Date.parse(sc.t) : nowHour;
  const an = useAnalysis(key, r?.site ?? null, Number.isFinite(t) ? t : null, a, bandOverrides);
  useEffect(() => onResult(id, an), [id, an, onResult]);
  return null;
}

export function CompareView() {
  const router = useRouter();
  const params = useSearchParams();
  const persona = usePersona((s) => s.persona);
  const nowHour = useNowHour();
  const scenarios = parseScenarios(params.get("s"));
  // Results are keyed by scenario id (not slot index), so adding, changing or removing one
  // scenario never discards the finished analyses of the others (their Runners stay mounted).
  const [byId, setById] = useState<Record<string, Analysis>>({});
  const [customSlot, setCustomSlot] = useState<number | null>(null);
  const onResult = useCallback((id: string, a: Analysis) => setById((r) => (r[id] === a ? r : { ...r, [id]: a })), []);
  const update = (next: Scenario[]) => {
    router.replace(next.length ? `/compare?s=${serialise(next)}` : "/compare", { scroll: false });
  };
  const defaultT = nowHour ? new Date(nowHour).toISOString() : "";

  const ids = scenarios.map(scenarioId);
  // Stable, unique Runner keys: identical (duplicated) scenarios get an occurrence suffix.
  const runnerKeys = ids.map((id, i) => `${id}#${ids.slice(0, i).filter((x) => x === id).length}`);
  const results: Record<number, Analysis> = Object.fromEntries(ids.flatMap((id, i) => (byId[id] ? [[i, byId[id]]] : [])));

  const resolved = scenarios.map((s) => resolveSite(s.siteId));
  const ready = scenarios.map((_, i) => results[i]?.stage === "full" || results[i]?.stage === "base");
  const kind = compareKind(scenarios, defaultT);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6">
      {scenarios.map((sc, i) => <Runner key={runnerKeys[i]} id={ids[i]} sc={sc} nowHour={nowHour} onResult={onResult} />)}
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Compare scenarios</h1>
        <p className="max-w-3xl text-sm text-muted">
          Up to <span className="num">{MAX_COMPARE}</span> site + landing-time combinations. Try one site on two dates, or two nearby sites on the same date, and see how small changes move the power and communication windows.
        </p>
        {kind && <p className="text-sm font-medium text-accent">{kind}</p>}
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: MAX_COMPARE }, (_, i) => {
          const sc = scenarios[i];
          const r = resolved[i];
          const res = results[i];
          return (
            <div key={i} className="rounded-sm border border-line bg-panel p-4 text-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-faint">Scenario {LETTERS[i]}</span>
                {sc && <button aria-label={`Remove scenario ${LETTERS[i]}`} title="Remove" className="-m-1 rounded-sm p-1 text-muted hover:bg-panel-2 hover:text-fg" onClick={() => update(scenarios.filter((_, k) => k !== i))}><X size={18} /></button>}
              </div>
              <select
                aria-label={`Site for scenario ${LETTERS[i]}`}
                value={sc?.siteId ?? ""}
                disabled={!sc && i > scenarios.length}
                onChange={(e) => {
                  if (e.target.value === "__custom") return setCustomSlot(i);
                  setCustomSlot(null);
                  const next = [...scenarios];
                  if (e.target.value) next[sc ? i : scenarios.length] = { siteId: e.target.value, t: sc?.t ?? scenarios[0]?.t ?? defaultT };
                  update(next);
                }}
                className="mb-2 w-full rounded-sm border border-line bg-bg px-2 py-1.5 disabled:opacity-40"
              >
                <option value="">{i > scenarios.length ? "Fill the previous slot first" : "Add a site…"}</option>
                <option value="__custom">Custom coordinates…</option>
                {sc?.siteId.startsWith("custom:") && <option value={sc.siteId}>{r?.name}</option>}
                {PICKABLE.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {customSlot === i && (
                <div className="mb-2">
                  <CustomCoordForm
                    compact
                    submitLabel="Use"
                    onSubmit={(la, lo) => {
                      const next = [...scenarios];
                      next[sc ? i : scenarios.length] = { siteId: customSiteId(la, lo), t: sc?.t ?? scenarios[0]?.t ?? defaultT };
                      setCustomSlot(null);
                      update(next);
                    }}
                  />
                </div>
              )}
              {sc && (
                <>
                  <input
                    type="datetime-local"
                    aria-label={`Landing time for scenario ${LETTERS[i]} (UTC)`}
                    value={(sc.t || defaultT).slice(0, 16)}
                    onChange={(e) => {
                      const next = [...scenarios];
                      next[i] = { ...sc, t: e.target.value ? new Date(e.target.value + "Z").toISOString() : "" };
                      update(next);
                    }}
                    className="num w-full rounded-sm border border-line bg-bg px-2 py-1.5"
                  />
                  <div className="mt-2 flex gap-2">
                    <div className="flex divide-x divide-line rounded-sm border border-line" role="group" aria-label={`Shift landing time for scenario ${LETTERS[i]}`}>
                    {[-1, 1, 7].map((d) => (
                      <button key={d} className="px-2 py-0.5 text-xs text-muted hover:bg-panel-2 hover:text-fg"
                        onClick={() => { const next = [...scenarios]; next[i] = { ...sc, t: new Date(Date.parse(sc.t || defaultT) + d * DAY_MS).toISOString() }; update(next); }}>
                        <span className="num">{d > 0 ? `+${d}` : d}</span> d
                      </button>
                    ))}
                    </div>
                    <button className="ml-auto inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-muted hover:bg-panel-2 hover:text-fg disabled:opacity-40" onClick={() => scenarios.length < MAX_COMPARE && update([...scenarios, { ...sc }])} disabled={scenarios.length >= MAX_COMPARE}>
                      <Copy size={16} aria-hidden /> Duplicate
                    </button>
                  </div>
                  {r && <div className="num mt-3 text-xs text-faint">{fmtLat(r.lat)}, {fmtLon(r.lon)}</div>}
                  {r && !isPolar(r.lat) && (
                    <p className="mt-2 flex gap-1.5 text-xs text-muted">
                      <Warning size={17} className="mt-px shrink-0 text-warn" aria-hidden />
                      <span><b className="font-semibold text-fg">Not a south-pole site.</b> Lighting and Earth visibility follow a regular equatorial/mid-latitude pattern, so differences against polar sites mostly reflect latitude, not site choice.</span>
                    </p>
                  )}
                  {res?.stage === "error" && <div className="mt-2 text-xs text-critical">{res.error}</div>}
                  {res && res.stage !== "full" && res.stage !== "error" && <div className="mt-2 text-xs text-muted">Computing…</div>}
                  {r && <Link className="mt-3 inline-flex items-center gap-1 text-xs text-fg underline" href={r.site ? `/site/${r.site.id}?t=${encodeURIComponent(sc.t || defaultT)}` : `/site/custom?lat=${r.lat}&lon=${r.lon}&t=${encodeURIComponent(sc.t || defaultT)}`}>Open full details <ArrowRight size={15} aria-hidden /></Link>}
                </>
              )}
            </div>
          );
        })}
      </div>

      {scenarios.length > 0 && ready.some(Boolean) && (
        <>
          <Strips scenarios={scenarios} results={results} />
          <KeyTable scenarios={scenarios} results={results} />
          {scenarios.length > 1 && <WhyItDiffers scenarios={scenarios} results={results} resolved={resolved} kind={kind} />}
          <Scores scenarios={scenarios} results={results} persona={persona} />
          {persona === "planner" && <BandsPanel />}
        </>
      )}
      {scenarios.length === 0 && (
        <div className="rounded-sm border border-dashed border-line p-8 text-center text-sm text-muted">
          Pick a site in Scenario A to begin, or open any site and press “Add to comparison”.
        </div>
      )}
    </div>
  );
}

function compareKind(scenarios: Scenario[], defaultT: string) {
  if (scenarios.length < 2) return null;
  const sameSite = scenarios.every((s) => s.siteId === scenarios[0].siteId);
  const sameDate = scenarios.every((s) => (s.t || defaultT) === (scenarios[0].t || defaultT));
  return sameSite ? "Same site, different dates" : sameDate ? "Different sites, same date" : "Different sites and dates";
}

function Strips({ scenarios, results }: { scenarios: Scenario[]; results: Record<number, Analysis> }) {
  const days = Math.max(...scenarios.map((_, i) => (results[i]?.scenario ? (results[i].scenario!.end - results[i].scenario!.start) / DAY_MS : 0)), 1);
  return (
    <section className="border-t border-line pt-6">
      <h2 className="mb-4 text-lg font-semibold">
        Sunlight and Earth contact, day by day
        <InfoTip title="Visibility strips" sources={["jpl-horizons", "lola-pds", "dsn-810-005"]}>Each scenario on the same time axis (days after its own landing). Orange = sunlit, blue = Earth in view. Gaps are darkness or blackout.</InfoTip>
      </h2>
      <div className="space-y-4">
        {scenarios.map((sc, i) => {
          const s = results[i]?.scenario;
          if (!s) return <div key={i} className="h-10 text-sm text-muted">Scenario {LETTERS[i]}: computing…</div>;
          const pos = (t: number) => `${(100 * (t - s.start)) / (days * DAY_MS)}%`;
          const wid = (a: number, b: number) => `${Math.max(0.2, (100 * (b - a)) / (days * DAY_MS))}%`;
          return (
            <div key={i}>
              <div className="mb-1 text-sm text-muted"><b className="font-semibold text-fg">{LETTERS[i]}</b> · {resolveSite(sc.siteId)?.name} · from <span className="num">{fmtUTC(s.start)}</span></div>
              {(["sunlit", "dte"] as const).map((k) => (
                <div key={k} className="relative mb-1 h-3 rounded-sm bg-panel-2" aria-label={`${k === "sunlit" ? "Sunlit" : "Earth in view"} intervals for scenario ${LETTERS[i]}`}>
                  {s.windows[k].map((w, j) => (
                    <div key={j} className="absolute top-0 h-3 rounded-sm" title={`${fmtUTC(w.start)} → ${fmtUTC(w.end)} (${fmtHours((w.end - w.start) / HOUR_MS)})`}
                      style={{ left: pos(w.start), width: wid(w.start, w.end), background: k === "sunlit" ? "var(--sun)" : "var(--earth)" }} />
                  ))}
                </div>
              ))}
            </div>
          );
        })}
        <div className="flex justify-between text-xs text-faint">
          {Array.from({ length: 5 }, (_, k) => <span key={k}>day <span className="num">{Math.round((k * days) / 4)}</span></span>)}
        </div>
      </div>
    </section>
  );
}

const KEY_ROWS: { id: string; label: string; better: "higher" | "lower" | null; unit: string }[] = [
  { id: "sun.solar-availability-fraction", label: "Sunlit share of mission", better: "higher", unit: "pp" },
  { id: "sun.longest-continuous-darkness", label: "Longest darkness", better: "lower", unit: "h" },
  { id: "sun.longest-continuous-sunlight", label: "Longest continuous sunlight", better: "higher", unit: "h" },
  { id: "earth.total-dte-visibility-fraction", label: "Earth-in-view share", better: "higher", unit: "pp" },
  { id: "earth.longest-dte-blackout", label: "Longest Earth blackout", better: "lower", unit: "h" },
  { id: "overall.joint-sunlit-dte-window", label: "Sun + Earth together", better: "higher", unit: "pp" },
  { id: "earth.dte-visibility-ground-station-availability", label: "Earth + DSN contact", better: "higher", unit: "pp" },
  { id: "terrain.local-slope-magnitude", label: "Local slope", better: "lower", unit: "°" },
  { id: "science.distance-to-science-targets", label: "Distance to nearest PSR", better: "lower", unit: "km" },
  { id: "sun.battery-charge-energy-reserve", label: "Lowest battery charge (your assumptions)", better: "higher", unit: "pp" },
];

function KeyTable({ scenarios, results }: { scenarios: Scenario[]; results: Record<number, Analysis> }) {
  return (
    <section className="overflow-x-auto border-t border-line pt-6">
      <h2 className="mb-3 text-lg font-semibold">Key numbers</h2>
      <table className="w-full min-w-140 text-sm">
        <thead>
          <tr className="text-left text-xs text-faint">
            <th className="py-1.5 font-normal">Metric</th>
            {scenarios.map((_, i) => <th key={i} className="py-1.5 font-normal">Scenario {LETTERS[i]}</th>)}
          </tr>
        </thead>
        <tbody>
          {KEY_ROWS.map((row) => {
            const vals = scenarios.map((_, i) => results[i]?.metrics?.[row.id]);
            // Not computable for any scenario: the row is not shown (LOGS D-041).
            if (vals.every((v) => v?.status === "unavailable")) return null;
            const nums = vals.map((v) => (typeof v?.value === "number" ? v.value : null));
            const valid = nums.filter((x): x is number => x !== null);
            const allSame = valid.every((x) => Math.abs(x - valid[0]) < 1e-6);
            const best = row.better && valid.length > 1 && !allSame ? (row.better === "higher" ? Math.max(...valid) : Math.min(...valid)) : null;
            return (
              <tr key={row.id} className="border-t border-line align-top">
                <td className="py-2.5 pr-4">
                  {row.label}
                  <InfoTip title={catalog.metrics.find((m) => m.id === row.id)?.name ?? row.label} sources={vals.find((v) => v)?.sources}>{catalog.metrics.find((m) => m.id === row.id)?.definition}</InfoTip>
                </td>
                {vals.map((v, i) => {
                  const d = i > 0 && nums[i] !== null && nums[0] !== null ? nums[i]! - nums[0]! : null;
                  return (
                    <td key={i} className="py-2.5 pr-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {v?.rating && <RagBadge rag={v.rating.rag} compact />}
                        <span className="font-mono">{v?.status === "unavailable" ? "—" : v?.display ?? "…"}</span>
                        {best !== null && nums[i] === best && <span className="text-xs font-medium text-good">best</span>}
                      </div>
                      {d !== null && Math.abs(d) > 1e-6 && <div className="text-xs text-muted"><span className="num">{d > 0 ? "+" : ""}{d.toFixed(Math.abs(d) < 10 ? 1 : 0)} {row.unit}</span> vs A</div>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function WhyItDiffers({ scenarios, results, resolved, kind }: { scenarios: Scenario[]; results: Record<number, Analysis>; resolved: ReturnType<typeof resolveSite>[]; kind: string | null }) {
  const a0 = results[0]?.scenario;
  if (!a0) return null;
  const lines: string[] = [];
  const meanOf = (arr: Float32Array) => arr.reduce((p, q) => p + q, 0) / arr.length;
  scenarios.slice(1).forEach((_, k) => {
    const i = k + 1;
    const b = results[i]?.scenario;
    if (!b) return;
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
      lines.push(`${L} lands ${Math.abs(days).toFixed(1)} days ${days > 0 ? "later" : "earlier"}. The Sun circles the polar sky once per ~29.5-day lunar day, so a shift moves which parts of the horizon it is behind during the mission; Sunlit share: A ${litA.toFixed(0)}% vs ${L} ${litB.toFixed(0)}%.`);
      lines.push(`Earth's average sub-Earth latitude (libration) is ${fmtDeg(slA, 2)} for A and ${fmtDeg(slB, 2)} for ${L}; at the south pole, Earth is higher in the sky when this is negative, so this shift changes Earth visibility (A ${results[0]?.metrics?.["earth.total-dte-visibility-fraction"]?.display} vs ${L} ${results[i]?.metrics?.["earth.total-dte-visibility-fraction"]?.display}).`);
    }
  });
  return (
    <section className="border-t border-line pt-6">
      <h2 className="mb-3 text-lg font-semibold">
        Why these scenarios differ
        <InfoTip title="How this is explained" sources={["jpl-horizons", "lola-pds"]}>Generated from the computed geometry: horizon height toward the Sun, distances, elevations and libration. {kind}.</InfoTip>
      </h2>
      <ul className="max-w-4xl list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted marker:text-faint">{lines.map((l, k) => <li key={k}><NumText>{l}</NumText></li>)}</ul>
    </section>
  );
}

function Scores({ scenarios, results, persona }: { scenarios: Scenario[]; results: Record<number, Analysis>; persona: string }) {
  return (
    <section className="overflow-x-auto border-t border-line pt-6">
      <h2 className="mb-1 text-lg font-semibold">
        At-a-glance score per category (1–10)
        <InfoTip title="How scores work" sources={["mission-assumption"]}>
          Scores appear only here, for comparison. Each rated metric sits in red / amber / green bands; its position across the bands gives 0–10, and a category averages its rated metrics (mapped to 1–10). Bands are planning defaults or tied to your assumptions, so there is no single right answer: a lower score can be the better trade for a given mission.
        </InfoTip>
      </h2>
      <p className="mb-3 text-sm text-muted">Hover a score to see which metrics fed it. Categories with no rated metric show “n/a”.</p>
      <table className="w-full min-w-140 text-sm">
        <tbody>
          {catalog.categories.filter((c) => !scenarios.every((_, i) => {
            const m = results[i]?.metrics;
            return m && metricsInCategory(c.id).every((d) => m[d.id]?.status === "unavailable");
          })).map((c) => (
            <tr key={c.id} className="border-t border-line">
              <th scope="row" className="py-2.5 pr-2 text-left font-normal"><span className="inline-flex items-center gap-2.5"><CategoryIcon id={c.id} />{c.label}</span></th>
              {scenarios.map((_, i) => {
                const m = results[i]?.metrics;
                const rated = metricsInCategory(c.id).map((d) => ({ d, v: m?.[d.id] })).filter((x) => x.v?.rating);
                const r = rollUp(rated.map((x) => x.v!.rating!));
                return (
                  <td key={i} className="w-40 py-2.5 text-center" title={rated.length ? `${rated.length} rated metric${rated.length === 1 ? "" : "s"}:\n` + rated.map((x) => `${x.d.name}: ${x.v!.display} (${RAG_META[x.v!.rating!.rag].label})`).join("\n") : "No rated metrics in this category"}>
                    {!m ? <span className="text-muted">…</span> : r ? (
                      <span className="inline-flex items-center gap-2 whitespace-nowrap"><span className="font-mono text-base font-medium">{r.score}</span><RagBadge rag={r.rag} compact={persona !== "enthusiast"} /></span>
                    ) : <span className="text-faint">n/a</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
