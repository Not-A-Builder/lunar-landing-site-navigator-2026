"use client";

import { CheckCircle, WarningDiamond, WarningOctagon, type Icon } from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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

/** What each rating means, in plain words for every persona (D-113). Short enough for two lines. */
export const RAG_HINT: Record<Rag, string> = {
  green: "this result suits the mission well.",
  amber: "workable, but it limits the mission or needs extra planning.",
  red: "a serious obstacle the mission would need to plan around.",
};

/**
 * Wraps a rating (icon + word) with a small hover hint that says what the rating means (D-113).
 * Portalled to <body> so card edges never clip it; sits above the rating, or below near the top of the screen.
 */
export function RagHint({ rag, children, className }: { rag: Rag; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const b = ref.current?.getBoundingClientRect(), t = tipRef.current;
    if (!open || !b || !t) return;
    const M = 8, GAP = 6, w = t.offsetWidth, h = t.offsetHeight;
    t.style.left = `${Math.min(Math.max(M, b.left + b.width / 2 - w / 2), window.innerWidth - w - M)}px`;
    t.style.top = `${b.top - GAP - h >= 64 + M ? b.top - GAP - h : b.bottom + GAP}px`;
    t.style.visibility = "visible";
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const hide = () => setOpen(false);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [open]);
  const m = META[rag];
  return (
    <span ref={ref} className={className} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {children}
      {open && createPortal(
        <span ref={tipRef} role="tooltip" style={{ position: "fixed", left: 0, top: 0, visibility: "hidden" }}
          className="pointer-events-none z-50 w-max max-w-72 rounded-sm border border-line bg-panel px-2.5 py-1.5 text-left text-xs font-normal leading-snug text-fg shadow-xl">
          <b className="font-semibold">{m.label}:</b> {RAG_HINT[rag]}
        </span>,
        document.body,
      )}
    </span>
  );
}

/** Status: colour + shape icon + word, so the state never relies on colour alone. No chip container. Hover explains it (D-113). */
export function RagBadge({ rag, compact }: { rag: Rag; compact?: boolean }) {
  const m = META[rag];
  return (
    <RagHint rag={rag} className="inline-flex cursor-default items-center gap-1 whitespace-nowrap text-xs text-fg">
      <RagIcon rag={rag} />
      {!compact && m.label}
      {compact && <span className="sr-only">{m.label}</span>}
    </RagHint>
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
