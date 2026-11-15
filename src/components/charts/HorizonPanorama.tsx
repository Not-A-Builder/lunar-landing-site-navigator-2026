"use client";

import { useId, useMemo } from "react";
import type { Scenario } from "@/lib/engine/scenario";
import { horizonAt } from "@/lib/engine/terrain";
import { compass, fmtDeg, fmtPct } from "@/lib/metrics/format";
import type { Persona } from "@/lib/persona";
import { AXIS, ChartTip, fmtWhen, Legend, niceTicks, scale, TipHead, TipRows, usePlotHover, useWidth } from "./chart-kit";

/**
 * 360° skyline from the site: LOLA terrain horizon plus the paths the Sun and Earth trace during the
 * mission, with both bodies drawn at the selected time.
 *
 * Azimuth runs right-to-left (N 360° → W → S → E → N 0°), D-086. At the south pole the Sun moves
 * toward lower azimuth as time passes, so reading this chart left to right meets the terrain in the
 * same order as the Sun and Earth timelines below it, which run left to right in time.
 *
 * Bodies and paths are drawn under a slightly translucent terrain, so a body behind a hill is
 * occluded exactly as it would be, and a partly hidden Sun shows only the part above the skyline.
 */
export function HorizonPanorama({ sc, cursor, persona, distKm, distStepDeg }: { sc: Scenario; cursor: number; persona: Persona; distKm?: number[]; distStepDeg?: number }) {
  const { setRef, w } = useWidth();
  const uid = useId().replace(/:/g, "");
  const enthusiast = persona === "enthusiast", planner = persona === "planner";
  const h = enthusiast ? 280 : 320;
  const m = { l: 64, r: 16, t: 26, b: 36 };
  const s = sc.series;
  const a = sc.assumptions;

  const { yMin, yMax } = useMemo(() => {
    let lo = Math.min(...sc.mask.elev), hi = Math.max(...sc.mask.elev);
    for (let i = 0; i < s.n; i++) {
      lo = Math.min(lo, s.sunEl[i], s.earthEl[i]);
      hi = Math.max(hi, s.sunEl[i], s.earthEl[i]);
    }
    return { yMin: Math.floor(lo - 0.6), yMax: Math.ceil(hi + 1) };
  }, [sc, s]);

  const x = scale(360, 0, m.l, w - m.r);
  const y = scale(yMin, yMax, h - m.b, m.t);
  const bottom = h - m.b;

  const terrain = useMemo(() => {
    const pts = sc.mask.elev.map((e, k) => `${x(k * sc.mask.stepDeg).toFixed(1)},${y(e).toFixed(1)}`);
    const ridge = `M${pts.join(" L")} L${x(360).toFixed(1)},${y(sc.mask.elev[0]).toFixed(1)}`;
    return { ridge, fill: `${ridge} L${x(360)},${bottom} L${x(0)},${bottom} Z` };
  }, [sc.mask, x, y, bottom]);

  const track = (az: Float32Array, el: Float32Array) => {
    const segs: string[] = [];
    let cur = "";
    for (let i = 0; i < s.n; i += 2) {
      if (i > 0 && Math.abs(az[i] - az[i - 2]) > 180) {
        segs.push(cur);
        cur = "";
      }
      cur += `${cur ? "L" : "M"}${x(az[i]).toFixed(1)},${y(el[i]).toFixed(1)}`;
    }
    segs.push(cur);
    return segs.join(" ");
  };
  const sunTrack = useMemo(() => track(s.sunAz, s.sunEl), [s, w, yMin, yMax]); // eslint-disable-line react-hooks/exhaustive-deps
  const earthTrack = useMemo(() => track(s.earthAz, s.earthEl), [s, w, yMin, yMax]); // eslint-disable-line react-hooks/exhaustive-deps

  const ci = Math.max(0, Math.min(s.n - 1, Math.round((cursor - s.t[0]) / s.stepMs)));
  const pxPerDegY = Math.abs(y(1) - y(0));
  const sunR = Math.max(6, 0.27 * pxPerDegY);
  const earthR = Math.max(7, 0.95 * pxPerDegY);
  const sunLit = s.sunFrac[ci] >= a.sunDiskThreshold;
  const earthUp = s.earthFrac[ci] >= a.earthDiskThreshold;

  /** Times during the mission when a body passes this azimuth (one per pass, within half a degree). */
  const passes = (az: Float32Array, target: number) => {
    const out: number[] = [];
    let inPass = false, best = -1, bd = 9;
    for (let i = 0; i < s.n; i++) {
      const d = Math.abs(((az[i] - target + 540) % 360) - 180);
      if (d < 0.5) {
        inPass = true;
        if (d < bd) { bd = d; best = i; }
      } else if (inPass) {
        out.push(best);
        inPass = false; best = -1; bd = 9;
      }
    }
    if (inPass && best >= 0) out.push(best);
    return out;
  };

  const step = 0.5;
  const { key, last, bind } = usePlotHover<number>((px) => (px < m.l - 8 || px > w - m.r + 8 ? null : Math.round(Math.max(0, Math.min(360, x.invert(Math.max(m.l, Math.min(w - m.r, px))))) / step) * step));
  const hAz = key ?? last;
  const show = key !== null;
  const hover = useMemo(() => {
    if (hAz === null) return null;
    const hzEl = horizonAt(sc.mask, hAz);
    const k = distKm && distStepDeg ? Math.round(hAz / distStepDeg) % distKm.length : -1;
    return { az: hAz, hz: hzEl, dist: k >= 0 ? distKm![k] : null, sun: passes(s.sunAz, hAz).slice(0, 3), earth: passes(s.earthAz, hAz).slice(0, 3) };
  }, [hAz, sc, s, distKm, distStepDeg]); // eslint-disable-line react-hooks/exhaustive-deps

  const compassTicks = [360, 315, 270, 225, 180, 135, 90, 45, 0];
  const NAMES: Record<number, string> = { 0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW", 360: "N" };

  return (
    <div ref={setRef} className="relative select-none">
      <svg width={w} height={h} role="img" aria-label="Horizon panorama: terrain skyline with the Sun and Earth paths" {...bind}>
        <defs>
          <linearGradient id={`sky-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--panel-2)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--panel-2)" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id={`ter-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--terrain)" stopOpacity="0.96" />
            <stop offset="1" stopColor="var(--terrain)" stopOpacity="0.7" />
          </linearGradient>
          <radialGradient id={`glow-${uid}`}>
            <stop offset="0.35" stopColor="var(--sun)" stopOpacity="0.45" />
            <stop offset="1" stopColor="var(--sun)" stopOpacity="0" />
          </radialGradient>
          <clipPath id={`plot-${uid}`}><rect x={m.l} y={m.t - 20} width={w - m.l - m.r} height={h - m.t - m.b + 20} /></clipPath>
        </defs>
        <rect x={m.l} y={m.t} width={w - m.l - m.r} height={bottom - m.t} fill={`url(#sky-${uid})`} />
        {niceTicks(yMin, yMax, 5).map((v) => (
          <g key={v}>
            <line x1={m.l} x2={w - m.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
            <text x={m.l - 8} y={y(v) + 4} textAnchor="end" {...AXIS}>{v}°</text>
          </g>
        ))}
        {compassTicks.map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={m.t} y2={bottom} stroke="var(--grid)" strokeOpacity={v % 90 ? 0.5 : 1} />
            <text x={x(v)} y={h - 12} textAnchor={v === 360 ? "start" : v === 0 ? "end" : "middle"} {...AXIS} fill={v % 90 ? "var(--faint)" : "var(--muted)"}>
              {v % 90 ? NAMES[v] : `${NAMES[v]} ${v}°`}
            </text>
          </g>
        ))}
        {yMin < 0 && <line x1={m.l} x2={w - m.r} y1={y(0)} y2={y(0)} stroke="var(--faint)" strokeDasharray="2 4" />}
        <g clipPath={`url(#plot-${uid})`}>
          <path d={sunTrack} fill="none" stroke="var(--sun)" strokeWidth={2} strokeLinecap="round" strokeOpacity={0.9} />
          <path d={earthTrack} fill="none" stroke="var(--earth)" strokeWidth={2} strokeLinecap="round" strokeOpacity={0.9} />
          {sunLit && <circle cx={x(s.sunAz[ci])} cy={y(s.sunEl[ci])} r={sunR * 2.6} fill={`url(#glow-${uid})`} />}
          <circle cx={x(s.sunAz[ci])} cy={y(s.sunEl[ci])} r={sunR} fill="var(--sun)" />
          <circle cx={x(s.earthAz[ci])} cy={y(s.earthEl[ci])} r={earthR} fill="var(--earth)" />
          <path d={terrain.fill} fill={`url(#ter-${uid})`} />
          <path d={terrain.ridge} fill="none" stroke="var(--muted)" strokeOpacity={0.6} strokeWidth={1.25} />
        </g>
        {/* body labels sit above everything so they read even when the body is hidden */}
        <BodyLabel x={x(s.sunAz[ci])} y={y(s.sunEl[ci]) - sunR - 7} color="var(--sun)" text={`Sun${sunLit ? "" : s.sunFrac[ci] > 0 ? " · partly hidden" : " · hidden"}`} w={w} />
        <BodyLabel x={x(s.earthAz[ci])} y={y(s.earthEl[ci]) - earthR - 7} color="var(--earth)" text={`Earth${earthUp ? "" : s.earthFrac[ci] > 0 ? " · partly hidden" : " · hidden"}`} w={w} />
        {hover && (
          <g pointerEvents="none" opacity={show ? 1 : 0} className="motion-safe:transition-opacity">
            <line x1={x(hover.az)} x2={x(hover.az)} y1={m.t} y2={bottom} stroke="var(--muted)" strokeDasharray="3 3" />
            <circle cx={x(hover.az)} cy={y(hover.hz)} r={4} fill="var(--terrain)" stroke="var(--fg)" strokeWidth={1.25} />
          </g>
        )}
      </svg>
      {hover && (
        <ChartTip x={x(hover.az)} w={w} show={show} width={300}>
          <TipHead title={`Looking ${compass(hover.az)} · azimuth ${hover.az.toFixed(1)}°`} />
          {enthusiast ? (
            <p className="mt-1.5 text-muted">
              The hills here rise <span className="num text-fg">{fmtDeg(hover.hz, 1)}</span> above flat ground{hover.dist !== null ? <>, <span className="num text-fg">{hover.dist.toFixed(1)} km</span> away</> : null}.
              {hover.sun.length ? <> The Sun passes this way on <span className="num text-fg">{fmtWhen(s.t[hover.sun[0]]).split(",")[0]}</span>{s.sunFrac[hover.sun[0]] > 0 ? ", above the hills." : ", but behind them."}</> : " The Sun doesn't pass this way during the mission."}
            </p>
          ) : (
            <>
              <TipRows rows={[
                ["Terrain horizon", fmtDeg(hover.hz, planner ? 3 : 2)],
                hover.dist !== null && ["Skyline terrain at", `${hover.dist.toFixed(1)} km`],
              ]} />
              <PassList label="Sun passes" color="var(--sun)" idx={hover.sun} el={s.sunEl} frac={s.sunFrac} t={s.t} digits={planner ? 3 : 2} />
              <PassList label="Earth passes" color="var(--earth)" idx={hover.earth} el={s.earthEl} frac={s.earthFrac} t={s.t} digits={planner ? 3 : 2} />
            </>
          )}
        </ChartTip>
      )}
      <Legend items={[
        { label: enthusiast ? "Hills and crater rims" : "Terrain horizon (LOLA)", color: "var(--terrain)", kind: "area" },
        { label: "Sun's path this mission", color: "var(--sun)" },
        { label: "Earth's path this mission", color: "var(--earth)" },
        { label: "Sun and Earth at the selected time", color: "var(--fg)", kind: "dot" },
      ]} />
      <p className="mt-1.5 text-xs text-faint">
        {enthusiast
          ? "Read it like a photo taken by turning on the spot. Anything under the grey skyline is hidden behind hills."
          : "Compass reads right to left, so left-to-right matches the order the Sun meets the terrain over time (as in the charts below). Paths and bodies behind the terrain show through faintly."}
      </p>
    </div>
  );
}

