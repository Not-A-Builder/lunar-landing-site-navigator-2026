"use client";

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
    <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 lg:h-[calc(100vh-57px)] lg:grid-cols-[400px_1fr]">
      <aside className="flex min-h-0 flex-col gap-3">
        <div className="space-y-2">
          <input
            aria-label="Search sites, missions or features"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sites, missions or features (e.g. Shackleton, Apollo 15)"
            className="w-full rounded-full border border-line bg-panel px-4 py-2.5 text-sm outline-none focus:border-muted"
          />
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-xs text-muted" htmlFor="when">
              Landing (UTC)
              <InfoTip title="Why the landing time matters" sources={["jpl-horizons"]}>
                Near the pole the Sun skims the horizon. Shifting a few days can decide whether a site is lit or in shadow, and whether Earth is up for direct contact.
              </InfoTip>
            </label>
            <input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="min-w-0 flex-1 rounded-md border border-line bg-panel px-2 py-1.5 text-sm" />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Curated lists">
            {ALL_GROUPS.map((g) => (
              <button
                key={g}
                onClick={() => toggleGroup(g)}
                aria-pressed={groups.has(g)}
                className={`rounded-full border px-2.5 py-1 text-[11px] ${groups.has(g) ? "border-accent bg-accent/15 text-fg" : "border-line text-muted hover:text-fg"}`}
              >
                {GROUP_LABELS[g]}
              </button>
            ))}
          </div>
          <div className="rounded-md border border-line bg-panel px-3 py-2">
            <CustomCoordForm key={custom ? `${custom.lat},${custom.lon}` : "empty"} initial={custom} onSubmit={openCustom} submitLabel="Analyse" />
            <p className="mt-1 text-[11px] text-faint">Or click anywhere on the map to drop a point.</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted">
          <span>{filtered.length} results{offMapCount > 0 && mode === "polar" ? ` · ${offMapCount} outside the south-pole map` : ""}</span>
          <Link href="/compare" className="underline">Start a comparison</Link>
        </div>

        <ul ref={listRef} className="min-h-0 flex-1 space-y-1.5 overflow-auto pr-1" aria-label="Candidate sites">
          {filtered.map((s) => (
            <SiteCard key={s.id} s={s} hot={hovered === s.id} onHover={setHovered} href={`/site/${s.id}${tParam}`} mode={mode} onShowGlobal={() => setMode("global")} />
          ))}
          {filtered.length === 0 && <li className="p-4 text-sm text-muted">No sites match. Try another name or turn on more lists.</li>}
        </ul>
      </aside>

      <section className="relative min-h-[60vh]">
        <div className="absolute right-3 top-3 z-10 flex rounded-full border border-line bg-panel/90 p-0.5 text-xs backdrop-blur" role="radiogroup" aria-label="Map view">
          {(["polar", "global"] as const).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`rounded-full px-3 py-1 ${mode === m ? "bg-accent text-accent-ink" : "text-muted hover:text-fg"}`}>
              {m === "polar" ? "South pole" : "Whole Moon"}
            </button>
          ))}
        </div>
        {hoveredSite && mode === "polar" && hasCoordinates(hoveredSite) && !onPolarMap(hoveredSite.lat) && (
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-md border border-line bg-panel-2 px-3 py-1.5 text-xs">
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
            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm shadow-lg">
              <span>Custom point {fmtLat(custom.lat)}, {fmtLon(custom.lon)}</span>
              <button onClick={() => openCustom(custom.lat, custom.lon)} className="rounded-md bg-accent px-2.5 py-1 text-accent-ink">Analyse this point →</button>
              <button onClick={() => setCustom(null)} className="text-xs text-muted underline">Clear</button>
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
        className={`block rounded-lg border px-3 py-2 transition-colors ${hot ? "border-accent bg-panel-2" : "border-line bg-panel hover:border-muted"}`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium">{s.name}</span>
          {!polar && (
            <span className="shrink-0 rounded-full border border-warn/50 px-1.5 py-0.5 text-[10px] text-warn" title="Outside the south-polar region (poleward of 80°S)">
              Not south pole
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-muted">
          {GROUP_LABELS[s.group]}
          {s.date ? ` · ${s.date.slice(0, 10)}` : ""}
          {s.status ? ` · ${s.status}` : ""}
        </div>
        <div className="text-[11px] text-faint">
          {fmtLat(s.lat!)}, {fmtLon(s.lon!)}
          {!mapped && mode === "polar" && (
            <button
              type="button"
              className="ml-2 underline"
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
