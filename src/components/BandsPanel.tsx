"use client";

import { useState } from "react";
import { BandStrip } from "@/components/RagBadge";
import { useAssumptions } from "@/lib/assumptions-store";
import { BAND_DEFS, BAND_KEYS, bandIsValid, resolveBands, type BandKey } from "@/lib/bands";
import { rate } from "@/lib/metrics/types";

/**
 * Planner-only editor for rating bands. Each row starts at its logical default; edits apply as soon as
 * they are valid (green must be on the better side of amber) and persist in this browser.
 */
export function BandsPanel() {
  const { a, bands, setBand, resetBand, resetBands } = useAssumptions();
  const resolved = resolveBands(a, bands);
  return (
    <section id="bands" className="border-t border-line pt-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Rating bands</h2>
        <button onClick={resetBands} className="text-sm text-muted underline hover:text-fg">Reset all to defaults</button>
      </div>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        These thresholds decide red / amber / green for every rated metric and the 1–10 scores on Compare. Each one starts at a default with a stated reason. Change any of them for your mission; linked bands follow your assumptions until you edit them.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-180 text-sm">
          <thead>
            <tr className="text-left text-xs text-faint">
              <th className="py-1.5 font-normal">Band set</th>
              <th className="font-normal">Better</th>
              <th className="font-normal">Amber starts at</th>
              <th className="font-normal">Green starts at</th>
              <th className="font-normal">Preview</th>
              <th className="font-normal" />
            </tr>
          </thead>
          <tbody>
            {BAND_KEYS.map((k) => (
              <BandRow key={k} k={k} edited={!!bands[k]} spec={resolved[k]} defaults={BAND_DEFS[k].defaults(a)} onSet={(v) => setBand(k, v)} onReset={() => resetBand(k)} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BandRow({ k, edited, spec, defaults, onSet, onReset }: {
  k: BandKey; edited: boolean; spec: ReturnType<typeof resolveBands>[BandKey]; defaults: { amber: number; green: number };
  onSet: (v: { amber: number; green: number }) => void; onReset: () => void;
}) {
  const d = BAND_DEFS[k];
  const [draft, setDraft] = useState<{ amber: string; green: string } | null>(null);
  const shown = draft ?? { amber: String(+spec.amber.toFixed(2)), green: String(+spec.green.toFixed(2)) };
  const parsed = { amber: Number(shown.amber), green: Number(shown.green) };
  const valid = bandIsValid(d.better, parsed);
  const update = (field: "amber" | "green", v: string) => {
    const next = { ...shown, [field]: v };
    setDraft(next);
    const n = { amber: Number(next.amber), green: Number(next.green) };
    if (bandIsValid(d.better, n)) onSet(n);
  };
  const mid = (spec.amber + spec.green) / 2;
  return (
    <tr className="border-t border-line align-top">
      <td className="py-2 pr-2">
        <div className="text-fg">{d.label}</div>
        <div className="text-xs text-faint" title={spec.basis}>{edited ? "Edited" : "Default"}{d.linkedTo && !edited ? ` · linked to ${d.linkedTo}` : ""}</div>
      </td>
      <td className="py-2 pr-2 text-muted">{d.better === "higher" ? "Higher" : "Lower"}</td>
      {(["amber", "green"] as const).map((f) => (
        <td key={f} className="py-2 pr-2">
          <label className="flex items-center gap-1">
            <input
              type="number"
              aria-label={`${d.label}: ${f} threshold`}
              value={shown[f]}
              step="any"
              onChange={(e) => update(f, e.target.value)}
              onBlur={() => setDraft(null)}
              className={`h-10 w-20 rounded-sm border bg-panel px-1.5 font-mono ${valid ? "border-line" : "border-critical"}`}
            />
            <span className="text-xs text-faint">{d.unit.trim()}</span>
          </label>
          <div className="text-xs text-faint">default <span className="num">{+defaults[f].toFixed(2)}</span></div>
        </td>
      ))}
      <td className="py-2 pr-2">
        <BandStrip rating={rate(mid, spec)} value={mid} />
        {!valid && <div className="mt-1 text-xs text-critical">Green must be {d.better === "higher" ? "at or above" : "at or below"} amber; not applied.</div>}
      </td>
      <td className="py-2">{edited && <button onClick={() => { setDraft(null); onReset(); }} className="text-xs text-muted underline hover:text-fg">Reset</button>}</td>
    </tr>
  );
}
