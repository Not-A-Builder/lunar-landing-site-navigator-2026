"use client";

import { useMemo, useState } from "react";
import type { Interval } from "@/lib/engine/windows";
import { fmtDeg, fmtPct, fmtUTC } from "@/lib/metrics/format";
import { fmtTick, Legend, niceTicks, scale, timeTicks, Tooltip, useWidth } from "./chart-kit";

/**
 * Elevation of a body over time against the terrain horizon in its direction. Shaded bands mark
 * when it is usable (sunlit / Earth in view); optional second band row (e.g. DSN coverage).
 */
export function BodyTimeline(props: {
  label: string;
  color: string;
  t: Float64Array;
  el: Float32Array;
  hz: Float32Array;
  frac: Float32Array;
  bands: Interval[];
  bandLabel: string;
  bands2?: Interval[];
  band2Label?: string;
  cursor: number;
  onCursor?: (t: number) => void;
}) {
  const { setRef, w } = useWidth();
  const h = 200;
  const m = { l: 40, r: 12, t: 10, b: 38 };
  const { t, el, hz, frac } = props;
  const n = t.length;
  const t0 = t[0], t1 = t[n - 1];
  const [hover, setHover] = useState<{ x: number; y: number; i: number } | null>(null);

  const { lo, hi } = useMemo(() => {
    let lo = 99, hi = -99;
    for (let i = 0; i < n; i++) {
      lo = Math.min(lo, el[i], hz[i]);
      hi = Math.max(hi, el[i], hz[i]);
    }
    return { lo: Math.floor(lo - 0.3), hi: Math.ceil(hi + 0.3) };
  }, [el, hz, n]);

  const x = scale(t0, t1, m.l, w - m.r);
  const y = scale(lo, hi, h - m.b, m.t);
  const line = (arr: Float32Array) => {
    let d = "";
    const stride = Math.max(1, Math.floor(n / (w - m.l - m.r)));
    for (let i = 0; i < n; i += stride) d += `${i ? "L" : "M"}${x(t[i]).toFixed(1)},${y(arr[i]).toFixed(1)}`;
    return d;
  };
  const bandY = h - m.b + 6;

  return (
    <div ref={setRef} className="relative">
      <svg width={w} height={h} role="img" aria-label={`${props.label} elevation over time`}>
        {props.bands.map((b, k) => (
          <rect key={k} x={x(b.start)} width={Math.max(1, x(b.end) - x(b.start))} y={m.t} height={h - m.t - m.b} fill={props.color} opacity={0.1} />
        ))}
        {niceTicks(lo, hi, 4).map((v) => (
          <g key={v}>
            <line x1={m.l} x2={w - m.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth={1} />
            <text x={m.l - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--muted)">{v}°</text>
          </g>
        ))}
        {timeTicks(t0, t1).map((v) => (
          <text key={v} x={x(v)} y={h - 4} textAnchor="middle" fontSize={10} fill="var(--muted)">{fmtTick(v)}</text>
        ))}
        <path d={line(hz)} fill="none" stroke="var(--terrain)" strokeWidth={2} />
        <path d={line(el)} fill="none" stroke={props.color} strokeWidth={2} strokeLinejoin="round" />
        {props.bands.map((b, k) => (
          <rect key={`b${k}`} x={x(b.start)} width={Math.max(1.5, x(b.end) - x(b.start))} y={bandY} height={5} rx={2} fill={props.color} />
        ))}
        {props.bands2?.map((b, k) => (
          <rect key={`c${k}`} x={x(b.start)} width={Math.max(1.5, x(b.end) - x(b.start))} y={bandY + 8} height={4} rx={2} fill="var(--muted)" />
        ))}
        <line x1={x(props.cursor)} x2={x(props.cursor)} y1={m.t} y2={h - m.b} stroke="var(--fg)" strokeWidth={1} />
        <rect
          x={m.l} y={m.t} width={w - m.l - m.r} height={h - m.t - m.b + 20} fill="transparent" style={{ cursor: props.onCursor ? "pointer" : "default" }}
          onMouseMove={(e) => {
            const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
            const px = e.clientX - r.left + m.l;
            const tt = x.invert(px);
            const i = Math.max(0, Math.min(n - 1, Math.round(((tt - t0) / (t1 - t0)) * (n - 1))));
            setHover({ x: px, y: e.clientY - r.top + m.t, i });
          }}
          onMouseLeave={() => setHover(null)}
          onClick={() => hover && props.onCursor?.(t[hover.i])}
        />
        {hover && <line x1={x(t[hover.i])} x2={x(t[hover.i])} y1={m.t} y2={h - m.b} stroke="var(--muted)" strokeWidth={1} />}
        {hover && <circle cx={x(t[hover.i])} cy={y(el[hover.i])} r={4} fill={props.color} stroke="var(--panel)" strokeWidth={2} />}
      </svg>
      {hover && (
        <Tooltip x={hover.x} y={hover.y} w={w}>
          <div className="font-medium">{fmtUTC(t[hover.i])}</div>
          <div>{props.label} elevation {fmtDeg(el[hover.i], 2)}</div>
          <div className="text-muted">Terrain in that direction {fmtDeg(hz[hover.i], 2)}</div>
          <div>{fmtPct(frac[hover.i])} of disk visible</div>
          {props.onCursor && <div className="mt-1 text-muted">Click to move the time cursor here</div>}
        </Tooltip>
      )}
      <Legend items={[
        { label: `${props.label} elevation`, color: props.color },
        { label: "Terrain horizon in that direction", color: "var(--terrain)" },
        { label: props.bandLabel, color: props.color, kind: "area" },
        ...(props.bands2 && props.band2Label ? [{ label: props.band2Label, color: "var(--muted)", kind: "area" as const }] : []),
      ]} />
    </div>
  );
}
