"use client";

import { useId, useMemo } from "react";
import { CONST } from "@/lib/engine/constants";
import type { Scenario } from "@/lib/engine/scenario";
import type { Interval } from "@/lib/engine/windows";
import { compass, fmtDeg, fmtPct } from "@/lib/metrics/format";
import type { Persona } from "@/lib/persona";
import { AXIS, ChartTip, dayTicks, fmtDay, fmtMissionTime, fmtWhen, Legend, niceTicks, sampleAt, scale, TIME_MARGIN, TipHead, TipRows, usePlotHover, useWidth } from "./chart-kit";

/**
 * A body's elevation over the mission against the terrain horizon in its direction. The terrain is
 * filled like the horizon view (same skyline, traced in time order). The body's line is solid while it
 * counts as visible (sunlit / Earth in view) and faded while hidden. Lanes underneath summarise the
 * usable windows (and DSN coverage for Earth). Hover for exact values; click to move the timeline.
 */
export function BodyTimeline({ sc, body, cursor, onCursor, persona }: { sc: Scenario; body: "sun" | "earth"; cursor: number; onCursor?: (t: number) => void; persona: Persona }) {
  const { setRef, w } = useWidth();
  const uid = useId().replace(/:/g, "");
  const s = sc.series;
  const a = sc.assumptions;
  const isSun = body === "sun";
  const color = isSun ? "var(--sun)" : "var(--earth)";
  const name = isSun ? "Sun" : "Earth";
  const el = isSun ? s.sunEl : s.earthEl;
  const hz = isSun ? s.sunHz : s.earthHz;
  const az = isSun ? s.sunAz : s.earthAz;
  const frac = isSun ? s.sunFrac : s.earthFrac;
  const thr = isSun ? a.sunDiskThreshold : a.earthDiskThreshold;
  const bands: Interval[] = isSun ? sc.windows.sunlit : sc.windows.dte;
  const lanes = isSun
    ? [{ label: "Sunlit", iv: sc.windows.sunlit, color }]
    : [{ label: "In view", iv: sc.windows.dte, color }, { label: "DSN", iv: sc.windows.dsn, color: "var(--muted)" }];

  const plotH = 190;
  const laneH = 14;
  const m = { ...TIME_MARGIN, t: 12, b: 30 + lanes.length * (laneH + 6) };
  const h = m.t + plotH + m.b;
  const n = s.n;
  const t0 = s.t[0], t1 = s.t[n - 1];

  const { lo, hi } = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) {
      lo = Math.min(lo, el[i], hz[i]);
      hi = Math.max(hi, el[i], hz[i]);
    }
    const pad = Math.max(0.3, (hi - lo) * 0.08);
    return { lo: Math.floor(lo - pad), hi: Math.ceil(hi + pad) };
  }, [el, hz, n]);

  const x = scale(t0, t1, m.l, w - m.r);
  const y = scale(lo, hi, m.t + plotH, m.t);
  const plotBottom = m.t + plotH;

  const paths = useMemo(() => {
    const stride = Math.max(1, Math.floor(n / ((w - m.l - m.r) * 1.5)));
    let line = "", ridge = "";
    for (let i = 0; i < n; i += stride) {
      const px = x(s.t[i]).toFixed(1);
      line += `${i ? "L" : "M"}${px},${y(el[i]).toFixed(1)}`;
      ridge += `${i ? "L" : "M"}${px},${y(hz[i]).toFixed(1)}`;
    }
    const lastX = x(s.t[n - 1]).toFixed(1);
    line += `L${lastX},${y(el[n - 1]).toFixed(1)}`;
    ridge += `L${lastX},${y(hz[n - 1]).toFixed(1)}`;
    const ground = `${ridge} L${lastX},${plotBottom} L${x(t0).toFixed(1)},${plotBottom} Z`;
    return { line, ridge, ground };
  }, [n, w, m.l, m.r, x, y, s.t, el, hz, plotBottom, t0]);

  const ticks = dayTicks(t0, t1, w - m.l - m.r);
  const { key: hi_, last, bind } = usePlotHover<number>((px) => (px < m.l - 8 || px > w - m.r + 8 ? null : sampleAt(s.t, x.invert(Math.max(m.l, Math.min(w - m.r, px))))));
  const show = hi_ !== null;
  const i = hi_ ?? last;
  const ci = sampleAt(s.t, cursor);
  const planner = persona === "planner", enthusiast = persona === "enthusiast";

  return (
    <div ref={setRef} className="relative select-none">
      <svg width={w} height={h} role="img" aria-label={`${name} elevation over the mission against the terrain horizon`} {...bind}
        onClick={() => i !== null && onCursor?.(s.t[i])} style={{ cursor: onCursor ? "pointer" : undefined }}>
        <defs>
          <linearGradient id={`g-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--terrain)" stopOpacity="0.95" />
            <stop offset="1" stopColor="var(--terrain)" stopOpacity="0.55" />
          </linearGradient>
          <clipPath id={`c-${uid}`}>
            {bands.map((b, k) => <rect key={k} x={x(b.start)} width={Math.max(1, x(b.end) - x(b.start))} y={0} height={h} />)}
          </clipPath>
        </defs>
        {/* usable windows, behind everything */}
        {bands.map((b, k) => (
          <rect key={k} x={x(b.start)} width={Math.max(1, x(b.end) - x(b.start))} y={m.t} height={plotH} fill={color} opacity={0.07} />
        ))}
        {niceTicks(lo, hi, 4).map((v) => (
          <g key={v}>
            <line x1={m.l} x2={w - m.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
            <text x={m.l - 8} y={y(v) + 4} textAnchor="end" {...AXIS}>{v}°</text>
          </g>
        ))}
        {ticks.minor.map((t) => <line key={t} x1={x(t)} x2={x(t)} y1={m.t} y2={plotBottom} stroke="var(--grid)" strokeOpacity={ticks.major.includes(t) ? 1 : 0.5} />)}
        {/* 0° = the smooth-sphere horizontal */}
        {lo < 0 && hi > 0 && <line x1={m.l} x2={w - m.r} y1={y(0)} y2={y(0)} stroke="var(--faint)" strokeDasharray="2 4" />}
        <path d={paths.ground} fill={`url(#g-${uid})`} />
        <path d={paths.ridge} fill="none" stroke="var(--muted)" strokeOpacity={0.55} strokeWidth={1} />
        <path d={paths.line} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={1.75} strokeDasharray="3 3" />
        <path d={paths.line} fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" clipPath={`url(#c-${uid})`} />
        {/* selected time on the page timeline */}
        <line x1={x(cursor)} x2={x(cursor)} y1={m.t - 4} y2={plotBottom} stroke="var(--fg)" strokeWidth={1.25} />
        <circle cx={x(cursor)} cy={y(el[ci])} r={4.5} fill={color} stroke="var(--bg)" strokeWidth={1.5} />
        {/* lanes */}
        {lanes.map((ln, k) => {
          const ly = plotBottom + 8 + k * (laneH + 6);
          return (
            <g key={ln.label}>
              <text x={m.l - 8} y={ly + laneH - 2} textAnchor="end" fontSize={14} fill="var(--muted)">{ln.label}</text>
              <rect x={m.l} y={ly} width={w - m.l - m.r} height={laneH} fill="var(--panel-2)" />
              {ln.iv.map((b, j) => (
                <rect key={j} x={x(b.start)} width={Math.max(1.5, x(b.end) - x(b.start))} y={ly} height={laneH} fill={ln.color} opacity={k ? 0.6 : 0.85} />
              ))}
            </g>
          );
        })}
        {ticks.major.map((t) => (
          <text key={t} x={x(t)} y={h - 6} textAnchor={x(t) > w - m.r - 24 ? "end" : "middle"} {...AXIS}>{fmtDay(t)}</text>
        ))}
        {/* hover guide, never intercepts the pointer */}
        {i !== null && (
          <g pointerEvents="none" opacity={show ? 1 : 0} className="motion-safe:transition-opacity">
            <line x1={x(s.t[i])} x2={x(s.t[i])} y1={m.t} y2={h - m.b + lanes.length * (laneH + 6) + 6} stroke="var(--muted)" strokeDasharray="3 3" />
            <circle cx={x(s.t[i])} cy={y(hz[i])} r={3.5} fill="var(--terrain)" stroke="var(--fg)" strokeWidth={1} />
            <circle cx={x(s.t[i])} cy={y(el[i])} r={5} fill={color} stroke="var(--bg)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {i !== null && (
        <ChartTip x={x(s.t[i])} w={w} show={show}>
          <TipHead title={fmtWhen(s.t[i])} sub={fmtMissionTime(s.t[i], t0)} />
          {enthusiast ? (
            <p className="mt-1.5 text-muted">
              {frac[i] >= thr ? `${name} is ${isSun ? "up and lighting the site" : "above the hills: you could call home"}.` : frac[i] > 0 ? `${name} is peeking over the hills, but mostly hidden.` : `${name} is hidden behind the hills.`}
              {" "}It is <span className="num text-fg">{fmtDeg(Math.abs(el[i]), 1)}</span> {el[i] >= 0 ? "above" : "below"} flat ground; the hills in that direction rise to <span className="num text-fg">{fmtDeg(hz[i], 1)}</span>.
            </p>
          ) : (
            <TipRows rows={[
              [`${name} elevation`, fmtDeg(el[i], planner ? 3 : 2)],
              ["Terrain horizon", fmtDeg(hz[i], planner ? 3 : 2)],
              ["Clearance", `${el[i] - hz[i] >= 0 ? "+" : ""}${fmtDeg(el[i] - hz[i], planner ? 3 : 2)}`, el[i] - hz[i] >= 0 ? "text-good" : "text-critical"],
              ["Direction", `${fmtDeg(az[i], 1)} ${compass(az[i])}`],
              ["Disk visible", fmtPct(frac[i], 1)],
              ["Status", frac[i] >= thr ? (isSun ? "Sunlit" : "In view") : frac[i] > 0 ? `Below ${Math.round(thr * 100)}% threshold` : "Hidden", frac[i] >= thr ? "text-good" : "text-muted"],
              !isSun && ["DSN complexes", `${s.dsnCount[i]} of 3 see the Moon`],
              !isSun && planner && ["Distance", `${Math.round(s.earthKm[i]).toLocaleString("en-US")} km`],
              !isSun && planner && ["One-way light time", `${(s.earthKm[i] / CONST.cKmS).toFixed(3)} s`],
              isSun && planner && ["Sun distance", `${s.sunAU[i].toFixed(5)} AU`],
            ]} />
          )}
          {onCursor && <div className="mt-2 border-t border-line pt-1.5 text-faint">Click to move the timeline here</div>}
        </ChartTip>
      )}
      <Legend items={[
        { label: enthusiast ? `${name} (visible)` : `${name} elevation, ${isSun ? "sunlit" : "in view"}`, color },
        { label: enthusiast ? `${name} (hidden)` : `${name} elevation, hidden`, color, kind: "faded" },
        { label: enthusiast ? "Hills in that direction" : `Terrain horizon toward the ${name}`, color: "var(--terrain)", kind: "area" },
        { label: "Selected time", color: "var(--fg)" },
      ]} />
    </div>
  );
}
