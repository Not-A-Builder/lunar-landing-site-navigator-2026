"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BandsPanel } from "@/components/BandsPanel";
import { CustomCoordForm } from "@/components/CustomCoordForm";
import { InfoTip } from "@/components/InfoTip";
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
import { getSite, hasCoordinates, isPolar, sites, type Site } from "@/lib/sites";
import { useAnalysis, type Analysis } from "@/lib/use-analysis";
import { useNowHour } from "@/lib/use-now";

/** A scenario is one site at one landing time. URL: ?s=siteId@ISO,custom:lat,lon@ISO */
export type Scenario = { siteId: string; t: string };

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

const serialise = (list: Scenario[]) => list.map((x) => `${encodeURIComponent(x.siteId)}@${encodeURIComponent(x.t)}`).join(",");
const LETTERS = ["A", "B", "C", "D"];
const PICKABLE = sites.filter(hasCoordinates).filter((s) => s.group !== "feature" || s.lat! < -80);

function resolveSite(id: string): { site: Site | null; lat: number; lon: number; name: string } | null {
  if (id.startsWith("custom:")) {
    const [la, lo] = id.slice(7).split(",").map(Number);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
    return { site: null, lat: la, lon: lo, name: `Custom ${fmtLat(la)}, ${fmtLon(lo)}` };
  }
  const s = getSite(id);
  return s && hasCoordinates(s) ? { site: s, lat: s.lat, lon: s.lon, name: s.name } : null;
}

/** Runs the analysis for one scenario and reports it upward. */
function Runner({ i, sc, nowHour, onResult }: { i: number; sc: Scenario; nowHour: number | null; onResult: (i: number, a: Analysis) => void }) {
  const a = useAssumptions((s) => s.a);
  const bandOverrides = useAssumptions((s) => s.bands);
  const r = useMemo(() => resolveSite(sc.siteId), [sc.siteId]);
  const key = useMemo(() => (r ? (r.site ? { siteId: r.site.id } : { lat: r.lat, lon: r.lon }) : null), [r]);
  const t = sc.t ? Date.parse(sc.t) : nowHour;
  const an = useAnalysis(key, r?.site ?? null, Number.isFinite(t) ? t : null, a, bandOverrides);
  useEffect(() => onResult(i, an), [i, an, onResult]);
  return null;
}

