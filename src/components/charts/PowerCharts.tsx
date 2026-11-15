"use client";

import { useId, useMemo } from "react";
import type { powerModel } from "@/lib/engine/analysis";
import type { Scenario } from "@/lib/engine/scenario";
import { fmtPct } from "@/lib/metrics/format";
import type { Persona } from "@/lib/persona";
import { AXIS, ChartTip, dayTicks, fmtDay, fmtMissionTime, fmtWhen, Legend, niceMax, niceTicks, sampleAt, scale, TIME_MARGIN, TipHead, TipRows, usePlotHover, useWidth } from "./chart-kit";

type Power = ReturnType<typeof powerModel>;
const W = (v: number) => `${Math.round(v).toLocaleString("en-US")} W`;
const Wh = (v: number) => `${Math.round(v).toLocaleString("en-US")} Wh`;

/**
 * Battery state of charge and solar-array output over the mission, from the power model in
 * src/lib/engine/analysis.ts (powerModel). Both share the timeline's x axis. Every tooltip value is a
 * per-sample output of that model; nothing is re-estimated here (D-088).
 */
export function PowerCharts({ sc, power, cursor, onCursor, persona, only }: { sc: Scenario; power: Power; cursor: number; onCursor?: (t: number) => void; persona: Persona; only?: "battery" | "array" }) {
  return (
    <div className="space-y-8">
      {only !== "array" && <Chart kind="battery" sc={sc} power={power} cursor={cursor} onCursor={onCursor} persona={persona} />}
      {only !== "battery" && <Chart kind="array" sc={sc} power={power} cursor={cursor} onCursor={onCursor} persona={persona} />}
    </div>
  );
}

