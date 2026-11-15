"use client";

import { ArrowSquareOut } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { InfoTip } from "@/components/InfoTip";
import type { Assumptions } from "@/lib/assumptions";
import type { powerModel } from "@/lib/engine/analysis";
import { HOUR_MS, type Scenario } from "@/lib/engine/scenario";
import { containing, nextAfter } from "@/lib/engine/windows";
import { compass, fmtDeg, fmtHours, fmtPct, fmtUTC } from "@/lib/metrics/format";
import type { MetricValue, Rag } from "@/lib/metrics/types";
import type { Persona } from "@/lib/persona";
import type { SourceId } from "@/lib/sources";
import type { MultiYear } from "@/lib/engine/analysis";

/**
 * Copy for the "Horizon, Sun & Earth views" and the power charts, shared by the site details page and
 * the comparison (D-130), so a scenario column always reads exactly like the solo page.
 */

/** Pick the copy for the current persona: enthusiast → educator → planner, increasingly technical. */
export const by = <T,>(p: Persona, enthusiast: T, educator: T, planner: T) => (p === "enthusiast" ? enthusiast : p === "educator" ? educator : planner);

/** Chart block titles per persona. The page body and its contents both use these, so the names always match (D-110). */
export const blockTitles = (p: Persona) => ({
  horizon: by(p, "What you would see on the horizon", "Horizon view: what hides the Sun and Earth", "Horizon view: terrain, Sun and Earth tracks"),
  sunView: by(p, "When the Sun is up", "Sun from the site", "Sun from the site: elevation vs terrain horizon"),
  earthView: by(p, "When you can see Earth", "Earth from the site", "Earth from the site: elevation vs terrain, DSN coverage"),
  libration: by(p, "Why Earth wobbles in the sky", "Libration: why Earth wobbles", "Libration: Earth az/el track"),
  battery: by(p, "Battery over the mission", "Battery charge", "Battery charge"),
  arrayPower: by(p, "Solar power", "Array power", "Array power"),
});

export const viewsLead = (p: Persona) => by(p,
  "What the sky looks like from this spot, and when the Sun and Earth are up.",
  "How the terrain, the Sun's low path and Earth's wobble combine at this site. Everything shows the time selected on the timeline.",
  "Terrain horizon (LOLA), Sun and Earth topocentric tracks (JPL Horizons) and visibility windows, at the timeline's selected time.",
);

type Power = ReturnType<typeof powerModel>;

