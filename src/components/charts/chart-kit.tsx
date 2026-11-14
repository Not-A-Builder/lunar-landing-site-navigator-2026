"use client";

import { useRef, useState, type ReactNode } from "react";

/** Small helpers shared by the SVG charts: linear scales, a measured-width container, a tooltip. */

export function scale(d0: number, d1: number, r0: number, r1: number) {
  const k = (r1 - r0) / (d1 - d0 || 1);
  const f = (v: number) => r0 + (v - d0) * k;
  f.invert = (p: number) => d0 + (p - r0) / k;
  return f;
}

export function niceTicks(min: number, max: number, count = 5) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

export function timeTicks(t0: number, t1: number) {
  const days = (t1 - t0) / 86_400_000;
  const stepDays = days <= 3 ? 0.5 : days <= 10 ? 1 : days <= 20 ? 2 : days <= 40 ? 5 : 10;
  const step = stepDays * 86_400_000;
  const first = Math.ceil(t0 / step) * step;
  const out: number[] = [];
  for (let t = first; t <= t1; t += step) out.push(t);
  return out;
}

export const fmtTick = (t: number) => {
  const d = new Date(t);
  const hh = d.getUTCHours();
  return hh === 0 ? d.toISOString().slice(5, 10) : `${d.toISOString().slice(5, 10)} ${String(hh).padStart(2, "0")}h`;
};

/** Container that reports its width so the SVG can be laid out in pixels (crisp hairlines). */
export function useWidth(initial = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(initial);
  const obs = useRef<ResizeObserver | null>(null);
  const setRef = (el: HTMLDivElement | null) => {
    obs.current?.disconnect();
    (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (el) {
      obs.current = new ResizeObserver((e) => setW(Math.max(280, Math.floor(e[0].contentRect.width))));
      obs.current.observe(el);
    }
  };
  return { setRef, w };
}

export function Tooltip({ x, y, w, children }: { x: number; y: number; w: number; children: ReactNode }) {
  const left = x > w - 268 ? x - 264 : x + 12;
  return (
    <div
      className="pointer-events-none absolute z-10 w-64 rounded-sm border border-line bg-panel px-3 py-2 text-xs leading-snug text-fg shadow-lg"
      style={{ left, top: Math.max(0, y - 10) }}
    >
      {children}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; kind?: "line" | "area" | "dot" }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.kind === "area" ? (
            <span className="inline-block h-3 w-3.5 rounded-sm" style={{ background: i.color, opacity: 0.5 }} />
          ) : i.kind === "dot" ? (
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: i.color }} />
          ) : (
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: i.color }} />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}
