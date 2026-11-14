import type { SourceId } from "@/lib/sources";

/**
 * How a value was obtained. The UI shows this as a badge so nobody mistakes an example
 * assumption for a measurement.
 *  computed      site- and date-specific, from NASA data (ephemeris, LOLA terrain, ...)
 *  modelled      computed from NASA data plus your mission assumptions (power, link, ...)
 *  reference     global lunar value from cited literature, not specific to this site
 *  assumption    an input you set (planner panel)
 *  unavailable   no public dataset or model supports it yet; the reason is given
 */
export type ValueStatus = "computed" | "modelled" | "reference" | "assumption" | "unavailable";

export type Rag = "green" | "amber" | "red";

export type Band = { rag: Rag; from: number; to: number; label: string };

export type Rating = {
  rag: Rag;
  /** 0–10 position across the bands (used for comparison scores only) */
  score: number;
  bands: Band[];
  /** why these thresholds (shown in the band tooltip) */
  basis: string;
};

export type MetricValue = {
  id: string;
  status: ValueStatus;
  /** machine value for comparisons (numbers in the display unit) */
  value?: number | null;
  /** formatted value */
  display: string;
  /** extra detail for planners (timestamps, intervals, assumptions used) */
  detail?: string;
  sources: SourceId[];
  note?: string;
  rating?: Rating;
  /** for "unavailable": what would be needed */
  reason?: string;
};

export type RatingSpec = {
  better: "higher" | "lower";
  /** value where amber starts (moving from bad to good) */
  amber: number;
  /** value where green starts */
  green: number;
  /** domain ends for drawing the band strip */
  min: number;
  max: number;
  basis: string;
  unit?: string;
};

/** Place a value in red/amber/green bands and a 0–10 score (piecewise linear across bands). */
export function rate(value: number, s: RatingSpec): Rating {
  const lo = s.min, hi = s.max;
  const higher = s.better === "higher";
  const bands: Band[] = higher
    ? [
        { rag: "red", from: lo, to: s.amber, label: `below ${s.amber}${s.unit ?? ""}` },
        { rag: "amber", from: s.amber, to: s.green, label: `${s.amber}–${s.green}${s.unit ?? ""}` },
        { rag: "green", from: s.green, to: hi, label: `${s.green}${s.unit ?? ""} or more` },
      ]
    : [
        { rag: "green", from: lo, to: s.green, label: `${s.green}${s.unit ?? ""} or less` },
        { rag: "amber", from: s.green, to: s.amber, label: `${s.green}–${s.amber}${s.unit ?? ""}` },
        { rag: "red", from: s.amber, to: hi, label: `above ${s.amber}${s.unit ?? ""}` },
      ];
  const v = Math.max(lo, Math.min(hi, value));
  const seg = (a: number, b: number, x: number) => (b === a ? 1 : (x - a) / (b - a));
  let score: number;
  if (higher) {
    if (v < s.amber) score = (10 / 3) * seg(lo, s.amber, v);
    else if (v < s.green) score = 10 / 3 + (10 / 3) * seg(s.amber, s.green, v);
    else score = 20 / 3 + (10 / 3) * seg(s.green, hi, v);
  } else {
    if (v <= s.green) score = 10 - (10 / 3) * seg(lo, s.green, v);
    else if (v <= s.amber) score = 20 / 3 - (10 / 3) * seg(s.green, s.amber, v);
    else score = 10 / 3 - (10 / 3) * seg(s.amber, hi, v);
  }
  const rag: Rag = score >= 20 / 3 ? "green" : score >= 10 / 3 ? "amber" : "red";
  return { rag, score: Math.max(0, Math.min(10, score)), bands, basis: s.basis };
}

/** Roll up member ratings into a category status (enthusiast view) and a 1–10 score (comparison). */
export function rollUp(ratings: Rating[]): { rag: Rag; score: number; n: number } | null {
  if (!ratings.length) return null;
  const mean = ratings.reduce((a, r) => a + r.score, 0) / ratings.length;
  const reds = ratings.filter((r) => r.rag === "red").length;
  // Any red in a category shows amber at worst-case-aware rollup; mostly red shows red.
  const rag: Rag = reds > ratings.length / 2 ? "red" : mean >= 20 / 3 && reds === 0 ? "green" : mean >= 10 / 3 ? "amber" : "red";
  return { rag, score: Math.max(1, Math.min(10, Math.round(1 + (mean / 10) * 9))), n: ratings.length };
}
