"use client";

import { ArrowRight, CheckCircle, MagnifyingGlass, Plus, Warning, X } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { InfoTip } from "@/components/InfoTip";
import { ScrollThumb } from "@/components/ScrollThumb";
import { MoonMap, type MapMode } from "@/components/map/MoonMap";
import { parseCoordString } from "@/lib/coords";
import { fmtLat, fmtLon } from "@/lib/metrics/format";
import { MAX_COMPARE } from "@/lib/config";
import { usePersona } from "@/lib/persona";
import { customScenarioId, parseScenarios, type Scenario, serialiseScenarios } from "@/lib/scenarios";
import { useNowMinute } from "@/lib/use-now";
import { GROUP_LABELS, getSite, hasCoordinates, isPolar, onPolarMap, sites, type Site, type SiteGroup } from "@/lib/sites";
import { DateField, TimeField } from "./DateTimePickers";
import { FilterMenu } from "./FilterMenu";
import { ScenarioBar } from "./ScenarioBar";
import { DEFAULT_SORT, SortMenu, sortSites, type SortId } from "./SortMenu";

const MoonGlobe = dynamic(() => import("@/components/map/MoonGlobe"), {
  ssr: false,
  loading: () => <div className="flex h-full min-h-105 items-center justify-center rounded-sm border border-line bg-black text-sm text-white/70">Loading 3D Moon…</div>,
});

const ALL_GROUPS = Object.keys(GROUP_LABELS) as SiteGroup[];
type GlobeView = "flat" | "3d";

const coordText = (lat: number, lon: number) => `${fmtLat(lat)}, ${fmtLon(lon)}`;
const matches = (s: Site, q: string) => [s.name, s.mission, GROUP_LABELS[s.group]].some((v) => v?.toLowerCase().includes(q));

/** The list shows at most this many rows; the next row peeks in at a bit over half its height (D-064, D-065). */
const VISIBLE_ROWS = 4;
const PEEK = 0.58;

/** Form fields (curated site, or coordinate text, plus landing time) that describe a scenario. */
function formFromScenario(sc: Scenario): { siteId: string | null; coords: string; picked: number | null } {
  const t = sc.t ? Date.parse(sc.t) : NaN;
  const picked = Number.isFinite(t) ? t : null;
  if (!sc.siteId.startsWith("custom:")) return { siteId: sc.siteId, coords: "", picked };
  const [la, lo] = sc.siteId.slice(7).split(",").map(Number);
  return { siteId: null, coords: coordText(la, lo), picked };
}

const subTitle = "flex items-center text-base font-semibold";
const inputCls = "h-10 w-full rounded-sm border bg-panel text-sm outline-none transition-colors placeholder:text-faint/60 hover:border-muted focus:border-fg";

/**
 * Page 1. Two sections and a button: pick a site (from the curated list, or by coordinates, or on the
 * map), pick a landing date and time, then "Explore site details". Picking only fills the form.
 *
 * "Select another scenario to compare" parks the current site + time in `?s=` and resets the form for
 * the next one; a sticky bar above the page shows the scenarios (D-066).
 */