/** Lead line and info tip for each chart block. `power` adds this scenario's numbers to the power tips (site details only). */
export function blockCopy(p: Persona, a: Assumptions, ctx: { maxRangeKm?: number; stepMin?: number; power?: Power | null }) {
  const P = <T,>(e: T, ed: T, pl: T) => by(p, e, ed, pl);
  const T = blockTitles(p);
  const blocks: Record<"horizon" | "sunView" | "earthView" | "libration" | "battery" | "arrayPower", { title: string; lead?: string; tip: ReactNode }> = {
    horizon: {
      title: T.horizon,
      lead: P(
        "At the pole the Sun circles around the horizon instead of rising high. Small hills decide whether it is hidden.",
        "Turn on the spot and trace the skyline: that's the grey band. The Sun's path stays low and goes all the way round; Earth hardly moves. Whatever dips under the skyline is hidden.",
        undefined,
      ),
      tip: <InfoTip title="Horizon view" sources={["lola-pds", "jpl-horizons"]}>
        The grey skyline is the real terrain around the site, traced out to {ctx.maxRangeKm ?? "—"} km in LOLA elevation data, including the curve of the Moon, seen from {a.mastHeightM} m above the ground. There is no air, so no refraction: the Sun or Earth is visible only when it clears this line. Coloured lines are their paths during the mission; the discs show where they are at the selected time. The compass runs clockwise from left to right: north, east, south, west, back to north. Click a path to move the timeline to when the Sun or Earth was there.
      </InfoTip>,
    },
    sunView: {
      title: T.sunView,
      lead: P("The orange line is how high the Sun is; the grey is the hills in front of it. Solid orange means the site is in sunlight.", "The Sun's height over time against the height of the terrain in the Sun's direction. Where the orange line clears the grey, the site is sunlit.", undefined),
      tip: <InfoTip title="Sun from the site" sources={["jpl-horizons", "lola-pds", "bryant-2009"]}>Sun elevation (orange) against the terrain horizon in the Sun&apos;s direction at each moment (grey). Solid where at least {Math.round(a.sunDiskThreshold * 100)}% of the disk is visible, dashed where it is hidden; the lane underneath shows the sunlit windows. Click to move the timeline.</InfoTip>,
    },
    earthView: {
      title: T.earthView,
      lead: P("Earth barely moves in the Moon's sky, but at the pole it sits so low that a small wobble hides it behind hills.", "Earth's height over time against the terrain in Earth's direction. A radio link also needs a Deep Space Network antenna on Earth that can see the Moon (one grey lane per complex); the bottom lane is when both line up.", undefined),
      tip: <InfoTip title="Earth from the site" sources={["jpl-horizons", "lola-pds", "dsn-810-005"]}>Earth elevation (blue) against the terrain horizon in Earth&apos;s direction. Solid where at least {Math.round(a.earthDiskThreshold * 100)}% of Earth&apos;s disk is visible. Lanes: Earth in view; one per DSN complex (Canberra, Madrid, Goldstone, in the order the Moon reaches them as Earth turns) showing when the Moon is ≥ {a.dsnMinElevDeg}° above that complex&apos;s horizon; Contact = both at once. Red marks are handover gaps: Earth is in view but no complex can see the Moon. Click to move the timeline.</InfoTip>,
    },
    libration: {
      title: T.libration,
      tip: <InfoTip title="Libration" sources={["jpl-horizons", "svs-libration"]}>The Moon keeps one face to Earth, but its slightly tilted, elliptical orbit makes Earth drift in a small loop in the lunar sky over each month. Near the pole that loop can carry Earth below the horizon. Libration is already in the JPL Horizons geometry; nothing is added.</InfoTip>,
    },
    battery: {
      title: T.battery,
      lead: P("The lander runs on sunlight. When the Sun hides behind hills, it lives off its battery.", "The battery fills while the panels make more than the lander uses, and drains in the dark.", undefined),
      tip: <InfoTip title="Battery charge" sources={["jpl-horizons", "lola-pds", "nssdc-moon", "mission-assumption"]}>
        Simulated every {ctx.stepMin ?? "—"} min from landing, starting full at {a.batteryWh.toLocaleString("en-US")} Wh. Each step adds the array output and subtracts the load: {a.loadW} W while any sunlight reaches the array, {a.survivalLoadW} W survival (heaters) otherwise. Charge stays between 0 and full.{ctx.power ? ` Lowest: ${fmtPct(ctx.power.minSoc, 1)} at ${fmtUTC(ctx.power.minSocAt)}${ctx.power.depletedAt ? `; first empty at ${fmtUTC(ctx.power.depletedAt)}` : ""}.` : ""} Lander values are example assumptions you can change.
      </InfoTip>,
    },
    arrayPower: {
      title: T.arrayPower,
      lead: P("How much power the solar panels make, against what the lander needs (dashed line).", "Output depends on how much of the Sun clears the terrain and how squarely sunlight hits the panels.", undefined),
      tip: <InfoTip title="Array power" sources={["jpl-horizons", "lola-pds", "nssdc-moon", "mission-assumption"]}>
        Output = 1,361 W/m² (sunlight at 1 AU, NSSDCA) ÷ (Sun distance in AU)² × visible share of the Sun&apos;s disk × cos(angle between sunlight and the panel) × {a.panelAreaM2} m² × {a.panelEfficiency} efficiency. Mounting: {a.panelTracking === "vertical-tracking" ? "vertical, turned to face the Sun" : a.panelTracking === "vertical-fixed" ? `vertical, fixed facing ${a.panelFixedAzDeg}°` : "horizontal"}.{ctx.power ? ` Mean ${Math.round(ctx.power.avgW)} W, peak ${Math.round(ctx.power.peakW)} W.` : ""} The dashed line is the load.
      </InfoTip>,
    },
  };
  return blocks;
}

