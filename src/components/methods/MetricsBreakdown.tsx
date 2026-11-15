"use client";

import { useState } from "react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { InfoTip } from "@/components/InfoTip";

const STATUS = [
  { id: "computed", label: "Computed", swatch: "bg-fg", text: "Calculated for this site and date from NASA data: ephemeris, LOLA terrain and the other datasets." },
  { id: "modelled", label: "Modelled", swatch: "bg-muted", text: "NASA data combined with your mission assumptions, such as array size, battery or antenna gain." },
  { id: "reference", label: "Reference", swatch: "bg-faint", text: "A cited lunar-wide value, the same for every site. Each one quotes the document it came from." },
  { id: "assumption", label: "Your input", swatch: "bg-terrain", text: "A mission assumption shown back to you. The defaults are examples; mission planners can change them." },
  { id: "unavailable", label: "Not available (hidden)", swatch: "hatch", text: "No public dataset or model supports it yet. These are left out instead of guessed; each has a recorded reason." },
] as const;

/**
 * How the 196 metrics break down by value status on the reference run (D-139), and how many sit in each
 * category. Counts come from src/data/source-usage.json (pipeline:terrain) and the metrics catalog.
 */
export function MetricsBreakdown({ counts, basis, total, categories }: {
  counts: Record<string, number>;
  basis: string;
  total: number;
  categories: { id: string; label: string; count: number }[];
}) {
  const [active, setActive] = useState<string | null>(null);
  const sum = STATUS.reduce((s, x) => s + (counts[x.id] ?? 0), 0);
  const maxCat = Math.max(...categories.map((c) => c.count));
  const [site, date] = basis.split(" @ ");
  const siteName = site ? site.charAt(0).toUpperCase() + site.slice(1) : basis;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="reveal rounded-sm border border-line bg-panel p-5 md:p-6">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          Where each value comes from
          <InfoTip title="Value status counts" sources={["metrics-sheet"]}>
            Counted on the pipeline&apos;s reference run: {siteName}, landing {date} 00:00 UTC, default assumptions, without peer rankings. On a site page the counts can differ a little: some values depend on the site&apos;s latitude or on data loaded alongside it, such as the rankings against other sites.
          </InfoTip>
        </div>
        <p className="mt-1 text-sm text-faint">{siteName}, landing {date}: {sum} metrics</p>
        <div className="mt-5 flex h-10 gap-0.5" onPointerLeave={() => setActive(null)}>
          {STATUS.map((s) => {
            const n = counts[s.id] ?? 0;
            if (!n) return null;
            const dim = active && active !== s.id;
            return (
              <button key={s.id} type="button" aria-label={`${s.label}: ${n}`} onPointerEnter={() => setActive(s.id)} onFocus={() => setActive(s.id)} onBlur={() => setActive(null)}
                style={{ flexGrow: n, ...(s.swatch === "hatch" ? { backgroundImage: "repeating-linear-gradient(135deg, var(--line) 0 2px, transparent 2px 7px)" } : {}) }}
                className={`h-full basis-0 rounded-[2px] transition-opacity duration-200 ${s.swatch === "hatch" ? "border border-line" : s.swatch} ${dim ? "opacity-30" : ""}`} />
            );
          })}
        </div>
        <ul className="mt-5 divide-y divide-line">
          {STATUS.map((s) => {
            const n = counts[s.id] ?? 0;
            const on = active === s.id;
            return (
              <li key={s.id} onPointerEnter={() => setActive(s.id)} onPointerLeave={() => setActive(null)}
                className={`grid grid-cols-[14px_1fr_auto] gap-x-3 py-2.5 transition-opacity duration-200 ${active && !on ? "opacity-45" : ""}`}>
                <span className={`mt-1.5 size-3.5 rounded-[2px] ${s.swatch === "hatch" ? "border border-line" : s.swatch}`}
                  style={s.swatch === "hatch" ? { backgroundImage: "repeating-linear-gradient(135deg, var(--line) 0 2px, transparent 2px 5px)" } : undefined} aria-hidden />
                <div>
                  <div className="text-sm font-medium text-fg">{s.label}</div>
                  <p className="text-xs leading-relaxed text-muted">{s.text}</p>
                </div>
                <span className="num text-lg text-fg">{n}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="reveal rounded-sm border border-line bg-panel p-5 md:p-6">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {total} metrics in {categories.length} categories
          <InfoTip title="Metrics catalog" sources={["metrics-sheet"]}>
            Names, definitions, units and persona wording come from the project&apos;s metrics sheet (Draft 3). Which ones you see depends on the persona and on what the data supports.
          </InfoTip>
        </div>
        <ul className="mt-4 space-y-1.5">
          {categories.map((c) => (
            <li key={c.id} className="grid grid-cols-[20px_minmax(0,1fr)_minmax(48px,22%)_28px] items-center gap-3 text-sm">
              <CategoryIcon id={c.id} size={18} />
              <span className="truncate text-muted" title={c.label}>{c.label}</span>
              <span className="h-2 rounded-[2px] bg-panel-2">
                <span className="block h-full origin-left rounded-[2px] bg-fg/70" style={{ width: `${(c.count / maxCat) * 100}%` }} />
              </span>
              <span className="num text-right text-fg">{c.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
