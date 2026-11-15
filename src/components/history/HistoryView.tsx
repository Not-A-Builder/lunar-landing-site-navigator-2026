"use client";

import { Columns, MapPin, Star, Trash } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { byRecent, collapseRevisits, historyHref, scenarioKey, useHistory, type HistoryEntry } from "@/lib/history";
import { fmtUTC } from "@/lib/metrics/format";
import { resolveScenarioSite, SCENARIO_LETTERS } from "@/lib/scenarios";
import { btnLink, btnSecondary } from "@/lib/ui";
import { useNowMinute } from "@/lib/use-now";
import { useHistoryHydrated } from "./HistoryRecorder";

const siteName = (id: string) => resolveScenarioSite(id)?.name ?? "Site no longer listed";

// When an entry was opened is shown in the viewer's local time (D-132); landing times stay UTC.
const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/**
 * English locales whose short zone names cover different regions: "en-US" alone gives "GMT+5:30" for India,
 * "en-IN" gives "IST". The first one that knows a name for the viewer's zone wins.
 */
const ZONE_LOCALES = ["en-US", "en-GB", "en-IN", "en-AU", "en-NZ", "en-ZA", "en-SG", "en-CA", "en-IE"];
let zoneFormats: Intl.DateTimeFormat[] | null = null;
const shortZone = (f: Intl.DateTimeFormat, d: Date) => f.formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "";
/** Local zone abbreviation (D-133), e.g. "IST", "CEST", "EDT"; the offset ("GMT+9") where no locale has a name. */
function zone(d: Date) {
  zoneFormats ??= ZONE_LOCALES.map((l) => new Intl.DateTimeFormat(l, { timeZoneName: "short" }));
  const names = zoneFormats.map((f) => shortZone(f, d));
  return names.find((n) => n && !/^(GMT|UTC)[+\-−]/.test(n)) ?? names[0];
}