function BodyLabel({ x, y, color, text, w }: { x: number; y: number; color: string; text: string; w: number }) {
  const anchor = x < 90 ? "start" : x > w - 90 ? "end" : "middle";
  return (
    <text x={x} y={Math.max(14, y)} textAnchor={anchor} fontSize={14} fontWeight={600} fill={color} stroke="var(--bg)" strokeWidth={3} paintOrder="stroke" pointerEvents="none">
      {text}
    </text>
  );
}

function PassList({ label, color, idx, el, frac, t, digits }: { label: string; color: string; idx: number[]; el: Float32Array; frac: Float32Array; t: Float64Array; digits: number }) {
  return (
    <div className="mt-2 border-t border-line pt-1.5">
      <div className="flex items-center gap-1.5 text-muted"><span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />{label}</div>
      {idx.length === 0 ? (
        <div className="text-faint">Not this way during the mission</div>
      ) : (
        idx.map((i) => (
          <div key={i} className="num flex justify-between gap-2">
            <span>{new Date(t[i]).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} {new Date(t[i]).toISOString().slice(11, 16)} UTC</span>
            <span className={frac[i] > 0 ? "text-fg" : "text-faint"}>{fmtDeg(el[i], digits)} · {frac[i] > 0 ? `${fmtPct(frac[i])} visible` : "hidden"}</span>
          </div>
        ))
      )}
    </div>
  );
}