export function SiteSelection() {
  const router = useRouter();
  const params = useSearchParams();
  // Scenarios added for comparison (D-066). The form below fills either a new slot after them
  // (`editing` null) or re-edits one of them (`editing` = its index; its URL entry is then stale
  // until the form is committed back).
  const queue = useMemo(() => parseScenarios(params.get("s")), [params]);
  // A link with every slot filled has no free slot, so it opens the last scenario for editing.
  const [initial] = useState(() => {
    const q = parseScenarios(params.get("s"));
    return q.length >= MAX_COMPARE ? { index: q.length - 1, form: formFromScenario(q[q.length - 1]) } : null;
  });
  const [editing, setEditing] = useState<number | null>(initial?.index ?? null);
  const activeIndex = editing ?? queue.length;
  const comparing = queue.length + (editing === null ? 1 : 0) > 1;
  const asideRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortId>(DEFAULT_SORT);
  const [groups, setGroups] = useState<Set<SiteGroup>>(() => new Set(ALL_GROUPS)) // every list on by default (D-052);
  const [siteId, setSiteId] = useState<string | null>(initial?.form.siteId ?? null);
  const [coords, setCoords] = useState(initial?.form.coords ?? "");
  const [coordsTouched, setCoordsTouched] = useState(false);
  const nowMinute = useNowMinute();
  const [picked, setPicked] = useState<number | null>(initial?.form.picked ?? null);
  const when = picked ?? nowMinute;
  const [hovered, setHovered] = useState<string | null>(null);
  const [listHover, setListHover] = useState<string | null>(null);
  const [mode, setMode] = useState<MapMode>("polar");
  const [globeView, setGlobeView] = useState<GlobeView>("flat");
  const listRef = useRef<HTMLUListElement>(null);
  const [listMax, setListMax] = useState<number | null>(null);
  const enthusiast = usePersona((s) => s.persona) === "enthusiast";

  // Exactly one of the two inputs is active: a curated site, or typed/clicked coordinates.
  const selectedSite = siteId ? getSite(siteId) ?? null : null;
  const parsed = coords.trim() ? parseCoordString(coords) : null;
  const customPoint = parsed?.ok ? { lat: parsed.lat, lon: parsed.lon } : null;
  const valid = !!selectedSite || !!customPoint;
  const coordError = coordsTouched && parsed && !parsed.ok ? parsed.error : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortSites(sites.filter(hasCoordinates).filter((s) => groups.has(s.group) && (!q || matches(s, q))), sort);
  }, [groups, query, sort]);
  // The selected site stays on the map even when the filters hide it from the list.
  const mapSites = useMemo(() => {
    const base = selectedSite && !filtered.includes(selectedSite) ? [...filtered, selectedSite] : filtered;
    return base.filter((s) => (mode === "polar" ? onPolarMap(s.lat) : true));
  }, [filtered, selectedSite, mode]);
  const offMapCount = filtered.filter((s) => !onPolarMap(s.lat)).length;

  // Cap the list at VISIBLE_ROWS rows plus PEEK of the next (it shrinks further on short screens), measured from the rendered rows so a
  // wrapped name still lines up. Re-measured when the rows or the column width change.
  useLayoutEffect(() => {
    const ul = listRef.current;
    if (!ul) return;
    const measure = () => {
      const next = ul.children[VISIBLE_ROWS] as HTMLElement | undefined;
      setListMax(next ? Math.round(next.offsetTop + next.offsetHeight * PEEK) : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ul);
    return () => ro.disconnect();
  }, [filtered]);

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

  // The scenario being filled in, once a site is picked.
  const current: Scenario | null = selectedSite || customPoint
    ? { siteId: selectedSite ? selectedSite.id : customScenarioId(customPoint!.lat, customPoint!.lon), t: when !== null ? new Date(when).toISOString() : "" }
    : null;
  // Room for one more slot after the form's scenario is saved.
  const canAddMore = (editing === null ? queue.length + 1 : queue.length) < MAX_COMPARE;
  const setQueue = (next: Scenario[]) => router.replace(next.length ? `/?s=${serialiseScenarios(next)}` : "/", { scroll: false });
  /** Applies a new slot list + edit target. With a single scenario left the bar goes away: it lives in the form. */
  const apply = (next: Scenario[], nextEditing: number | null) => {
    if (nextEditing !== null && next.length <= 1) {
      next = [];
      nextEditing = null;
    }
    setEditing(nextEditing);
    setQueue(next);
  };
  /** The slot list with the form's scenario saved into its slot (unchanged if no site is picked). */
  const committed = (): Scenario[] => {
    if (!current) return queue;
    if (editing === null) return [...queue, current];
    return queue.map((sc, k) => (k === editing ? current : sc));
  };

  const resetForm = () => {
    setSiteId(null);
    setCoords("");
    setCoordsTouched(false);
    setPicked(null);
    setQuery("");
    setGroups(new Set(ALL_GROUPS));
  };
  const loadIntoForm = (sc: Scenario) => {
    const f = formFromScenario(sc);
    setSiteId(f.siteId);
    setCoords(f.coords);
    setCoordsTouched(false);
    setPicked(f.picked);
  };

  // Parks this site + time as the next scenario and starts an empty form for the one after.
  const addAnother = () => {
    if (!current) {
      setCoordsTouched(true);
      return;
    }
    if (!canAddMore) return;
    apply(committed(), null);
    resetForm();
    asideRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  };
  const startComparison = () => {
    if (!current) {
      setCoordsTouched(true);
      return;
    }
    router.push(`/compare?s=${serialiseScenarios(committed())}`);
  };
  // Pencil on a saved card: save the form into its own slot, then load that scenario into the form.
  const editQueued = (i: number) => {
    const next = committed();
    loadIntoForm(next[i]);
    apply(next, i);
  };
  // × on a saved card drops it. × on the active card discards the form and opens the last remaining
  // scenario for editing. With a single scenario left the page is the plain picker again.
  const removeQueued = (i: number) => {
    const next = queue.filter((_, k) => k !== i);
    apply(next, editing === null ? null : editing > i ? editing - 1 : editing);
  };
  const removeCurrent = () => {
    const next = editing === null ? queue : queue.filter((_, k) => k !== editing);
    const last = next.at(-1);
    if (!last) return;
    loadIntoForm(last);
    apply(next, next.length - 1);
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
    <div className="flex flex-col lg:h-[calc(100vh-65px)]">
    {comparing && (
      <ScenarioBar
        queue={queue}
        activeIndex={activeIndex}
        editing={editing !== null}
        onEdit={editQueued}
        current={current}
        draftWhen={when}
        onRemoveQueued={removeQueued}
        onRemoveCurrent={removeCurrent}
      />
    )}
    <div className="mx-auto grid w-full max-w-[1600px] gap-6 px-4 py-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[460px_1fr]">
      <aside ref={asideRef} className="flex min-h-0 flex-col overflow-y-auto">
        {/* 1 · Date & time selection */}
        <section aria-label="Date and time selection" className="pb-8">
          <div className={subTitle}>
            <label htmlFor="landing-date">Select landing date &amp; time</label>
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

        {/* 2 · Site selection */}
        <section aria-label="Site selection" className="flex min-h-0 flex-col border-t border-line py-8">
          {/* The enthusiast view skips typed coordinates; the map click (hint below the list) still works. */}
          {!enthusiast && (
          <>
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

          <div className="my-4 flex items-center justify-center gap-3 text-xs font-semibold tracking-wider text-faint" role="separator" aria-label="or">
            {/* each rule is a quarter of the column, fading out toward its outer end */}
            <span className="h-px w-1/4" style={{ background: "linear-gradient(to right, transparent, var(--line))" }} />
            OR
            <span className="h-px w-1/4" style={{ background: "linear-gradient(to left, transparent, var(--line))" }} />
          </div>
          </>
          )}

          <div className="flex items-center justify-between gap-2">
            <h3 className={subTitle}>Select landing site, mission, or feature</h3>
            <div className="flex shrink-0 items-center gap-2">
              <FilterMenu groups={ALL_GROUPS} selected={groups} onChange={setGroups} />
              <SortMenu value={sort} onChange={setSort} />
            </div>
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

          <div className="relative mt-1.5 flex min-h-[120px] flex-col overflow-hidden rounded-sm border border-line bg-panel">
          {/* When it overflows, the list leaves a gutter on the right for its scroll bar (D-064). */}
          <ul
            ref={listRef}
            aria-label="Landing sites, missions, and features"
            style={listMax ? { maxHeight: listMax } : undefined}
            className={`no-scrollbar relative min-h-0 divide-y divide-line overflow-y-auto ${listMax ? "pr-3.5" : ""}`}
          >
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
          {enthusiast && (
            <p className="mt-2 text-xs text-faint">
              {customPoint ? (
                <>
                  Point dropped at <span className="num">{coordText(customPoint.lat, customPoint.lon)}</span>.{" "}
                  <button type="button" className="underline hover:text-fg" onClick={() => setCoords("")}>Clear</button>
                </>
              ) : (
                "Or click anywhere on the map to drop a point."
              )}
            </p>
          )}
        </section>

        <button
          type="button"
          onClick={comparing ? startComparison : explore}
          disabled={!valid}
          className={`inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-sm bg-primary cursor-pointer font-medium text-primary-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-35 ${valid ? "cta-shimmer" : ""}`}
        >
          {comparing ? "Start comparison now" : "Explore Site Details"} <ArrowRight size={18} aria-hidden />
        </button>
        {/* No free slot left (the form fills the last one): only "Start comparison now" (D-067). */}
        {canAddMore && (
        <button
          type="button"
          onClick={addAnother}
          disabled={!valid}
          className="mt-2 inline-flex h-11 w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-sm border border-line bg-panel font-medium text-fg transition-colors hover:border-muted disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line"
        >
          <Plus size={18} aria-hidden /> Select another scenario to compare
        </button>
        )}
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
        className={`relative cursor-pointer px-3 py-2 outline-none transition-colors ${
          selected ? "bg-panel-2 ring-2 ring-inset ring-primary" : hot ? "bg-panel-2/60 ring-1 ring-inset ring-primary/30" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className={`leading-snug ${selected ? "font-semibold" : "font-medium"}`}>{s.name}</span>
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
        <div className="text-xs leading-[1.125rem] text-muted">
          {GROUP_LABELS[s.group]}
          {s.date ? <> · <span className="num">{s.date.slice(0, 10)}</span></> : ""}
          {s.status ? ` · ${s.status}` : ""}
        </div>
        <div className="num text-xs leading-[1.125rem] text-faint">
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