/** Libration explanation for enthusiasts and educators (planners get per-site numbers instead). */
export function LibrationText({ persona, multi }: { persona: Persona; multi?: MultiYear | null }) {
  if (persona === "enthusiast") {
    return (
      <div className="space-y-2.5">
        <p>From the Moon, Earth hangs almost still in the sky. It never rises and sets like the Sun does here.</p>
        <p>But it does sway a little, tracing the small loop on the chart. At the south pole Earth sits right at the horizon, so that small sway decides whether you can call home.</p>
      </div>
    );
  }
  if (persona === "educator") {
    return (
      <div className="space-y-2.5">
        <p><b className="font-medium text-fg">Libration in longitude:</b> the Moon spins at a steady rate, but moves faster near perigee and slower near apogee, so we see a little around its east and west edges.</p>
        <p><b className="font-medium text-fg">Libration in latitude:</b> the Moon&apos;s spin axis is tilted relative to its orbit, so over a month we look slightly over its north and then its south pole.</p>
        {multi && <p>Computed from JPL Horizons for <span className="num">2026–2029</span>, the point on the Moon directly below Earth wanders <span className="num">{fmtDeg(multi.libLonRange[0], 1)}</span> to <span className="num">{fmtDeg(multi.libLonRange[1], 1)}</span> in longitude and <span className="num">{fmtDeg(multi.libLatRange[0], 1)}</span> to <span className="num">{fmtDeg(multi.libLatRange[1], 1)}</span> in latitude.</p>}
        <p>Seen from the Moon, the same motion makes Earth trace the loop on the chart. Try the ±7d buttons to watch Earth dip behind the terrain.</p>
        <a className="inline-flex items-center gap-1 text-fg underline underline-offset-4" href="https://svs.gsfc.nasa.gov/gallery/moonphase/" target="_blank" rel="noreferrer">NASA SVS Moon phase &amp; libration animation <ArrowSquareOut size={16} aria-hidden /></a>
      </div>
    );
  }
  return null;
}

/** "3.3° above flat ground" / "13.4° below flat ground" (never "−13.4° above"). */
export function upDown(el: number, digits: number, ref: string) {
  return `${fmtDeg(Math.abs(el), digits)} ${el >= 0 ? "above" : "below"} ${ref}`;
}

/** Sample index and visibility windows at time `cur`. */
export function statusAt(sc: Scenario, cur: number) {
  const lit = containing(sc.windows.sunlit, cur);
  const dte = containing(sc.windows.dte, cur);
  const nextLit = lit ? null : nextAfter(sc.windows.sunlit, cur);
  const nextDte = dte ? null : nextAfter(sc.windows.dte, cur);
  const i = Math.max(0, Math.min(sc.series.n - 1, Math.round((cur - sc.series.t[0]) / sc.series.stepMs)));
  return { lit, dte, nextLit, nextDte, i };
}

export type StatusCard = { id: "sun" | "earth" | "sunlit" | "joint"; label: string; value: string; sub?: string; color?: string; rag?: Rag; tip: string; sources: SourceId[] };

/** Card titles and tips only (they don't depend on a scenario): the comparison's label column uses them. */
export function statusCardHeads(p: Persona, a: Assumptions): Pick<StatusCard, "id" | "label" | "tip" | "sources" | "color">[] {
  const P = <T,>(e: T, ed: T, pl: T) => by(p, e, ed, pl);
  return [
    { id: "sun", color: "var(--sun)", label: P("Is the Sun up?", "Sun at the selected time", "Sun at selected time"), tip: `Whether at least ${Math.round(a.sunDiskThreshold * 100)}% of the Sun's disk clears the LOLA terrain horizon at the selected time, and how long until that changes.`, sources: ["jpl-horizons", "lola-pds"] },
    { id: "earth", color: "var(--earth)", label: P("Can we call Earth?", "Earth at the selected time", "Earth at selected time"), tip: `Direct-to-Earth contact needs at least ${Math.round(a.earthDiskThreshold * 100)}% of Earth's disk above the terrain horizon, and a Deep Space Network antenna that can see the Moon (≥ ${a.dsnMinElevDeg}° up).`, sources: ["jpl-horizons", "lola-pds", "dsn-810-005"] },
    { id: "sunlit", label: P("Sunlight over the mission", "Sunlit, whole mission", "Sunlit % of mission"), tip: `Share of the ${a.missionDays}-day mission with at least ${Math.round(a.sunDiskThreshold * 100)}% of the Sun's disk above the terrain horizon.`, sources: ["jpl-horizons", "lola-pds"] },
    { id: "joint", label: P("Power and a call home at once", "Sun and Earth together", "Sun + Earth together"), tip: "Hours with both sunlight (power) and Earth in view (direct communication) at the same time.", sources: ["jpl-horizons", "lola-pds"] },
  ];
}

