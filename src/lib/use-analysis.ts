"use client";

import { useEffect, useState } from "react";
import type { Assumptions } from "@/lib/assumptions";
import { resolveBands, type BandOverrides } from "@/lib/bands";
import { ensureEphemeris, loadPeers, loadTerrain } from "@/lib/data-client";
import { gridStats, landingDatePercentiles, multiYear, sensitivity, type GridStats, type MultiYear } from "@/lib/engine/analysis";
import { buildScenario, DAY_MS, type Scenario } from "@/lib/engine/scenario";
import type { TerrainFile } from "@/lib/engine/terrain-file";
import { computeAllMetrics, type Percentiles, type PeerSummary, type RefValue, type Sensitivity } from "@/lib/metrics/compute";
import type { MetricValue } from "@/lib/metrics/types";
import refsJson from "@/data/references.json";
import { isPolar, sites, type Site } from "@/lib/sites";

export const REFS: Record<string, RefValue> = Object.fromEntries((refsJson.values as RefValue[]).map((r) => [r.key, r]));

export const MULTI_FROM = Date.UTC(2026, 0, 1);
export const MULTI_TO = Date.UTC(2030, 0, 1);

export type SiteKey = { siteId: string } | { lat: number; lon: number };

export type Analysis = {
  stage: "loading" | "base" | "full" | "error";
  error?: string;
  terrain?: TerrainFile;
  scenario?: Scenario;
  metrics?: Record<string, MetricValue>;
  multi?: MultiYear | null;
  grid?: GridStats | null;
  sens?: Sensitivity | null;
  pct?: Percentiles | null;
};

const yieldToBrowser = () => new Promise((r) => setTimeout(r, 0));

const ALL_LITE = sites
  .filter((s) => s.lat !== null && s.lon !== null)
  .map((s) => ({ id: s.id, name: s.name, lat: s.lat!, lon: s.lon!, group: s.group, status: s.status, date: s.date, mission: s.mission, notes: s.notes }));

/** Run the full analysis for one site/time/assumptions; staged so the page paints early. */
export function useAnalysis(key: SiteKey | null, site: Site | null, landingMs: number | null, a: Assumptions, bandOverrides: BandOverrides = {}, opts: { heavy?: boolean } = {}): Analysis {
  const [state, setState] = useState<Analysis>({ stage: "loading" });
  const keyStr = key ? JSON.stringify(key) : "";
  const aStr = JSON.stringify(a) + JSON.stringify(bandOverrides);
  const heavy = opts.heavy !== false;

  useEffect(() => {
    if (!key || landingMs === null) return;
    let cancelled = false;
    (async () => {
      try {
        setState((s) => ({ ...s, stage: s.metrics ? s.stage : "loading", error: undefined }));
        const terrain = await loadTerrain(key);
        const end = landingMs + a.missionDays * DAY_MS;
        const eph = await ensureEphemeris(landingMs - DAY_MS, end + DAY_MS);
        if (cancelled) return;
        const scenario = buildScenario({ eph, terrain, landingMs, assumptions: a });
        const meta = { id: site?.id ?? "custom", name: site?.name ?? "Custom site", polar: isPolar(terrain.site.lat), group: site?.group };
        const peersIdx = await loadPeers();
        const peers: PeerSummary[] = peersIdx.sites;
        const base = (extra: Partial<Analysis>) =>
          computeAllMetrics({
            scenario, terrain, site: meta, peers, allSites: ALL_LITE, refs: REFS, bands: resolveBands(a, bandOverrides),
            multi: extra.multi ?? null, grid: extra.grid ?? null, sens: extra.sens ?? null, pct: extra.pct ?? null,
          });
        setState({ stage: heavy ? "base" : "full", terrain, scenario, metrics: base({}) });
        if (!heavy) return;

        await yieldToBrowser();
        await ensureEphemeris(MULTI_FROM, MULTI_TO - 1);
        await ensureEphemeris(landingMs, landingMs + 366 * DAY_MS + a.missionDays * DAY_MS);
        if (cancelled) return;
        const multi = multiYear(eph, terrain, scenario.mask, a, MULTI_FROM, MULTI_TO);
        await yieldToBrowser();
        if (cancelled) return;
        const sens = sensitivity(eph, terrain, a, landingMs, scenario);
        await yieldToBrowser();
        if (cancelled) return;
        const pctRaw = landingDatePercentiles(eph, terrain, scenario.mask, a, landingMs);
        const pct: Percentiles = { sun: pctRaw.sun, earth: pctRaw.earth, bestDay: pctRaw.bestDay };
        await yieldToBrowser();
        if (cancelled) return;
        const grid = gridStats(eph, terrain, a, landingMs, scenario.mask);
        if (cancelled) return;
        setState({ stage: "full", terrain, scenario, multi, sens, pct, grid, metrics: base({ multi, sens, pct, grid }) });
      } catch (e) {
        if (!cancelled) setState({ stage: "error", error: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyStr, landingMs, aStr, heavy]);

  return state;
}
