"use client";

import { CaretRight } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { InfoTip } from "@/components/InfoTip";
import { useWidth } from "./use-width";

export type ValRow = { id: string; name: string; oursSun: number; lolaSun: number; oursEarth: number; lolaEarth: number | null };

const P = { l: 56, r: 16, t: 16, b: 48 };

/**
 * Validation scatter (D-139): for each south-polar site, our share of time with any part of the Sun (or
 * Earth) above the terrain horizon against the LOLA team's average-visibility map. Points on the diagonal
 * agree. Data: src/data/validation.json (pipeline:terrain).
 */
export function ValidationChart({ rows }: { rows: ValRow[] }) {
  const [body, setBody] = useState<"sun" | "earth">("sun");
  const [hover, setHover] = useState<string | null>(null);
  const [plot, W] = useWidth<HTMLDivElement>();

  const pts = useMemo(
    () => rows
      .map((r) => ({ id: r.id, name: r.name, ours: body === "sun" ? r.oursSun : r.oursEarth, lola: body === "sun" ? r.lolaSun : r.lolaEarth }))
      .filter((p): p is { id: string; name: string; ours: number; lola: number } => p.lola !== null),
    [rows, body],
  );
  const stats = useMemo(() => {
    const d = pts.map((p) => Math.abs(p.ours - p.lola));
    const worst = pts.reduce((w, p) => (Math.abs(p.ours - p.lola) > Math.abs(w.ours - w.lola) ? p : w), pts[0]);
    return {
      n: pts.length,
      mean: d.reduce((a, b) => a + b, 0) / d.length,
      within1: d.filter((x) => x <= 0.01).length,
      within2: d.filter((x) => x <= 0.02).length,
      worst,
    };
  }, [pts]);
  const max = Math.min(1, Math.ceil(Math.max(...pts.flatMap((p) => [p.ours, p.lola])) * 10 + 0.5) / 10);
  const side = W - P.l - P.r; // square plot: both axes share one scale
  const x = (v: number) => P.l + (v / max) * side;
  const y = (v: number) => P.t + (1 - v / max) * side;
  const ticks = Array.from({ length: Math.round(max * 10) + 1 }, (_, i) => i / 10);
  const hv = pts.find((p) => p.id === hover) ?? null;
  const color = body === "sun" ? "sun" : "earth";

  return (
    <div className="space-y-4">
      <div className="reveal min-w-0 rounded-sm border border-line bg-panel p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            Share of time any part of the {body === "sun" ? "Sun" : "Earth"} is visible
            <InfoTip title="Validation against LOLA" sources={["lola-pds", "pgda", "jpl-horizons"]}>
              Ours: 2026–2029 from JPL Horizons and LOLA LDEM_75S_120M, at ground level. LOLA: avgvisib_75s_120m (2016 release, Mazarico et al. 2011 method), simulated over a different period with its own time steps, so small differences are expected.
            </InfoTip>
          </div>
          <div role="group" aria-label="Body" className="inline-flex rounded-sm border border-line">
            {(["sun", "earth"] as const).map((b, i) => (
              <button key={b} type="button" onClick={() => setBody(b)} aria-pressed={b === body}
                className={`px-3 py-1 text-sm transition-colors ${i ? "border-l border-line" : ""} ${b === body ? "bg-fg text-bg" : "text-muted hover:bg-panel-2 hover:text-fg"}`}>{b === "sun" ? "Sun" : "Earth"}</button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        <div ref={plot} className="relative">
          <svg width={W} height={side + P.t + P.b} className="block" role="img" aria-label={`Our results against LOLA for ${stats.n} sites`}>
            {ticks.map((v) => (
              <g key={v}>
                <line x1={x(v)} x2={x(v)} y1={y(0)} y2={y(max)} className="stroke-grid" />
                <line x1={x(0)} x2={x(max)} y1={y(v)} y2={y(v)} className="stroke-grid" />
                <text x={x(v)} y={y(0) + 20} textAnchor="middle" className="num fill-faint text-xs">{Math.round(v * 100)}%</text>
                <text x={x(0) - 8} y={y(v) + 5} textAnchor="end" className="num fill-faint text-xs">{Math.round(v * 100)}%</text>
              </g>
            ))}
            <line x1={x(0)} y1={y(0)} x2={x(max)} y2={y(max)} className="stroke-muted" strokeDasharray="4 4" />
            <text transform={`translate(${x(max * 0.82)} ${y(max * 0.82)}) rotate(-45)`} dy={-8} textAnchor="middle" className="fill-muted text-xs">Perfect agreement</text>
            <text x={x(max / 2)} y={y(0) + 42} textAnchor="middle" className="fill-faint text-xs">LOLA average-visibility map</text>
            <text transform={`translate(${x(0) - 44} ${y(max / 2)}) rotate(-90)`} textAnchor="middle" className="fill-faint text-xs">This tool</text>
            {pts.map((p) => {
              const on = hover === p.id;
              return (
                <circle key={p.id} cx={x(p.lola)} cy={y(p.ours)} r={on ? 7 : 5}
                  className={`${color === "sun" ? "fill-sun" : "fill-earth"} stroke-panel transition-opacity duration-200`} strokeWidth={2}
                  opacity={hover && !on ? 0.35 : 0.9} />
              );
            })}
            {/* generous invisible hit targets */}
            {pts.map((p) => (
              <circle key={`h-${p.id}`} cx={x(p.lola)} cy={y(p.ours)} r={12} fill="transparent" tabIndex={0} role="button" aria-label={`${p.name}: ours ${(p.ours * 100).toFixed(1)}%, LOLA ${(p.lola * 100).toFixed(1)}%`}
                onPointerEnter={() => setHover(p.id)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(p.id)} onBlur={() => setHover(null)} className="outline-none" />
            ))}
          </svg>
          {hv && (
            <div className="pointer-events-none absolute rounded-sm border border-line bg-bg/95 px-3 py-2 text-xs shadow-sm"
              style={{ left: Math.min(x(hv.lola) + 14, W - 220), top: Math.max(0, y(hv.ours) - 70), width: 206 }}>
              <div className="font-medium text-fg">{hv.name}</div>
              <div className="mt-0.5 text-muted">This tool: <span className="num text-fg">{(hv.ours * 100).toFixed(1)}%</span></div>
              <div className="text-muted">LOLA map: <span className="num text-fg">{(hv.lola * 100).toFixed(1)}%</span></div>
              <div className="text-muted">Difference: <span className="num text-fg">{((hv.ours - hv.lola) * 100 >= 0 ? "+" : "−") + Math.abs((hv.ours - hv.lola) * 100).toFixed(1)} pp</span></div>
            </div>
          )}
        </div>

      <div className="divide-y divide-line border-y border-line lg:mt-4">
        <Stat value={`${(stats.mean * 100).toFixed(1)} pp`} label={`mean difference across ${stats.n} sites`} />
        <Stat value={`${stats.within1} of ${stats.n}`} label="sites within 1 percentage point" />
        <Stat value={`${stats.within2} of ${stats.n}`} label="sites within 2 percentage points" />
        <Stat value={`${((stats.worst.ours - stats.worst.lola) * 100 >= 0 ? "+" : "−") + Math.abs((stats.worst.ours - stats.worst.lola) * 100).toFixed(1)} pp`} label={`largest difference: ${stats.worst.name}`} />
      </div>
        </div>
      </div>

      <details className="group">
        <summary className="inline-flex cursor-pointer items-center gap-1 text-sm text-muted hover:text-fg">
          <CaretRight size={14} className="caret transition-transform" aria-hidden /> Show all {rows.length} sites as a table
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-130 text-sm">
            <thead><tr className="text-left text-xs text-faint"><th className="py-1.5 font-normal">Site</th><th className="font-normal">Sun: ours</th><th className="font-normal">Sun: LOLA</th><th className="font-normal">Earth: ours</th><th className="font-normal">Earth: LOLA</th></tr></thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="border-t border-line">
                  <td className="py-1.5">{v.name}</td>
                  <td className="num">{(v.oursSun * 100).toFixed(1)}%</td>
                  <td className="num">{(v.lolaSun * 100).toFixed(1)}%</td>
                  <td className="num">{(v.oursEarth * 100).toFixed(1)}%</td>
                  <td className="num">{v.lolaEarth === null ? "—" : `${(v.lolaEarth * 100).toFixed(1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="py-4">
      <div className="num text-2xl text-fg">{value}</div>
      <div className="mt-1 flex items-start gap-1 text-sm text-muted">
        <span>{label}</span>
        <InfoTip title="Validation statistic" sources={["lola-pds", "pgda"]} align="right">
          Computed on this page from the validation table below (src/data/validation.json). A percentage point (pp) is the plain difference between two percentages.
        </InfoTip>
      </div>
    </div>
  );
}