function Chart({ kind, sc, power, cursor, onCursor, persona }: { kind: "battery" | "array"; sc: Scenario; power: Power; cursor: number; onCursor?: (t: number) => void; persona: Persona }) {
  const { setRef, w } = useWidth();
  const uid = useId().replace(/:/g, "");
  const s = sc.series;
  const a = sc.assumptions;
  const n = s.n;
  const t0 = s.t[0], t1 = s.t[n - 1];
  const plotH = 170;
  const m = { ...TIME_MARGIN, t: 12, b: 30 };
  const h = m.t + plotH + m.b;
  const bottom = m.t + plotH;
  const isBat = kind === "battery";
  const color = isBat ? "var(--good)" : "var(--sun)";
  const enthusiast = persona === "enthusiast", planner = persona === "planner";

  const v = useMemo(() => (isBat ? power.soc.map((z) => z * 100) : power.power), [isBat, power]);
  const yMax = useMemo(() => {
    if (isBat) return 100;
    let hi = a.loadW;
    for (let i = 0; i < n; i++) hi = Math.max(hi, v[i]);
    return niceMax(hi * 1.04, 4);
  }, [isBat, v, n, a.loadW]);
  const x = scale(t0, t1, m.l, w - m.r);
  const y = scale(0, yMax, bottom, m.t);

  const paths = useMemo(() => {
    const stride = Math.max(1, Math.floor(n / ((w - m.l - m.r) * 1.5)));
    let d = "", load = "";
    for (let i = 0; i < n; i += stride) {
      d += `${i ? "L" : "M"}${x(s.t[i]).toFixed(1)},${y(v[i]).toFixed(1)}`;
    }
    d += `L${x(t1).toFixed(1)},${y(v[n - 1]).toFixed(1)}`;
    // load is a step function: draw it exactly at every change
    for (let i = 0; i < n; i++) {
      const px = x(s.t[i]).toFixed(1), py = y(power.loadW[i]).toFixed(1);
      if (i === 0) load = `M${px},${py}`;
      else if (power.loadW[i] !== power.loadW[i - 1]) load += `L${px},${y(power.loadW[i - 1]).toFixed(1)}L${px},${py}`;
    }
    load += `L${x(t1).toFixed(1)},${y(power.loadW[n - 1]).toFixed(1)}`;
    return { line: d, area: `${d} L${x(t1).toFixed(1)},${bottom} L${x(t0).toFixed(1)},${bottom} Z`, load };
  }, [n, w, m.l, m.r, x, y, s.t, v, t0, t1, bottom, power.loadW]);

  const ticks = dayTicks(t0, t1, w - m.l - m.r);
  const { key, last, bind } = usePlotHover<number>((px) => (px < m.l - 8 || px > w - m.r + 8 ? null : sampleAt(s.t, x.invert(Math.max(m.l, Math.min(w - m.r, px))))));
  const i = key ?? last;
  const show = key !== null;
  const minI = useMemo(() => sampleAt(s.t, power.minSocAt), [s.t, power.minSocAt]);

  const tip = (i: number) => {
    const p = power.power[i], load = power.loadW[i];
    const net = p - load;
    const e = power.soc[i] * a.batteryWh;
    const full = power.soc[i] >= 0.9995, empty = power.soc[i] <= 0.0005;
    const flow = net > 0 ? (full ? "Full: surplus not stored" : `Charging +${W(net)}`) : net < 0 ? (empty ? `Empty: short ${W(-net)}` : `Draining ${W(net).replace("-", "−")}`) : "Balanced";
    const mode = p > 0 ? `${W(load)} operating` : `${W(load)} survival`;
    if (enthusiast) {
      return isBat
        ? <p className="mt-1.5 text-muted">The battery is <span className="num text-fg">{fmtPct(power.soc[i])}</span> full. {p > 0 ? "Sunlight is reaching the solar panels." : "No sunlight: only heaters and essentials are running."}</p>
        : <p className="mt-1.5 text-muted">The panels make <span className="num text-fg">{W(p)}</span>; the lander uses <span className="num text-fg">{W(load)}</span>{p > 0 ? " while working." : " to stay warm in the dark."}</p>;
    }
    return isBat ? (
      <TipRows rows={[
        ["Charge", `${fmtPct(power.soc[i], 1)} · ${Wh(e)} of ${Wh(a.batteryWh)}`],
        ["Array output", W(p)],
        ["Load", mode],
        ["Net", flow, net > 0 ? "text-good" : net < 0 ? "text-critical" : "text-fg"],
        planner && ["Visible Sun disk", fmtPct(s.sunFrac[i], 1)],
      ]} />
    ) : (
      <>
        <TipRows rows={[
          ["Array output", W(p)],
          ["Load", mode],
          ["Surplus / deficit", `${net >= 0 ? "+" : "−"}${W(Math.abs(net))}`, net >= 0 ? "text-good" : "text-critical"],
        ]} />
        {planner && (
          <div className="mt-2 border-t border-line pt-1.5">
            <div className="text-muted">How the output is made</div>
            <TipRows rows={[
              ["Sunlight at Sun's distance", `${Math.round(power.tsi[i]).toLocaleString("en-US")} W/m²`],
              ["× visible Sun disk", fmtPct(s.sunFrac[i], 1)],
              ["× cos(angle to panel)", power.incidence[i].toFixed(3)],
              ["× area × efficiency", `${a.panelAreaM2} m² × ${a.panelEfficiency}`],
              ["= output", W(p)],
            ]} />
          </div>
        )}
      </>
    );
  };

  return (
    <div>
      <div ref={setRef} className="relative select-none">
        <svg width={w} height={h} role="img" aria-label={isBat ? "Battery state of charge over the mission" : "Solar array output and load over the mission"} {...bind}
          onClick={() => i !== null && onCursor?.(s.t[i])} style={{ cursor: onCursor ? "pointer" : undefined }}>
          <defs>
            <linearGradient id={`pa-${uid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.32" />
              <stop offset="1" stopColor={color} stopOpacity="0.03" />
            </linearGradient>
          </defs>
          {sc.windows.dark.map((b, k) => (
            <rect key={k} x={x(b.start)} width={Math.max(1, x(b.end) - x(b.start))} y={m.t} height={plotH} fill="var(--panel-2)" opacity={0.9} />
          ))}
          {niceTicks(0, yMax, 4).map((z) => (
            <g key={z}>
              <line x1={m.l} x2={w - m.r} y1={y(z)} y2={y(z)} stroke="var(--grid)" />
              <text x={m.l - 8} y={y(z) + 4} textAnchor="end" {...AXIS}>{isBat ? `${z}%` : z >= 1000 ? `${(z / 1000).toLocaleString("en-US")} kW` : `${z} W`}</text>
            </g>
          ))}
          {ticks.minor.map((t) => <line key={t} x1={x(t)} x2={x(t)} y1={m.t} y2={bottom} stroke="var(--grid)" strokeOpacity={ticks.major.includes(t) ? 1 : 0.5} />)}
          <path d={paths.area} fill={`url(#pa-${uid})`} />
          <path d={paths.line} fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" />
          {!isBat && <path d={paths.load} fill="none" stroke="var(--fg)" strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="5 4" />}
          {isBat && (
            <g pointerEvents="none">
              <circle cx={x(s.t[minI])} cy={y(power.soc[minI] * 100)} r={4} fill="var(--bg)" stroke={color} strokeWidth={2} />
              <text x={x(s.t[minI])} y={power.soc[minI] < 0.2 ? y(power.soc[minI] * 100) - 10 : y(power.soc[minI] * 100) + 20} textAnchor={x(s.t[minI]) > w - 120 ? "end" : "middle"} fontSize={14} fill="var(--fg)" stroke="var(--bg)" strokeWidth={3} paintOrder="stroke">
                Lowest {fmtPct(power.minSoc)}
              </text>
            </g>
          )}
          <line x1={x(cursor)} x2={x(cursor)} y1={m.t - 4} y2={bottom} stroke="var(--fg)" strokeWidth={1.25} />
          {ticks.major.map((t) => <text key={t} x={x(t)} y={h - 6} textAnchor={x(t) > w - m.r - 24 ? "end" : "middle"} {...AXIS}>{fmtDay(t)}</text>)}
          {i !== null && (
            <g pointerEvents="none" opacity={show ? 1 : 0} className="motion-safe:transition-opacity">
              <line x1={x(s.t[i])} x2={x(s.t[i])} y1={m.t} y2={bottom} stroke="var(--muted)" strokeDasharray="3 3" />
              {!isBat && <circle cx={x(s.t[i])} cy={y(power.loadW[i])} r={3.5} fill="var(--fg)" stroke="var(--bg)" strokeWidth={1.5} />}
              <circle cx={x(s.t[i])} cy={y(v[i])} r={5} fill={color} stroke="var(--bg)" strokeWidth={2} />
            </g>
          )}
        </svg>
        {i !== null && (
          <ChartTip x={x(s.t[i])} w={w} show={show}>
            <TipHead title={fmtWhen(s.t[i])} sub={fmtMissionTime(s.t[i], t0)} />
            {tip(i)}
            {onCursor && <div className="mt-2 border-t border-line pt-1.5 text-faint">Click to move the timeline here</div>}
          </ChartTip>
        )}
      </div>
      <Legend items={isBat ? [
        { label: enthusiast ? "Battery level" : "State of charge", color },
        { label: enthusiast ? "Dark (no sunlight)" : `Dark (under ${Math.round(a.sunDiskThreshold * 100)}% of the Sun visible)`, color: "var(--panel-2)", kind: "area" },
        { label: "Selected time", color: "var(--fg)" },
      ] : [
        { label: enthusiast ? "Power from the panels" : "Array output", color },
        { label: enthusiast ? "Power the lander uses" : `Load (${a.loadW} W operating · ${a.survivalLoadW} W survival)`, color: "var(--fg)", kind: "dash" },
        { label: enthusiast ? "Dark (no sunlight)" : "Dark", color: "var(--panel-2)", kind: "area" },
      ]} />
    </div>
  );
}
