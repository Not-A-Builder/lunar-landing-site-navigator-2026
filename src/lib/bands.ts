/**
 * Rating bands (red / amber / green) for rated metrics. Every band set has a logical default from the
 * start; mission planners can override any of them (LOGS D-033). Two sets are linked to mission
 * assumptions by default (slope ↔ lander tolerance, darkness ↔ battery survival) until overridden.
 */
import type { Assumptions } from "./assumptions";
import type { RatingSpec } from "./metrics/types";

export type BandKey =
  | "sunPct" | "dtePct" | "jointPct" | "darkH" | "litH" | "blackoutH" | "slope" | "margin"
  | "soc" | "psrKm" | "sensPct" | "areaPct" | "sunElev" | "hazardPct" | "heritageKm";

export type BandOverride = { amber: number; green: number };
export type BandOverrides = Partial<Record<BandKey, BandOverride>>;

type BandDef = {
  label: string;
  better: "higher" | "lower";
  unit: string;
  /** default thresholds; for linked bands this is computed from assumptions */
  defaults: (a: Assumptions) => BandOverride;
  domain: (a: Assumptions, t: BandOverride) => { min: number; max: number };
  basis: (a: Assumptions) => string;
  linkedTo?: string;
};

const TOOL = "Planning default set by this tool, not a NASA requirement.";
const survivable = (a: Assumptions) => a.batteryWh / a.survivalLoadW;

