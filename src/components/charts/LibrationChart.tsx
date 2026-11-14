"use client";

import { useState } from "react";
import type { Scenario } from "@/lib/engine/scenario";
import { fmtDeg, fmtUTC } from "@/lib/metrics/format";
import { niceTicks, scale, Tooltip, useWidth } from "./chart-kit";

/**
 * Earth's position in the site's sky over the mission. Without libration Earth would sit still;
 * the loop is the libration seen from this spot. Terrain line shows where it gets hidden.
 */
export function LibrationChart({ sc, cursor }: { sc: Scenario; cursor: number }) {
  const { setRef, w } = useWidth(360);
  const h = 240;
  const m = { l: 62, r: 28, t: 12, b: 34 };
  const s = sc.series;
  const [hover, setHover] = useState<{ x: number; y: number; i: number } | null>(null);
  let azMin = 360, azMax = 0, elMin = 90, elMax = -90;
  for (let i = 0; i < s.n; i++) {
    azMin = Math.min(azMin, s.earthAz[i]); azMax = Math.max(azMax, s.earthAz[i]);
    elMin = Math.min(elMin, s.earthEl[i], s.earthHz[i]); elMax = Math.max(elMax, s.earthEl[i], s.earthHz[i]);
  }
  const padAz = Math.max(1, (azMax - azMin) * 0.1);
  const x = scale(azMin - padAz, azMax + padAz, m.l, w - m.r);
  const y = scale(Math.floor(elMin - 0.5), Math.ceil(elMax + 0.5), h - m.b, m.t);
  let path = "";
  for (let i = 0; i < s.n; i += 2) path += `${i ? "L" : "M"}${x(s.earthAz[i]).toFixed(1)},${y(s.earthEl[i]).toFixed(1)}`;
  const k0 = Math.floor((azMin - padAz) / sc.mask.stepDeg), k1 = Math.ceil((azMax + padAz) / sc.mask.stepDeg);
  let terr = "";
  for (let k = k0; k <= k1; k++) {
    const az = k * sc.mask.stepDeg;
    const e = sc.mask.elev[((k % sc.mask.elev.length) + sc.mask.elev.length) % sc.mask.elev.length];
    terr += `${k === k0 ? "M" : "L"}${x(az).toFixed(1)},${y(e).toFixed(1)}`;
  }
  const terrArea = `${terr} L${x(k1 * sc.mask.stepDeg)},${h - m.b} L${x(k0 * sc.mask.stepDeg)},${h - m.b} Z`;
  const ci = Math.max(0, Math.min(s.n - 1, Math.round((cursor - s.t[0]) / s.stepMs)));

  return (
    <div ref={setRef} className="relative">
      <svg width={w} height={h} role="img" aria-label="Earth's path in the sky from this site">
        <defs>
          <clipPath id="lib-plot"><rect x={m.l} y={m.t} width={w - m.l - m.r} height={h - m.t - m.b} /></clipPath>
        </defs>
        <g clipPath="url(#lib-plot)">
          <path d={terrArea} fill="var(--terrain)" fillOpacity={0.9} />
        </g>
        {niceTicks(y.invert(h - m.b), y.invert(m.t), 4).map((v) => (
          <g key={v}>
            <line x1={m.l} x2={w - m.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
            <text x={m.l - 6} y={y(v) + 3} textAnchor="end" fontSize={14} fontFamily="var(--font-plex-mono)" fill="var(--muted)">{v}°</text>
          </g>
        ))}
        {niceTicks(azMin - padAz, azMax + padAz, 4).map((v) => (
          <text key={v} x={x(v)} y={h - 10} textAnchor="middle" fontSize={14} fontFamily="var(--font-plex-mono)" fill="var(--muted)">az {v}°</text>
        ))}
        <path d={path} fill="none" stroke="var(--earth)" strokeWidth={2} />
        <circle cx={x(s.earthAz[ci])} cy={y(s.earthEl[ci])} r={6} fill="var(--earth)" fillOpacity={s.earthFrac[ci] > 0 ? 1 : 0.15} stroke={s.earthFrac[ci] > 0 ? "var(--panel)" : "var(--earth)"} strokeWidth={2} />
        <rect
          x={m.l} y={m.t} width={w - m.l - m.r} height={h - m.t - m.b} fill="transparent"
          onMouseMove={(e) => {
            const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
            const px = e.clientX - r.left + m.l, py = e.clientY - r.top + m.t;
            let best = 0, bd = Infinity;
            for (let i = 0; i < s.n; i += 2) {
              const d = (x(s.earthAz[i]) - px) ** 2 + (y(s.earthEl[i]) - py) ** 2;
              if (d < bd) { bd = d; best = i; }
            }
            setHover(bd < 900 ? { x: px, y: py, i: best } : null);
          }}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      {hover && (
        <Tooltip x={hover.x} y={hover.y} w={w}>
          <div className="font-medium">{fmtUTC(s.t[hover.i])}</div>
          <div>Earth az {fmtDeg(s.earthAz[hover.i], 2)}, el {fmtDeg(s.earthEl[hover.i], 2)}</div>
          <div className="text-muted">Libration: {fmtDeg(s.libLon[hover.i], 2)} lon, {fmtDeg(s.libLat[hover.i], 2)} lat</div>
        </Tooltip>
      )}
    </div>
  );
}
