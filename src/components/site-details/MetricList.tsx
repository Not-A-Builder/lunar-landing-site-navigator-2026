"use client";

import { CaretRight } from "@phosphor-icons/react";
import { CategoryIcon } from "@/components/CategoryIcon";
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
  const tone = status === "computed" ? "text-muted" : "text-faint";
  return (
    <span title={STATUS_META[status].hint} className={`text-xs ${tone}`}>
      {STATUS_META[status].label}
    </span>
  );
}

/**
 * The 13 metric categories. Enthusiast: one rolled-up status per category and plain answers.
 * Educator: per-metric status, the colour bands, definition and why it matters.
 * Mission planner: everything, including numbers, timestamps, roles, dependencies and assumptions.
 * Metrics that can't be computed or fetched from data for this site and date are not shown (LOGS D-041).
 */
export function MetricList({ values, persona, computing }: { values: Record<string, MetricValue> | undefined; persona: Persona; computing: boolean }) {
  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        {computing ? "Computing multi-year, area and sensitivity results…" : "All results computed."}
        {values && <> <span className="num">{Object.values(values).filter((v) => v.status !== "unavailable").length}</span> metrics for this site and date.</>}
      </p>
      {catalog.categories.map((cat, ci) => {
        const metrics = metricsInCategory(cat.id);
        const vals = metrics.map((m) => ({ m, v: values?.[m.id] }));
        const roll = rollUp(vals.map((x) => x.v?.rating).filter((r): r is NonNullable<typeof r> => !!r));
        const shown = vals.filter((x) => x.v?.status !== "unavailable");
        if (shown.length === 0) return null;
        return (
          <details key={cat.id} open={ci < 3} className="border-t border-line last:border-b">
            <summary className="flex cursor-pointer select-none flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:text-fg">
              <CaretRight size={16} className="caret shrink-0 text-faint transition-transform" aria-hidden />
              <CategoryIcon id={cat.id} />
              <span className="font-medium">{cat.label}</span>
              {roll && <RagBadge rag={roll.rag} />}
              <span className="ml-auto text-xs text-faint">
                <span className="num">{shown.length}</span> metric{shown.length === 1 ? "" : "s"}
              </span>
            </summary>
            <ul className="mb-3 ml-[26px] divide-y divide-line">
              {shown.map(({ m, v }) => (
                <li key={m.id} className="grid gap-x-8 gap-y-1 py-3 text-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
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
                    {persona === "enthusiast" && <p className="mt-0.5 text-sm text-muted">{m.views.enthusiast}</p>}
                    {persona === "educator" && <div className="mt-1"><EducatorText id={m.id} v={v} /></div>}
                    {persona === "planner" && (
                      <p className="mt-0.5 text-xs text-faint">
                        {m.role} · depends on {m.dependencies || "n/a"} · literature: {m.source}
                      </p>
                    )}
                  </div>
                  <div className="min-w-0">
                    {!v ? (
                      <span className="text-muted">…</span>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {v.rating && persona !== "enthusiast" && <RagBadge rag={v.rating.rag} compact />}
                          {persona !== "educator" && <span className="font-mono">{v.display}</span>}
                          {persona !== "enthusiast" && <StatusBadge status={v.status} />}
                        </div>
                        {v.rating && persona !== "enthusiast" && v.value !== null && v.value !== undefined && (
                          <div className="mt-2"><BandStrip rating={v.rating} value={v.value} /></div>
                        )}
                        {persona === "planner" && v.detail && (
                          <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted">{v.detail}</pre>
                        )}
                        {persona === "educator" && v.note && (
                          <p className="mt-1 text-xs text-faint">{v.note}</p>
                        )}
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
