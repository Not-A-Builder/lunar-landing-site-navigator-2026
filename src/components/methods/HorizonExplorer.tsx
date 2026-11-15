"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { InfoTip } from "@/components/InfoTip";
import { loadTerrain } from "@/lib/data-client";
import type { TerrainFile } from "@/lib/engine/terrain-file";
import { useWidth } from "./use-width";

const PAD = { l: 52, r: 12, t: 14, b: 36 };
const COMPASS: Record<number, string> = { 0: "N", 90: "E", 180: "S", 270: "W", 360: "N" };

/**
 * Terrain horizon explorer (D-139): the real 360° horizon mask of a listed site, read from its
 * precomputed terrain file (LOLA ray-march, pipeline/build-terrain.ts), at each observer height the file
 * holds. Switching site or height eases the line from the old mask to the new one.
 */
export function HorizonExplorer({ options, initial }: { options: { id: string; name: string }[]; initial: string }) {
  const [siteId, setSiteId] = useState(initial);
  const [loaded, setLoaded] = useState<{ id: string; tf?: TerrainFile; err?: string } | null>(null);
  const [hi, setHi] = useState(0); // index into heightsM
  const [hover, setHover] = useState<number | null>(null);
  const [plot, W] = useWidth<HTMLDivElement>();
  const H = 300;

  useEffect(() => {
    let live = true;
    loadTerrain({ siteId }).then((t) => live && setLoaded({ id: siteId, tf: t }), (e) => live && setLoaded({ id: siteId, err: (e as Error).message }));
    return () => { live = false; };
  }, [siteId]);

  // keep showing the previous site's terrain until the new file arrives, so the line can ease across
  const lastTf = useRef<TerrainFile | null>(null);
  if (loaded?.tf) lastTf.current = loaded.tf;
  const tf = loaded?.tf ?? lastTf.current;
  const err = loaded?.id === siteId ? loaded.err ?? null : null;
  const target = tf?.masks[Math.min(hi, (tf?.masks.length ?? 1) - 1)] ?? null;
  const ground = tf?.masks[0] ?? null;

  // Ease the drawn mask toward the target (≈300 ms), so changes read as movement, not a jump.
  const [shown, setShown] = useState<number[] | null>(null);
  const shownRef = useRef<number[] | null>(null);
  useEffect(() => {
    if (!target) return;
    const from = shownRef.current;
    if (!from || from.length !== target.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 320);
      const e = 1 - Math.pow(1 - p, 3);
      const cur = target.map((v, i) => from[i] + (v - from[i]) * e);
      shownRef.current = cur;
      setShown(cur);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  // y range covers every height of this site, so switching heights never rescales the axis
  const dom = useMemo(() => {
    if (!tf) return { lo: -6, hi: 10 };
    const all = tf.masks.flat();
    return { lo: Math.floor(Math.min(0, ...all) - 1), hi: Math.ceil(Math.max(0, ...all) + 1) };
  }, [tf]);
  const x = (az: number) => PAD.l + (az / 360) * (W - PAD.l - PAD.r);
  const y = (el: number) => PAD.t + ((dom.hi - el) / (dom.hi - dom.lo)) * (H - PAD.t - PAD.b);
  const line = (m: number[]) => [...m, m[0]].map((v, i) => `${i ? "L" : "M"}${x(i * (360 / m.length)).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const yStep = dom.hi - dom.lo > 16 ? 5 : 2;
  const yTicks: number[] = [];
  for (let v = Math.ceil(dom.lo / yStep) * yStep; v <= dom.hi; v += yStep) yTicks.push(v);

  const stats = useMemo(() => {
    if (!tf || !target || !ground) return null;
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    let iMax = 0, iMin = 0;
    target.forEach((v, i) => { if (v > target[iMax]) iMax = i; if (v < target[iMin]) iMin = i; });
    const step = 360 / target.length;
    return { max: target[iMax], maxAz: iMax * step, min: target[iMin], minAz: iMin * step, dMean: mean(target) - mean(ground) };
  }, [tf, target, ground]);

  const heights = tf?.heightsM ?? [0, 2, 5, 10, 20, 50];
  const hM = heights[hi] ?? 0;
  const hv = hover !== null && target ? { az: hover * (360 / target.length), el: target[hover], dist: tf!.maskDistKm[hover], g: ground![hover] } : null;

  return (
    <div className="reveal rounded-sm border border-line bg-panel p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-faint">Site</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {options.map((o) => (
              <button key={o.id} type="button" onClick={() => setSiteId(o.id)} aria-pressed={o.id === siteId}
                className={`rounded-sm border px-2.5 py-1 text-sm transition-colors ${o.id === siteId ? "border-fg bg-fg text-bg" : "border-line text-muted hover:border-muted hover:text-fg"}`}>{o.name}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-faint">
            Array / antenna height
            <InfoTip title="Observer height" sources={["lola-pds", "bryant-2009"]}>
              The terrain file holds a full horizon for each of these heights above the ground. A mast sees over nearby terrain, which lowers the horizon in some directions (Bryant 2009 studies the same tower-height effect).
            </InfoTip>
          </div>
          <div role="group" aria-label="Observer height" className="mt-1.5 inline-flex rounded-sm border border-line">
            {heights.map((h, i) => (
              <button key={h} type="button" onClick={() => setHi(i)} aria-pressed={i === hi}
                className={`num min-w-11 px-2 py-1 text-sm transition-colors ${i ? "border-l border-line" : ""} ${i === hi ? "bg-fg text-bg" : "text-muted hover:bg-panel-2 hover:text-fg"}`}>{h} m</button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted" aria-hidden>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-fg" />Horizon at {hM} m</span>
        {hi > 0 && <span className="flex items-center gap-1.5"><span className="w-5 border-t border-dashed border-faint" />Ground level</span>}
        <span className="flex items-center gap-1.5"><span className="w-5 border-t border-dashed border-muted" />0° = flat horizon (smooth Moon)</span>
      </div>
      <div ref={plot} className="relative mt-2">
        <svg width={W} height={H} className="block touch-none" role="img"
          aria-label={tf ? `Horizon elevation around the site at ${hM} m, from LOLA` : "Loading terrain"}
          onPointerMove={(e) => {
            if (!target) return;
            const r = e.currentTarget.getBoundingClientRect();
            const az = ((e.clientX - r.left - PAD.l) / (W - PAD.l - PAD.r)) * 360;
            setHover(az < 0 || az > 360 ? null : Math.round(az / (360 / target.length)) % target.length);
          }}
          onPointerLeave={() => setHover(null)}>
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className={v === 0 ? "stroke-muted" : "stroke-grid"} strokeDasharray={v === 0 ? "4 4" : undefined} />
              <text x={PAD.l - 8} y={y(v) + 5} textAnchor="end" className="num fill-faint text-xs">{v}°</text>
            </g>
          ))}
          {[0, 45, 90, 135, 180, 225, 270, 315, 360].map((a) => (
            <text key={a} x={x(a)} y={H - 10} textAnchor={a === 0 ? "start" : a === 360 ? "end" : "middle"} className="num fill-faint text-xs">{COMPASS[a] ? `${a}° ${COMPASS[a]}` : `${a}°`}</text>
          ))}
          {shown && (
            <>
              <path d={`${line(shown)}L${x(360)},${H - PAD.b}L${x(0)},${H - PAD.b}Z`} className="fill-terrain" fillOpacity={0.55} />
              {hi > 0 && ground && <path d={line(ground)} className="fill-none stroke-faint" strokeWidth={1} strokeDasharray="3 3" />}
              <path d={line(shown)} className="fill-none stroke-fg" strokeWidth={1.5} strokeLinejoin="round" />
            </>
          )}
          {hv && (
            <g pointerEvents="none">
              <line x1={x(hv.az)} x2={x(hv.az)} y1={PAD.t} y2={H - PAD.b} className="stroke-muted" />
              <circle cx={x(hv.az)} cy={y(hv.el)} r={4.5} className="fill-fg stroke-panel" strokeWidth={2} />
            </g>
          )}
          {!tf && <text x={W / 2} y={H / 2} textAnchor="middle" className="fill-faint text-sm">{err ? `Could not load terrain: ${err}` : "Loading LOLA terrain…"}</text>}
        </svg>
        {hv && (
          <div className="pointer-events-none absolute top-2 rounded-sm border border-line bg-bg/95 px-3 py-2 text-xs shadow-sm"
            style={{ left: Math.min(Math.max(x(hv.az) + 12, 0), W - 230), width: 218 }}>
            <div className="num text-fg">Azimuth {hv.az.toFixed(0)}°</div>
            <div className="mt-0.5 text-muted">Horizon at {hM} m: <span className="num text-fg">{hv.el.toFixed(2)}°</span></div>
            {hi > 0 && <div className="text-muted">At ground level: <span className="num text-fg">{hv.g.toFixed(2)}°</span></div>}
            <div className="text-muted">Set by terrain <span className="num text-fg">{hv.dist.toFixed(1)} km</span> away{hi > 0 ? " (ground level)" : ""}</div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-4 text-sm">
        <Fact label="Ground elevation" value={tf ? `${Math.round(tf.groundM).toLocaleString("en-US")} m` : "—"} tip="LOLA height at the site, above the 1,737.4 km reference sphere that all LOLA heights use." />
        <Fact label={`Highest horizon (${hM} m)`} value={stats ? `${stats.max.toFixed(2)}° at ${stats.maxAz.toFixed(0)}°` : "—"} tip="The largest horizon elevation in the mask, and the azimuth (degrees clockwise from north) where it occurs." />
        <Fact label={`Lowest horizon (${hM} m)`} value={stats ? `${stats.min.toFixed(2)}° at ${stats.minAz.toFixed(0)}°` : "—"} tip="The smallest horizon elevation in the mask. Below 0° means the site looks down to its horizon in that direction, as from a peak or ridge." />
        {hi > 0 && <Fact label="Average change vs ground level" value={stats ? `${stats.dMean >= 0 ? "+" : "−"}${Math.abs(stats.dMean).toFixed(2)}°` : "—"} tip="Mean of all 360 azimuths at this height minus the mean at ground level." />}
        <Fact label="Elevation data" value={tf ? tf.dem.label : "—"} mono={false} tip="The LOLA grid the site sits on; rays that leave the 120 m polar grid continue on the global grid." />
      </div>
    </div>
  );
}

function Fact({ label, value, tip, mono = true }: { label: string; value: string; tip: string; mono?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-faint">
        {label}
        <InfoTip title={label} sources={["lola-pds"]}>{tip}</InfoTip>
      </div>
      <div className={`mt-0.5 text-fg ${mono ? "num" : ""}`}>{value}</div>
    </div>
  );
}
