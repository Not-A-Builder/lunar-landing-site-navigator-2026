"use client";

import { useState } from "react";
import { InfoTip } from "@/components/InfoTip";
import { EducatorText } from "./EducatorText";
import { BandStrip, RagBadge } from "@/components/RagBadge";
import { catalog, metricsInCategory } from "@/lib/metrics";
import type { MetricValue, ValueStatus } from "@/lib/metrics/types";
import { rollUp } from "@/lib/metrics/types";
import type { Persona } from "@/lib/persona";

export const STATUS_META: Record<ValueStatus, { label: string; hint: string }> = {
  computed: { label: "Computed", hint: "Calculated for this site and date from NASA data." },
  modelled: { label: "Modelled", hint: "NASA data combined with your mission assumptions." },
  reference: { label: "Reference", hint: "A cited lunar-wide value, not specific to this site." },
  assumption: { label: "Your input", hint: "A mission assumption you can change in the planner panel." },
  unavailable: { label: "Not available", hint: "No public dataset or model supports this yet; the reason is given." },
};

function StatusBadge({ status }: { status: ValueStatus }) {
  const tone = status === "computed" ? "text-fg" : status === "unavailable" ? "text-faint" : "text-muted";
  return (
    <span title={STATUS_META[status].hint} className={`rounded border border-line px-1.5 py-px text-[10px] ${tone}`}>
      {STATUS_META[status].label}
    </span>
  );
}

/**
 * The 13 metric categories. Enthusiast: one rolled-up status per category and plain answers.
 * Educator: per-metric status, the colour bands, definition and why it matters.
 * Mission planner: everything, including numbers, timestamps, roles, dependencies and assumptions.
 */
export function MetricList({ values, persona, computing }: { values: Record<string, MetricValue> | undefined; persona: Persona; computing: boolean }) {
  const [showUnavailable, setShowUnavailable] = useState(persona === "planner");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          {computing ? "Computing multi-year, area and sensitivity results…" : "All results computed."}
          {values && ` ${Object.values(values).filter((v) => v.status !== "unavailable").length} of ${catalog.metrics.length} metrics have values.`}
        </span>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={showUnavailable} onChange={(e) => setShowUnavailable(e.target.checked)} />
          Show metrics that are not available
        </label>
      </div>
      {catalog.categories.map((cat, ci) => {
        const metrics = metricsInCategory(cat.id);
        const vals = metrics.map((m) => ({ m, v: values?.[m.id] }));
        const roll = rollUp(vals.map((x) => x.v?.rating).filter((r): r is NonNullable<typeof r> => !!r));
        const shown = vals.filter((x) => showUnavailable || x.v?.status !== "unavailable");
        const hidden = vals.length - shown.length;
        return (
          <details key={cat.id} open={ci < 3} className="group rounded-lg border border-line bg-panel">
            <summary className="flex cursor-pointer select-none flex-wrap items-center gap-2 px-4 py-3">
              <span className="font-medium">{cat.emoji} {cat.label}</span>
              {roll && <RagBadge rag={roll.rag} />}
              <span className="text-xs text-muted">
                {vals.filter((x) => x.v && x.v.status !== "unavailable").length}/{vals.length} with values
              </span>
            </summary>
            <ul className="divide-y divide-line border-t border-line">
              {shown.map(({ m, v }) => (
                <li key={m.id} className="grid gap-x-4 gap-y-1 px-4 py-2.5 text-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-1.5">
                      <span className="font-medium">{persona === "enthusiast" ? m.question : m.name}</span>
                      <InfoTip title={m.name} sources={v?.sources?.length ? v.sources : ["metrics-sheet"]}>
                        <span className="block">{m.definition}</span>
                        {persona !== "enthusiast" && <span className="mt-1 block"><b className="text-fg">Why it matters:</b> {m.significance}</span>}
                        {m.unit && <span className="mt-1 block">Unit: {m.unit}</span>}
                        {v?.note && <span className="mt-1 block">{v.note}</span>}
                        {m.caveats && <span className="mt-1 block">Caveat: {m.caveats}</span>}
                        {v?.rating && <span className="mt-1 block">Bands: {v.rating.basis}</span>}
                      </InfoTip>
                    </div>
                    {persona === "enthusiast" && <p className="text-xs text-muted">{m.views.enthusiast}</p>}
                    {persona === "educator" && <div className="mt-1"><EducatorText id={m.id} v={v} /></div>}
                    {persona === "planner" && (
                      <p className="text-[11px] text-faint">
                        {m.role} · depends on {m.dependencies || "n/a"} · literature: {m.source}
                      </p>
                    )}
                  </div>
                  <div className="min-w-0">
                    {!v ? (
                      <span className="text-muted">…</span>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          {v.rating && persona !== "enthusiast" && <RagBadge rag={v.rating.rag} compact />}
                          {(persona !== "educator" || v.status === "unavailable") && <span className={v.status === "unavailable" ? "text-faint" : "font-mono text-[13px]"}>{v.display}</span>}
                          {persona !== "enthusiast" && <StatusBadge status={v.status} />}
                        </div>
                        {v.status === "unavailable" && v.reason && <p className="text-xs text-faint">{v.reason}</p>}
                        {v.rating && persona !== "enthusiast" && v.value !== null && v.value !== undefined && (
                          <div className="mt-1.5"><BandStrip rating={v.rating} value={v.value} /></div>
                        )}
                        {persona === "planner" && v.detail && (
                          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-muted">{v.detail}</pre>
                        )}
                        {persona !== "planner" && v.note && v.status !== "unavailable" && persona === "educator" && (
                          <p className="text-[11px] text-faint">{v.note}</p>
                        )}
                      </>
                    )}
                  </div>
                </li>
              ))}
              {hidden > 0 && (
                <li className="px-4 py-2 text-xs text-faint">
                  {hidden} metric{hidden === 1 ? "" : "s"} in this group can&apos;t be computed from public data yet (tick “Show metrics that are not available” to see why).
                </li>
              )}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
