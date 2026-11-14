"use client";

import { useState } from "react";
import { fmtUTC } from "@/lib/metrics/format";
import { fmtTick, niceTicks, scale, timeTicks, Tooltip, useWidth } from "./chart-kit";

/** Single-series time chart (battery charge, array power). Title outside names the series. */
export function LineChart(props: {
  t: Float64Array;
  v: Float32Array;
  color: string;
  unit: string;
  min?: number;
  max?: number;
  format?: (v: number) => string;
  ariaLabel: string;
}) {
  const { setRef, w } = useWidth();
  const h = 160;
  const m = { l: 44, r: 12, t: 10, b: 24 };
  const { t, v } = props;
  const n = t.length;
  let lo = props.min ?? Infinity, hi = props.max ?? -Infinity;
  if (props.min === undefined || props.max === undefined) for (let i = 0; i < n; i++) { lo = Math.min(lo, v[i]); hi = Math.max(hi, v[i]); }
  if (hi === lo) hi = lo + 1;
  const x = scale(t[0], t[n - 1], m.l, w - m.r);
  const y = scale(lo, hi, h - m.b, m.t);
  const fmt = props.format ?? ((z: number) => `${z.toFixed(0)} ${props.unit}`);
  const stride = Math.max(1, Math.floor(n / (w - m.l - m.r)));
  let d = "";
  for (let i = 0; i < n; i += stride) d += `${i ? "L" : "M"}${x(t[i]).toFixed(1)},${y(v[i]).toFixed(1)}`;
  const area = `${d} L${x(t[n - 1])},${y(lo)} L${x(t[0])},${y(lo)} Z`;
  const [hover, setHover] = useState<{ x: number; y: number; i: number } | null>(null);
  return (
    <div ref={setRef} className="relative">
      <svg width={w} height={h} role="img" aria-label={props.ariaLabel}>
        {niceTicks(lo, hi, 4).map((z) => (
          <g key={z}>
            <line x1={m.l} x2={w - m.r} y1={y(z)} y2={y(z)} stroke="var(--grid)" />
            <text x={m.l - 6} y={y(z) + 3} textAnchor="end" fontSize={10} fill="var(--muted)">{fmt(z)}</text>
          </g>
        ))}
        {timeTicks(t[0], t[n - 1]).map((z) => (
          <text key={z} x={x(z)} y={h - 6} textAnchor="middle" fontSize={10} fill="var(--muted)">{fmtTick(z)}</text>
        ))}
        <path d={area} fill={props.color} opacity={0.1} />
        <path d={d} fill="none" stroke={props.color} strokeWidth={2} />
        <rect
          x={m.l} y={m.t} width={w - m.l - m.r} height={h - m.t - m.b} fill="transparent"
          onMouseMove={(e) => {
            const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
            const px = e.clientX - r.left + m.l;
            const i = Math.max(0, Math.min(n - 1, Math.round(((x.invert(px) - t[0]) / (t[n - 1] - t[0])) * (n - 1))));
            setHover({ x: px, y: e.clientY - r.top + m.t, i });
          }}
          onMouseLeave={() => setHover(null)}
        />
        {hover && <line x1={x(t[hover.i])} x2={x(t[hover.i])} y1={m.t} y2={h - m.b} stroke="var(--muted)" />}
        {hover && <circle cx={x(t[hover.i])} cy={y(v[hover.i])} r={4} fill={props.color} stroke="var(--panel)" strokeWidth={2} />}
      </svg>
      {hover && (
        <Tooltip x={hover.x} y={hover.y} w={w}>
          <div className="font-medium">{fmtUTC(t[hover.i])}</div>
          <div>{fmt(v[hover.i])}</div>
        </Tooltip>
      )}
    </div>
  );
}
