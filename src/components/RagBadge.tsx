import { CheckCircle, WarningDiamond, WarningOctagon, type Icon } from "@phosphor-icons/react";
import type { Rag, Rating } from "@/lib/metrics/types";

const META: Record<Rag, { label: string; Icon: Icon; color: string }> = {
  green: { label: "Good", Icon: CheckCircle, color: "var(--good)" },
  amber: { label: "Trade-off", Icon: WarningDiamond, color: "var(--warning)" },
  red: { label: "Challenging", Icon: WarningOctagon, color: "var(--critical)" },
};

export function RagIcon({ rag, size = 17 }: { rag: Rag; size?: number }) {
  const m = META[rag];
  return <m.Icon size={size} weight="fill" style={{ color: m.color }} className="shrink-0" aria-hidden />;
}

/** Status: colour + shape icon + word, so the state never relies on colour alone. No chip container. */
export function RagBadge({ rag, compact }: { rag: Rag; compact?: boolean }) {
  const m = META[rag];
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-fg" title={compact ? m.label : undefined}>
      <RagIcon rag={rag} />
      {!compact && m.label}
      {compact && <span className="sr-only">{m.label}</span>}
    </span>
  );
}

/**
 * The colour bands for a metric with a marker at this site's value. Shows that there is no single
 * right answer: where the value sits, and how far it is from the next band.
 */
/** `wide`: fill the parent's full width (metric rows and the Rating bands modal, D-104); otherwise capped at 18rem. */
export function BandStrip({ rating, value, unit, wide }: { rating: Rating; value: number; unit?: string; wide?: boolean }) {
  const lo = rating.bands[0].from, hi = rating.bands[rating.bands.length - 1].to;
  const pos = (v: number) => `${(100 * (Math.max(lo, Math.min(hi, v)) - lo)) / (hi - lo || 1)}%`;
  return (
    <div className={`w-full ${wide ? "" : "max-w-72"}`} title={rating.basis}>
      <div className="relative h-1.5">
        <div className="absolute inset-0 flex gap-px">
          {rating.bands.map((b) => (
            <div key={b.rag} className="h-1.5" style={{ width: `${(100 * (b.to - b.from)) / (hi - lo || 1)}%`, background: META[b.rag].color, opacity: 0.6 }} />
          ))}
        </div>
        <div className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 bg-fg" style={{ left: pos(value) }} />
      </div>
      <div className="mt-1.5 flex justify-between gap-2 text-xs text-faint">
        {rating.bands.map((b) => (
          <span key={b.rag} className="inline-flex items-center gap-1">
            <RagIcon rag={b.rag} size={14} />
            {b.label}
          </span>
        ))}
      </div>
      {unit && <span className="sr-only">{unit}</span>}
    </div>
  );
}

export const RAG_META = META;
