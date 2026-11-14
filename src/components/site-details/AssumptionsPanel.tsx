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
    <section id="assumptions" className="rounded-lg border border-line bg-panel p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">Mission assumptions</h2>
        <button onClick={reset} className="text-xs text-muted underline">Reset to examples</button>
      </div>
      <p className="mb-3 text-xs text-muted">
        These are inputs, not data. Defaults describe an example small solar-powered lander; set your own and every
        metric marked “Modelled” or “Your input” updates.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {GROUPS.map((g) => (
          <fieldset key={g.title} className="space-y-2">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-faint">{g.title}</legend>
            {g.keys.map((k) => {
              const meta = ASSUMPTION_META[k];
              const v = a[k];
              return (
                <label key={k} className="block text-xs" title={meta.why}>
                  <span className="text-muted">{meta.label}{meta.unit ? ` (${meta.unit})` : ""}</span>
                  {k === "panelTracking" ? (
                    <select value={v as string} onChange={(e) => set(k, e.target.value as Assumptions["panelTracking"])} className="mt-0.5 w-full rounded border border-line bg-bg px-2 py-1">
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
                      className="mt-0.5 w-full rounded border border-line bg-bg px-2 py-1 font-mono"
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
