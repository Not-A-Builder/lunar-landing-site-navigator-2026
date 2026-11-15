"use client";

import { ArrowUpRight, CaretRight } from "@phosphor-icons/react";
import { useState } from "react";
import type { SourceId } from "@/lib/sources";

type Kind = "data" | "method" | "context" | "project";
const KIND: Record<SourceId, Kind> = {
  "jpl-horizons": "data", "lola-pds": "data", pgda: "data", diviner: "data", "psr-atlas": "data", "dsn-810-005": "data",
  "usgs-gazetteer": "data", "lroc-sites": "data", "nssdc-moon": "data", "nssdc-sun": "data", "nssdc-earth": "data", "trek-wmts": "data",
  "bryant-2009": "method", "liu-2023": "method", "naif-spice": "method", "reference-literature": "method",
  "nasa-clps": "context", "nasa-artemis": "context", "csa-moon": "context", "svs-libration": "context", quickmap: "context",
  "metrics-sheet": "project", "mission-assumption": "project",
};
const FILTERS: { id: Kind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "data", label: "Datasets & services" },
  { id: "method", label: "Methods & references" },
  { id: "context", label: "Missions & context" },
  { id: "project", label: "This project & you" },
];

export type SourceCard = { id: SourceId; name: string; provider: string; url: string; use: string; usedIn: string[] };

/**
 * Every entry of the source registry (src/lib/sources.ts) as a card, most-used first (D-139). "Used in"
 * counts metrics that cite the source on the reference run (src/data/source-usage.json); sources no metric
 * cites (maps, charts, pages) say so.
 */
export function SourceGrid({ sources, mapLayers }: { sources: SourceCard[]; mapLayers: { id: string; map: string }[] }) {
  const [filter, setFilter] = useState<Kind | "all">("all");
  const max = Math.max(...sources.map((s) => s.usedIn.length));
  const list = sources.filter((s) => filter === "all" || KIND[s.id] === filter).sort((a, b) => b.usedIn.length - a.usedIn.length);

  return (
    <div>
      <div role="group" aria-label="Filter sources" className="reveal flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const n = f.id === "all" ? sources.length : sources.filter((s) => KIND[s.id] === f.id).length;
          return (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
              className={`rounded-sm border px-3 py-1.5 text-sm transition-colors ${filter === f.id ? "border-fg bg-fg text-bg" : "border-line text-muted hover:border-muted hover:text-fg"}`}>
              {f.label} <span className="num opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {list.map((s) => {
          const internal = s.url.startsWith("/");
          return (
            <li key={s.id} id={`src-${s.id}`} className="swap-in group flex scroll-mt-24 flex-col rounded-sm border border-line bg-panel p-5 transition-[border-color,transform] duration-300 ease-out hover:-translate-y-0.5 hover:border-muted">
              <div className="text-xs text-faint">{s.provider}</div>
              <a href={s.url} target={internal ? undefined : "_blank"} rel="noreferrer" className="mt-1 inline-flex items-start gap-1 font-medium text-fg underline decoration-line underline-offset-4 hover:decoration-current">
                <span>{s.name}</span>
                {!internal && <ArrowUpRight size={14} className="mt-1 shrink-0 text-faint transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />}
              </a>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{s.use}</p>
              <div className="mt-4">
                {s.usedIn.length > 0 ? (
                  <details>
                    <summary className="flex cursor-pointer items-center gap-2 text-xs text-muted hover:text-fg">
                      <CaretRight size={12} className="caret shrink-0 transition-transform" aria-hidden />
                      <span className="whitespace-nowrap">Used in <span className="num text-fg">{s.usedIn.length}</span> metric{s.usedIn.length === 1 ? "" : "s"}</span>
                      <span className="h-1.5 flex-1 rounded-[2px] bg-panel-2" aria-hidden>
                        <span className="block h-full rounded-[2px] bg-fg/60" style={{ width: `${Math.max(3, (s.usedIn.length / max) * 100)}%` }} />
                      </span>
                    </summary>
                    <p className="mt-2 text-xs leading-relaxed text-muted">{s.usedIn.join(" · ")}</p>
                  </details>
                ) : (
                  <div className="text-xs text-faint">Not cited by a metric value; used in maps, charts or pages</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {(filter === "all" || filter === "data") && (
        <div className="reveal mt-6 rounded-sm border border-line p-5">
          <div className="text-sm font-medium">Map tile layers (NASA Moon Trek)</div>
          <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
            {mapLayers.map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-x-3">
                <span className="font-mono text-xs leading-6 text-fg">{l.id}</span>
                <span className="text-xs leading-6 text-faint">{l.map}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
