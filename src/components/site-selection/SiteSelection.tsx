"use client";

import { ArrowRight, CheckCircle, MagnifyingGlass, Warning, X } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { InfoTip } from "@/components/InfoTip";
import { ScrollThumb } from "@/components/ScrollThumb";
import { MoonMap, type MapMode } from "@/components/map/MoonMap";
import { parseCoordString } from "@/lib/coords";
import { fmtLat, fmtLon } from "@/lib/metrics/format";
import { useNowMinute } from "@/lib/use-now";
import { GROUP_LABELS, getSite, hasCoordinates, isPolar, onPolarMap, sites, type Site, type SiteGroup } from "@/lib/sites";
import { DateField, TimeField } from "./DateTimePickers";
import { FilterMenu } from "./FilterMenu";

const MoonGlobe = dynamic(() => import("@/components/map/MoonGlobe"), {
  ssr: false,
  loading: () => <div className="flex h-full min-h-105 items-center justify-center rounded-sm border border-line bg-black text-sm text-white/70">Loading 3D Moon…</div>,
});

const ALL_GROUPS = Object.keys(GROUP_LABELS) as SiteGroup[];
type GlobeView = "flat" | "3d";

const coordText = (lat: number, lon: number) => `${fmtLat(lat)}, ${fmtLon(lon)}`;
const matches = (s: Site, q: string) => [s.name, s.mission, GROUP_LABELS[s.group]].some((v) => v?.toLowerCase().includes(q));

const sectionTitle = "text-xs font-semibold uppercase tracking-wider text-faint";
const subTitle = "flex items-center text-base font-semibold";
const inputCls = "h-10 w-full rounded-sm border bg-panel text-sm outline-none transition-colors placeholder:text-faint/60 hover:border-muted focus:border-fg";

/**
 * Page 1. Two sections and a button: pick a site (from the curated list, or by coordinates, or on the
 * map), pick a landing date and time, then "Explore site details". Picking only fills the form.
 */
