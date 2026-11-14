"use client";

import { useMemo, useState } from "react";
import type { Scenario } from "@/lib/engine/scenario";
import { horizonAt } from "@/lib/engine/terrain";
import { compass, fmtDeg, fmtUTC } from "@/lib/metrics/format";
import { Legend, niceTicks, scale, Tooltip, useWidth } from "./chart-kit";

/**
 * 360° skyline from the site: LOLA terrain horizon (filled), plus the paths the Sun and Earth trace
 * during the mission. Markers show positions at the selected time.
 */
export function HorizonPanorama({ sc, cursor, simple }: { sc: Scenario; cursor: number; simple?: boolean }) {
  const { setRef, w } = useWidth();
  const h = simple ? 220 : 260;
  const m = { l: 58, r: 12, t: 12, b: 34 };
  const s = sc.series;
  const [hover, setHover] = useState<{ x: number; y: number; az: number } | null>(null);

  const { yMin, yMax } = useMemo(() => {
    let lo = Math.min(...sc.mask.elev), hi = Math.max(...sc.mask.elev);
    for (let i = 0; i < s.n; i++) {
      lo = Math.min(lo, s.sunEl[i], s.earthEl[i]);
      hi = Math.max(hi, s.sunEl[i], s.earthEl[i]);
    }
    return { yMin: Math.floor(lo - 0.5), yMax: Math.ceil(hi + 0.5) };
  }, [sc, s]);

  const x = scale(0, 360, m.l, w - m.r);
  const y = scale(yMin, yMax, h - m.b, m.t);
  const terrainPath = useMemo(() => {
    const pts = sc.mask.elev.map((e, k) => `${x(k * sc.mask.stepDeg).toFixed(1)},${y(e).toFixed(1)}`);
    return `M${x(0)},${h - m.b} L${pts.join(" L")} L${x(360)},${y(sc.mask.elev[0])} L${x(360)},${h - m.b} Z`;
  }, [sc.mask, x, y, h, m.b]);

  const track = (az: Float32Array, el: Float32Array) => {
    const segs: string[] = [];
    let cur = "";
    for (let i = 0; i < s.n; i += 2) {
      const px = x(az[i]), py = y(el[i]);
      if (i > 0 && Math.abs(az[i] - az[i - 2]) > 180) {
        segs.push(cur);
        cur = "";
      }
      cur += `${cur ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`;
    }
    segs.push(cur);
    return segs.join(" ");
  };

  const ci = Math.max(0, Math.min(s.n - 1, Math.round((cursor - s.t[0]) / s.stepMs)));
  const sunR = Math.max(4, Math.abs(y(0.27) - y(0)));
  const earthR = Math.max(5, Math.abs(y(0.95) - y(0)));
  const yTicks = niceTicks(yMin, yMax, 5);

  const nearest = (az: number) => {
    let best = -1, bd = 999;
    for (let i = 0; i < s.n; i += 3) {
      const d = Math.abs(((s.sunAz[i] - az + 540) % 360) - 180);
      if (d < bd) { bd = d; best = i; }
    }
    return bd < 3 ? best : -1;
  };

  return (
    <div ref={setRef} className="relative">
      <svg width={w} height={h} role="img" aria-label="Horizon panorama with Sun and Earth paths">
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={w - m.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth={1} />
            <text x={m.l - 6} y={y(v) + 3} textAnchor="end" fontSize={14} fontFamily="var(--font-plex-mono)" fill="var(--muted)">{v}°</text>
          </g>
        ))}
        {[0, 90, 180, 270, 360].map((v) => (
          <text key={v} x={x(v)} y={h - 10} textAnchor={v === 0 ? "start" : v === 360 ? "end" : "middle"} fontSize={14} fontFamily="var(--font-plex-mono)" fill="var(--muted)">
            {["N", "E", "S", "W", "N"][v / 90]} {v}°
          </text>
        ))}
        <line x1={m.l} x2={w - m.r} y1={y(0)} y2={y(0)} stroke="var(--faint)" strokeWidth={1} />
        <path d={track(s.sunAz, s.sunEl)} fill="none" stroke="var(--sun)" strokeWidth={2} strokeLinecap="round" opacity={0.85} />
        <path d={track(s.earthAz, s.earthEl)} fill="none" stroke="var(--earth)" strokeWidth={2} strokeLinecap="round" opacity={0.85} />
        <path d={terrainPath} fill="var(--terrain)" fillOpacity={0.9} />
        {/* hidden bodies are drawn as faded outlines so they never look visible */}
        <circle cx={x(s.sunAz[ci])} cy={y(s.sunEl[ci])} r={sunR} fill="var(--sun)" fillOpacity={s.sunFrac[ci] > 0 ? 1 : 0.15} stroke={s.sunFrac[ci] > 0 ? "var(--panel)" : "var(--sun)"} strokeWidth={2} />
        <circle cx={x(s.earthAz[ci])} cy={y(s.earthEl[ci])} r={earthR} fill="var(--earth)" fillOpacity={s.earthFrac[ci] > 0 ? 1 : 0.15} stroke={s.earthFrac[ci] > 0 ? "var(--panel)" : "var(--earth)"} strokeWidth={2} />
        <rect
          x={m.l} y={m.t} width={w - m.l - m.r} height={h - m.t - m.b} fill="transparent"
          onMouseMove={(e) => {
            const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
            const px = e.clientX - r.left + m.l;
            setHover({ x: px, y: e.clientY - r.top + m.t, az: Math.max(0, Math.min(360, x.invert(px))) });
          }}
          onMouseLeave={() => setHover(null)}
        />
        {hover && <line x1={hover.x} x2={hover.x} y1={m.t} y2={h - m.b} stroke="var(--muted)" strokeWidth={1} />}
      </svg>
      {hover && (() => {
        const k = nearest(hover.az);
        return (
          <Tooltip x={hover.x} y={hover.y} w={w}>
            <div className="font-medium">Azimuth {hover.az.toFixed(0)}° ({compass(hover.az)})</div>
            <div className="text-muted">Terrain horizon {fmtDeg(horizonAt(sc.mask, hover.az), 2)}</div>
            {k >= 0 && <div className="mt-1">Sun here at {fmtUTC(s.t[k])}, {fmtDeg(s.sunEl[k], 2)} high</div>}
          </Tooltip>
        );
      })()}
      <div>
        <Legend items={[
          { label: "Terrain horizon (LOLA)", color: "var(--terrain)", kind: "area" },
          { label: "Sun path", color: "var(--sun)" },
          { label: "Earth path", color: "var(--earth)" },
        ]} />
        <p className="mt-1.5 text-xs text-faint">Faded marker = hidden behind terrain at the time cursor.</p>
      </div>
    </div>
  );
}
