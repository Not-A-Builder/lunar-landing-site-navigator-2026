"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

/** Small helpers shared by the SVG charts: linear scales, a measured-width container, hover and tooltips. */

export function scale(d0: number, d1: number, r0: number, r1: number) {
  const k = (r1 - r0) / (d1 - d0 || 1);
  const f = (v: number) => r0 + (v - d0) * k;
  f.invert = (p: number) => d0 + (p - r0) / k;
  return f;
}

/** Round `max` up to the next "nice" tick so the top gridline sits above the data. */
export function niceMax(max: number, count = 4) {
  const step0 = (max || 1) / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  return Math.ceil(max / step) * step;
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

const DAY = 86_400_000;

/**
 * Day ticks for a mission chart: every UTC midnight inside the window (minor), and a labelled subset
 * spaced so labels never collide at this width (major). Labels read "4 Dec".
 */
export function dayTicks(t0: number, t1: number, plotW: number) {
  const first = Math.ceil(t0 / DAY) * DAY;
  const minor: number[] = [];
  for (let t = first; t <= t1; t += DAY) minor.push(t);
  const days = (t1 - t0) / DAY;
  const every = [1, 2, 3, 5, 7, 10, 15].find((k) => (plotW / days) * k >= 64) ?? 30;
  // drop a label that would sit within ~one label width of the right edge (it would be clipped)
  const major = minor.filter((t) => Math.round((t - first) / DAY) % every === 0 && ((t1 - t) / (t1 - t0)) * plotW >= 30);
  return { minor, major };
}

export const fmtDay = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "Wed 4 Dec 2026, 14:20 UTC" */
export const fmtWhen = (t: number) => {
  const d = new Date(t);
  const date = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${date}, ${d.toISOString().slice(11, 16)} UTC`;
};

/** "Day 3, 14 h" style offset from the landing time. */
export const fmtMissionTime = (t: number, t0: number) => {
  const h = (t - t0) / 3_600_000;
  const d = Math.floor(h / 24);
  return `Day ${d + 1} · +${Math.round(h)} h`;
};

/** Container that reports its width so the SVG can be laid out in pixels (crisp hairlines). */
export function useWidth(initial = 640) {
  const [w, setW] = useState(initial);
  const obs = useRef<ResizeObserver | null>(null);
  const setRef = useCallback((el: HTMLDivElement | null) => {
    obs.current?.disconnect();
    if (el) {
      obs.current = new ResizeObserver((e) => setW(Math.max(280, Math.floor(e[0].contentRect.width))));
      obs.current.observe(el);
    }
  }, []);
  return { setRef, w };
}

/**
 * Hover state for an SVG chart, designed not to flicker (D-087):
 *  - handlers sit on the whole <svg>, so moving over lines, dots or labels never counts as leaving;
 *  - the pointer is snapped to a data key (sample index, azimuth step) and state only changes when that
 *    key changes, so the tooltip doesn't re-render on every pixel;
 *  - leaving waits briefly before hiding, and the last content stays mounted to fade out.
 */
export function usePlotHover<K extends string | number>(pick: (px: number, py: number) => K | null) {
  const [key, setKey] = useState<K | null>(null);
  const [last, setLast] = useState<K | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const k = pick(e.clientX - r.left, e.clientY - r.top);
    if (timer.current) clearTimeout(timer.current);
    if (k === null) {
      timer.current = setTimeout(() => setKey(null), 90);
      return;
    }
    setKey((prev) => (prev === k ? prev : k));
    setLast((prev) => (prev === k ? prev : k));
  };
  const onPointerLeave = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setKey(null), 90);
  };
  return { key, last, bind: { onPointerMove, onPointerLeave } };
}

/**
 * Tooltip card that glides to the hovered point instead of jumping, pinned near the top of the plot so
 * it doesn't chase the pointer vertically. It flips to the left of the point near the right edge.
 */
export function ChartTip({ x, w, show, top = 8, width = 288, children }: { x: number; w: number; show: boolean; top?: number; width?: number; children: ReactNode }) {
  const left = x + 16 + width > w ? x - 16 - width : x + 16;
  return (
    <div
      aria-hidden={!show}
      className="pointer-events-none absolute left-0 top-0 z-10 rounded-sm border border-line bg-panel/95 px-3 py-2.5 text-xs leading-snug text-fg shadow-lg backdrop-blur-sm motion-safe:transition-[transform,opacity] motion-safe:duration-150 motion-safe:ease-out"
      style={{ width, transform: `translate3d(${Math.max(0, left)}px, ${top}px, 0)`, opacity: show ? 1 : 0 }}
    >
      {children}
    </div>
  );
}

/** Label / value rows inside a chart tooltip. Values use the mono numeral font. */
export function TipRows({ rows }: { rows: ([string, ReactNode, string?] | null | false)[] }) {
  return (
    <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      {rows.filter((r): r is [string, ReactNode, string?] => !!r).map(([k, v, tone]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className={`num text-right ${tone ?? "text-fg"}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TipHead({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <div className="font-medium">{title}</div>
      {sub && <div className="text-faint">{sub}</div>}
    </div>
  );
}

export const AXIS = { fontSize: 14, fontFamily: "var(--font-plex-mono)", fill: "var(--muted)" } as const;

export function Legend({ items }: { items: { label: string; color: string; kind?: "line" | "area" | "dot" | "dash" | "faded" }[] }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.kind === "area" ? (
            <span className="inline-block h-3 w-3.5 rounded-sm" style={{ background: i.color, opacity: 0.55 }} />
          ) : i.kind === "dot" ? (
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />
          ) : i.kind === "dash" ? (
            <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: i.color }} />
          ) : i.kind === "faded" ? (
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: i.color, opacity: 0.35 }} />
          ) : (
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: i.color }} />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Index of the sample nearest to time `tt` on an evenly spaced series. */
export const sampleAt = (t: Float64Array, tt: number) => {
  const n = t.length;
  const step = (t[n - 1] - t[0]) / (n - 1 || 1);
  return Math.max(0, Math.min(n - 1, Math.round((tt - t[0]) / step)));
};

/** Shared horizontal layout for every chart drawn against mission time, so their x axes line up. */
export const TIME_MARGIN = { l: 64, r: 16 };
