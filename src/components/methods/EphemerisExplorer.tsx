"use client";

import { Pause, Play } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { InfoTip } from "@/components/InfoTip";
import { ensureEphemeris } from "@/lib/data-client";
import type { EphemerisSet } from "@/lib/engine/ephemeris";
import { useWidth } from "./use-width";

const DAY = 86_400_000;
const PAD = { l: 56, r: 16, t: 16, b: 48 };

/**
 * Libration explorer (D-139b): the sub-Earth point from the real hourly Horizons table for one year.
 * The path is drawn from samples every 6 hours; the dot follows the slider (00:00 UTC each day).
 * Nothing here is illustrative: every point is read from public/data/ephemeris/<year>.bin.
 */
export function EphemerisExplorer({ years }: { years: number[] }) {
  const [year, setYear] = useState(years.includes(2027) ? 2027 : years[0]);
  // the loaded table, tagged with its year, so switching years shows "loading" until the new one arrives
  const [loaded, setLoaded] = useState<{ year: number; eph?: EphemerisSet; err?: string } | null>(null);
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [plot, W] = useWidth<HTMLDivElement>();
  const H = Math.round(Math.min(420, Math.max(280, W * 0.62)));

  // Load the year only once the figure is close to the viewport (it is a ~300 KB file).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!near) return;
    let live = true;
    ensureEphemeris(Date.UTC(year, 0, 1), Date.UTC(year, 11, 31, 23)).then(
      (e) => live && setLoaded({ year, eph: e }),
      (e) => live && setLoaded({ year, err: (e as Error).message }),
    );
    return () => { live = false; };
  }, [year, near]);

  const eph = loaded?.year === year ? loaded.eph ?? null : null;
  const err = loaded?.year === year ? loaded.err ?? null : null;
  const t0 = Date.UTC(year, 0, 1);
  const days = Math.round((Date.UTC(year + 1, 0, 1) - t0) / DAY);

  const path = useMemo(() => {
    if (!eph) return null;
    const pts: { lon: number; lat: number }[] = [];
    for (let t = t0; t < t0 + days * DAY; t += 6 * 3_600_000) {
      const e = eph.sample(t).earth;
      pts.push({ lon: e.lon > 180 ? e.lon - 360 : e.lon, lat: e.lat });
    }
    const m = Math.max(...pts.map((p) => Math.max(Math.abs(p.lon), Math.abs(p.lat))));
    return { pts, lim: Math.ceil(m) };
  }, [eph, t0, days]);

  // play: one day every 60 ms
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now(), acc = 0;
    const tick = (now: number) => {
      acc += now - last;
      last = now;
      if (acc >= 60) {
        const n = Math.floor(acc / 60);
        acc -= n * 60;
        setDay((d) => (d + n) % days);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, days]);

  const lim = path?.lim ?? 8;
  // equal scale on both axes, so the path keeps its true shape
  const pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b, k = Math.min(pw, ph) / (2 * lim);
  const cx = PAD.l + pw / 2, cy = PAD.t + ph / 2;
  const x = (lon: number) => cx + lon * k;
  const y = (lat: number) => cy - lat * k;
  const ticks = Array.from({ length: Math.floor(lim / 2) * 2 + 1 }, (_, i) => -Math.floor(lim / 2) * 2 + i * 2).filter((v) => Math.abs(v) <= lim);

  const at = eph ? eph.sample(t0 + Math.min(day, days - 1) * DAY) : null;
  const eLon = at ? (at.earth.lon > 180 ? at.earth.lon - 360 : at.earth.lon) : null;
  const date = new Date(t0 + day * DAY).toISOString().slice(0, 10);

  return (
    <div ref={box} className="reveal grid grid-cols-1 gap-6 rounded-sm border border-line bg-panel p-5 md:p-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            Sub-Earth point over {year}
            <InfoTip title="Sub-Earth point (optical libration)" sources={["jpl-horizons"]}>
              The point on the Moon where Earth is straight overhead, from JPL Horizons (QUANTITIES 14), sampled every 6 hours for the path. Its wobble around 0°, 0° is the optical libration.
            </InfoTip>
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Year">
            {years.map((yy) => (
              <button key={yy} type="button" onClick={() => { setYear(yy); setDay(0); }} aria-pressed={yy === year}
                className={`num rounded-sm px-2 py-0.5 text-xs transition-colors ${yy === year ? "bg-fg text-bg" : "text-muted hover:bg-panel-2 hover:text-fg"}`}>{yy}</button>
            ))}
          </div>
        </div>
        <div ref={plot} className="mt-3">
        <svg width={W} height={H} className="block" role="img" aria-label={`Sub-Earth point over ${year}, from JPL Horizons`}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={x(v)} x2={x(v)} y1={y(lim)} y2={y(-lim)} className="stroke-grid" />
              <line x1={x(-lim)} x2={x(lim)} y1={y(v)} y2={y(v)} className="stroke-grid" />
              <text x={x(v)} y={y(-lim) + 18} textAnchor="middle" className="num fill-faint text-xs">{v}°</text>
              <text x={x(-lim) - 8} y={y(v) + 5} textAnchor="end" className="num fill-faint text-xs">{v}°</text>
            </g>
          ))}
          <line x1={x(0)} x2={x(0)} y1={y(lim)} y2={y(-lim)} className="stroke-line" />
          <line x1={x(-lim)} x2={x(lim)} y1={y(0)} y2={y(0)} className="stroke-line" />
          <text x={cx} y={H - 6} textAnchor="middle" className="fill-faint text-xs">Longitude libration (east +)</text>
          <text transform={`translate(${x(-lim) - 42} ${cy}) rotate(-90)`} textAnchor="middle" className="fill-faint text-xs">Latitude libration (north +)</text>
          {path && (
            <polyline key={year} pathLength={1} points={path.pts.map((p) => `${x(p.lon).toFixed(1)},${y(p.lat).toFixed(1)}`).join(" ")}
              className="draw-line fill-none stroke-earth" strokeWidth={1.25} strokeOpacity={0.55} strokeLinejoin="round" />
          )}
          {at && eLon !== null && (
            <g style={{ transform: `translate(${x(eLon)}px, ${y(at.earth.lat)}px)`, transition: playing ? "none" : "transform 200ms ease-out" }}>
              <circle r={9} className="fill-earth" opacity={0.18} />
              <circle r={5} className="fill-earth stroke-panel" strokeWidth={2} />
            </g>
          )}
          {!eph && <text x={W / 2} y={H / 2} textAnchor="middle" className="fill-faint text-sm">{err ? `Could not load ${year}: ${err}` : `Loading the ${year} table…`}</text>}
        </svg>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={() => setPlaying((p) => !p)} disabled={!eph} aria-label={playing ? "Pause" : "Play the year"}
            className="grid size-9 shrink-0 place-items-center rounded-sm border border-line bg-panel-2 text-fg transition-colors hover:border-muted disabled:opacity-40">
            {playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
          </button>
          <input type="range" min={0} max={days - 1} value={day} disabled={!eph} aria-label="Day of the year"
            onChange={(e) => { setPlaying(false); setDay(+e.target.value); }} className="w-full accent-(--earth)" />
        </div>
      </div>

      <dl className="grid content-start gap-4 text-sm xl:border-l xl:border-line xl:pl-6">
        <Readout label="Date (00:00 UTC)" value={date} />
        <Readout label="Sub-Earth longitude" value={eLon === null ? "—" : `${eLon.toFixed(2)}°`} />
        <Readout label="Sub-Earth latitude" value={at ? `${at.earth.lat.toFixed(2)}°` : "—"} />
        <Readout label="Earth–Moon distance" value={at ? `${Math.round(at.earth.distKm).toLocaleString("en-US")} km` : "—"} />
        <Readout label="Sub-solar latitude" value={at ? `${at.sun.lat.toFixed(2)}°` : "—"} />
        <p className="text-xs leading-relaxed text-faint">
          Read from the precomputed {year} table (JPL Horizons, DE441): the hourly row for 00:00 UTC on that day.
        </p>
      </dl>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="num mt-0.5 text-lg text-fg">{value}</dd>
    </div>
  );
}
