"use client";

import { Fragment, useId, useMemo, type ReactNode } from "react";
import { CONST } from "@/lib/engine/constants";
import { DSN_COMPLEXES, DSN_RELAY_ORDER } from "@/lib/engine/dsn";
import type { Scenario } from "@/lib/engine/scenario";
import { complement, longestMs, nextAfter, totalMs, type Interval } from "@/lib/engine/windows";
import { compass, fmtDeg, fmtHours, fmtLat, fmtLon, fmtPct } from "@/lib/metrics/format";
import type { SourceId } from "@/lib/sources";
import { InfoTip } from "../InfoTip";
import type { Persona } from "@/lib/persona";
import { AXIS, ChartTip, dayTicks, fmtDay, fmtMissionTime, fmtWhen, Legend, niceTicks, sampleAt, scale, TIME_MARGIN, TipHead, TipRows, useComparisonMode, usePlotHover, useWidth } from "./chart-kit";

type Lane = { key: string; label: string; iv: Interval[]; color: string; opacity: number; h: number; gaps?: Interval[]; /** the combined lane: a little extra space above, label in the text colour */ result?: boolean };
const HOUR = 3_600_000;

/**
 * A body's elevation over the mission against the terrain horizon in its direction. The terrain is
 * filled like the horizon view (same skyline, traced in time order). The body's line is solid while it
 * counts as visible (sunlit / Earth in view) and faded while hidden. Lanes underneath summarise the
 * usable windows. For Earth (D-095) they read as a sum: Earth in view, then one lane per DSN complex in
 * the order the Moon reaches them as Earth turns, then Contact (both at once) with handover gaps in red,
 * and a computed summary underneath. Hover for exact values; click to move the timeline.
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
  const wn = sc.windows;
  const bands: Interval[] = isSun ? wn.sunlit : wn.dte;
  const planner = persona === "planner", enthusiast = persona === "enthusiast";
  const lanes: Lane[] = isSun
    ? [{ key: "sun", label: "Sunlit", iv: wn.sunlit, color, opacity: 0.85, h: 14 }]
    : [
      { key: "dte", label: enthusiast ? "Earth up" : "In view", iv: wn.dte, color, opacity: 0.5, h: 14 },
      ...DSN_RELAY_ORDER.map((k) => ({ key: DSN_COMPLEXES[k].id, label: enthusiast ? DSN_COMPLEXES[k].place : DSN_COMPLEXES[k].short, iv: wn.dsnBy[k], color: "var(--muted)", opacity: 0.6, h: 12 })),
      { key: "contact", label: enthusiast ? "Call home" : "Contact", iv: wn.dteDsn, color, opacity: 1, h: 14, gaps: wn.dteNoDsn, result: true },
    ];
  const laneY: number[] = [];
  let lanesH = 0;
  for (const ln of lanes) {
    if (ln.result) lanesH += 4;
    laneY.push(lanesH);
    lanesH += ln.h + 8; // ≥ 20px pitch so the hoverable labels never touch
  }

  const plotH = 190;
  const m = { ...TIME_MARGIN, t: 12, b: 30 + lanesH };
  const h = m.t + plotH + m.b;
  const n = s.n;
  const t0 = s.t[0], t1 = s.t[n - 1];
  const dsn = useDsnSummary(sc, isSun);

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
  const lanesTop = plotBottom + 8;
  const lanesBottom = lanesTop + lanesH - 8;

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
        {/* lanes */}
        {lanes.map((ln, k) => {
          const ly = lanesTop + laneY[k];
          return (
            <g key={ln.key}>
              <rect x={m.l} y={ly} width={w - m.l - m.r} height={ln.h} fill="var(--panel-2)" />
              {ln.iv.map((b, j) => (
                <rect key={j} x={x(b.start)} width={Math.max(1.5, x(b.end) - x(b.start))} y={ly} height={ln.h} fill={ln.color} opacity={ln.opacity} />
              ))}
              {/* handover gaps: Earth is up but no DSN complex has the Moon; widened so 10 min still shows */}
              {ln.gaps?.map((g, j) => {
                const gx = x(g.start), gw = x(g.end) - gx;
                return <rect key={`g${j}`} x={gx + gw / 2 - Math.max(3, gw) / 2} width={Math.max(3, gw)} y={ly - 2} height={ln.h + 4} fill="var(--critical)" />;
              })}
            </g>
          );
        })}
        {/* selected time on the page timeline, through the lanes so their state reads off it */}
        <line x1={x(cursor)} x2={x(cursor)} y1={m.t - 4} y2={lanesBottom} stroke="var(--fg)" strokeWidth={1.25} />
        <circle cx={x(cursor)} cy={y(el[ci])} r={4.5} fill={color} stroke="var(--bg)" strokeWidth={1.5} />
        {ticks.major.map((t) => (
          <text key={t} x={x(t)} y={h - 6} textAnchor={x(t) > w - m.r - 24 ? "end" : "middle"} {...AXIS}>{fmtDay(t)}</text>
        ))}
        {/* hover guide, never intercepts the pointer */}
        {i !== null && (
          <g pointerEvents="none" opacity={show ? 1 : 0} className="motion-safe:transition-opacity">
            <line x1={x(s.t[i])} x2={x(s.t[i])} y1={m.t} y2={lanesBottom + 2} stroke="var(--muted)" strokeDasharray="3 3" />
            <circle cx={x(s.t[i])} cy={y(hz[i])} r={3.5} fill="var(--terrain)" stroke="var(--fg)" strokeWidth={1} />
            <circle cx={x(s.t[i])} cy={y(el[i])} r={5} fill={color} stroke="var(--bg)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {/* lane labels: HTML so each opens a card explaining the lane (D-098) */}
      {lanes.map((ln, k) => {
        const info = laneInfo(ln.key);
        return (
          <div key={ln.key} className={`absolute flex h-5 -translate-y-1/2 items-center text-sm ${ln.result ? "text-fg" : "text-muted"}`} style={{ right: w - (m.l - 8), top: lanesTop + laneY[k] + ln.h / 2 }}>
            <InfoTip title={info.title} sources={info.sources} trigger={ln.label}>{info.body}</InfoTip>
          </div>
        );
      })}
      {i !== null && (
        <ChartTip x={x(s.t[i])} w={w} show={show}>
          <TipHead title={fmtWhen(s.t[i])} sub={fmtMissionTime(s.t[i], t0)} />
          {enthusiast ? (
            <p className="mt-1.5 text-muted">
              {frac[i] >= thr ? `${name} is ${isSun ? "up and lighting the site" : "above the hills: you could call home"}.` : frac[i] > 0 ? `${name} is peeking over the hills, but mostly hidden.` : `${name} is hidden behind the hills.`}
              {" "}It is <span className="num text-fg">{fmtDeg(Math.abs(el[i]), 1)}</span> {el[i] >= 0 ? "above" : "below"} flat ground; the hills in that direction rise to <span className="num text-fg">{fmtDeg(hz[i], 1)}</span>.
              {!isSun && <>{" "}{dishSentence(i)}</>}
            </p>
          ) : (
            <TipRows rows={[
              [`${name} elevation`, fmtDeg(el[i], planner ? 3 : 2)],
              ["Terrain horizon", fmtDeg(hz[i], planner ? 3 : 2)],
              ["Clearance", `${el[i] - hz[i] >= 0 ? "+" : ""}${fmtDeg(el[i] - hz[i], planner ? 3 : 2)}`, el[i] - hz[i] >= 0 ? "text-good" : "text-critical"],
              ["Direction", `${fmtDeg(az[i], 1)} ${compass(az[i])}`],
              ["Disk visible", fmtPct(frac[i], 1)],
              ["Status", frac[i] >= thr ? (isSun ? "Sunlit" : "In view") : frac[i] > 0 ? `Below ${Math.round(thr * 100)}% threshold` : "Hidden", frac[i] >= thr ? "text-good" : "text-muted"],
              ...(isSun ? [] : DSN_RELAY_ORDER.map((k): [string, string, string] => {
                const e = s.dsnEl[k][i], up = e >= a.dsnMinElevDeg;
                return [DSN_COMPLEXES[k].short, planner ? `Moon ${fmtDeg(e, 1)}` : up ? "Sees the Moon" : e > 0 ? `Moon below ${a.dsnMinElevDeg}°` : "Moon set", up ? "text-good" : "text-muted"];
              })),
              !isSun && contactRow(i),
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
        ...(isSun ? [] : [
          { label: enthusiast ? "A NASA dish can see the Moon" : `DSN complex: Moon ≥ ${a.dsnMinElevDeg}° up`, color: "var(--muted)", kind: "area" as const },
          { label: enthusiast ? "Can call home" : "Contact: Earth in view and a DSN complex", color, kind: "area" as const },
          { label: enthusiast ? "Gap between dishes" : "Handover gap: Earth in view, no DSN complex", color: "var(--critical)", kind: "area" as const },
        ]),
        { label: "Selected time", color: "var(--fg)" },
      ]} />
      {dsn && <DsnSummary d={dsn} persona={persona} minEl={a.dsnMinElevDeg} />}
    </div>
  );

  /** What a lane means, in this persona's words, with this mission's numbers (D-098). */
  function laneInfo(key: string): { title: string; body: ReactNode; sources: SourceId[] } {
    const min = a.dsnMinElevDeg;
    const pct = (p: number) => Math.round(p * 100);
    if (key === "sun") return {
      title: "Sunlit",
      body: enthusiast
        ? <>When the Sun is above the hills around the site, so solar panels can work. On this mission: <N>{fmtHours(totalMs(wn.sunlit) / HOUR)}</N> of sunlight.</>
        : <>Bars mark when at least <N>{pct(thr)}%</N> of the Sun&apos;s disk is above the terrain horizon in the Sun&apos;s direction (and not covered by Earth). Sun position from JPL Horizons; terrain horizon from LOLA elevation. This mission: <N>{fmtHours(totalMs(wn.sunlit) / HOUR)}</N> sunlit (<N>{fmtPct(totalMs(wn.sunlit) / (t1 - t0))}</N>).</>,
      sources: ["jpl-horizons", "lola-pds"],
    };
    if (key === "dte") return {
      title: enthusiast ? "Earth up" : "Earth in view",
      body: enthusiast
        ? <>When Earth is above the hills around the site, so a radio could point straight at it. Earth hardly moves in the Moon&apos;s sky, but it wobbles a little each month, and near the pole that wobble can hide it. On this mission: <N>{fmtHours(dsn!.dteH)}</N> with Earth up.</>
        : <>The first condition for a direct-to-Earth link: at least <N>{pct(thr)}%</N> of Earth&apos;s disk is above the terrain horizon at this site. It depends on the site&apos;s terrain and on libration, which moves Earth in a small monthly loop in the lunar sky. It says nothing yet about whether anyone on Earth is listening; that is the three lanes below. This mission: <N>{fmtHours(dsn!.dteH)}</N> in view.</>,
      sources: ["jpl-horizons", "lola-pds"],
    };
    if (key === "contact") return {
      title: enthusiast ? "Call home" : "Contact",
      body: enthusiast
        ? <>When you could actually talk to Earth: Earth is above the hills here <em>and</em> one of NASA&apos;s dish sites can see the Moon (bars above). Red marks are short gaps when Earth is up but no dish site has the Moon yet. On this mission: <N>{fmtHours(dsn!.contactH)}</N>{dsn!.gaps.length ? <>, with <N>{dsn!.gaps.length}</N> short gaps</> : null}.</>
        : <>When a direct-to-Earth radio link is geometrically possible: Earth in view (top lane) <em>and</em> at least one DSN complex with the Moon ≥ <N>{min}°</N> up (the three lanes above). Red marks are handover gaps: Earth is in view but no complex has the Moon high enough. This mission: <N>{fmtHours(dsn!.contactH)}</N> of contact; <N>{dsn!.gaps.length}</N> {dsn!.gaps.length === 1 ? "gap" : "gaps"} while Earth is in view{dsn!.longest ? <>, longest <N>{fmtHours((dsn!.longest.end - dsn!.longest.start) / HOUR)}</N></> : null}. Geometry only: real DSN time is scheduled and shared with other missions.</>,
      sources: ["jpl-horizons", "lola-pds", "dsn-810-005"],
    };
    const k = DSN_COMPLEXES.findIndex((c) => c.id === key);
    const c = DSN_COMPLEXES[k];
    const j = DSN_RELAY_ORDER.indexOf(k as 0 | 1 | 2);
    const prev = DSN_COMPLEXES[DSN_RELAY_ORDER[(j + 2) % 3]], next = DSN_COMPLEXES[DSN_RELAY_ORDER[(j + 1) % 3]];
    const lon = c.lonE > 180 ? c.lonE - 360 : c.lonE;
    const perDay = (dsn!.share[k] * 24);
    return {
      title: enthusiast ? `${c.place}: a NASA dish site` : `${c.short}: Deep Space Network complex`,
      body: enthusiast
        ? <>NASA talks to faraway spacecraft through the Deep Space Network: three sites with giant radio dishes, in California, Spain and Australia, spread around the globe so one of them can almost always see the Moon. This one is near {c.short}, {c.place}. Grey bars: the Moon is high enough in the sky there (at least <N>{min}°</N>) for the dish to point at it. As Earth spins, the Moon rises and sets there about once a day, so the bars come and go: about <N>{fmtHours(perDay)}</N> a day on this mission. The Moon reaches {prev.place} before this site and {next.place} after it.</>
        : <>NASA&apos;s Deep Space Network (DSN) has three complexes about a third of the way round the globe from each other, so that as Earth turns one can usually see a spacecraft. This lane is <span className="text-fg">{c.name}</span>, {c.place} (<N>{fmtLat(c.lat)}</N>, <N>{fmtLon(lon)}</N>). Bars mark when the Moon is at least <N>{min}°</N> above this complex&apos;s horizon{planner ? " (your assumption \"Minimum Moon elevation at a DSN station\"; antennas avoid very low elevations)" : "; antennas avoid pointing lower"}. Earth&apos;s rotation sets the rhythm, not the lunar site: the Moon is up here about once a day, for about <N>{fmtHours(perDay)}</N> (<N>{fmtPct(dsn!.share[k])}</N> of this mission). As Earth turns the Moon arrives here from {prev.short} and moves on to {next.short}.</>,
      sources: ["dsn-810-005", "jpl-horizons"],
    };
  }

  /** Enthusiast hover line about the dishes on Earth at sample i. */
  function dishSentence(i: number) {
    const up = DSN_RELAY_ORDER.filter((k) => s.dsnEl[k][i] >= a.dsnMinElevDeg).map((k) => DSN_COMPLEXES[k].place);
    if (up.length) return `NASA's dish site in ${up.join(" and ")} can see the Moon${frac[i] >= thr ? ", so a call would go through." : ", but the hills here block the signal."}`;
    const next = nextAfter(wn.dsn, s.t[i]);
    return `No NASA dish can see the Moon right now${next ? `; the next one picks it up in ${fmtHours((next.start - s.t[i]) / HOUR)}` : ""}.`;
  }

  function contactRow(i: number): [string, string, string] {
    if (frac[i] < thr) return ["Contact", "Earth hidden", "text-muted"];
    if (s.dsnCount[i] > 0) return ["Contact", "Possible", "text-good"];
    const next = nextAfter(wn.dsn, s.t[i]);
    return ["Contact", `Handover gap${next ? `, ${fmtHours((next.start - s.t[i]) / HOUR)} to go` : ""}`, "text-critical"];
  }
}

type DsnSummaryData = NonNullable<ReturnType<typeof useDsnSummary>>;

/**
 * Everything the DSN summary says, computed from this scenario's windows: per-complex share, gaps over
 * the whole mission and which handover each falls in, and the gaps that matter (while Earth is in view).
 */
function useDsnSummary(sc: Scenario, off: boolean) {
  return useMemo(() => {
    if (off) return null;
    const { series: s, windows: w, start, end } = sc;
    const span = end - start;
    const share = [0, 1, 2].map((k) => totalMs(w.dsnBy[k]) / span);
    // interior gaps only: one cut by the mission start or end has an unknown handover
    const gapsAll = complement(w.dsn, start, end).filter((g) => g.start > start && g.end < end);
    const strongest = (i: number) => [0, 1, 2].reduce((b, k) => (s.dsnEl[k][i] > s.dsnEl[b][i] ? k : b), 0);
    const clampI = (i: number) => Math.max(0, Math.min(s.n - 1, i));
    const counts = new Map<string, { from: number; to: number; n: number }>();
    for (const g of gapsAll) {
      // just before the gap only the setting complex is above the floor; just after, only the rising one
      const from = strongest(clampI(Math.floor((g.start - s.t[0]) / s.stepMs)));
      const to = strongest(clampI(Math.ceil((g.end - s.t[0]) / s.stepMs)));
      const key = `${from}-${to}`;
      counts.set(key, { from, to, n: (counts.get(key)?.n ?? 0) + 1 });
    }
    const handovers = [...counts.values()].sort((p, q) => q.n - p.n);
    // longitude the Moon has to travel (westward, as Earth turns) between consecutive complexes
    const spacing = DSN_RELAY_ORDER.map((k, j) => {
      const next = DSN_COMPLEXES[DSN_RELAY_ORDER[(j + 1) % 3]];
      return { from: k, deg: (((DSN_COMPLEXES[k].lonE - next.lonE) % 360) + 360) % 360 };
    });
    const gaps = w.dteNoDsn;
    const longest = gaps.reduce<Interval | null>((b, g) => (!b || g.end - g.start > b.end - b.start ? g : b), null);
    return {
      share, any: totalMs(w.dsn) / span, hoursPerDay: (24 * (share[0] + share[1] + share[2])) / 3,
      gapsAll, longestAllH: longestMs(gapsAll) / HOUR, handovers, spacing,
      dteH: totalMs(w.dte) / HOUR, contactH: totalMs(w.dteDsn) / HOUR, contactShare: totalMs(w.dteDsn) / span,
      gaps, gapH: totalMs(gaps) / HOUR, longest,
    };
  }, [sc, off]);
}

const N = ({ children }: { children: ReactNode }) => <span className="num text-fg">{children}</span>;
const ho = (h: { from: number; to: number }) => `${DSN_COMPLEXES[h.from].short} → ${DSN_COMPLEXES[h.to].short}`;

function DsnSummary({ d, persona, minEl }: { d: DsnSummaryData; persona: Persona; minEl: number }) {
  const stacked = useComparisonMode();
  const top = d.handovers[0];
  const widest = d.spacing.reduce((b, x) => (x.deg > b.deg ? x : b));
  const topIsWidest = !!top && top.from === widest.from;
  const gapLine = d.gaps.length
    ? <><N>{d.gaps.length}</N> {d.gaps.length === 1 ? "gap" : "gaps"} while Earth is up here, the longest <N>{fmtHours((d.longest!.end - d.longest!.start) / HOUR)}</N></>
    : null;

  if (persona === "planner") {
    // Each value is a list of parts: one line of "a · b · c" on the site details page; in the narrow
    // comparison columns the key sits above its value and each part gets its own line (D-131b).
    const rows: [string, ReactNode[]][] = [
      [`DSN visibility (Moon ≥ ${minEl}°)`, [...DSN_RELAY_ORDER.map((k) => <>{DSN_COMPLEXES[k].short} <N>{fmtPct(d.share[k])}</N></>), <>any <N>{fmtPct(d.any)}</N> of the mission</>]],
      ["Coverage gaps, whole mission", d.gapsAll.length
        ? [<><N>{d.gapsAll.length}</N>, longest <N>{fmtHours(d.longestAllH)}</N>; by handover</>, ...d.handovers.map((h) => <>{ho(h)} <N>{h.n}</N></>)]
        : ["None"]],
      [`While Earth is in view (${fmtHours(d.dteH)})`, d.gaps.length
        ? [<><N>{d.gaps.length}</N> {d.gaps.length === 1 ? "gap" : "gaps"}, <N>{fmtHours(d.gapH)}</N> in all</>, <>longest <N>{fmtHours((d.longest!.end - d.longest!.start) / HOUR)}</N> from <N>{fmtWhen(d.longest!.start)}</N></>]
        : [d.dteH > 0 ? "No gaps" : "Earth never in view"]],
      ["Contact (Earth in view ∩ DSN)", [<><N>{fmtHours(d.contactH)}</N> (<N>{fmtPct(d.contactShare)}</N> of the mission)</>]],
      ["Complex spacing (Moon's westward path)", d.spacing.map((x, j) => <>{ho({ from: x.from, to: DSN_RELAY_ORDER[(j + 1) % 3] })} <N>{fmtDeg(x.deg, 0)}</N></>)],
    ];
    return (
      <div className="mt-4 max-w-4xl border-t border-line pt-3 text-sm">
        {stacked ? (
          <dl className="space-y-2.5">
            {rows.map(([k, parts]) => (
              <div key={k}>
                <dt className="text-muted">{k}</dt>
                <dd>{parts.map((p, j) => <div key={j}>{p}</div>)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[max-content_minmax(0,1fr)]">
            {rows.map(([k, parts]) => <Fragment key={k}><dt className="text-muted">{k}</dt><dd>{parts.map((p, j) => <Fragment key={j}>{j ? (k.startsWith("Coverage") && j === 1 ? " " : " · ") : ""}{p}</Fragment>)}</dd></Fragment>)}
          </dl>
        )}
        <p className="mt-2 text-muted">Geometric visibility only: real DSN passes are scheduled and shared with other missions.</p>
      </div>
    );
  }

  if (persona === "educator") {
    return (
      <div className="mt-4 max-w-4xl space-y-2 border-t border-line pt-3 text-sm leading-relaxed text-muted">
        <p>
          A direct radio link needs two independent things. <span className="text-fg">Earth in view</span> depends on this site&apos;s terrain and the Moon&apos;s libration (top lane).
          {" "}<span className="text-fg">A Deep Space Network antenna that can see the Moon</span> depends on Earth&apos;s rotation: each complex has the Moon at least <N>{minEl}°</N> above its horizon for about <N>{fmtHours(d.hoursPerDay)}</N> a day, and as Earth turns the Moon reaches Canberra first, then Madrid, then Goldstone, so the three lanes step along like a relay.
        </p>
        <p>
          <span className="text-fg">Contact</span> (bottom lane) is where both hold: <N>{fmtHours(d.contactH)}</N> of the <N>{fmtHours(d.dteH)}</N> Earth is in view.
          {" "}Red marks are handover gaps, when the next complex doesn&apos;t have the Moon high enough yet{gapLine ? <>: {gapLine}</> : " (none while Earth is in view on this mission)"}.
          {top && <>{" "}Most gaps fall at the <span className="text-fg">{ho(top)}</span> handover (<N>{top.n}</N> of <N>{d.gapsAll.length}</N> this mission){topIsWidest ? <>, because those two complexes are <N>{fmtDeg(widest.deg, 0)}</N> of longitude apart rather than an even <N>120°</N></> : null}.</>}
          {" "}Gaps grow on days when the Goldstone and Madrid lanes shorten: the Moon is then far south in Earth&apos;s sky, so the two northern-hemisphere complexes see it for less of the day.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 max-w-4xl border-t border-line pt-3 text-sm leading-relaxed text-muted">
      {d.dteH > 0 ? (
        <p>
          Calling home needs two things at once: Earth above the hills here, and one of NASA&apos;s three giant dish sites (Australia, Spain, California) facing the Moon.
          {" "}As Earth spins, each site sees the Moon for part of the day and then hands it on to the next, so the three grey stripes step along like a relay.
          {" "}{gapLine ? <>Sometimes the next dish isn&apos;t ready yet, leaving a short gap (red): {gapLine}.</> : "On this mission the hand-overs never leave a gap while Earth is up."}
          {" "}In all you could call home for <N>{fmtHours(d.contactH)}</N>.
        </p>
      ) : (
        <p>Earth never gets above the hills here during this mission, so there&apos;s no direct line home, whatever the dishes on Earth are doing.</p>
      )}
    </div>
  );
}
