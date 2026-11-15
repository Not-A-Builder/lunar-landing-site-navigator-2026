"use client";

import { ArrowCounterClockwise, ArrowSquareOut, DownloadSimple, PencilSimple, Plus, SlidersHorizontal, Steps, Warning } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BodyTimeline } from "@/components/charts/BodyTimeline";
import { HorizonPanorama } from "@/components/charts/HorizonPanorama";
import { LibrationChart } from "@/components/charts/LibrationChart";
import { MissionTimeline } from "@/components/charts/MissionTimeline";
import { PowerCharts } from "@/components/charts/PowerCharts";
import { InfoTip } from "@/components/InfoTip";
import { NumText } from "@/components/Num";
import { RagBadge } from "@/components/RagBadge";
import { DateField, TimeField } from "@/components/site-selection/DateTimePickers";
import { useEffectiveAssumptions } from "@/lib/assumptions-store";
import { downloadCsv } from "@/lib/csv";
import { enthusiastPick } from "@/lib/enthusiast-metrics";
import { powerModel } from "@/lib/engine/analysis";
import { DAY_MS, HOUR_MS } from "@/lib/engine/scenario";
import { containing, nextAfter } from "@/lib/engine/windows";
import { compass, fmtDeg, fmtElevation, fmtHours, fmtLat, fmtLon, fmtPct, fmtUTC } from "@/lib/metrics/format";
import { usePersona, type Persona } from "@/lib/persona";
import { GROUP_LABELS, isPolar, type Site } from "@/lib/sites";
import type { SourceId } from "@/lib/sources";
import { useAnalysis } from "@/lib/use-analysis";
import { useNowHour } from "@/lib/use-now";
import { AssumptionsModal } from "./AssumptionsModal";
import { BandsModal } from "./BandsModal";
import { useEditor } from "./editor-store";
import { categoryAnchor, metricAnchor, metricLabel, MetricList, shownMetrics } from "./MetricList";
import { PageToc, type TocItem } from "./PageToc";
import { btnPrimary, btnSecondary } from "@/lib/ui";

/** Pick the copy for the current persona: enthusiast → educator → planner, increasingly technical. */
const by = <T,>(p: Persona, enthusiast: T, educator: T, planner: T) => (p === "enthusiast" ? enthusiast : p === "educator" ? educator : planner);

/** Chart block titles per persona. The page body and its contents both use these, so the names always match (D-110). */
const blockTitles = (p: Persona) => ({
  horizon: by(p, "What you would see on the horizon", "Horizon view: what hides the Sun and Earth", "Horizon view: terrain, Sun and Earth tracks"),
  sunView: by(p, "When the Sun is up", "Sun from the site", "Sun from the site: elevation vs terrain horizon"),
  earthView: by(p, "When you can see Earth", "Earth from the site", "Earth from the site: elevation vs terrain, DSN coverage"),
  libration: by(p, "Why Earth wobbles in the sky", "Libration: why Earth wobbles", "Libration: Earth az/el track"),
  battery: by(p, "Battery over the mission", "Battery charge", "Battery charge"),
  arrayPower: by(p, "Solar power", "Array power", "Array power"),
});

/**
 * Page 2: one site at one landing time (D-082). Header (name, coordinates, metadata, editors, compare),
 * landing date & time with the mission timeline, then a 3 / 9 split: contents on the left, views and
 * metrics on the right. Same structure for every persona; copy and depth change.
 */
