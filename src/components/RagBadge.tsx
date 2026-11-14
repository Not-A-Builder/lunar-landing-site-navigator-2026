import type { Rag, Rating } from "@/lib/metrics/types";

const META: Record<Rag, { label: string; icon: string; color: string }> = {
  green: { label: "Good", icon: "●", color: "var(--good)" },
  amber: { label: "Trade-off", icon: "◆", color: "var(--warning)" },
  red: { label: "Challenging", icon: "▲", color: "var(--critical)" },
};

/** Status chip: colour + shape icon + word, so the state never relies on colour alone. */
export function RagBadge({ rag, compact }: { rag: Rag; compact?: boolean }) {
  const m = META[rag];
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-[11px] text-fg">
      <span aria-hidden style={{ color: m.color }}>{m.icon}</span>
      {!compact && m.label}
      {compact && <span className="sr-only">{m.label}</span>}
    </span>
  );
}

/**
 * The colour bands for a metric with a marker at this site's value. Shows that there is no single
 * right answer: where the value sits, and how far it is from the next band.
 */
export function BandStrip({ rating, value, unit }: { rating: Rating; value: number; unit?: string }) {
  const lo = rating.bands[0].from, hi = rating.bands[rating.bands.length - 1].to;
  const pos = (v: number) => `${(100 * (Math.max(lo, Math.min(hi, v)) - lo)) / (hi - lo || 1)}%`;
  return (
    <div className="w-full max-w-56" title={rating.basis}>
      <div className="relative h-2">
        <div className="absolute inset-0 flex gap-0.5">
          {rating.bands.map((b) => (
            <div key={b.rag} className="h-2 rounded-full" style={{ width: `${(100 * (b.to - b.from)) / (hi - lo || 1)}%`, background: META[b.rag].color, opacity: 0.55 }} />
          ))}
        </div>
        <div className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded-full bg-fg ring-2 ring-panel" style={{ left: pos(value) }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-faint">
        {rating.bands.map((b) => (
          <span key={b.rag}>{META[b.rag].icon} {b.label}</span>
        ))}
      </div>
      {unit && <span className="sr-only">{unit}</span>}
    </div>
  );
}

export const RAG_META = META;