/** Local day heading: "Today", "Yesterday", or e.g. "Sat 14 Nov 2026". */
function dayLabel(ms: number, now: number) {
  const k = localDate(new Date(ms));
  if (k === localDate(new Date(now))) return "Today";
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (k === localDate(y)) return "Yesterday";
  return new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())} ${zone(d)}`;
/** "14:32 GMT+5:30" */
const timeOfDay = (ms: number) => localTime(new Date(ms));
/** "2026-11-15 14:32 GMT+5:30" */
const localDateTime = (ms: number) => `${localDate(new Date(ms))} ${localTime(new Date(ms))}`;

/** A UTC time that may wrap between date and time, never inside either: "2026-12-01 | 06:00 UTC". */
function UtcTime({ iso }: { iso: string }) {
  const [date, time] = fmtUTC(Date.parse(iso)).split(" ");
  return (
    <span className="num font-mono">
      <span className="whitespace-nowrap">{date}</span> <span className="whitespace-nowrap">{time} UTC</span>
    </span>
  );
}

/** Column widths: star, type, scenario(s) (the rest), done on. Phones show the type as an icon only. */
const COLS = ["w-11", "w-12 sm:w-40", "", "w-28 sm:w-56"];

/**
 * `starredElsewhere`: these scenarios are starred, but via a newer row. Only the newest row of a starred set
 * shows the filled star (D-138); older ones show an empty star that explains instead of toggling.
 */
function HistoryRow({ entry, starred, starredElsewhere = false, opened }: { entry: HistoryEntry; starred: boolean; starredElsewhere?: boolean; opened: string }) {
  const toggleStar = useHistory((s) => s.toggleStar);
  const { scenarios } = entry;
  const single = scenarios.length === 1;
  const Icon = single ? MapPin : Columns;
  const type = single ? "Single site" : "Comparison";
  const cell = "border-t border-line py-3 align-top";
  return (
    // The scenario link stretches over the whole row (after:inset-0), so any cell opens it; the star sits above it.
    <tr className="group relative transition-colors hover:bg-panel">
      <td className={`${cell} pr-1`}>
        <button
          type="button"
          onClick={() => !starredElsewhere && toggleStar(scenarios, Date.now())}
          aria-pressed={starred}
          aria-disabled={starredElsewhere || undefined}
          aria-label={starred ? "Remove star" : starredElsewhere ? "Already starred from a newer visit" : "Star"}
          title={starred ? "Remove star" : starredElsewhere ? "Already starred: the newer visit above holds the star" : "Star: keep this at the top"}
          className={`relative z-10 -my-1 -ml-1.5 rounded-sm p-1.5 transition-colors ${starredElsewhere ? "cursor-default text-faint/60" : `cursor-pointer hover:bg-panel-2 ${starred ? "text-warning" : "text-faint hover:text-fg"}`}`}
        >
          <Star size={20} weight={starred ? "fill" : "regular"} className="block" />
        </button>
      </td>
      <td className={`${cell} pr-3 text-sm text-muted`}>
        <span className="flex items-start gap-2">
          <Icon size={20} className="shrink-0 text-faint" aria-hidden />
          <span className="sr-only sm:not-sr-only">{type}</span>
        </span>
      </td>
      <td className={`${cell} min-w-0 pr-3`}>
        <Link href={historyHref(scenarios)} className="block min-w-0 rounded-sm outline-offset-4 after:absolute after:inset-0 after:content-['']">
          {single ? (
            <>
              <span className="block truncate font-medium group-hover:underline group-hover:underline-offset-4">{siteName(scenarios[0].siteId)}</span>
              <span className="block text-sm text-muted">
                Landing <UtcTime iso={scenarios[0].t} />
              </span>
            </>
          ) : (
            <span className="grid gap-0.5">
              {scenarios.map((s, i) => (
                <span key={i} className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  <span className="w-4 shrink-0 text-sm font-medium text-faint">{SCENARIO_LETTERS[i]}</span>
                  <span className="truncate font-medium group-hover:underline group-hover:underline-offset-4">{siteName(s.siteId)}</span>
                  <span className="min-w-0 text-sm text-muted"><UtcTime iso={s.t} /></span>
                </span>
              ))}
            </span>
          )}
        </Link>
      </td>
      <td className={`${cell} num font-mono text-sm text-faint`}>
        {/^\d{4}-/.test(opened) ? (
          <>
            <span className="whitespace-nowrap">{opened.slice(0, 10)}</span> <span className="whitespace-nowrap">{opened.slice(11)}</span>
          </>
        ) : (
          <span className="whitespace-nowrap">{opened}</span>
        )}
      </td>
    </tr>
  );
}

/** A full-width row naming a part of the table ("Starred", "All history", a day). */
function GroupRow({ children, level }: { children: React.ReactNode; level: "section" | "day" }) {
  return (
    <tr>
      <th colSpan={4} scope="colgroup" className={`text-left ${level === "section" ? "pt-8 pb-2 text-lg font-semibold" : "pt-4 pb-1 text-sm font-medium text-faint"}`}>
        {children}
      </th>
    </tr>
  );
}

/**
 * History (D-131, D-136): one table with a sticky column header. Starred site details and comparisons
 * first (one per scenario set, latest opening), then every opening, newest first, grouped by local day (D-132).
 */
export function HistoryView() {
  const hydrated = useHistoryHydrated();
  const entries = useHistory((s) => s.entries);
  const starredList = useHistory((s) => s.starred);
  const clear = useHistory((s) => s.clear);
  const [confirming, setConfirming] = useState(false);
  const nowMinute = useNowMinute();

  if (!hydrated || nowMinute === null) return <p className="text-sm text-muted">Loading history…</p>;

  const now = nowMinute;
  const starredKeys = new Set(starredList.map((x) => scenarioKey(x.scenarios)));
  const starred = byRecent(starredList);
  const recent = collapseRevisits(byRecent(entries));
  // The newest row of each scenario set; only that row carries a starred set's filled star (D-138).
  const newestOfKey = new Map<string, string>();
  for (const e of recent) if (!newestOfKey.has(scenarioKey(e.scenarios))) newestOfKey.set(scenarioKey(e.scenarios), e.id);
  const groups: { label: string; items: HistoryEntry[] }[] = [];
  for (const e of recent) {
    const label = dayLabel(e.at, now);
    if (groups.at(-1)?.label === label) groups.at(-1)!.items.push(e);
    else groups.push({ label, items: [e] });
  }

  if (!starred.length && !recent.length) {
    return (
      <div className="border-t border-line pt-6 text-sm text-muted">
        <p>Nothing here yet. Site details and comparisons you open will be listed here.</p>
        <Link href="/" className="mt-3 inline-block font-medium text-fg underline underline-offset-4">Select a site</Link>
      </div>
    );
  }

  // Sticks just under the app header (h-16); the bottom rule is a shadow because borders don't travel with sticky cells.
  const head = "sticky top-16 z-20 bg-bg py-2.5 text-left text-sm font-medium text-faint shadow-[inset_0_-1px_0_var(--line)]";
  return (
    <table className="w-full table-fixed border-separate border-spacing-0">
      <colgroup>
        {COLS.map((w, i) => <col key={i} className={w} />)}
      </colgroup>
      <thead>
        <tr>
          <th scope="col" className={head}><span className="sr-only">Star</span></th>
          <th scope="col" className={head}>Type</th>
          <th scope="col" className={head}>Scenario(s)</th>
          <th scope="col" className={head}>Done on</th>
        </tr>
      </thead>
      {starred.length > 0 && (
        <tbody>
          <GroupRow level="section">Starred</GroupRow>
          {starred.map((e) => (
            <HistoryRow key={e.id} entry={e} starred opened={localDateTime(e.at)} />
          ))}
        </tbody>
      )}
      <tbody>
        <tr>
          <th colSpan={4} scope="colgroup" className="pt-8 pb-2 text-left">
            <span className="flex flex-wrap items-center gap-3">
              <span className="text-lg font-semibold">All history</span>
              {recent.length > 0 && (
                <span className="ml-auto flex flex-wrap items-center gap-3 text-sm font-normal">
                  {confirming ? (
                    <>
                      <span className="text-muted">Clear {recent.length} {recent.length === 1 ? "entry" : "entries"}? Starred stay.</span>
                      <button type="button" onClick={() => setConfirming(false)} className={btnLink}>Cancel</button>
                      <button type="button" onClick={() => { clear(); setConfirming(false); }} className={btnSecondary}>
                        <Trash size={16} aria-hidden /> Clear
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirming(true)} className={btnLink}>Clear history</button>
                  )}
                </span>
              )}
            </span>
          </th>
        </tr>
        {recent.length === 0 && (
          <tr><td colSpan={4} className="border-t border-line py-3 text-sm text-muted">History is empty. Starred items stay above.</td></tr>
        )}
      </tbody>
      {groups.map((g) => (
        <tbody key={g.label}>
          <GroupRow level="day">{g.label}</GroupRow>
          {g.items.map((e) => (
            <HistoryRow
              key={e.id}
              entry={e}
              starred={starredKeys.has(scenarioKey(e.scenarios)) && newestOfKey.get(scenarioKey(e.scenarios)) === e.id}
              starredElsewhere={starredKeys.has(scenarioKey(e.scenarios)) && newestOfKey.get(scenarioKey(e.scenarios)) !== e.id}
              opened={timeOfDay(e.at)}
            />
          ))}
        </tbody>
      ))}
    </table>
  );
}
