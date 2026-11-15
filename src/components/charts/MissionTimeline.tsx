"use client";

import { Pause, Play } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { Interval } from "@/lib/engine/windows";
import { dayTicks, fmtDay, fmtWhen, scale, TIME_MARGIN, useWidth } from "./chart-kit";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const STEP = 10 * 60_000;
/** Playback speed (D-093): one mission day per second of wall time. */
const PLAY_RATE = DAY / 1000;

/**
 * Plays the timeline forward from where it is, wrapping from the mission end back to landing, until
 * `playing` turns false. Only the time changes; the caller decides when to stop.
 */
function usePlayback(playing: boolean, start: number, end: number, value: number, onTick: (t: number) => void) {
  const valueRef = useRef(value);
  const tickRef = useRef(onTick);
  useEffect(() => {
    valueRef.current = value;
    tickRef.current = onTick;
  });
  useEffect(() => {
    if (!playing || end <= start) return;
    const span = end - start;
    const from = Math.max(start, Math.min(end, valueRef.current)) - start;
    // starting at the very end jumps straight back to landing
    const origin = from >= span - STEP ? 0 : from;
    let t0: number | null = null;
    let last = NaN;
    let raf = requestAnimationFrame(function frame(now) {
      if (t0 === null) t0 = now;
      const off = (origin + (now - t0) * PLAY_RATE) % span;
      const t = start + Math.round(off / STEP) * STEP;
      if (t !== last) {
        last = t;
        tickRef.current(Math.min(end, t));
      }
      raf = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(raf);
  }, [playing, start, end]);
}

/**
 * The page timeline (D-085): mission time from landing to the end of the mission, with the sunlit and
 * Earth-in-view windows as lanes. Drag the playhead, click anywhere, or use the arrow keys
 * (←/→ 1 h, Shift 1 day, Home/End). Everything on the page shows the selected time.
 *
 * The play button (D-093) runs the timeline forward in a loop. `onChange` is a user pick (click,
 * drag, keys), which the caller treats as "stop here"; `onTick` is a playback step.
 */
export function MissionTimeline({ start, end, value, onChange, onTick, playing, onPlayingChange, sunlit, dte, sunLabel, earthLabel }: {
  start: number; end: number; value: number; onChange: (t: number) => void; onTick: (t: number) => void;
  playing: boolean; onPlayingChange: (playing: boolean) => void;
  sunlit: Interval[]; dte: Interval[]; sunLabel: string; earthLabel: string;
}) {
  usePlayback(playing, start, end, value, onTick);
  const { setRef, w } = useWidth();
  const [drag, setDrag] = useState(false);
  const [hoverT, setHoverT] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const m = { ...TIME_MARGIN, t: 34 };
  const laneH = 12, gap = 6;
  const trackY = m.t;
  const h = m.t + 2 * laneH + gap + 34;
  const x = scale(start, end, m.l, w - m.r);
  const ticks = dayTicks(start, end, w - m.l - m.r);
  const clampT = (t: number) => Math.max(start, Math.min(end, Math.round(t / STEP) * STEP));
  const tAt = (clientX: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return clampT(x.invert(Math.max(m.l, Math.min(w - m.r, clientX - r.left))));
  };
  const px = x(value);
  const labelW = 200;
  const labelX = Math.max(0, Math.min(w - labelW, px - labelW / 2));

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    const stepMs = e.shiftKey ? DAY : HOUR;
    if (k === "ArrowRight" || k === "ArrowUp") onChange(clampT(value + stepMs));
    else if (k === "ArrowLeft" || k === "ArrowDown") onChange(clampT(value - stepMs));
    else if (k === "Home") onChange(start);
    else if (k === "End") onChange(end);
    else if (k === " " || k === "k") onPlayingChange(!playing);
    else return;
    e.preventDefault();
  };

  return (
    <div className="flex items-start gap-3">
    <button
      type="button"
      onClick={() => onPlayingChange(!playing)}
      aria-pressed={playing}
      aria-label={playing ? "Pause the timeline" : "Play the timeline"}
      title={playing ? "Pause (Space)" : "Play the mission forward, one day per second (Space)"}
      className="mt-[29px] inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-line bg-panel-2 text-fg transition-colors hover:border-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {playing ? <Pause size={18} weight="fill" aria-hidden /> : <Play size={18} weight="fill" aria-hidden />}
    </button>
    <div ref={setRef} className="relative min-w-0 flex-1 select-none">
      {/* readout bubble that follows the playhead */}
      <div className="pointer-events-none absolute top-0 flex justify-center" style={{ left: labelX, width: labelW }}>
        <span className="num whitespace-nowrap rounded-sm bg-fg px-2 py-0.5 text-xs font-medium text-bg">{fmtWhen(value).replace(/^\w+, /, "")}</span>
      </div>
      <svg
        ref={svgRef}
        width={w}
        height={h}
        role="slider"
        tabIndex={0}
        aria-label="Timeline: selected time in the mission"
        aria-valuemin={start}
        aria-valuemax={end}
        aria-valuenow={value}
        aria-valuetext={fmtWhen(value)}
        onKeyDown={onKey}
        className="cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onPointerDown={(e) => {
          (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
          setDrag(true);
          onChange(tAt(e.clientX));
        }}
        onPointerMove={(e) => {
          const t = tAt(e.clientX);
          setHoverT(t);
          if (drag) onChange(t);
        }}
        onPointerUp={() => setDrag(false)}
        onPointerCancel={() => setDrag(false)}
        onPointerLeave={() => setHoverT(null)}
        style={{ cursor: drag ? "grabbing" : "pointer", touchAction: "none" }}
      >
        {/* lanes */}
        {[{ y: trackY, iv: sunlit, color: "var(--sun)", label: sunLabel }, { y: trackY + laneH + gap, iv: dte, color: "var(--earth)", label: earthLabel }].map((ln) => (
          <g key={ln.label}>
            <text x={m.l - 8} y={ln.y + laneH - 1} textAnchor="end" fontSize={14} fill="var(--muted)">{ln.label}</text>
            <rect x={m.l} y={ln.y} width={w - m.l - m.r} height={laneH} fill="var(--panel-2)" />
            {ln.iv.map((b, k) => <rect key={k} x={x(b.start)} y={ln.y} width={Math.max(1.5, x(b.end) - x(b.start))} height={laneH} fill={ln.color} opacity={0.85} />)}
          </g>
        ))}
        {/* day ticks */}
        {ticks.minor.map((t) => {
          const major = ticks.major.includes(t);
          const ty = trackY + 2 * laneH + gap + 4;
          return <line key={t} x1={x(t)} x2={x(t)} y1={ty} y2={ty + (major ? 8 : 4)} stroke={major ? "var(--muted)" : "var(--faint)"} />;
        })}
        {ticks.major.map((t) => (
          <text key={t} x={x(t)} y={h - 4} textAnchor={x(t) > w - m.r - 24 ? "end" : x(t) < m.l + 24 ? "start" : "middle"} fontSize={14} fontFamily="var(--font-plex-mono)" fill="var(--muted)">{fmtDay(t)}</text>
        ))}
        {/* landing marker */}
        <line x1={x(start)} x2={x(start)} y1={trackY - 6} y2={trackY + 2 * laneH + gap} stroke="var(--faint)" />
        {/* hover ghost */}
        {hoverT !== null && !drag && Math.abs(x(hoverT) - px) > 3 && (
          <line x1={x(hoverT)} x2={x(hoverT)} y1={trackY - 4} y2={trackY + 2 * laneH + gap + 4} stroke="var(--muted)" strokeDasharray="2 3" pointerEvents="none" />
        )}
        {/* playhead */}
        <g pointerEvents="none">
          <line x1={px} x2={px} y1={trackY - 8} y2={trackY + 2 * laneH + gap + 4} stroke="var(--fg)" strokeWidth={2} />
          <path d={`M${px - 6},${trackY - 12} L${px + 6},${trackY - 12} L${px},${trackY - 5} Z`} fill="var(--fg)" />
        </g>
      </svg>
      <div className="mt-1 flex justify-between text-xs text-faint">
        <span>Landing · <span className="num">{fmtWhen(start)}</span></span>
        <span>Mission end · <span className="num">{fmtWhen(end)}</span></span>
      </div>
    </div>
    </div>
  );
}