/** The four status cards above the charts (D-097): Sun and Earth at the selected time, then two mission totals. */
export function statusCards(p: Persona, a: Assumptions, sc: Scenario, m: Record<string, MetricValue>, cur: number): StatusCard[] {
  const P = <T,>(e: T, ed: T, pl: T) => by(p, e, ed, pl);
  const status = statusAt(sc, cur);
  const [sunH, earthH, litH, jointH] = statusCardHeads(p, a);
  const s = sc.series, i = status.i;
  return [
    {
      ...sunH,
      value: status.lit ? (status.lit.end >= sc.end - s.stepMs ? P("Up for the rest of the mission", "Sunlit to the end of the mission", "Lit · rest of mission") : P(`Up · sets in ${fmtHours((status.lit.end - cur) / HOUR_MS)}`, `Sunlit · sets in ${fmtHours((status.lit.end - cur) / HOUR_MS)}`, `Lit · sets in ${fmtHours((status.lit.end - cur) / HOUR_MS)}`)) : status.nextLit ? P(`Hidden · back in ${fmtHours((status.nextLit.start - cur) / HOUR_MS)}`, `Dark · rises in ${fmtHours((status.nextLit.start - cur) / HOUR_MS)}`, `Dark · rises in ${fmtHours((status.nextLit.start - cur) / HOUR_MS)}`) : P("Hidden all mission", "Dark all mission", "Dark · all mission"),
      sub: P(
        `Toward the ${compass(s.sunAz[i])}, ${upDown(s.sunEl[i], 1, "flat ground")}`,
        `${upDown(s.sunEl[i], 2, "the horizontal")}, toward ${compass(s.sunAz[i])}; ${fmtPct(s.sunFrac[i])} of its disk clears the terrain`,
        `el ${fmtDeg(s.sunEl[i], 2)} · az ${fmtDeg(s.sunAz[i], 1)} ${compass(s.sunAz[i])} · ${fmtPct(s.sunFrac[i], 1)} disk`,
      ),
    },
    {
      ...earthH,
      value: status.dte ? (status.dte.end >= sc.end - s.stepMs ? P("Yes, for the rest of the mission", "In view to the end of the mission", "In view · rest of mission") : P(`Yes · for ${fmtHours((status.dte.end - cur) / HOUR_MS)}`, `In view · sets in ${fmtHours((status.dte.end - cur) / HOUR_MS)}`, `In view · sets in ${fmtHours((status.dte.end - cur) / HOUR_MS)}`)) : status.nextDte ? P(`Not now · back in ${fmtHours((status.nextDte.start - cur) / HOUR_MS)}`, `Hidden · rises in ${fmtHours((status.nextDte.start - cur) / HOUR_MS)}`, `Hidden · rises in ${fmtHours((status.nextDte.start - cur) / HOUR_MS)}`) : P("Not during this mission", "Hidden all mission", "Hidden · all mission"),
      sub: P(
        `Toward the ${compass(s.earthAz[i])}, ${upDown(s.earthEl[i], 1, "flat ground")}`,
        `${upDown(s.earthEl[i], 2, "the horizontal")}, toward ${compass(s.earthAz[i])}; ${s.dsnCount[i]} of 3 Deep Space Network sites can see the Moon`,
        `el ${fmtDeg(s.earthEl[i], 2)} · az ${fmtDeg(s.earthAz[i], 1)} ${compass(s.earthAz[i])} · ${s.dsnCount[i]}/3 DSN`,
      ),
    },
    {
      ...litH,
      value: m["sun.solar-availability-fraction"]?.display ?? "—",
      rag: m["sun.solar-availability-fraction"]?.rating?.rag,
      sub: `${P("Longest dark stretch", "Longest dark stretch", "Longest dark")} ${m["sun.longest-continuous-darkness"]?.display ?? "—"}`,
    },
    {
      ...jointH,
      value: m["overall.joint-sunlit-dte-window"]?.display.split(" (")[0] ?? "—",
      rag: m["overall.joint-sunlit-dte-window"]?.rating?.rag,
      sub: `${P("That's ", "That is ", "")}${fmtPct((m["overall.joint-sunlit-dte-window"]?.value ?? 0) / 100)} ${P("of the mission", "of the mission", "of mission")} · Earth in view ${m["earth.total-dte-visibility-fraction"]?.display ?? "—"}`,
    },
  ];
}
