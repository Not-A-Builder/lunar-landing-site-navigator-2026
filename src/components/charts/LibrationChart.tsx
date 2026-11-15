"use client";

import { useId, useMemo } from "react";
import type { Scenario } from "@/lib/engine/scenario";
import { horizonAt } from "@/lib/engine/terrain";
import { compass, fmtDeg, fmtPct } from "@/lib/metrics/format";
import type { Persona } from "@/lib/persona";
import { AXIS, ChartTip, fmtMissionTime, fmtWhen, Legend, niceTicks, scale, TipHead, TipRows, usePlotHover, useWidth } from "./chart-kit";

/**
 * Earth's position in the site's sky over the mission. Without libration Earth would sit still; the
 * loop is the libration seen from this spot. The terrain shows where it gets hidden. Azimuth runs right
 * to left, matching the horizon view (D-086). Hover snaps to the nearest point on the loop.
 */
export function LibrationChart({ sc, cursor, persona, onCursor }: { sc: Scenario; cursor: number; persona: Persona; onCursor?: (t: number) => void }) {
  const { setRef, w } = useWidth(360);
  const uid = useId().replace(/:/g, "");
  const h = 300;
  const m = { l: 64, r: 16, t: 14, b: 36 };
  const s = sc.series;
  const planner = persona === "planner", enthusiast = persona === "enthusiast";

  // Earth often sits near north (0°/360°): unwrap so the loop doesn't split across the chart edges.
  const wrap = useMemo(() => {
    let lo = 360, hi = 0;
    for (let i = 0; i < s.n; i++) { lo = Math.min(lo, s.earthAz[i]); hi = Math.max(hi, s.earthAz[i]); }
    return hi - lo > 180;
  }, [s]);
  const U = (v: number) => (wrap && v < 180 ? v + 360 : v);
  const ext = useMemo(() => {
    let azMin = 720, azMax = -360, elMin = 90, elMax = -90;
    for (let i = 0; i < s.n; i++) {
      const az = wrap && s.earthAz[i] < 180 ? s.earthAz[i] + 360 : s.earthAz[i];
      azMin = Math.min(azMin, az); azMax = Math.max(azMax, az);
      elMin = Math.min(elMin, s.earthEl[i], s.earthHz[i]); elMax = Math.max(elMax, s.earthEl[i], s.earthHz[i]);
    }
    const padAz = Math.max(1, (azMax - azMin) * 0.12);
    return { az0: azMin - padAz, az1: azMax + padAz, el0: Math.floor(elMin - 0.6), el1: Math.ceil(elMax + 0.6) };
  }, [s, wrap]);

  const x = scale(ext.az1, ext.az0, m.l, w - m.r);
  const y = scale(ext.el0, ext.el1, h - m.b, m.t);

  const paths = useMemo(() => {
    let loop = "";
    for (let i = 0; i < s.n; i += 2) loop += `${i ? "L" : "M"}${x(U(s.earthAz[i])).toFixed(1)},${y(s.earthEl[i]).toFixed(1)}`;
    const st = sc.mask.stepDeg;
    const k0 = Math.floor(ext.az0 / st), k1 = Math.ceil(ext.az1 / st);
    let ridge = "";
    for (let k = k0; k <= k1; k++) {
      const len = sc.mask.elev.length;
      const e = sc.mask.elev[((k % len) + len) % len];
      ridge += `${k === k0 ? "M" : "L"}${x(k * st).toFixed(1)},${y(e).toFixed(1)}`;
    }
    const fill = `${ridge} L${x(k1 * st)},${h - m.b} L${x(k0 * st)},${h - m.b} Z`;
    return { loop, ridge, fill };
  }, [s, sc.mask, ext, x, y, h, m.b]); // eslint-disable-line react-hooks/exhaustive-deps

  const ci = Math.max(0, Math.min(s.n - 1, Math.round((cursor - s.t[0]) / s.stepMs)));
  const up = s.earthFrac[ci] >= sc.assumptions.earthDiskThreshold;

  const { key, last, bind } = usePlotHover<number>((px, py) => {
    if (px < m.l - 8 || px > w - m.r + 8 || py < m.t - 8 || py > h - m.b + 8) return null;
    let best = 0, bd = Infinity;
    for (let i = 0; i < s.n; i++) {
      const d = (x(U(s.earthAz[i])) - px) ** 2 + (y(s.earthEl[i]) - py) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  });
  const i = key ?? last;
  const show = key !== null;

  return (
    <div ref={setRef} className="relative select-none">
      <svg width={w} height={h} role="img" aria-label="Earth's path in the sky from this site over the mission" {...bind}
        onClick={() => i !== null && onCursor?.(s.t[i])} style={{ cursor: onCursor ? "pointer" : undefined }}>
        <defs>
          <clipPath id={`lib-${uid}`}><rect x={m.l} y={m.t} width={w - m.l - m.r} height={h - m.t - m.b} /></clipPath>
          <linearGradient id={`lt-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--terrain)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--terrain)" stopOpacity="0.65" />
          </linearGradient>
        </defs>
        {niceTicks(ext.el0, ext.el1, 4).map((v) => (
          <g key={v}>
            <line x1={m.l} x2={w - m.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
            <text x={m.l - 8} y={y(v) + 4} textAnchor="end" {...AXIS}>{v}°</text>
          </g>
        ))}
        {niceTicks(ext.az0, ext.az1, 5).map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={m.t} y2={h - m.b} stroke="var(--grid)" strokeOpacity={0.6} />
            <text x={x(v)} y={h - 12} textAnchor="middle" {...AXIS}>{((v % 360) + 360) % 360}° {compass(((v % 360) + 360) % 360)}</text>
          </g>
        ))}
        <g clipPath={`url(#lib-${uid})`}>
          <path d={paths.loop} fill="none" stroke="var(--earth)" strokeWidth={2} strokeLinejoin="round" />
          <circle cx={x(U(s.earthAz[ci]))} cy={y(s.earthEl[ci])} r={7} fill="var(--earth)" />
          <path d={paths.fill} fill={`url(#lt-${uid})`} />
          <path d={paths.ridge} fill="none" stroke="var(--muted)" strokeOpacity={0.6} strokeWidth={1.25} />
        </g>
        <text x={x(U(s.earthAz[ci]))} y={Math.max(14, y(s.earthEl[ci]) - 13)} textAnchor="middle" fontSize={14} fontWeight={600} fill="var(--earth)" stroke="var(--bg)" strokeWidth={3} paintOrder="stroke" pointerEvents="none">
          Earth{up ? "" : " · hidden"}
        </text>
        {i !== null && (
          <g pointerEvents="none" opacity={show ? 1 : 0} className="motion-safe:transition-opacity">
            <circle cx={x(U(s.earthAz[i]))} cy={y(s.earthEl[i])} r={5.5} fill="var(--earth)" stroke="var(--fg)" strokeWidth={1.5} />
          </g>
        )}
      </svg>
      {i !== null && (
        <ChartTip x={x(U(s.earthAz[i]))} w={w} show={show}>
          <TipHead title={fmtWhen(s.t[i])} sub={fmtMissionTime(s.t[i], s.t[0])} />
          {enthusiast ? (
            <p className="mt-1.5 text-muted">Earth is <span className="num text-fg">{fmtDeg(Math.abs(s.earthEl[i]), 1)}</span> {s.earthEl[i] >= 0 ? "above" : "below"} flat ground, toward the {compass(s.earthAz[i])}. {s.earthFrac[i] > 0 ? "You can see it over the hills." : "It is behind the hills."}</p>
          ) : (
            <TipRows rows={[
              ["Azimuth", `${fmtDeg(s.earthAz[i], planner ? 3 : 2)} ${compass(s.earthAz[i])}`],
              ["Elevation", fmtDeg(s.earthEl[i], planner ? 3 : 2)],
              ["Terrain there", fmtDeg(horizonAt(sc.mask, s.earthAz[i]), planner ? 3 : 2)],
              ["Disk visible", fmtPct(s.earthFrac[i], 1)],
              ["Sub-Earth longitude", fmtDeg(s.libLon[i], planner ? 3 : 2)],
              ["Sub-Earth latitude", fmtDeg(s.libLat[i], planner ? 3 : 2)],
            ]} />
          )}
          {onCursor && <div className="mt-2 border-t border-line pt-1.5 text-faint">Click to move the timeline here</div>}
        </ChartTip>
      )}
      <Legend items={[
        { label: enthusiast ? "Earth's wobble this mission" : "Earth's track this mission", color: "var(--earth)" },
        { label: enthusiast ? "Hills in that direction" : "Terrain horizon (LOLA)", color: "var(--terrain)", kind: "area" },
        { label: "Earth at the selected time", color: "var(--earth)", kind: "dot" },
      ]} />
    </div>
  );
}