export function SiteSelection() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Set<SiteGroup>>(() => new Set(ALL_GROUPS)) // every list on by default (D-052);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [coords, setCoords] = useState("");
  const [coordsTouched, setCoordsTouched] = useState(false);
  const nowMinute = useNowMinute();
  const [picked, setPicked] = useState<number | null>(null);
  const when = picked ?? nowMinute;
  const [hovered, setHovered] = useState<string | null>(null);
  const [listHover, setListHover] = useState<string | null>(null);
  const [mode, setMode] = useState<MapMode>("polar");
  const [globeView, setGlobeView] = useState<GlobeView>("flat");
  const listRef = useRef<HTMLUListElement>(null);

  // Exactly one of the two inputs is active: a curated site, or typed/clicked coordinates.
  const selectedSite = siteId ? getSite(siteId) ?? null : null;
  const parsed = coords.trim() ? parseCoordString(coords) : null;
  const customPoint = parsed?.ok ? { lat: parsed.lat, lon: parsed.lon } : null;
  const valid = !!selectedSite || !!customPoint;
  const coordError = coordsTouched && parsed && !parsed.ok ? parsed.error : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sites.filter(hasCoordinates).filter((s) => groups.has(s.group) && (!q || matches(s, q)));
  }, [groups, query]);
  // The selected site stays on the map even when the filters hide it from the list.
  const mapSites = useMemo(() => {
    const base = selectedSite && !filtered.includes(selectedSite) ? [...filtered, selectedSite] : filtered;
    return base.filter((s) => (mode === "polar" ? onPolarMap(s.lat) : true));
  }, [filtered, selectedSite, mode]);
  const offMapCount = filtered.filter((s) => !onPolarMap(s.lat)).length;

  // A pin hovered or picked on the map scrolls its card into view.
  useEffect(() => {
    const id = listHover ? null : hovered ?? siteId;
    if (!id) return;
    listRef.current?.querySelector(`[data-site="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [hovered, listHover, siteId]);

  // Esc clears the selection (a curated site or a custom point), unless a menu, picker or dialog is
  // open: then Esc only closes that.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector('[role="menu"], [role="dialog"], [role="listbox"]')) return;
      setSiteId(null);
      setCoords("");
      setCoordsTouched(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const pickSite = (s: Site) => {
    setSiteId(s.id);
    setCoords("");
    setCoordsTouched(false);
  };
  const pickPoint = (lat: number, lon: number) => {
    setSiteId(null);
    setCoords(coordText(+lat.toFixed(4), +(((lon + 540) % 360) - 180).toFixed(4)));
    setCoordsTouched(false);
  };

  const explore = () => {
    if (!valid) {
      setCoordsTouched(true);
      return;
    }
    const t = when !== null ? `t=${encodeURIComponent(new Date(when).toISOString())}` : "";
    if (selectedSite) router.push(`/site/${selectedSite.id}${t ? `?${t}` : ""}`);
    else if (customPoint) router.push(`/site/custom?${t ? `${t}&` : ""}lat=${customPoint.lat}&lon=${customPoint.lon}`);
  };

  const hoveredSite = hovered ? getSite(hovered) : null;
  const mapProps = {
    sites: mapSites,
    hoveredId: hovered,
    selectedIds: selectedSite ? [selectedSite.id] : [],
    onHover: setHovered,
    onSelect: (id: string) => {
      const s = getSite(id);
      if (s) pickSite(s);
    },
    onPickCoordinate: pickPoint,
    customPoint,
    onClearCustom: () => {
      setCoords("");
      setCoordsTouched(false);
    },
  };

  const seg = (on: boolean) => `rounded-sm px-3 py-1 transition-colors ${on ? "bg-primary text-primary-ink" : "text-muted hover:text-fg"}`;
  const overlays = (
    <>
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2 text-sm">
        <div className="flex rounded-sm border border-line bg-panel/90 p-0.5 backdrop-blur" role="radiogroup" aria-label="Map view">
          <button role="radio" aria-checked={mode === "polar"} onClick={() => setMode("polar")} className={seg(mode === "polar")}>South pole</button>
          <button role="radio" aria-checked={mode === "global"} onClick={() => setMode("global")} className={seg(mode === "global")}>Whole Moon</button>
        </div>
        {mode === "global" && (
          <div className="flex rounded-sm border border-line bg-panel/90 p-0.5 backdrop-blur" role="radiogroup" aria-label="Whole Moon view">
            <button role="radio" aria-checked={globeView === "flat"} onClick={() => setGlobeView("flat")} className={seg(globeView === "flat")}>Flat</button>
            <button role="radio" aria-checked={globeView === "3d"} onClick={() => setGlobeView("3d")} className={seg(globeView === "3d")}>3D</button>
          </div>
        )}
      </div>
      {hoveredSite && mode === "polar" && !onPolarMap(hoveredSite.lat) && (
        <div className="absolute left-1/2 top-14 z-10 -translate-x-1/2 rounded-sm border border-line bg-panel px-3 py-1.5 text-sm shadow-sm">
          {hoveredSite.name} is outside the south-pole map. Switch to <button className="underline" onClick={() => setMode("global")}>Whole Moon</button> to see it.
        </div>
      )}
    </>
  );

  return (
    <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-5 lg:h-[calc(100vh-65px)] lg:grid-cols-[460px_1fr]">
      <aside className="flex min-h-0 flex-col overflow-y-auto">
        {/* 1 · Site selection */}
        <section aria-labelledby="sec-site" className="flex min-h-0 flex-1 flex-col pb-5">
          <h2 id="sec-site" className={sectionTitle}>Site selection</h2>

          <div className="mt-3 flex items-center justify-between gap-2">
            <h3 className={subTitle}>Lunar sites, missions, and features</h3>
            <FilterMenu groups={ALL_GROUPS} selected={groups} onChange={setGroups} />
          </div>
          <div className="relative mt-2">
            <MagnifyingGlass size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
            <input
              type="search"
              aria-label="Search sites, missions or features"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sites, missions, features"
              className={`${inputCls} border-line pl-9 pr-3`}
            />
          </div>
          <p className="mt-2 text-xs text-faint">
            <span className="num">{filtered.length}</span> results
            {offMapCount > 0 && mode === "polar" ? <> · <span className="num">{offMapCount}</span> outside the south-pole map</> : ""}
          </p>

          <div className="relative mt-1.5 flex min-h-[180px] flex-1 flex-col overflow-hidden rounded-sm border border-line bg-panel">
          <ul ref={listRef} aria-label="Lunar sites" className="no-scrollbar min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            {filtered.map((s) => (
              <SiteCard
                key={s.id}
                s={s}
                hot={hovered === s.id}
                selected={siteId === s.id}
                onHover={(id) => {
                  setHovered(id);
                  setListHover(id);
                }}
                onPick={() => (siteId === s.id ? setSiteId(null) : pickSite(s))}
                mode={mode}
                onShowGlobal={() => setMode("global")}
              />
            ))}
            {filtered.length === 0 && <li className="p-3 text-sm text-muted">No sites match. Try another search or turn on more filters.</li>}
          </ul>
          <ScrollThumb target={listRef} />
          </div>

          <div className="my-4 flex items-center gap-3 text-xs font-semibold tracking-wider text-faint" role="separator" aria-label="or">
            <span className="h-px flex-1 bg-line" />OR<span className="h-px flex-1 bg-line" />
          </div>

          <label htmlFor="coords" className={subTitle}>
            Enter Lunar Coordinates
            <InfoTip title="Custom coordinates" sources={["lola-pds", "jpl-horizons", "usgs-gazetteer", "psr-atlas"]}>
              Type latitude then longitude, for example 85.2S 30.1E, -85.2, 30.1, or -89.45 230.22 (east longitude 0–360). You can also click the map. The terrain horizon, slopes and nearby features are computed for that exact point from LOLA elevation data, which takes a few seconds the first time.
            </InfoTip>
          </label>
          <div className="relative mt-2">
            <input
              id="coords"
              value={coords}
              onChange={(e) => {
                setCoords(e.target.value);
                setCoordsTouched(false);
                if (e.target.value.trim()) setSiteId(null);
              }}
              onBlur={() => setCoordsTouched(true)}
              onKeyDown={(e) => e.key === "Enter" && explore()}
              placeholder="e.g. 85.2S 30.1E or -85.2, 30.1"
              aria-invalid={!!coordError}
              autoComplete="off"
              spellCheck={false}
              className={`${inputCls} num pl-3 pr-9 placeholder:font-sans ${coordError ? "border-critical" : customPoint ? "border-fg" : "border-line"}`}
            />
            {coords && (
              <button type="button" onClick={() => setCoords("")} aria-label="Clear coordinates" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-faint hover:text-fg">
                <X size={16} />
              </button>
            )}
          </div>
          {coordError ? (
            <p className="mt-1.5 text-xs text-critical" role="alert">{coordError}</p>
          ) : customPoint && coords.trim() !== coordText(customPoint.lat, customPoint.lon) ? (
            <p className="mt-1.5 text-xs text-faint">Reads as <span className="num">{coordText(customPoint.lat, customPoint.lon)}</span></p>
          ) : null}
          <p className="mt-1.5 text-xs text-faint">Or click anywhere on the map to drop a point.</p>
        </section>

        {/* 2 · Date & time */}
        <section aria-labelledby="sec-time" className="border-t border-line py-5">
          <h2 id="sec-time" className={sectionTitle}>Date &amp; time</h2>
          <div className={`${subTitle} mt-3`}>
            <label htmlFor="landing-date">Landing date &amp; time</label>
            <InfoTip title="Why the landing time matters" sources={["jpl-horizons"]}>
              Near the pole the Sun skims the horizon. Shifting a few days can decide whether a site is lit or in shadow, and whether Earth is up for direct contact. Times are UTC.
            </InfoTip>
          </div>
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
            <DateField id="landing-date" value={when} onChange={setPicked} />
            <div className="w-36">
              <TimeField value={when} onChange={setPicked} />
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={explore}
          disabled={!valid}
          className={`inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-sm bg-primary font-medium text-primary-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-35 ${valid ? "cta-shimmer" : ""}`}
        >
          Explore Site Details <ArrowRight size={18} aria-hidden />
        </button>
      </aside>

      <section className="relative min-h-[60vh]">
        {mode === "global" && globeView === "3d" ? (
          <MoonGlobe {...mapProps} focusId={listHover}>
            {overlays}
          </MoonGlobe>
        ) : (
          <MoonMap mode={mode} {...mapProps}>
            {overlays}
          </MoonMap>
        )}
      </section>
    </div>
  );
}

function SiteCard({
  s, hot, selected, onHover, onPick, mode, onShowGlobal,
}: { s: Site; hot: boolean; selected: boolean; onHover: (id: string | null) => void; onPick: () => void; mode: MapMode; onShowGlobal: () => void }) {
  const polar = isPolar(s.lat);
  const mapped = onPolarMap(s.lat);
  return (
    <li data-site={s.id}>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={onPick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPick();
          }
        }}
        onMouseEnter={() => onHover(s.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(s.id)}
        onBlur={() => onHover(null)}
        className={`relative cursor-pointer px-3 py-2.5 outline-none transition-colors ${
          selected ? "bg-panel-2 ring-2 ring-inset ring-primary" : hot ? "bg-panel-2/60 ring-1 ring-inset ring-primary/30" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className={selected ? "font-semibold" : "font-medium"}>{s.name}</span>
          {selected ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-fg">
              <CheckCircle size={18} weight="fill" aria-hidden /> Selected
            </span>
          ) : (
            !polar && (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-warn" title="Outside the south-polar region (poleward of 80°S)">
                <Warning size={15} aria-hidden /> Not south pole
              </span>
            )
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted">
          {GROUP_LABELS[s.group]}
          {s.date ? <> · <span className="num">{s.date.slice(0, 10)}</span></> : ""}
          {s.status ? ` · ${s.status}` : ""}
        </div>
        <div className="num mt-0.5 text-xs text-faint">
          {fmtLat(s.lat)}, {fmtLon(s.lon)}
          {!mapped && mode === "polar" && (
            <button
              type="button"
              className="ml-2 font-sans underline hover:text-fg"
              onClick={(e) => {
                e.stopPropagation();
                onShowGlobal();
              }}
            >
              show on Whole Moon
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
