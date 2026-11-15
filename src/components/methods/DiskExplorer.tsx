"use client";

import { CheckCircle, MinusCircle } from "@phosphor-icons/react";
import { useId, useMemo, useState } from "react";
import { InfoTip } from "@/components/InfoTip";
import { DEFAULT_ASSUMPTIONS } from "@/lib/assumptions";
import { CONST } from "@/lib/engine/constants";
import { angularRadius, AU_KM, diskAboveHorizon } from "@/lib/engine/geometry";
import { useWidth } from "./use-width";

const R_DEG = angularRadius(CONST.sunRadiusKm, AU_KM);
const SPAN = 0.4; // degrees either side of the horizon shown on the slider
const THRESH = DEFAULT_ASSUMPTIONS.sunDiskThreshold;

/**
 * Sun-disk demo (D-139): drag the Sun's centre across a flat horizon and read the visible share from the
 * same function the engine uses (geometry.ts diskAboveHorizon, the f(t) of Liu et al. 2023). The Sun's
 * size is its angular radius at 1 AU from the NSSDCA solar radius.
 */
export function DiskExplorer() {
  const [o, setO] = useState(0.08);
  const f = diskAboveHorizon(o, R_DEG, 0);
  const lit = f >= THRESH;
  const clip = useId();
  const [plot, W] = useWidth<HTMLDivElement>(420);

  // left: the disk, 1° = K px
  const S = 260, K = 300, cy = S / 2;
  // right: f against centre offset
  const CH = 220, P = { l: 48, r: 12, t: 12, b: 40 };
  const cx = (v: number) => P.l + ((v + SPAN) / (2 * SPAN)) * (W - P.l - P.r);
  const cyy = (v: number) => P.t + (1 - v) * (CH - P.t - P.b);
  const curve = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 160; i++) {
      const v = -SPAN + (i / 160) * 2 * SPAN;
      pts.push(`${i ? "L" : "M"}${cx(v).toFixed(1)},${cyy(diskAboveHorizon(v, R_DEG, 0)).toFixed(1)}`);
    }
    return pts.join("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W]);

  return (
    <div className="reveal rounded-sm border border-line bg-panel p-5 md:p-6">
      <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[260px_minmax(0,1fr)]">
        <svg width={S} height={S} className="mx-auto block" role="img" aria-label={`Sun's disk ${(f * 100).toFixed(1)}% above the horizon`}>
          <defs>
            <clipPath id={clip}><rect x={0} y={0} width={S} height={cy} /></clipPath>
          </defs>
          {/* hidden part of the disk, behind terrain */}
          <circle cx={S / 2} cy={cy - o * K} r={R_DEG * K} className="fill-none stroke-faint" strokeDasharray="4 4" />
          <rect x={0} y={cy} width={S} height={S - cy} className="fill-terrain" fillOpacity={0.55} />
          <circle cx={S / 2} cy={cy - o * K} r={R_DEG * K} className="fill-sun" clipPath={`url(#${clip})`} />
          <line x1={0} x2={S} y1={cy} y2={cy} className="stroke-fg" strokeWidth={1.5} />
          <text x={8} y={cy + 22} className="fill-fg text-xs">Terrain horizon</text>
        </svg>

        <div className="min-w-0">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-faint">Sun&apos;s centre above the horizon</span>
            <input type="range" min={-SPAN} max={SPAN} step={0.002} value={o} onChange={(e) => setO(+e.target.value)} className="mt-2 w-full accent-(--sun)" />
          </label>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Out label="Centre vs horizon" value={`${o >= 0 ? "+" : "−"}${Math.abs(o).toFixed(3)}°`} tip="Set with the slider: how far the Sun's centre is above (+) or below (−) the terrain horizon in its direction." sources={["lola-pds", "jpl-horizons"]} />
            <Out label="Sun's radius" value={`${R_DEG.toFixed(3)}°`} tip={<>Angular radius of the Sun at 1 AU: asin(695,700 km ÷ 149,597,870.7 km). The real distance varies through the year, and the engine uses each hour&apos;s Horizons distance.</>} sources={["nssdc-sun", "jpl-horizons"]} />
            <Out label="Visible share" value={`${(f * 100).toFixed(1)}%`} tip="Area of the disk above the horizon line, as a share of the whole disk (circular segment)." sources={["liu-2023"]} />
            <div>
              <div className="flex items-center gap-1 text-xs text-faint">
                Sunlit?
                <InfoTip title="Sunlit threshold" sources={["mission-assumption", "liu-2023", "bryant-2009"]}>
                  A moment counts as sunlit when at least {THRESH * 100}% of the disk is visible (default). Mission planners can change this.
                </InfoTip>
              </div>
              <div className={`mt-0.5 flex items-center gap-1.5 text-lg ${lit ? "text-fg" : "text-muted"}`}>
                {lit ? <CheckCircle size={18} weight="fill" className="text-good" aria-hidden /> : <MinusCircle size={18} className="text-faint" aria-hidden />}
                {lit ? "Yes" : "No"}
              </div>
            </div>
          </div>

          <div ref={plot} className="mt-5">
            <svg width={W} height={CH} className="block" role="img" aria-label="Visible share of the disk against the centre's height above the horizon">
              {[0, 0.5, 1].map((v) => (
                <g key={v}>
                  <line x1={P.l} x2={W - P.r} y1={cyy(v)} y2={cyy(v)} className={v === THRESH ? "stroke-muted" : "stroke-grid"} strokeDasharray={v === THRESH ? "4 4" : undefined} />
                  <text x={P.l - 8} y={cyy(v) + 5} textAnchor="end" className="num fill-faint text-xs">{v * 100}%</text>
                </g>
              ))}
              {[-SPAN, -R_DEG, 0, R_DEG, SPAN].map((v) => (
                <g key={v}>
                  <line x1={cx(v)} x2={cx(v)} y1={P.t} y2={CH - P.b} className="stroke-grid" />
                  <text x={cx(v)} y={CH - P.b + 18} textAnchor={v === -SPAN ? "start" : v === SPAN ? "end" : "middle"} className="num fill-faint text-xs">{v > 0 ? "+" : v < 0 ? "−" : ""}{Math.abs(v).toFixed(2)}°</text>
                </g>
              ))}
              <text x={(P.l + W - P.r) / 2} y={CH - 4} textAnchor="middle" className="fill-faint text-xs">Centre above horizon</text>
              <text x={W - P.r} y={cyy(THRESH) - 6} textAnchor="end" className="fill-muted text-xs">Sunlit threshold</text>
              <path d={curve} className="fill-none stroke-sun" strokeWidth={2} />
              <circle cx={cx(o)} cy={cyy(f)} r={5} className="fill-sun stroke-panel" strokeWidth={2} />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function Out({ label, value, tip, sources }: { label: string; value: string; tip?: React.ReactNode; sources?: Parameters<typeof InfoTip>[0]["sources"] }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-faint">
        {label}
        {tip && <InfoTip title={label} sources={sources}>{tip}</InfoTip>}
      </div>
      <div className="num mt-0.5 text-lg text-fg">{value}</div>
    </div>
  );
}
