"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BodyTimeline } from "@/components/charts/BodyTimeline";
import { HorizonPanorama } from "@/components/charts/HorizonPanorama";
import { LibrationChart } from "@/components/charts/LibrationChart";
import { LineChart } from "@/components/charts/LineChart";
import { BandsPanel } from "@/components/BandsPanel";
import { CustomCoordForm } from "@/components/CustomCoordForm";
import { InfoTip } from "@/components/InfoTip";
import { RagBadge } from "@/components/RagBadge";
import { useAssumptions } from "@/lib/assumptions-store";
import { powerModel } from "@/lib/engine/analysis";
import { DAY_MS, HOUR_MS } from "@/lib/engine/scenario";
import { containing, nextAfter } from "@/lib/engine/windows";
import { compass, fmtDeg, fmtHours, fmtLat, fmtLon, fmtPct, fmtUTC } from "@/lib/metrics/format";
import { usePersona } from "@/lib/persona";
import { GROUP_LABELS, isPolar, type Site } from "@/lib/sites";
import { useAnalysis } from "@/lib/use-analysis";
import { useNowHour } from "@/lib/use-now";
import { AssumptionsPanel } from "./AssumptionsPanel";
import { MetricList } from "./MetricList";

/** Page 2: one site at one landing time, with every visual and metric. */
export function SiteDetails({ site }: { site: Site | null }) {
  const params = useSearchParams();
  const router = useRouter();
  const persona = usePersona((s) => s.persona);
  const a = useAssumptions((s) => s.a);
  const bandOverrides = useAssumptions((s) => s.bands);
  const nowHour = useNowHour();
  const tParam = params.get("t");
  const landingMs = useMemo(() => {
    const ms = tParam ? Date.parse(tParam) : NaN;
    return Number.isFinite(ms) ? ms : nowHour;
  }, [tParam, nowHour]);
  const [cursorState, setCursorState] = useState<{ base: number | null; t: number } | null>(null);
  const cursor = cursorState && cursorState.base === landingMs ? cursorState.t : landingMs;
  const setCursor = (t: number) => setCursorState({ base: landingMs, t });

  const lat = site?.lat ?? numOrNull(params.get("lat"));
  const lon = site?.lon ?? numOrNull(params.get("lon"));
  const key = useMemo(() => (site ? { siteId: site.id } : lat !== null && lon !== null ? { lat, lon } : null), [site, lat, lon]);
  const an = useAnalysis(key, site, landingMs, a, bandOverrides);
  const sc = an.scenario;
  const name = site?.name ?? "Custom site";
  const id = site?.id ?? "custom";
  const polar = lat !== null && isPolar(lat);

  const setLanding = (ms: number) => {
    const q = new URLSearchParams(params.toString());
    q.set("t", new Date(ms).toISOString());
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
  const power = useMemo(() => (sc && persona === "planner" ? powerModel(sc) : null), [sc, persona]);

  if (!key) return <div className="p-6 text-sm text-muted">Coordinates missing. Go back and pick a site.</div>;

  const compareHref = `/compare?s=${encodeURIComponent(id === "custom" ? `custom:${lat},${lon}` : id)}@${encodeURIComponent(landingMs ? new Date(landingMs).toISOString() : "")}`;
  const m = an.metrics;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted">{site ? GROUP_LABELS[site.group] : "Custom coordinates"}{site?.status ? ` · ${site.status}` : ""}{site?.date ? ` · ${site.date.slice(0, 10)}` : ""}</div>
          <h1 className="text-2xl font-semibold">{name}</h1>
          {!site && an.terrain?.features[0] && (
            <div className="text-xs text-muted">Nearest named feature: {an.terrain.features[0].name} ({an.terrain.features[0].type}), {an.terrain.features[0].distKm.toFixed(1)} km away</div>
          )}
          <p className="text-sm text-muted">
            {lat !== null && lon !== null && `${fmtLat(lat)}, ${fmtLon(lon)}`}
            {an.terrain && ` · ${Math.round(an.terrain.groundM)} m above the reference sphere`}
            {site?.sourceUrl && (
              <InfoTip title="Where this location comes from" sources={site.group === "feature" ? ["usgs-gazetteer"] : ["lroc-sites"]} sourceLabel="Original record" sourceUrl={site.sourceUrl}>
                {site.sourceQuote ? <span className="block wrap-break-word font-mono text-[10px]">{site.sourceQuote.slice(0, 400)}</span> : null}
                {site.notes && <span className="mt-1 block">{site.notes}</span>}
              </InfoTip>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <a href="https://quickmap.lroc.asu.edu/" target="_blank" rel="noreferrer" className="rounded-md border border-line px-3 py-2 text-sm text-muted hover:text-fg">Open QuickMap ↗</a>
          <Link href={compareHref} className="rounded-md bg-accent px-3 py-2 text-sm text-accent-ink">+ Add to comparison</Link>
        </div>
      </header>

      {!site && (
        <section className="max-w-xl rounded-lg border border-line bg-panel p-3">
          <CustomCoordForm
            key={`${lat},${lon}`}
            initial={lat !== null && lon !== null ? { lat, lon } : null}
            submitLabel="Update"
            onSubmit={(la, lo) => {
              const q = new URLSearchParams(params.toString());
              q.set("lat", String(la));
              q.set("lon", String(lo));
              router.replace(`?${q.toString()}`, { scroll: false });
            }}
          />
        </section>
      )}

      {!polar && lat !== null && (
        <div className="rounded-lg border border-warn/50 bg-warn/10 px-4 py-2 text-sm">
          <b>Not a south-pole site.</b> At {fmtLat(lat)} the Sun climbs high and sets on a regular ~29.5-day cycle, and Earth stays fixed in the sky for near-side sites. The polar trade-offs this tool focuses on mostly don&apos;t apply here.
        </div>
      )}

      <section className="flex flex-wrap items-end gap-4 rounded-lg border border-line bg-panel p-3">
        <label className="text-xs text-muted">
          Landing time (UTC)
          <input
            type="datetime-local"
            value={landingMs ? new Date(landingMs).toISOString().slice(0, 16) : ""}
            onChange={(e) => e.target.value && setLanding(Date.parse(e.target.value + "Z"))}
            className="mt-0.5 block rounded border border-line bg-bg px-2 py-1 text-sm text-fg"
          />
        </label>
        <div className="flex gap-1">
          {[-7, -1, 1, 7].map((d) => (
            <button key={d} onClick={() => landingMs && setLanding(landingMs + d * DAY_MS)} className="rounded border border-line px-2 py-1 text-xs text-muted hover:text-fg">
              {d > 0 ? `+${d}` : d} d
            </button>
          ))}
        </div>
        <div className="text-xs text-muted">Mission length: <b className="text-fg">{a.missionDays} days</b>{persona === "planner" ? " (edit in assumptions)" : ""}</div>
        {sc && (
          <label className="min-w-55 flex-1 text-xs text-muted">
            Time cursor: <span className="text-fg">{fmtUTC(cur)}</span>
            <input type="range" min={sc.start} max={sc.end} step={HOUR_MS} value={cur} onChange={(e) => setCursor(Number(e.target.value))} className="mt-1 block w-full" />
          </label>
        )}
      </section>

      {an.stage === "error" && <div className="rounded-lg border border-critical/50 bg-critical/10 p-4 text-sm">Could not compute this site: {an.error}</div>}
      {an.stage === "loading" && <div className="rounded-lg border border-line bg-panel p-6 text-sm text-muted">{site ? "Loading NASA ephemeris and LOLA terrain…" : "Computing the terrain horizon for this point from LOLA elevation data (a few seconds the first time)…"}</div>}

      {sc && status && m && (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label={persona === "enthusiast" ? "Sunlight right now" : "Sun at cursor"} color="var(--sun)"
              value={status.lit ? (status.lit.end >= sc.end - sc.series.stepMs ? "Lit for the rest of the mission" : `Lit · sets in ${fmtHours((status.lit.end - cur) / HOUR_MS)}`) : status.nextLit ? `Dark · rises in ${fmtHours((status.nextLit.start - cur) / HOUR_MS)}` : "Dark all mission"}
              sub={`${fmtDeg(sc.series.sunEl[status.i], 2)} high, ${compass(sc.series.sunAz[status.i])} · ${fmtPct(sc.series.sunFrac[status.i])} of disk`}
              tip="Time remaining before sunset (or until sunrise), from the Sun's position against the LOLA terrain horizon." sources={["jpl-horizons", "lola-pds"]} />
            <Tile label={persona === "enthusiast" ? "Can we talk to Earth?" : "Earth at cursor"} color="var(--earth)"
              value={status.dte ? (status.dte.end >= sc.end - sc.series.stepMs ? "In view for the rest of the mission" : `In view · sets in ${fmtHours((status.dte.end - cur) / HOUR_MS)}`) : status.nextDte ? `Hidden · rises in ${fmtHours((status.nextDte.start - cur) / HOUR_MS)}` : "Hidden all mission"}
              sub={`${fmtDeg(sc.series.earthEl[status.i], 2)} high, ${compass(sc.series.earthAz[status.i])} · ${sc.series.dsnCount[status.i]} DSN complex${sc.series.dsnCount[status.i] === 1 ? "" : "es"} in view`}
              tip="Direct-to-Earth contact needs Earth above the terrain horizon and a Deep Space Network antenna that can see the Moon." sources={["jpl-horizons", "lola-pds", "dsn-810-005"]} />
            <Tile label="Sunlit, whole mission" value={m["sun.solar-availability-fraction"]?.display ?? "—"} rag={m["sun.solar-availability-fraction"]?.rating?.rag}
              sub={`Longest dark ${m["sun.longest-continuous-darkness"]?.display}`} tip="Share of the mission with at least the threshold fraction of the Sun's disk visible." sources={["jpl-horizons", "lola-pds"]} />
            <Tile label="Sun + Earth together" value={m["overall.joint-sunlit-dte-window"]?.display.split(" (")[0] ?? "—"} rag={m["overall.joint-sunlit-dte-window"]?.rating?.rag}
              sub={`Earth in view ${m["earth.total-dte-visibility-fraction"]?.display}`} tip="Hours with both power (sunlight) and direct-to-Earth communication." sources={["jpl-horizons", "lola-pds"]} />
          </section>

          <section className="rounded-lg border border-line bg-panel p-4">
            <h2 className="mb-1 font-medium">
              {persona === "enthusiast" ? "What you would see on the horizon" : "Horizon view: terrain, Sun and Earth paths"}
              <InfoTip title="Horizon view" sources={["lola-pds", "jpl-horizons"]}>
                The grey skyline is the real terrain around the site, traced out to {an.terrain?.maxRangeKm} km in LOLA elevation data, including the curve of the Moon. There is no air, so no refraction: the Sun or Earth is visible only when it clears this line. Coloured paths show where they move during the mission; dots show the time cursor.
              </InfoTip>
            </h2>
            {persona !== "planner" && <p className="mb-2 text-xs text-muted">At the pole the Sun circles the horizon instead of rising high. Small hills decide whether it is hidden.</p>}
            <HorizonPanorama sc={sc} cursor={cur} simple={persona === "enthusiast"} />
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-lg border border-line bg-panel p-4">
              <h2 className="mb-2 font-medium">
                ☀️ Sun over the mission
                <InfoTip title="Sun timeline" sources={["jpl-horizons", "lola-pds", "bryant-2009"]}>Sun elevation (orange) against the terrain horizon in the Sun&apos;s direction (grey). Shaded = sunlit (at least {Math.round(a.sunDiskThreshold * 100)}% of the disk visible). Click the chart to move the time cursor.</InfoTip>
              </h2>
              <BodyTimeline label="Sun" color="var(--sun)" t={sc.series.t} el={sc.series.sunEl} hz={sc.series.sunHz} frac={sc.series.sunFrac} bands={sc.windows.sunlit} bandLabel="Sunlit" cursor={cur} onCursor={setCursor} />
            </section>
            <section className="rounded-lg border border-line bg-panel p-4">
              <h2 className="mb-2 font-medium">
                🌎 Earth over the mission
                <InfoTip title="Earth timeline" sources={["jpl-horizons", "lola-pds", "dsn-810-005"]}>Earth elevation (blue) against the terrain horizon in Earth&apos;s direction. Shaded = Earth in view. Grey strip below = a DSN complex can see the Moon (≥ {a.dsnMinElevDeg}° elevation).</InfoTip>
              </h2>
              <BodyTimeline label="Earth" color="var(--earth)" t={sc.series.t} el={sc.series.earthEl} hz={sc.series.earthHz} frac={sc.series.earthFrac} bands={sc.windows.dte} bandLabel="Earth in view" bands2={sc.windows.dsn} band2Label="DSN can see the Moon" cursor={cur} onCursor={setCursor} />
            </section>
          </div>

          <section className="grid gap-4 rounded-lg border border-line bg-panel p-4 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 className="mb-1 font-medium">
                {persona === "planner" ? "Libration: Earth az/el track" : "Why Earth wobbles in the sky (libration)"}
                <InfoTip title="Libration" sources={["jpl-horizons", "svs-libration"]}>The Moon keeps one face to Earth, but its slightly tilted, elliptical orbit makes Earth drift in a small loop in the lunar sky over each month. Near the pole that loop can carry Earth below the horizon.</InfoTip>
              </h2>
              {persona === "enthusiast" && <p className="text-sm text-muted">From the Moon, Earth hangs almost still in the sky. It never rises and sets like the Sun does here. But it does sway a little, and at the south pole Earth sits right at the horizon, so that small sway decides whether you can call home.</p>}
              {persona === "educator" && (
                <div className="space-y-2 text-sm text-muted">
                  <p><b className="text-fg">Libration in longitude:</b> the Moon spins at a steady rate, but moves faster near perigee and slower near apogee, so we see a little around its east and west edges.</p>
                  <p><b className="text-fg">Libration in latitude:</b> the Moon&apos;s spin axis is tilted relative to its orbit, so over a month we look slightly over its north and then its south pole.</p>
                  {an.multi && <p>Computed from JPL Horizons for 2026–2029, the point on the Moon directly below Earth wanders {fmtDeg(an.multi.libLonRange[0], 1)} to {fmtDeg(an.multi.libLonRange[1], 1)} in longitude and {fmtDeg(an.multi.libLatRange[0], 1)} to {fmtDeg(an.multi.libLatRange[1], 1)} in latitude.</p>}
                  <p>Seen from the Moon, the same motion makes Earth trace the loop on the right. Try the ±7 d buttons to watch Earth dip behind the terrain.</p>
                  <a className="underline" href="https://svs.gsfc.nasa.gov/gallery/moonphase/" target="_blank" rel="noreferrer">Watch NASA SVS&apos;s Moon phase &amp; libration animation ↗</a>
                </div>
              )}
              {persona === "planner" && m["earth.libration-of-earth-in-lunar-sky"] && (
                <dl className="space-y-1 text-xs">
                  <div><dt className="inline text-muted">At cursor: </dt><dd className="inline font-mono">sub-Earth {fmtDeg(sc.series.libLon[status.i], 3)} lon, {fmtDeg(sc.series.libLat[status.i], 3)} lat · az {fmtDeg(sc.series.earthAz[status.i], 3)} el {fmtDeg(sc.series.earthEl[status.i], 3)}</dd></div>
                  <div><dt className="inline text-muted">Range: </dt><dd className="inline">{m["earth.libration-of-earth-in-lunar-sky"].display}</dd></div>
                  <div className="text-faint">Uncertainty: Horizons DE441 positions are far more precise than needed here; the dominant error is terrain (DEM {an.terrain?.dem.resolutionM} m/px) and the 1 h table interpolation (&lt; 0.01°).</div>
                </dl>
              )}
            </div>
            <LibrationChart sc={sc} cursor={cur} />
          </section>

          {persona === "planner" && power && (
            <section className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-lg border border-line bg-panel p-4">
                <h2 className="mb-2 font-medium">Battery charge<InfoTip title="Battery model" sources={["jpl-horizons", "lola-pds", "nssdc-moon", "mission-assumption"]}>Array power from the Sun&apos;s visible disk, elevation and distance, minus your operating/survival loads. Lowest charge: {fmtPct(power.minSoc)}.</InfoTip></h2>
                <LineChart t={sc.series.t} v={power.soc.map((x) => x * 100) as Float32Array} color="var(--good)" unit="%" min={0} max={100} format={(z) => `${z.toFixed(0)}%`} ariaLabel="Battery state of charge" />
              </div>
              <div className="rounded-lg border border-line bg-panel p-4">
                <h2 className="mb-2 font-medium">Array power<InfoTip title="Array power" sources={["jpl-horizons", "lola-pds", "nssdc-moon", "mission-assumption"]}>{a.panelAreaM2} m² at {Math.round(a.panelEfficiency * 100)}% efficiency, {a.panelTracking.replace("-", " ")}.</InfoTip></h2>
                <LineChart t={sc.series.t} v={power.power} color="var(--sun)" unit="W" ariaLabel="Solar array power" />
              </div>
            </section>
          )}

          {persona === "planner" && <AssumptionsPanel />}
          {persona === "planner" && <BandsPanel />}

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Metrics</h2>
              {persona === "planner" && <CsvButton sc={sc} name={id} />}
            </div>
            <MetricList values={m} persona={persona} computing={an.stage !== "full"} />
          </section>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, sub, color, rag, tip, sources }: { label: string; value: string; sub?: string; color?: string; rag?: "green" | "amber" | "red"; tip: string; sources: Parameters<typeof InfoTip>[0]["sources"] }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />}
        {label}
        <InfoTip title={label} sources={sources}>{tip}</InfoTip>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-base font-semibold">{value}{rag && <RagBadge rag={rag} compact />}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
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
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = `${name}-${new Date(sc.start).toISOString().slice(0, 10)}-ephemeris.csv`;
    el.click();
    URL.revokeObjectURL(url);
  };
  return <button onClick={download} className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-fg">Download time series (CSV)</button>;
}

function numOrNull(v: string | null) {
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
}