export function SiteDetails({ site }: { site: Site | null }) {
  const params = useSearchParams();
  const router = useRouter();
  const persona = usePersona((s) => s.persona);
  const cardH = CARD_H[persona];
  // Enthusiasts always see results for the default assumptions and bands (D-117).
  const { a, bands: bandOverrides } = useEffectiveAssumptions(persona);
  const openEditor = useEditor((s) => s.open);
  const closeEditor = useEditor((s) => s.close);
  // Enthusiasts don't get the planner editors (D-114): close one left open when switching to that persona.
  const enthusiast = persona === "enthusiast";
  useEffect(() => {
    if (enthusiast) closeEditor();
  }, [enthusiast, closeEditor]);
  const nowHour = useNowHour();
  const tParam = params.get("t");
  const landingMs = useMemo(() => {
    const ms = tParam ? Date.parse(tParam) : NaN;
    return Number.isFinite(ms) ? ms : nowHour;
  }, [tParam, nowHour]);
  const [cursorState, setCursorState] = useState<{ base: number | null; t: number } | null>(null);
  const cursor = cursorState && cursorState.base === landingMs ? cursorState.t : landingMs;
  const setCursor = (t: number) => setCursorState({ base: landingMs, t });
  // Timeline playback (D-093). Any time the user picks a time (timeline, charts, "Back to landing"), playback stops there.
  const [playing, setPlaying] = useState(false);
  const pickTime = (t: number) => {
    setPlaying(false);
    setCursor(t);
  };

  const lat = site?.lat ?? numOrNull(params.get("lat"));
  const lon = site?.lon ?? numOrNull(params.get("lon"));
  const key = useMemo(() => (site ? { siteId: site.id } : lat !== null && lon !== null ? { lat, lon } : null), [site, lat, lon]);
  const an = useAnalysis(key, site, landingMs, a, bandOverrides);
  const sc = an.scenario;
  const m = an.metrics;
  const name = site?.name ?? "Custom site";
  const id = site?.id ?? "custom";
  const polar = lat !== null && isPolar(lat);
  const P = <T,>(e: T, ed: T, pl: T) => by(persona, e, ed, pl);

  const setLanding = (ms: number) => {
    const q = new URLSearchParams(params.toString());
    q.set("t", new Date(ms).toISOString().replace(".000Z", "Z"));
    router.replace(`?${q.toString()}`, { scroll: false });
  };

  const cur = cursor ?? landingMs ?? 0;
  const status = useMemo(() => {
    if (!sc) return null;
    const lit = containing(sc.windows.sunlit, cur);
    const dte = containing(sc.windows.dte, cur);
    const nextLit = lit ? null : nextAfter(sc.windows.sunlit, cur);
    const nextDte = dte ? null : nextAfter(sc.windows.dte, cur);
    const i = Math.max(0, Math.min(sc.series.n - 1, Math.round((cur - sc.series.t[0]) / sc.series.stepMs)));
    return { lit, dte, nextLit, nextDte, i };
  }, [sc, cur]);
  const power = useMemo(() => (sc ? powerModel(sc) : null), [sc]);

  const T = blockTitles(persona);
  const toc = useMemo<TocItem[]>(() => {
    const t = blockTitles(persona);
    return [
      {
        id: "views", label: "Horizon, Sun & Earth views", children: [
          { id: "horizon", label: t.horizon },
          { id: "sun-view", label: t.sunView },
          { id: "earth-view", label: t.earthView },
          { id: "libration", label: t.libration },
        ],
      },
      {
        id: "metrics", label: "Metrics", children: shownMetrics(m, persona).filter((g) => g.items.length).map(({ cat, items }) => {
          // Same order as the body: enthusiast takeaway cards first, then the battery and power charts, then the rows.
          const card = (id: string) => persona === "enthusiast" && !!enthusiastPick(id)?.card;
          const row = ({ m: def }: (typeof items)[number]) => ({ id: metricAnchor(def.id), label: metricLabel(def, persona) });
          // Enthusiasts and educators get the categories only, with no expandable list of metrics under each (D-111, D-118).
          if (persona !== "planner") return { id: categoryAnchor(cat.id), label: cat.label };
          return {
            id: categoryAnchor(cat.id), label: cat.label, children: [
              ...items.filter(({ m: def }) => card(def.id)).map(row),
              ...(cat.id === "overall" ? [{ id: "battery", label: t.battery }, { id: "array-power", label: t.arrayPower }] : []),
              ...items.filter(({ m: def }) => !card(def.id)).map(row),
            ],
          };
        }),
      },
    ];
  }, [m, persona]);

  const { pageRef, trackRef, barRef, pinned: tlPinned } = useStickyTimeline(!!sc);

  if (!key) return <div className="mx-auto max-w-[1600px] px-4 py-6 text-sm text-muted">Coordinates missing. Go back and pick a site.</div>;

  const compareHref = `/compare?s=${encodeURIComponent(id === "custom" ? `custom:${lat},${lon}` : id)}@${encodeURIComponent(landingMs ? new Date(landingMs).toISOString() : "")}`;
  const selectHref = tParam && landingMs !== null ? `/?t=${encodeURIComponent(new Date(landingMs).toISOString())}` : "/";
  const sep = <span aria-hidden className="mx-3 text-faint">•</span>;
  const feature = !site ? an.terrain?.features[0] : undefined;

  return (
    <div ref={pageRef} className="mx-auto max-w-[1600px] px-4 pb-24 pt-7">
      {/* ── Header: name, coordinates, metadata · editors and compare ── */}
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">{name}</h1>
            {/* Back to site selection, keeping the landing date & time (D-100). */}
            <Link href={selectHref} className="inline-flex items-center gap-1 text-sm text-muted underline decoration-faint underline-offset-4 hover:text-fg">
              <PencilSimple size={15} aria-hidden /> Select different site
            </Link>
          </div>
          <div className="flex flex-wrap items-center text-sm text-muted">
            {lat !== null && lon !== null && (
              <span className="inline-flex items-center">
                <span className="num text-fg">{fmtLat(lat)}</span>{sep}<span className="num text-fg">{fmtLon(lon)}</span>
                {site?.sourceUrl && (
                  <InfoTip title="Where this location comes from" sources={site.group === "feature" ? ["usgs-gazetteer"] : ["lroc-sites"]} sourceLabel="Original record" sourceUrl={site.sourceUrl}>
                    {site.sourceQuote ? <span className="block wrap-break-word font-mono text-xs">{site.sourceQuote.slice(0, 400)}</span> : null}
                    {site.notes && <span className="mt-1 block">{site.notes}</span>}
                  </InfoTip>
                )}
              </span>
            )}
            {an.terrain && (
              <span className="inline-flex items-center">
                {sep}
                <span><span className="num text-fg">{fmtElevation(an.terrain.groundM)}</span> the lunar reference sphere</span>
                <InfoTip title="Ground height" sources={["lola-pds"]}>
                  The Moon has no sea level, so NASA&apos;s LOLA laser altimeter measures heights against a perfect sphere 1,737.4 km in radius
                  (0 m = exactly 1,737.4 km from the Moon&apos;s centre). A value &ldquo;below&rdquo; simply means the ground is lower than that sphere. Lower ground tends to sit under a higher skyline, so the Sun and Earth must climb further before they are visible.
                </InfoTip>
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center text-sm text-muted">
            {site ? (
              <>
                <span>{GROUP_LABELS[site.group]}</span>
                {site.mission && site.mission !== site.name && <>{sep}<span>{site.mission}</span></>}
                {site.status && <>{sep}<span className="capitalize">{site.status}</span></>}
                {site.date && <>{sep}<span className="num">{site.date.slice(0, 10)}</span></>}
              </>
            ) : (
              <>
                <span>Custom coordinates</span>
                {feature && <>{sep}<span>Nearest named feature: {feature.name} ({feature.type}), <span className="num">{feature.distKm.toFixed(1)}</span> km away</span></>}
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!enthusiast && <>
            <button type="button" onClick={() => openEditor({ kind: "assumptions" })} className={btnSecondary}>
              <SlidersHorizontal size={18} aria-hidden /> Set mission assumptions
            </button>
            <button type="button" onClick={() => openEditor({ kind: "bands" })} className={btnSecondary}>
              <Steps size={18} aria-hidden /> Customise rating bands
            </button>
            <span className="mx-2 h-8 w-px bg-line" role="separator" aria-orientation="vertical" />
          </>}
          <Link href={compareHref} className={btnPrimary}>
            <Plus size={18} weight="bold" aria-hidden /> Add to comparison
          </Link>
        </div>
      </header>

      {!polar && lat !== null && (
        <Note tone="warn">
          <b className="font-semibold">Not a south-pole site.</b> At <span className="num">{fmtLat(lat)}</span> the Sun climbs high and sets on a regular ~<span className="num">29.5</span>-day cycle, and Earth stays fixed in the sky for near-side sites. The polar trade-offs this tool focuses on mostly don&apos;t apply here.
        </Note>
      )}

      {/* ── Landing date & time, then the timeline ── */}
      <section aria-label="Landing date and time, and the mission timeline" className="mt-7 border-t border-line pt-6">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div>
            <div className="mb-1.5 flex items-center text-sm font-medium">
              <label htmlFor="landing-date">Landing date &amp; time</label>
              <InfoTip title="Landing date and time" sources={["jpl-horizons"]}>
                Carried over from the site selection page. Near the pole the Sun skims the horizon, so a shift of a few days can decide whether the site is lit and whether Earth is up. All times are UTC. The buttons move the landing by 1 or 7 days.
              </InfoTip>
            </div>
            <div className="flex gap-2">
              <div className="w-64"><DateField id="landing-date" value={landingMs} onChange={setLanding} /></div>
              <div className="w-36"><TimeField value={landingMs} onChange={setLanding} /></div>
            </div>
          </div>
          <div className="flex h-10 divide-x divide-line rounded-sm border border-line" role="group" aria-label="Move the landing date">
            {[-7, -1, 1, 7].map((d) => (
              <button key={d} type="button" onClick={() => landingMs && setLanding(landingMs + d * DAY_MS)} title={`Move the landing ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} ${d < 0 ? "earlier" : "later"}`}
                className="num px-3 text-sm text-muted hover:bg-panel-2 hover:text-fg">
                {d > 0 ? `+${d}d` : `−${-d}d`}
              </button>
            ))}
          </div>
          <div className="flex h-10 items-center gap-1.5 text-sm text-muted">
            Mission length
            {enthusiast ? (
              <span className="font-medium text-fg"><span className="num">{a.missionDays}</span> Earth days</span>
            ) : (
              <button type="button" onClick={() => openEditor({ kind: "assumptions", focus: "missionDays" })} title="Change the mission length in Mission assumptions"
                className="inline-flex items-center gap-1 font-medium text-fg underline decoration-dotted decoration-faint underline-offset-4 hover:decoration-fg">
                <span className="num">{a.missionDays}</span> Earth days <PencilSimple size={14} className="text-faint" aria-hidden />
              </button>
            )}
            <InfoTip title="Mission length" sources={["mission-assumption"]}>
              Everything on this page covers the time from landing to the end of the mission. The default, 30 Earth days, is about one full lunar day (29.5 days), so every site shows a whole cycle of light and dark.{!enthusiast && " Change it in Mission assumptions."}
            </InfoTip>
          </div>
        </div>
      </section>

      {/* ── The timeline, pinned under the app header until the Array power chart has scrolled past (D-099) ── */}
      {sc && (
        <div ref={trackRef} className="pointer-events-none mt-3">
          <div ref={barRef} data-sticky-bar role="region" aria-label="Mission timeline"
            className="pointer-events-auto sticky top-16 z-20 -mx-4 bg-bg px-4 pt-3">
            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <div className="flex items-center text-sm font-medium">
                Timeline
                <InfoTip title="Timeline" sources={["jpl-horizons", "lola-pds"]}>
                  The whole mission from landing to the end. The orange lane shows when the site is sunlit, the blue lane when Earth is in view. Press play to run the mission forward, one day per second, in a loop; press again to pause. Drag the marker, click anywhere on it, or use the arrow keys (Shift for whole days) to stop at a time. Space plays or pauses when the timeline has focus. The cards, the horizon view and every chart below show the selected time. The timeline stays pinned at the top while you scroll through those charts, down to Array power; the metrics after that are for the landing time, so it lets go there.
                </InfoTip>
              </div>
              <span className="text-sm text-muted"><span className="num text-fg">{fmtUTC(cur)}</span>{sep}<span className="num">Day {Math.floor((cur - sc.start) / DAY_MS) + 1}</span> of <span className="num">{a.missionDays}</span></span>
              {cur !== landingMs && (
                <button type="button" onClick={() => pickTime(sc.start)} className="inline-flex items-center gap-1 text-sm text-muted underline decoration-faint underline-offset-4 hover:text-fg">
                  <ArrowCounterClockwise size={15} aria-hidden /> Back to landing
                </button>
              )}
            </div>
            <MissionTimeline start={sc.start} end={sc.end} value={cur} onChange={pickTime} onTick={setCursor} playing={playing} onPlayingChange={setPlaying} sunlit={sc.windows.sunlit} dte={sc.windows.dte}
              sunLabel={P("Sun up", "Sunlit", "Sunlit")} earthLabel={P("Earth up", "Earth", "DTE")} />
            {/* The page divider under the timeline doubles as the pinned bar's bottom edge (same width as the content). */}
            <hr className="mt-6 border-line" />
          </div>
        </div>
      )}

      {!sc && <hr className="mt-6 border-line" />}

      {an.stage === "error" && <Note tone="critical">Could not compute this site: {an.error}</Note>}
      {an.stage === "loading" && <p className="mt-6 text-sm text-muted">{site ? "Loading NASA ephemeris and LOLA terrain…" : "Computing the terrain horizon for this point from LOLA elevation data (a few seconds the first time)…"}</p>}

      {sc && status && m && power && (
        <div className="mt-8 grid grid-cols-12 gap-x-10">
          <aside className="col-span-3 hidden lg:block">
            {/* Sits below the pinned timeline while it is there, and glides back up when it leaves (D-099). */}
            <div data-toc-scroll className="no-scrollbar sticky overflow-y-auto pb-8 pr-2 transition-[top,max-height] duration-300 ease-out motion-reduce:transition-none"
              style={{ top: tlPinned ? "calc(88px + var(--tl-h, 0px))" : "88px", maxHeight: tlPinned ? "calc(100vh - 112px - var(--tl-h, 0px))" : "calc(100vh - 112px)" }}>
              <PageToc items={toc} />
            </div>
          </aside>

          <div className="col-span-12 min-w-0 lg:col-span-9">
            {/* ── Horizon, Sun & Earth views ── */}
            <section id="views" aria-labelledby="views-h" className="scroll-mt-24">
              <h2 id="views-h" className="text-2xl font-semibold tracking-tight">Horizon, Sun &amp; Earth views</h2>
              <p className="mt-1 text-sm text-muted">{P(
                "What the sky looks like from this spot, and when the Sun and Earth are up.",
                "How the terrain, the Sun's low path and Earth's wobble combine at this site. Everything shows the time selected on the timeline.",
                "Terrain horizon (LOLA), Sun and Earth topocentric tracks (JPL Horizons) and visibility windows, at the timeline's selected time.",
              )}</p>

              {/* Fixed per-breakpoint card height (D-097), sized to the longest copy measured for each persona,
                  so changing the time or site never makes the content below jump. */}
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Card h={cardH} color="var(--sun)" label={P("Is the Sun up?", "Sun at the selected time", "Sun at selected time")}
                  value={status.lit ? (status.lit.end >= sc.end - sc.series.stepMs ? P("Up for the rest of the mission", "Sunlit to the end of the mission", "Lit · rest of mission") : P(`Up · sets in ${fmtHours((status.lit.end - cur) / HOUR_MS)}`, `Sunlit · sets in ${fmtHours((status.lit.end - cur) / HOUR_MS)}`, `Lit · sets in ${fmtHours((status.lit.end - cur) / HOUR_MS)}`)) : status.nextLit ? P(`Hidden · back in ${fmtHours((status.nextLit.start - cur) / HOUR_MS)}`, `Dark · rises in ${fmtHours((status.nextLit.start - cur) / HOUR_MS)}`, `Dark · rises in ${fmtHours((status.nextLit.start - cur) / HOUR_MS)}`) : P("Hidden all mission", "Dark all mission", "Dark · all mission")}
                  sub={P(
                    `Toward the ${compass(sc.series.sunAz[status.i])}, ${upDown(sc.series.sunEl[status.i], 1, "flat ground")}`,
                    `${upDown(sc.series.sunEl[status.i], 2, "the horizontal")}, toward ${compass(sc.series.sunAz[status.i])}; ${fmtPct(sc.series.sunFrac[status.i])} of its disk clears the terrain`,
                    `el ${fmtDeg(sc.series.sunEl[status.i], 2)} · az ${fmtDeg(sc.series.sunAz[status.i], 1)} ${compass(sc.series.sunAz[status.i])} · ${fmtPct(sc.series.sunFrac[status.i], 1)} disk`,
                  )}
                  tip={`Whether at least ${Math.round(a.sunDiskThreshold * 100)}% of the Sun's disk clears the LOLA terrain horizon at the selected time, and how long until that changes.`} sources={["jpl-horizons", "lola-pds"]} />
                <Card h={cardH} color="var(--earth)" label={P("Can we call Earth?", "Earth at the selected time", "Earth at selected time")}
                  value={status.dte ? (status.dte.end >= sc.end - sc.series.stepMs ? P("Yes, for the rest of the mission", "In view to the end of the mission", "In view · rest of mission") : P(`Yes · for ${fmtHours((status.dte.end - cur) / HOUR_MS)}`, `In view · sets in ${fmtHours((status.dte.end - cur) / HOUR_MS)}`, `In view · sets in ${fmtHours((status.dte.end - cur) / HOUR_MS)}`)) : status.nextDte ? P(`Not now · back in ${fmtHours((status.nextDte.start - cur) / HOUR_MS)}`, `Hidden · rises in ${fmtHours((status.nextDte.start - cur) / HOUR_MS)}`, `Hidden · rises in ${fmtHours((status.nextDte.start - cur) / HOUR_MS)}`) : P("Not during this mission", "Hidden all mission", "Hidden · all mission")}
                  sub={P(
                    `Toward the ${compass(sc.series.earthAz[status.i])}, ${upDown(sc.series.earthEl[status.i], 1, "flat ground")}`,
                    `${upDown(sc.series.earthEl[status.i], 2, "the horizontal")}, toward ${compass(sc.series.earthAz[status.i])}; ${sc.series.dsnCount[status.i]} of 3 Deep Space Network sites can see the Moon`,
                    `el ${fmtDeg(sc.series.earthEl[status.i], 2)} · az ${fmtDeg(sc.series.earthAz[status.i], 1)} ${compass(sc.series.earthAz[status.i])} · ${sc.series.dsnCount[status.i]}/3 DSN`,
                  )}
                  tip={`Direct-to-Earth contact needs at least ${Math.round(a.earthDiskThreshold * 100)}% of Earth's disk above the terrain horizon, and a Deep Space Network antenna that can see the Moon (≥ ${a.dsnMinElevDeg}° up).`} sources={["jpl-horizons", "lola-pds", "dsn-810-005"]} />
                <Card h={cardH} label={P("Sunlight over the mission", "Sunlit, whole mission", "Sunlit % of mission")} value={m["sun.solar-availability-fraction"]?.display ?? "—"} rag={m["sun.solar-availability-fraction"]?.rating?.rag}
                  sub={`${P("Longest dark stretch", "Longest dark stretch", "Longest dark")} ${m["sun.longest-continuous-darkness"]?.display ?? "—"}`}
                  tip={`Share of the ${a.missionDays}-day mission with at least ${Math.round(a.sunDiskThreshold * 100)}% of the Sun's disk above the terrain horizon.`} sources={["jpl-horizons", "lola-pds"]} />
                <Card h={cardH} label={P("Power and a call home at once", "Sun and Earth together", "Sun + Earth together")} value={m["overall.joint-sunlit-dte-window"]?.display.split(" (")[0] ?? "—"} rag={m["overall.joint-sunlit-dte-window"]?.rating?.rag}
                  sub={`${P("That's ", "That is ", "")}${fmtPct((m["overall.joint-sunlit-dte-window"]?.value ?? 0) / 100)} ${P("of the mission", "of the mission", "of mission")} · Earth in view ${m["earth.total-dte-visibility-fraction"]?.display ?? "—"}`}
                  tip="Hours with both sunlight (power) and Earth in view (direct communication) at the same time." sources={["jpl-horizons", "lola-pds"]} />
              </div>

              <Block id="horizon" title={T.horizon}
                lead={P(
                  "At the pole the Sun circles around the horizon instead of rising high. Small hills decide whether it is hidden.",
                  "Turn on the spot and trace the skyline: that's the grey band. The Sun's path stays low and goes all the way round; Earth hardly moves. Whatever dips under the skyline is hidden.",
                  undefined,
                )}
                tip={<InfoTip title="Horizon view" sources={["lola-pds", "jpl-horizons"]}>
                  The grey skyline is the real terrain around the site, traced out to {an.terrain?.maxRangeKm} km in LOLA elevation data, including the curve of the Moon, seen from {a.mastHeightM} m above the ground. There is no air, so no refraction: the Sun or Earth is visible only when it clears this line. Coloured lines are their paths during the mission; the discs show where they are at the selected time. The compass runs right to left so the terrain appears in the same order as in the time charts below. Click a path to move the timeline to when the Sun or Earth was there.
                </InfoTip>}>
                <HorizonPanorama sc={sc} cursor={cur} persona={persona} onCursor={pickTime} distKm={an.terrain?.maskDistKm} distStepDeg={an.terrain?.stepDeg} />
              </Block>

              <Block id="sun-view" title={T.sunView}
                lead={P("The orange line is how high the Sun is; the grey is the hills in front of it. Solid orange means the site is in sunlight.", "The Sun's height over time against the height of the terrain in the Sun's direction. Where the orange line clears the grey, the site is sunlit.", undefined)}
                tip={<InfoTip title="Sun from the site" sources={["jpl-horizons", "lola-pds", "bryant-2009"]}>Sun elevation (orange) against the terrain horizon in the Sun&apos;s direction at each moment (grey). Solid where at least {Math.round(a.sunDiskThreshold * 100)}% of the disk is visible, dashed where it is hidden; the lane underneath shows the sunlit windows. Click to move the timeline.</InfoTip>}>
                <BodyTimeline sc={sc} body="sun" cursor={cur} onCursor={pickTime} persona={persona} />
              </Block>

              <Block id="earth-view" title={T.earthView}
                lead={P("Earth barely moves in the Moon's sky, but at the pole it sits so low that a small wobble hides it behind hills.", "Earth's height over time against the terrain in Earth's direction. A radio link also needs a Deep Space Network antenna on Earth that can see the Moon (one grey lane per complex); the bottom lane is when both line up.", undefined)}
                tip={<InfoTip title="Earth from the site" sources={["jpl-horizons", "lola-pds", "dsn-810-005"]}>Earth elevation (blue) against the terrain horizon in Earth&apos;s direction. Solid where at least {Math.round(a.earthDiskThreshold * 100)}% of Earth&apos;s disk is visible. Lanes: Earth in view; one per DSN complex (Canberra, Madrid, Goldstone, in the order the Moon reaches them as Earth turns) showing when the Moon is ≥ {a.dsnMinElevDeg}° above that complex&apos;s horizon; Contact = both at once. Red marks are handover gaps: Earth is in view but no complex can see the Moon. Click to move the timeline.</InfoTip>}>
                <BodyTimeline sc={sc} body="earth" cursor={cur} onCursor={pickTime} persona={persona} />
              </Block>

              <Block id="libration" title={T.libration}
                tip={<InfoTip title="Libration" sources={["jpl-horizons", "svs-libration"]}>The Moon keeps one face to Earth, but its slightly tilted, elliptical orbit makes Earth drift in a small loop in the lunar sky over each month. Near the pole that loop can carry Earth below the horizon. Libration is already in the JPL Horizons geometry; nothing is added.</InfoTip>}>
                <div className="grid gap-x-10 gap-y-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
                  <div className="text-sm leading-relaxed text-muted">
                    {persona === "enthusiast" && (
                      <div className="space-y-2.5">
                        <p>From the Moon, Earth hangs almost still in the sky. It never rises and sets like the Sun does here.</p>
                        <p>But it does sway a little, tracing the small loop on the chart. At the south pole Earth sits right at the horizon, so that small sway decides whether you can call home.</p>
                      </div>
                    )}
                    {persona === "educator" && (
                      <div className="space-y-2.5">
                        <p><b className="font-medium text-fg">Libration in longitude:</b> the Moon spins at a steady rate, but moves faster near perigee and slower near apogee, so we see a little around its east and west edges.</p>
                        <p><b className="font-medium text-fg">Libration in latitude:</b> the Moon&apos;s spin axis is tilted relative to its orbit, so over a month we look slightly over its north and then its south pole.</p>
                        {an.multi && <p>Computed from JPL Horizons for <span className="num">2026–2029</span>, the point on the Moon directly below Earth wanders <span className="num">{fmtDeg(an.multi.libLonRange[0], 1)}</span> to <span className="num">{fmtDeg(an.multi.libLonRange[1], 1)}</span> in longitude and <span className="num">{fmtDeg(an.multi.libLatRange[0], 1)}</span> to <span className="num">{fmtDeg(an.multi.libLatRange[1], 1)}</span> in latitude.</p>}
                        <p>Seen from the Moon, the same motion makes Earth trace the loop on the chart. Try the ±7d buttons to watch Earth dip behind the terrain.</p>
                        <a className="inline-flex items-center gap-1 text-fg underline underline-offset-4" href="https://svs.gsfc.nasa.gov/gallery/moonphase/" target="_blank" rel="noreferrer">NASA SVS Moon phase &amp; libration animation <ArrowSquareOut size={16} aria-hidden /></a>
                      </div>
                    )}
                    {persona === "planner" && (
                      <dl className="space-y-3">
                        <Stat k="Selected time" v={fmtUTC(cur)} />
                        <Stat k="Sub-Earth point" v={`${fmtDeg(sc.series.libLon[status.i], 3)} lon · ${fmtDeg(sc.series.libLat[status.i], 3)} lat`} />
                        <Stat k="Earth from the site" v={`az ${fmtDeg(sc.series.earthAz[status.i], 3)} · el ${fmtDeg(sc.series.earthEl[status.i], 3)}`} />
                        {m["earth.libration-of-earth-in-lunar-sky"] && <Stat k="2026–2029 range" v={m["earth.libration-of-earth-in-lunar-sky"].display.replace("Sub-Earth point wanders ", "")} />}
                        <p className="text-xs text-faint">Uncertainty: Horizons DE441 positions are far more precise than needed here. The dominant errors are the terrain (DEM <span className="num">{an.terrain?.dem.resolutionM}</span> m/px) and interpolating the 1 h tables (&lt; <span className="num">0.01°</span>).</p>
                      </dl>
                    )}
                  </div>
                  <LibrationChart sc={sc} cursor={cur} persona={persona} onCursor={pickTime} />
                </div>
              </Block>
            </section>

            {/* ── Metrics ── */}
            <section id="metrics" aria-labelledby="metrics-h" className="mt-16 scroll-mt-24 border-t border-line pt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="metrics-h" className="text-2xl font-semibold tracking-tight">Metrics</h2>
                {persona === "planner" && <CsvButton sc={sc} name={id} />}
              </div>
              <MetricList values={m} persona={persona} computing={an.stage !== "full"} exportMeta={landingMs !== null ? { siteId: id, site: name, lat, lon, landingMs } : undefined} extras={{
                overall: (
                  <div className="divide-y divide-line">
                    <Block id="battery" sub title={T.battery}
                      lead={P("The lander runs on sunlight. When the Sun hides behind hills, it lives off its battery.", "The battery fills while the panels make more than the lander uses, and drains in the dark.", undefined)}
                      tip={<InfoTip title="Battery charge" sources={["jpl-horizons", "lola-pds", "nssdc-moon", "mission-assumption"]}>
                        Simulated every {sc.series.stepMs / 60000} min from landing, starting full at {a.batteryWh.toLocaleString("en-US")} Wh. Each step adds the array output and subtracts the load: {a.loadW} W while any sunlight reaches the array, {a.survivalLoadW} W survival (heaters) otherwise. Charge stays between 0 and full. Lowest: {fmtPct(power.minSoc, 1)} at {fmtUTC(power.minSocAt)}{power.depletedAt ? `; first empty at ${fmtUTC(power.depletedAt)}` : ""}. Lander values are example assumptions you can change.
                      </InfoTip>}>
                      <PowerCharts sc={sc} power={power} cursor={cur} onCursor={pickTime} persona={persona} only="battery" />
                    </Block>
                    <Block id="array-power" sub title={T.arrayPower}
                      lead={P("How much power the solar panels make, against what the lander needs (dashed line).", "Output depends on how much of the Sun clears the terrain and how squarely sunlight hits the panels.", undefined)}
                      tip={<InfoTip title="Array power" sources={["jpl-horizons", "lola-pds", "nssdc-moon", "mission-assumption"]}>
                        Output = 1,361 W/m² (sunlight at 1 AU, NSSDCA) ÷ (Sun distance in AU)² × visible share of the Sun&apos;s disk × cos(angle between sunlight and the panel) × {a.panelAreaM2} m² × {a.panelEfficiency} efficiency. Mounting: {a.panelTracking === "vertical-tracking" ? "vertical, turned to face the Sun" : a.panelTracking === "vertical-fixed" ? `vertical, fixed facing ${a.panelFixedAzDeg}°` : "horizontal"}. Mean {Math.round(power.avgW)} W, peak {Math.round(power.peakW)} W. The dashed line is the load.
                      </InfoTip>}>
                      <PowerCharts sc={sc} power={power} cursor={cur} onCursor={pickTime} persona={persona} only="array" />
                    </Block>
                  </div>
                ),
              }} />
            </section>
          </div>
        </div>
      )}

      {!enthusiast && <AssumptionsModal />}
      {!enthusiast && <BandsModal values={m} />}
    </div>
  );
}

/** Height of the sticky app header (`h-16` in AppHeader). */
const APP_HEADER_PX = 64;
/** The pinned timeline lets go when the bottom of this block (the last chart that follows the timeline) passes under it. */
const STICKY_END_ID = "array-power";

/**
 * Sticky mission timeline (D-099). The bar is CSS `position: sticky` inside a "track" that runs from the
 * bar's place in the page to the bottom of the Array power chart, so pinning, the push-out at the end and
 * re-pinning on the way back up are all done by the browser's scroller: nothing moves from JavaScript
 * while scrolling. The track is as tall as that span but gives the space back with a negative bottom
 * margin, so the layout below is unchanged. JS only re-measures the span when the layout changes, and
 * flips one flag on scroll: `pinned` (the bar is covering the top of the viewport, so the contents column
 * sits below it). The bar's bottom edge is the page divider that sits under the timeline anyway.
 */
function useStickyTimeline(enabled: boolean) {
  const pageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [flags, setFlags] = useState({ stuck: false, pinned: false });

  useEffect(() => {
    const page = pageRef.current, track = trackRef.current, bar = barRef.current;
    if (!enabled || !page || !track || !bar) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const t = track.getBoundingClientRect(), b = bar.getBoundingClientRect();
      const stuck = t.top < APP_HEADER_PX - 0.5;
      const pinned = stuck && b.bottom > APP_HEADER_PX + 8;
      setFlags((f) => (f.stuck === stuck && f.pinned === pinned ? f : { stuck, pinned }));
    };
    const measure = () => {
      const end = document.getElementById(STICKY_END_ID);
      const barH = bar.offsetHeight;
      const span = end ? end.getBoundingClientRect().bottom - track.getBoundingClientRect().top : 0;
      const h = Math.max(barH, span);
      page.style.setProperty("--tl-h", `${barH}px`);
      track.style.height = `${h}px`;
      track.style.marginBottom = `${barH - h}px`;
      read();
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };
    // Content above the end block changes height as data, persona and fonts arrive: the page box grows or shrinks with it.
    const ro = new ResizeObserver(measure);
    ro.observe(page);
    ro.observe(bar);
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      if (raf) cancelAnimationFrame(raf);
      track.style.height = "";
      track.style.marginBottom = "";
    };
  }, [enabled]);

  return { pageRef, trackRef, barRef, ...flags };
}

/** A titled block inside a section: anchor, heading with its info tip, optional lead line. */
function Block({ id, title, tip, lead, sub, children }: { id: string; title: string; tip?: ReactNode; lead?: string; sub?: boolean; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`scroll-mt-24 ${sub ? "py-6" : "mt-12"}`}>
      <h3 id={`${id}-h`} className={`flex items-center font-semibold ${sub ? "text-base" : "text-lg"}`}>{title}{tip}</h3>
      {lead && <p className="mt-1 max-w-4xl text-sm leading-relaxed text-muted">{lead}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Status-card min-heights per persona (D-097): the longest copy measured across sites, dates and widths, plus ~1.5 lines of headroom. */
const CARD_H: Record<Persona, string> = {
  enthusiast: "min-h-[9rem] xl:min-h-[12rem]",
  educator: "min-h-[11rem] xl:min-h-[18rem] 2xl:min-h-[12rem]",
  planner: "min-h-[9rem] xl:min-h-[12rem]",
};

function Card({ label, value, sub, color, rag, tip, sources, h }: { label: string; value: string; sub?: string; color?: string; rag?: "green" | "amber" | "red"; tip: string; sources: SourceId[]; h?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-sm border border-line bg-panel px-4 pb-4 pt-3.5 ${h ?? ""}`}>
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ background: color ?? "var(--line)" }} />
      <div className="flex items-center text-sm text-muted">
        {label}
        <InfoTip title={label} sources={sources}>{tip}</InfoTip>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-semibold leading-snug"><span><NumText>{value}</NumText></span>{rag && <RagBadge rag={rag} />}</div>
      {sub && <div className="mt-1 text-sm leading-snug text-muted"><NumText>{sub}</NumText></div>}
    </div>
  );
}

/** "3.3° above flat ground" / "13.4° below flat ground" (never "−13.4° above"). */
function upDown(el: number, digits: number, ref: string) {
  return `${fmtDeg(Math.abs(el), digits)} ${el >= 0 ? "above" : "below"} ${ref}`;
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-faint">{k}</dt>
      <dd className="text-fg"><NumText>{v}</NumText></dd>
    </div>
  );
}

function Note({ tone, children }: { tone: "warn" | "critical"; children: ReactNode }) {
  return (
    <div className={`mt-5 flex max-w-4xl gap-2.5 border-l-2 py-1 pl-3 text-sm ${tone === "warn" ? "border-warn" : "border-critical"}`}>
      <Warning size={20} className={`mt-0.5 shrink-0 ${tone === "warn" ? "text-warn" : "text-critical"}`} aria-hidden />
      <p>{children}</p>
    </div>
  );
}

function CsvButton({ sc, name }: { sc: NonNullable<ReturnType<typeof useAnalysis>["scenario"]>; name: string }) {
  const download = () => {
    const s = sc.series;
    const rows = ["utc,sun_az_deg,sun_el_deg,sun_horizon_deg,sun_disk_visible,earth_az_deg,earth_el_deg,earth_horizon_deg,earth_disk_visible,earth_range_km,sub_earth_lon,sub_earth_lat,dsn_complexes"];
    for (let i = 0; i < s.n; i++) {
      rows.push([new Date(s.t[i]).toISOString(), s.sunAz[i].toFixed(4), s.sunEl[i].toFixed(4), s.sunHz[i].toFixed(4), s.sunFrac[i].toFixed(4), s.earthAz[i].toFixed(4), s.earthEl[i].toFixed(4), s.earthHz[i].toFixed(4), s.earthFrac[i].toFixed(4), s.earthKm[i].toFixed(1), s.libLon[i].toFixed(4), s.libLat[i].toFixed(4), s.dsnCount[i]].join(","));
    }
    downloadCsv(`${name}-${new Date(sc.start).toISOString().slice(0, 10)}-ephemeris.csv`, rows.join("\n"));
  };
  return <button type="button" onClick={download} className={btnSecondary}><DownloadSimple size={17} aria-hidden /> Download time series (CSV)</button>;
}

function numOrNull(v: string | null) {
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
}
