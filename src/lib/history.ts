"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { customScenarioId, parseScenarios, serialiseScenarios, type Scenario } from "@/lib/scenarios";

/**
 * History (D-131): every site details page and comparison opened in this browser, newest first, plus a
 * starred list. History keeps duplicates (each opening is its own entry); starred keeps one entry per
 * scenario set, refreshed to the latest opening. Stored per browser (localStorage), like the persona.
 */

/** One opening of a site details page (1 scenario) or a comparison (2+ scenarios). */
export type HistoryEntry = { id: string; scenarios: Scenario[]; at: number };

/** History is capped so localStorage stays small; starred entries are never dropped. */
export const MAX_HISTORY = 300;

/** Identity of a scenario set: same sites at the same landing times, in the same order. */
export const scenarioKey = (scenarios: Scenario[]) => serialiseScenarios(scenarios);

/** Revisits of the same scenarios within this long after the previous opening are one entry (D-138). */
export const REVISIT_MERGE_MS = 30 * 60_000;

/** `later` reopens the same scenarios as `earlier`, at most REVISIT_MERGE_MS after it. */
const isQuickRevisit = (earlier: Pick<HistoryEntry, "scenarios" | "at">, later: Pick<HistoryEntry, "scenarios" | "at">) =>
  scenarioKey(earlier.scenarios) === scenarioKey(later.scenarios) && later.at - earlier.at <= REVISIT_MERGE_MS;

/**
 * Newest-first list with consecutive quick revisits merged into the newest of each run (D-138). The gap is
 * measured between neighbouring openings, so a chain of revisits each within 30 min stays one entry.
 */
export function collapseRevisits(newestFirst: HistoryEntry[]): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  let prev: HistoryEntry | null = null;
  for (const e of newestFirst) {
    if (!(prev && isQuickRevisit(e, prev))) out.push(e);
    prev = e;
  }
  return out;
}

/** Where an entry opens: the site details page for one scenario, the comparison for several. */
export function historyHref(scenarios: Scenario[]): string {
  if (scenarios.length >= 2) return `/compare?s=${serialiseScenarios(scenarios)}`;
  const { siteId, t } = scenarios[0];
  const tq = t ? `t=${encodeURIComponent(t)}` : "";
  if (siteId.startsWith("custom:")) {
    const [lat, lon] = siteId.slice(7).split(",");
    return `/site/custom?lat=${lat}&lon=${lon}${tq ? `&${tq}` : ""}`;
  }
  return `/site/${encodeURIComponent(siteId)}${tq ? `?${tq}` : ""}`;
}

/** Same ISO form the site details page writes into `t` (no milliseconds). */
const iso = (ms: number) => new Date(ms).toISOString().replace(".000Z", "Z");

/**
 * The scenarios a URL shows, or null when it is not a recordable view. A site details URL without `t`
 * shows the current UTC hour, so that hour is recorded (`nowMs`) to reopen what was actually seen.
 */
export function scenariosAt(pathname: string, params: URLSearchParams, nowMs: number): Scenario[] | null {
  if (pathname === "/compare") {
    const list = parseScenarios(params.get("s"));
    return list.length >= 2 && list.every((s) => s.t) ? list : null;
  }
  const m = /^\/site\/([^/]+)$/.exec(pathname);
  if (!m) return null;
  const tParam = params.get("t");
  const tMs = tParam ? Date.parse(tParam) : NaN;
  const hour = new Date(nowMs);
  hour.setUTCMinutes(0, 0, 0);
  const t = Number.isFinite(tMs) ? tParam! : iso(hour.getTime());
  const id = decodeURIComponent(m[1]);
  if (id !== "custom") return [{ siteId: id, t }];
  const lat = Number(params.get("lat")), lon = Number(params.get("lon"));
  if (params.get("lat") === null || params.get("lon") === null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return [{ siteId: customScenarioId(lat, lon), t }];
}

type HistoryState = {
  entries: HistoryEntry[];
  /** Starred scenario sets, each holding its latest opening. */
  starred: HistoryEntry[];
  /**
   * Records an opening. Calls with the same `visit` (one stay on a page) update that entry instead of
   * adding one, so moving the landing time or removing a scenario doesn't flood the list.
   */
  record: (scenarios: Scenario[], visit: string, at: number) => void;
  toggleStar: (scenarios: Scenario[], at: number) => void;
  /** Clears history; starred entries stay. */
  clear: () => void;
};

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useHistory = create<HistoryState>()(
  persist(
    (set) => ({
      entries: [],
      starred: [],
      record: (scenarios, visit, at) =>
        set((s) => {
          const key = scenarioKey(scenarios);
          const head = s.entries[0];
          // Same visit, or a quick revisit of the same scenarios (D-138): the newest entry takes this opening.
          const replaceHead = head && (head.id === visit || isQuickRevisit(head, { scenarios, at }));
          const entries = replaceHead
            ? [{ id: visit, scenarios, at }, ...s.entries.slice(1)]
            : [{ id: visit, scenarios, at }, ...s.entries].slice(0, MAX_HISTORY);
          // A starred set reopened moves to the top of the starred list with its latest opening time.
          const starred = s.starred.some((x) => scenarioKey(x.scenarios) === key)
            ? s.starred.map((x) => (scenarioKey(x.scenarios) === key ? { ...x, at } : x))
            : s.starred;
          return { entries, starred };
        }),
      toggleStar: (scenarios, at) =>
        set((s) => {
          const key = scenarioKey(scenarios);
          if (s.starred.some((x) => scenarioKey(x.scenarios) === key)) {
            return { starred: s.starred.filter((x) => scenarioKey(x.scenarios) !== key) };
          }
          // Starring takes the latest opening of this set from history (or now, if it has none).
          const last = s.entries.find((e) => scenarioKey(e.scenarios) === key);
          return { starred: [{ id: newId(), scenarios, at: last?.at ?? at }, ...s.starred] };
        }),
      clear: () => set({ entries: [] }),
    }),
    // skipHydration: server renders an empty list; <PersonaHydrator/> rehydrates on the client.
    { name: "llsn-history", version: 1, skipHydration: true, partialize: (s) => ({ entries: s.entries, starred: s.starred }) },
  ),
);

export const newVisitId = newId;

/** Newest first. */
export const byRecent = (list: HistoryEntry[]) => [...list].sort((a, b) => b.at - a.at);
