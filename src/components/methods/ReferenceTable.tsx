"use client";

import { ArrowUpRight, CaretRight, MagnifyingGlass } from "@phosphor-icons/react";
import { useDeferredValue, useMemo, useState } from "react";
import { FIELD_H } from "@/lib/ui";

export type RefRow = { key: string; value: string; unit: string; range: string | null; context: string; sourceTitle: string; sourceUrl: string; page: string; quote: string };

const label = (k: string) => {
  const s = k.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * The cited lunar-wide reference values (src/data/references.json), searchable (D-139b). Each row opens to
 * its context and the exact quote from the cited document.
 */
export function ReferenceTable({ rows }: { rows: RefRow[] }) {
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q.trim().toLowerCase());
  const list = useMemo(
    () => (dq ? rows.filter((r) => `${r.key} ${r.context} ${r.sourceTitle} ${r.value} ${r.unit}`.toLowerCase().replace(/_/g, " ").includes(dq)) : rows),
    [rows, dq],
  );

  return (
    <div>
      <div className="reveal flex flex-wrap items-center gap-3">
        <label className={`flex ${FIELD_H} w-full max-w-md items-center gap-2 rounded-sm border border-line bg-panel px-3 focus-within:border-muted`}>
          <MagnifyingGlass size={16} className="text-faint" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search values, e.g. regolith, radiation, DSN" aria-label="Search reference values"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
        </label>
        <span className="num text-sm text-faint" aria-live="polite">{list.length} of {rows.length}</span>
      </div>

      <div className="mt-4 border-t border-line">
        {list.map((r) => (
          <details key={r.key} className="group border-b border-line">
            <summary className="grid cursor-pointer grid-cols-[16px_minmax(0,1fr)] gap-x-2 py-3 transition-colors hover:bg-panel md:grid-cols-[16px_minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,2fr)] md:gap-x-4">
              <CaretRight size={14} className="caret mt-1 text-faint transition-transform" aria-hidden />
              <span className="text-sm text-fg">{label(r.key)}</span>
              <span className="num col-start-2 text-sm text-fg md:col-start-auto">
                {r.value} {r.unit}
                {r.range && r.range !== r.value ? <span className="text-faint"> ({r.range})</span> : null}
              </span>
              <span className="col-start-2 truncate text-sm text-muted md:col-start-auto" title={r.sourceTitle}>{r.sourceTitle}{r.page ? `, ${r.page}` : ""}</span>
            </summary>
            <div className="grid gap-3 pb-4 pl-6 text-sm md:grid-cols-2 md:gap-6">
              {r.context && <p className="leading-relaxed text-muted">{r.context}</p>}
              <div>
                {r.quote && <blockquote className="border-l-2 border-line pl-3 text-muted italic">“{r.quote}”</blockquote>}
                <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-fg underline decoration-line underline-offset-4 hover:decoration-current">
                  Open the source <ArrowUpRight size={14} aria-hidden />
                </a>
              </div>
            </div>
          </details>
        ))}
        {list.length === 0 && <p className="py-6 text-sm text-muted">No reference value matches “{q}”.</p>}
      </div>
    </div>
  );
}