export function CompareView() {
  const router = useRouter();
  const params = useSearchParams();
  const persona = usePersona((s) => s.persona);
  const nowHour = useNowHour();
  const scenarios = parseScenarios(params.get("s"));
  const [results, setResults] = useState<Record<number, Analysis>>({});
  const [customSlot, setCustomSlot] = useState<number | null>(null);
  const onResult = useCallback((i: number, a: Analysis) => setResults((r) => (r[i] === a ? r : { ...r, [i]: a })), []);
  const update = (next: Scenario[]) => {
    setResults({});
    router.replace(next.length ? `/compare?s=${serialise(next)}` : "/compare", { scroll: false });
  };
  const defaultT = nowHour ? new Date(nowHour).toISOString() : "";

  const resolved = scenarios.map((s) => resolveSite(s.siteId));
  const ready = scenarios.map((_, i) => results[i]?.stage === "full" || results[i]?.stage === "base");
  const kind = compareKind(scenarios, defaultT);

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5">
      {scenarios.map((sc, i) => <Runner key={`${i}-${sc.siteId}-${sc.t}`} i={i} sc={sc} nowHour={nowHour} onResult={onResult} />)}
      <header>
        <h1 className="text-xl font-semibold">Compare scenarios</h1>
        <p className="text-sm text-muted">
          Up to {MAX_COMPARE} site + landing-time combinations. Try one site on two dates, or two nearby sites on the same date, and see how small changes move the power and communication windows.
        </p>
        {kind && <p className="mt-1 text-sm"><span className="rounded-full border border-line px-2 py-0.5 text-xs">{kind}</span></p>}
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: MAX_COMPARE }, (_, i) => {
          const sc = scenarios[i];
          const r = resolved[i];
          const res = results[i];
          return (
            <div key={i} className="rounded-lg border border-line bg-panel p-3 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">Scenario {LETTERS[i]}</span>
                {sc && <button className="text-xs text-muted underline" onClick={() => update(scenarios.filter((_, k) => k !== i))}>Remove</button>}
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
                className="mb-2 w-full rounded border border-line bg-bg px-2 py-1 disabled:opacity-40"
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
                    className="w-full rounded border border-line bg-bg px-2 py-1"
                  />
                  <div className="mt-1 flex gap-1">
                    {[-1, 1, 7].map((d) => (
                      <button key={d} className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted hover:text-fg"
                        onClick={() => { const next = [...scenarios]; next[i] = { ...sc, t: new Date(Date.parse(sc.t || defaultT) + d * DAY_MS).toISOString() }; update(next); }}>
                        {d > 0 ? `+${d}` : d} d
                      </button>
                    ))}
                    <button className="ml-auto rounded border border-line px-1.5 py-0.5 text-[11px] text-muted hover:text-fg" onClick={() => scenarios.length < MAX_COMPARE && update([...scenarios, { ...sc }])} disabled={scenarios.length >= MAX_COMPARE}>
                      Duplicate
                    </button>
                  </div>
                  {r && <div className="mt-2 text-[11px] text-faint">{fmtLat(r.lat)}, {fmtLon(r.lon)}</div>}
                  {r && !isPolar(r.lat) && (
                    <div className="mt-2 rounded border border-warn/50 bg-warn/10 px-2 py-1 text-[11px]">
                      <b>Not a south-pole site.</b> Lighting and Earth visibility follow a regular equatorial/mid-latitude pattern, so differences against polar sites mostly reflect latitude, not site choice.
                    </div>
                  )}
                  {res?.stage === "error" && <div className="mt-2 text-[11px] text-critical">{res.error}</div>}
                  {res && res.stage !== "full" && res.stage !== "error" && <div className="mt-2 text-[11px] text-muted">Computing…</div>}
                  {r && <Link className="mt-2 inline-block text-[11px] underline" href={r.site ? `/site/${r.site.id}?t=${encodeURIComponent(sc.t || defaultT)}` : `/site/custom?lat=${r.lat}&lon=${r.lon}&t=${encodeURIComponent(sc.t || defaultT)}`}>Open full details</Link>}
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
        <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
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
    <section className="rounded-lg border border-line bg-panel p-4">
      <h2 className="mb-1 font-medium">
        Sunlight and Earth contact, day by day
        <InfoTip title="Visibility strips" sources={["jpl-horizons", "lola-pds", "dsn-810-005"]}>Each scenario on the same time axis (days after its own landing). Orange = sunlit, blue = Earth in view. Gaps are darkness or blackout.</InfoTip>
      </h2>
      <div className="space-y-3">
        {scenarios.map((sc, i) => {
          const s = results[i]?.scenario;
          if (!s) return <div key={i} className="h-10 text-xs text-muted">Scenario {LETTERS[i]}: computing…</div>;
          const pos = (t: number) => `${(100 * (t - s.start)) / (days * DAY_MS)}%`;
          const wid = (a: number, b: number) => `${Math.max(0.2, (100 * (b - a)) / (days * DAY_MS))}%`;
          return (
            <div key={i}>
              <div className="mb-0.5 text-xs text-muted">{LETTERS[i]} · {resolveSite(sc.siteId)?.name} · from {fmtUTC(s.start)}</div>
              {(["sunlit", "dte"] as const).map((k) => (
                <div key={k} className="relative mb-1 h-3 rounded-full bg-panel-2" aria-label={`${k === "sunlit" ? "Sunlit" : "Earth in view"} intervals for scenario ${LETTERS[i]}`}>
                  {s.windows[k].map((w, j) => (
                    <div key={j} className="absolute top-0 h-3 rounded-full" title={`${fmtUTC(w.start)} → ${fmtUTC(w.end)} (${fmtHours((w.end - w.start) / HOUR_MS)})`}
                      style={{ left: pos(w.start), width: wid(w.start, w.end), background: k === "sunlit" ? "var(--sun)" : "var(--earth)" }} />
                  ))}
                </div>
              ))}
            </div>
          );
        })}
        <div className="flex justify-between text-[10px] text-faint">
          {Array.from({ length: 5 }, (_, k) => <span key={k}>day {Math.round((k * days) / 4)}</span>)}
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
    <section className="overflow-x-auto rounded-lg border border-line bg-panel p-4">
      <h2 className="mb-2 font-medium">Key numbers</h2>
      <table className="w-full min-w-140 text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1 font-normal">Metric</th>
            {scenarios.map((_, i) => <th key={i} className="py-1 font-normal">Scenario {LETTERS[i]}</th>)}
          </tr>
        </thead>
        <tbody>
          {KEY_ROWS.map((row) => {
            const vals = scenarios.map((_, i) => results[i]?.metrics?.[row.id]);
            const nums = vals.map((v) => (typeof v?.value === "number" ? v.value : null));
            const valid = nums.filter((x): x is number => x !== null);
            const allSame = valid.every((x) => Math.abs(x - valid[0]) < 1e-6);
            const best = row.better && valid.length > 1 && !allSame ? (row.better === "higher" ? Math.max(...valid) : Math.min(...valid)) : null;
            return (
              <tr key={row.id} className="border-t border-line align-top">
                <td className="py-2 pr-2">
                  {row.label}
                  <InfoTip title={catalog.metrics.find((m) => m.id === row.id)?.name ?? row.label} sources={vals.find((v) => v)?.sources}>{catalog.metrics.find((m) => m.id === row.id)?.definition}</InfoTip>
                </td>
                {vals.map((v, i) => {
                  const d = i > 0 && nums[i] !== null && nums[0] !== null ? nums[i]! - nums[0]! : null;
                  return (
                    <td key={i} className="py-2 pr-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {v?.rating && <RagBadge rag={v.rating.rag} compact />}
                        <span className="font-mono text-[13px]">{v?.display ?? "…"}</span>
                        {best !== null && nums[i] === best && <span className="text-[10px] text-good">best</span>}
                      </div>
                      {d !== null && Math.abs(d) > 1e-6 && <div className="text-[11px] text-muted">{d > 0 ? "+" : ""}{d.toFixed(Math.abs(d) < 10 ? 1 : 0)} {row.unit} vs A</div>}
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
    <section className="rounded-lg border border-line bg-panel p-4">
      <h2 className="mb-2 font-medium">
        Why these scenarios differ
        <InfoTip title="How this is explained" sources={["jpl-horizons", "lola-pds"]}>Generated from the computed geometry: horizon height toward the Sun, distances, elevations and libration. {kind}.</InfoTip>
      </h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted">{lines.map((l, k) => <li key={k}>{l}</li>)}</ul>
    </section>
  );
}

function Scores({ scenarios, results, persona }: { scenarios: Scenario[]; results: Record<number, Analysis>; persona: string }) {
  return (
    <section className="overflow-x-auto rounded-lg border border-line bg-panel p-4">
      <h2 className="mb-1 font-medium">
        At-a-glance score per category (1–10)
        <InfoTip title="How scores work" sources={["mission-assumption"]}>
          Scores appear only here, for comparison. Each rated metric sits in red / amber / green bands; its position across the bands gives 0–10, and a category averages its rated metrics (mapped to 1–10). Bands are planning defaults or tied to your assumptions, so there is no single right answer: a lower score can be the better trade for a given mission.
        </InfoTip>
      </h2>
      <p className="mb-2 text-xs text-muted">Hover a score to see which metrics fed it. Categories with no rated metric show “n/a”.</p>
      <table className="w-full min-w-140 text-sm">
        <tbody>
          {catalog.categories.map((c) => (
            <tr key={c.id} className="border-t border-line">
              <th scope="row" className="py-2 pr-2 text-left font-normal">{c.emoji} {c.label}</th>
              {scenarios.map((_, i) => {
                const m = results[i]?.metrics;
                const rated = metricsInCategory(c.id).map((d) => ({ d, v: m?.[d.id] })).filter((x) => x.v?.rating);
                const r = rollUp(rated.map((x) => x.v!.rating!));
                return (
                  <td key={i} className="w-40 py-2 text-center" title={rated.length ? `${rated.length} rated metric${rated.length === 1 ? "" : "s"}:\n` + rated.map((x) => `${x.d.name}: ${x.v!.display} (${RAG_META[x.v!.rating!.rag].label})`).join("\n") : "No rated metrics in this category"}>
                    {!m ? <span className="text-muted">…</span> : r ? (
                      <span className="inline-flex items-center gap-2 whitespace-nowrap"><span className="font-mono text-base">{r.score}</span><RagBadge rag={r.rag} compact={persona !== "enthusiast"} /></span>
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