export const BAND_DEFS: Record<BandKey, BandDef> = {
  sunPct: { label: "Sunlit share of the mission", better: "higher", unit: "%", defaults: () => ({ amber: 40, green: 70 }), domain: () => ({ min: 0, max: 100 }), basis: () => `A solar-powered surface mission needs sunlight most of the time; under 40% usually forces large batteries. ${TOOL}` },
  dtePct: { label: "Earth-in-view / DSN share", better: "higher", unit: "%", defaults: () => ({ amber: 30, green: 60 }), domain: () => ({ min: 0, max: 100 }), basis: () => `Share of the mission with direct contact possible. ${TOOL}` },
  jointPct: { label: "Sunlight + Earth together", better: "higher", unit: "%", defaults: () => ({ amber: 25, green: 50 }), domain: () => ({ min: 0, max: 100 }), basis: () => `Share of the mission with both power and contact (the challenge's core question). ${TOOL}` },
  darkH: {
    label: "Longest darkness", better: "lower", unit: " h", linkedTo: "battery capacity ÷ survival load",
    defaults: (a) => ({ amber: +survivable(a).toFixed(1), green: +(survivable(a) / 2).toFixed(1) }),
    domain: (_a, t) => ({ min: 0, max: Math.max(t.amber * 2, 1) }),
    basis: (a) => `Unfavourable beyond what your battery can survive on heaters (${survivable(a).toFixed(0)} h from your assumptions); favourable within half of it.`,
  },
  litH: { label: "Longest continuous sunlight", better: "higher", unit: " h", defaults: () => ({ amber: 78, green: 156 }), domain: (a) => ({ min: 0, max: Math.max(a.missionDays * 24, 157) }), basis: () => "NASA chose its south-pole candidate regions for continuous sunlight over a 6.5-day (156 h) surface stay, so 156 h or more is favourable; under half of that is unfavourable." },
  blackoutH: { label: "Longest stretch without contact", better: "lower", unit: " h", defaults: () => ({ amber: 72, green: 24 }), domain: (a) => ({ min: 0, max: Math.max(a.missionDays * 24, 73) }), basis: () => `A day without Earth contact is manageable for an autonomous lander; three days is a long blackout. ${TOOL}` },
  slope: {
    label: "Slope", better: "lower", unit: "°", linkedTo: "lander slope tolerance",
    defaults: (a) => ({ amber: a.slopeToleranceDeg, green: a.slopeToleranceDeg / 2 }),
    domain: (a) => ({ min: 0, max: Math.max(30, a.slopeToleranceDeg * 2) }),
    basis: (a) => `Unfavourable above your lander's slope tolerance (${a.slopeToleranceDeg}°); favourable within half of it.`,
  },
  margin: { label: "Earth clearance above terrain", better: "higher", unit: "°", defaults: () => ({ amber: 0, green: 3 }), domain: () => ({ min: -10, max: 15 }), basis: () => `Below 0° Earth is hidden; a few degrees of margin keeps the link clear of the terrain edge. ${TOOL}` },
  soc: { label: "Lowest battery charge", better: "higher", unit: "%", defaults: () => ({ amber: 1, green: 30 }), domain: () => ({ min: 0, max: 100 }), basis: () => `Reaching 0% means the battery runs out; 30% keeps a reserve. ${TOOL}` },
  psrKm: { label: "Distance to nearest permanently shadowed region", better: "lower", unit: " km", defaults: () => ({ amber: 15, green: 5 }), domain: () => ({ min: 0, max: 30 }), basis: () => "NASA aims to land close enough to a permanently shadowed region for a moonwalk; thresholds set by this tool." },
  sensPct: { label: "Sensitivity of sunlit hours", better: "lower", unit: "%", defaults: () => ({ amber: 30, green: 10 }), domain: () => ({ min: 0, max: 100 }), basis: () => `How much sunlit time changes for a one-day or one-kilometre shift; lower means a more forgiving choice. ${TOOL}` },
  areaPct: { label: "Share of surrounding area meeting criteria", better: "higher", unit: "%", defaults: () => ({ amber: 40, green: 70 }), domain: () => ({ min: 0, max: 100 }), basis: () => `More qualifying ground means more room for landing error and moving around. ${TOOL}` },
  sunElev: { label: "Sun elevation at landing", better: "higher", unit: "°", defaults: () => ({ amber: 0, green: 3 }), domain: () => ({ min: -5, max: 10 }), basis: () => `Below 0° the Sun is under the flat horizon; near the pole it rarely climbs more than a few degrees. ${TOOL}` },
  hazardPct: { label: "Area too steep for the lander", better: "lower", unit: "%", defaults: () => ({ amber: 60, green: 30 }), domain: () => ({ min: 0, max: 100 }), basis: () => `Share of the surrounding area steeper than your lander's tolerance. ${TOOL}` },
  heritageKm: { label: "Distance to nearest historic artifact", better: "higher", unit: " km", defaults: () => ({ amber: 2, green: 10 }), domain: () => ({ min: 0, max: 50 }), basis: () => "Unfavourable inside the 2 km touchdown-targeting distance in NASA's 2011 lunar heritage recommendations; favourable beyond 10 km (tool default)." },
};

export const BAND_KEYS = Object.keys(BAND_DEFS) as BandKey[];

export function bandIsValid(better: "higher" | "lower", t: BandOverride) {
  return Number.isFinite(t.amber) && Number.isFinite(t.green) && (better === "higher" ? t.green >= t.amber : t.green <= t.amber);
}

/** Resolve every band set to a RatingSpec, applying any valid override. */
export function resolveBands(a: Assumptions, overrides: BandOverrides = {}): Record<BandKey, RatingSpec> {
  const out = {} as Record<BandKey, RatingSpec>;
  for (const k of BAND_KEYS) {
    const d = BAND_DEFS[k];
    const def = d.defaults(a);
    const o = overrides[k];
    const t = o && bandIsValid(d.better, o) ? o : def;
    const dom = d.domain(a, t);
    const fmt = (v: number) => `${+v.toFixed(2)}${d.unit}`;
    out[k] = {
      better: d.better, amber: t.amber, green: t.green,
      min: Math.min(dom.min, t.amber, t.green), max: Math.max(dom.max, t.amber, t.green), unit: d.unit,
      basis: t === def ? d.basis(a) : `Edited by you: conditional from ${fmt(t.amber)}, favourable from ${fmt(t.green)} (default ${fmt(def.amber)} / ${fmt(def.green)}: ${d.basis(a)})`,
    };
  }
  return out;
}
