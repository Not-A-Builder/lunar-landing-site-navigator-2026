"use client";

import { ArrowRight, MagnifyingGlass, Warning, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CustomCoordForm } from "@/components/CustomCoordForm";
import { InfoTip } from "@/components/InfoTip";
import { MoonMap, type MapMode } from "@/components/map/MoonMap";
import { fmtLat, fmtLon } from "@/lib/metrics/format";
import { useNowHour } from "@/lib/use-now";
import { GROUP_LABELS, hasCoordinates, isPolar, onPolarMap, sites, type Site, type SiteGroup } from "@/lib/sites";

const ALL_GROUPS = Object.keys(GROUP_LABELS) as SiteGroup[];
const DEFAULT_GROUPS = ALL_GROUPS.filter((g) => g !== "feature");


/** Page 1: search + filters + results list beside the map, hover-linked both ways. */
export function SiteSelection() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Set<SiteGroup>>(new Set(DEFAULT_GROUPS));
  const nowHour = useNowHour();
  const [whenInput, setWhen] = useState("");
  const when = whenInput || (nowHour ? new Date(nowHour).toISOString().slice(0, 16) : "");
  const [custom, setCustom] = useState<{ lat: number; lon: number } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mode, setMode] = useState<MapMode>("polar");
  const listRef = useRef<HTMLUListElement>(null);

  const tParam = when ? `?t=${encodeURIComponent(new Date(when + "Z").toISOString())}` : "";
  const open = (id: string) => router.push(`/site/${id}${tParam}`);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sites
      .filter(hasCoordinates)
      .filter((s) => (q ? true : groups.has(s.group)))
      .filter((s) => !q || [s.name, s.mission, GROUP_LABELS[s.group]].some((v) => v?.toLowerCase().includes(q)));
  }, [query, groups]);

  const onMap = filtered.filter((s) => (mode === "polar" ? onPolarMap(s.lat!) : true));
  const offMapCount = filtered.length - onMap.length;

  // Pin hover scrolls the matching card into view (list ← map)
  useEffect(() => {
    if (!hovered) return;
    listRef.current?.querySelector(`[data-site="${hovered}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [hovered]);

  const toggleGroup = (g: SiteGroup) =>
    setGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  const openCustom = (lat: number, lon: number) => router.push(`/site/custom${tParam}${tParam ? "&" : "?"}lat=${lat}&lon=${lon}`);

  const hoveredSite = hovered ? sites.find((s) => s.id === hovered) : null;

  return (
    <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-5 lg:h-[calc(100vh-65px)] lg:grid-cols-[440px_1fr]">
      <aside className="flex min-h-0 flex-col gap-4">
        <div className="space-y-4">
          <div className="relative">
            <MagnifyingGlass size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
            <input
              aria-label="Search sites, missions or features"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sites, missions, features"
              className="w-full rounded-sm border border-line bg-panel py-2 pl-9 pr-3 text-sm outline-none placeholder:text-faint focus:border-muted"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="shrink-0 text-sm text-muted" htmlFor="when">
              Landing (UTC)
              <InfoTip title="Why the landing time matters" sources={["jpl-horizons"]}>
                Near the pole the Sun skims the horizon. Shifting a few days can decide whether a site is lit or in shadow, and whether Earth is up for direct contact.
              </InfoTip>
            </label>
            <input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="num min-w-0 flex-1 rounded-sm border border-line bg-panel px-2 py-1.5 text-sm" />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Curated lists">
            {ALL_GROUPS.map((g) => (
              <button
                key={g}
                onClick={() => toggleGroup(g)}
                aria-pressed={groups.has(g)}
                className={`rounded-sm border px-2 py-0.5 text-xs transition-colors ${groups.has(g) ? "border-accent/40 bg-accent/10 text-fg" : "border-line text-muted hover:text-fg"}`}
              >
                {GROUP_LABELS[g]}
              </button>
            ))}
          </div>
          <div className="border-t border-line pt-4">
            <CustomCoordForm key={custom ? `${custom.lat},${custom.lon}` : "empty"} initial={custom} onSubmit={openCustom} submitLabel="Analyse" />
            <p className="mt-1 text-xs text-faint">Or click anywhere on the map to drop a point.</p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-4 text-xs text-muted">
          <span><span className="num">{filtered.length}</span> results{offMapCount > 0 && mode === "polar" ? <> · <span className="num">{offMapCount}</span> outside the south-pole map</> : ""}</span>
          <Link href="/compare" className="inline-flex items-center gap-1 hover:text-fg">Start a comparison <ArrowRight size={15} aria-hidden /></Link>
        </div>

        <ul ref={listRef} className="-mx-2 min-h-0 flex-1 overflow-auto" aria-label="Candidate sites">
          {filtered.map((s) => (
            <SiteCard key={s.id} s={s} hot={hovered === s.id} onHover={setHovered} href={`/site/${s.id}${tParam}`} mode={mode} onShowGlobal={() => setMode("global")} />
          ))}
          {filtered.length === 0 && <li className="p-4 text-sm text-muted">No sites match. Try another name or turn on more lists.</li>}
        </ul>
      </aside>

      <section className="relative min-h-[60vh]">
        <div className="absolute right-3 top-3 z-10 flex rounded-sm border border-line bg-panel/90 p-0.5 text-sm backdrop-blur" role="radiogroup" aria-label="Map view">
          {(["polar", "global"] as const).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`rounded-sm px-3 py-1 ${mode === m ? "bg-primary text-primary-ink" : "text-muted hover:text-fg"}`}>
              {m === "polar" ? "South pole" : "Whole Moon"}
            </button>
          ))}
        </div>
        {hoveredSite && mode === "polar" && hasCoordinates(hoveredSite) && !onPolarMap(hoveredSite.lat) && (
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-sm border border-line bg-panel px-3 py-1.5 text-sm shadow-sm">
            {hoveredSite.name} is outside the south-pole map. Switch to <button className="underline" onClick={() => setMode("global")}>Whole Moon</button> to see it.
          </div>
        )}
        <div className="h-full">
          <MoonMap
            mode={mode}
            sites={onMap}
            hoveredId={hovered}
            onHover={setHovered}
            onSelect={(id) => (id === "__custom" && custom ? openCustom(custom.lat, custom.lon) : open(id))}
            onPickCoordinate={(lat, lon) => setCustom({ lat: +lat.toFixed(4), lon: +(((lon + 540) % 360) - 180).toFixed(4) })}
            customPoint={custom}
          />
          {custom && (
            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-sm border border-line bg-panel py-2 pl-3 pr-2 text-sm shadow-lg">
              <span>Custom point <span className="num">{fmtLat(custom.lat)}, {fmtLon(custom.lon)}</span></span>
              <button onClick={() => openCustom(custom.lat, custom.lon)} className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-2.5 py-1 text-primary-ink">Analyse this point <ArrowRight size={16} aria-hidden /></button>
              <button onClick={() => setCustom(null)} aria-label="Clear custom point" title="Clear" className="rounded-sm p-1 text-muted hover:bg-panel-2 hover:text-fg"><X size={18} /></button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SiteCard({ s, hot, onHover, href, mode, onShowGlobal }: { s: Site; hot: boolean; onHover: (id: string | null) => void; href: string; mode: MapMode; onShowGlobal: () => void }) {
  const polar = isPolar(s.lat!);
  const mapped = onPolarMap(s.lat!);
  return (
    <li data-site={s.id}>
      <Link
        href={href}
        onMouseEnter={() => onHover(s.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(s.id)}
        onBlur={() => onHover(null)}
        className={`block rounded-sm border-l-2 px-3 py-2.5 transition-colors ${hot ? "border-accent bg-panel-2" : "border-transparent hover:bg-panel-2"}`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium">{s.name}</span>
          {!polar && (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-warn" title="Outside the south-polar region (poleward of 80°S)">
              <Warning size={15} aria-hidden /> Not south pole
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted">
          {GROUP_LABELS[s.group]}
          {s.date ? <> · <span className="num">{s.date.slice(0, 10)}</span></> : ""}
          {s.status ? ` · ${s.status}` : ""}
        </div>
        <div className="num mt-0.5 text-xs text-faint">
          {fmtLat(s.lat!)}, {fmtLon(s.lon!)}
          {!mapped && mode === "polar" && (
            <button
              type="button"
              className="ml-2 font-sans underline hover:text-fg"
              onClick={(e) => {
                e.preventDefault();
                onShowGlobal();
              }}
            >
              show on Whole Moon
            </button>
          )}
        </div>
      </Link>
    </li>
  );
}
