"use client";

import { ASSUMPTION_META, type Assumptions } from "@/lib/assumptions";
import { useAssumptions } from "@/lib/assumptions-store";

const GROUPS: { title: string; keys: (keyof Assumptions)[] }[] = [
  { title: "Mission & thresholds", keys: ["missionDays", "mastHeightM", "sunDiskThreshold", "earthDiskThreshold", "dsnMinElevDeg"] },
  { title: "Power", keys: ["panelTracking", "panelFixedAzDeg", "panelAreaM2", "panelEfficiency", "batteryWh", "loadW", "survivalLoadW"] },
  { title: "Landing", keys: ["slopeToleranceDeg", "approachAzDeg", "footprintRadiusM", "landerMassKg", "footpadAreaM2", "minSunElevForOpticalNavDeg"] },
  { title: "Communications", keys: ["txPowerW", "landerAntennaGainDbi", "freqGHz", "groundGTdBK", "requiredEbN0dB", "linkMarginDb"] },
  { title: "Rover", keys: ["roverSpeedMPerH", "roverWhPerKm"] },
];

/** Planner-only: edit the mission assumptions. Every dependent metric recomputes immediately. */
export function AssumptionsPanel() {
  const { a, set, reset } = useAssumptions();
  return (
    <section id="assumptions" className="border-t border-line pt-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Mission assumptions</h2>
        <button onClick={reset} className="text-sm text-muted underline hover:text-fg">Reset to examples</button>
      </div>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        These are inputs, not data. Defaults describe an example small solar-powered lander; set your own and every
        metric marked “Modelled” or “Your input” updates.
      </p>
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
        {GROUPS.map((g) => (
          <fieldset key={g.title} className="space-y-2.5">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">{g.title}</legend>
            {g.keys.map((k) => {
              const meta = ASSUMPTION_META[k];
              const v = a[k];
              return (
                <label key={k} className="block text-sm" title={meta.why}>
                  <span className="text-muted">{meta.label}{meta.unit ? ` (${meta.unit})` : ""}</span>
                  {k === "panelTracking" ? (
                    <select value={v as string} onChange={(e) => set(k, e.target.value as Assumptions["panelTracking"])} className="mt-1 w-full rounded-sm border border-line bg-panel px-2 py-1">
                      <option value="vertical-tracking">Vertical, rotating to face the Sun</option>
                      <option value="vertical-fixed">Vertical, fixed direction</option>
                      <option value="horizontal">Horizontal</option>
                    </select>
                  ) : (
                    <input
                      type="number"
                      value={v as number}
                      min={meta.min}
                      max={meta.max}
                      step={meta.step}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n)) set(k, n as never);
                      }}
                      className="mt-1 w-full rounded-sm border border-line bg-panel px-2 py-1 font-mono"
                    />
                  )}
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
    </section>
  );
}
