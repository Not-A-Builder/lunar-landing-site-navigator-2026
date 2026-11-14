"use client";

import { MOON_RADIUS_M } from "@/lib/moon";

const M_PER_FT = 0.3048;
const M_PER_MI = 1609.344;

/** Largest 1, 2 or 5 × 10ⁿ that is ≤ x. */
const niceFloor = (x: number) => {
  const p = 10 ** Math.floor(Math.log10(x));
  return [5, 2, 1].map((k) => k * p).find((v) => v <= x) ?? p;
};

/** Great-circle distance on the Moon (IAU mean radius, `MOON_RADIUS_M`) between two lat/lon points in degrees. */
export function moonDistanceM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * MOON_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Pick a round length that fits in `maxPx` for metric and imperial units. */
export function scaleLengths(metersPerPixel: number, maxPx = 110) {
  const maxM = maxPx * metersPerPixel;
  const m = niceFloor(maxM);
  const metric = m >= 1000 ? { label: `${m / 1000} km`, px: m / metersPerPixel } : { label: `${m} m`, px: m / metersPerPixel };
  const imperial =
    maxM >= M_PER_MI
      ? (() => { const mi = niceFloor(maxM / M_PER_MI); return { label: `${mi} mi`, px: (mi * M_PER_MI) / metersPerPixel }; })()
      : (() => { const ft = niceFloor(maxM / M_PER_FT); return { label: `${ft} ft`, px: (ft * M_PER_FT) / metersPerPixel }; })();
  return { metric, imperial };
}

/**
 * Ground scale like Google Maps: km on top, miles below, measured on the lunar sphere at the centre
 * of the view (distances shrink or grow away from it as the projection distorts).
 */
export function ScaleBar({ metersPerPixel, className = "" }: { metersPerPixel: number | null; className?: string }) {
  if (!metersPerPixel || !Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return null;
  const { metric, imperial } = scaleLengths(metersPerPixel);
  const w = Math.ceil(Math.max(metric.px, imperial.px)) + 1;
  return (
    <div
      className={`pointer-events-none rounded-sm bg-panel/85 px-1.5 py-0.5 text-fg backdrop-blur-sm ${className}`}
      title="Ground scale at the centre of the view"
      aria-label={`Scale: ${metric.label} or ${imperial.label}`}
    >
      <div className="num text-xs leading-4">{metric.label}</div>
      <svg width={w} height={9} className="block" aria-hidden>
        <path d={`M0.5 0 V9 M0.5 4.5 H${w - 0.5} M${metric.px} 0 V4.5 M${imperial.px} 4.5 V9`} stroke="currentColor" strokeWidth={1.5} fill="none" />
      </svg>
      <div className="num text-xs leading-4">{imperial.label}</div>
    </div>
  );
}
