"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorFooter, Modal } from "@/components/Modal";
import { ASSUMPTION_META, DEFAULT_ASSUMPTIONS, type Assumptions } from "@/lib/assumptions";
import { useAssumptions } from "@/lib/assumptions-store";
import type { Persona } from "@/lib/persona";
import { useEditor } from "./editor-store";

type Key = keyof Assumptions;

const GROUPS: { title: string; hint: string; keys: Key[] }[] = [
  { title: "Mission & visibility", hint: "How long, from what height, and what counts as sunlit or in view.", keys: ["missionDays", "mastHeightM", "sunDiskThreshold", "earthDiskThreshold", "dsnMinElevDeg"] },
  { title: "Power", hint: "Solar array, battery and loads used by the power model.", keys: ["panelTracking", "panelFixedAzDeg", "panelAreaM2", "panelEfficiency", "batteryWh", "loadW", "survivalLoadW"] },
  { title: "Landing", hint: "Vehicle limits that rate slopes, glare and footing.", keys: ["slopeToleranceDeg", "approachAzDeg", "footprintRadiusM", "landerMassKg", "footpadAreaM2", "minSunElevForOpticalNavDeg"] },
  { title: "Communications", hint: "Direct-to-Earth link budget.", keys: ["txPowerW", "landerAntennaGainDbi", "freqGHz", "groundGTdBK", "requiredEbN0dB", "linkMarginDb"] },
  { title: "Rover", hint: "Used for drive time and energy to nearby targets.", keys: ["roverSpeedMPerH", "roverWhPerKm"] },
];

const TRACKING: { v: Assumptions["panelTracking"]; label: string }[] = [
  { v: "vertical-tracking", label: "Vertical, rotating to face the Sun" },
  { v: "vertical-fixed", label: "Vertical, fixed direction" },
  { v: "horizontal", label: "Horizontal (flat)" },
];

const show = (v: number) => (+v.toFixed(4)).toLocaleString("en-US", { maximumFractionDigits: 4 });
/** unit after a default value: "10°", "2 m", plain number for 0–1 fractions */
const unitText = (u: string) => (u === "deg" ? "°" : u === "0–1" || !u ? "" : ` ${u}`);

/** Mission assumptions editor (D-083). Edits stay in a draft until "Save changes". */
export function AssumptionsModal({ persona }: { persona: Persona }) {
  const target = useEditor((s) => s.target);
  const close = useEditor((s) => s.close);
  const open = target?.kind === "assumptions";
  return open ? <Editor focus={target.focus as Key | undefined} onClose={close} persona={persona} /> : null;
}

function Editor({ focus, onClose, persona }: { focus?: Key; onClose: () => void; persona: Persona }) {
  const saved = useAssumptions((s) => s.a);
  const setAll = useAssumptions((s) => s.setAll);
  const [draft, setDraft] = useState<Record<Key, string>>(() => toDraft(saved));
  const bodyRef = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState<Key | null>(focus ?? null);

  const errors = useMemo(() => {
    const e: Partial<Record<Key, string>> = {};
    for (const k of Object.keys(draft) as Key[]) {
      if (k === "panelTracking") continue;
      const meta = ASSUMPTION_META[k];
      const n = Number(draft[k]);
      if (draft[k].trim() === "" || !Number.isFinite(n)) e[k] = "Enter a number";
      else if (meta.min !== undefined && n < meta.min) e[k] = `At least ${meta.min}`;
      else if (meta.max !== undefined && n > meta.max) e[k] = `At most ${meta.max}`;
    }
    return e;
  }, [draft]);
  const parsed = useMemo(() => fromDraft(draft), [draft]);
  const changed = (Object.keys(draft) as Key[]).filter((k) => !same(parsed[k], saved[k]));
  const dirty = changed.length > 0;
  const invalid = Object.keys(errors).length > 0;
  const isDefault = (Object.keys(draft) as Key[]).every((k) => same(parsed[k], DEFAULT_ASSUMPTIONS[k]));

  useEffect(() => {
    if (!focus) return;
    const el = bodyRef.current?.querySelector<HTMLElement>(`[data-field="${focus}"]`);
    el?.scrollIntoView({ block: "center" });
    el?.querySelector<HTMLElement>("input, select")?.focus({ preventScroll: true });
    const t = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(t);
  }, [focus]);

  const save = () => {
    if (invalid) return;
    setAll(parsed);
    onClose();
  };

  return (
    <Modal
      open
      title="Mission assumptions"
      labelledBy="assumptions-title"
      onClose={onClose}
      dirty={dirty}
      description={
        persona === "enthusiast"
          ? "These describe the lander you imagine sending. They are example values, not measurements. Change them to see how the results move."
          : "Inputs, not data. Defaults describe an example small solar-powered lander. Every value marked “Modelled” or “Your input” recomputes when you save."
      }
      footer={
        <EditorFooter
          dirty={dirty}
          invalid={invalid}
          isDefault={isDefault}
          onReset={() => setDraft(toDraft(DEFAULT_ASSUMPTIONS))}
          onDiscard={onClose}
          onSave={save}
          status={invalid ? "Some values are out of range." : dirty ? `${changed.length} unsaved change${changed.length === 1 ? "" : "s"}` : "No unsaved changes"}
        />
      }
    >
      <div ref={bodyRef} className="grid gap-x-10 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
        {GROUPS.map((g) => (
          <fieldset key={g.title} className="min-w-0">
            <legend className="text-sm font-semibold">{g.title}</legend>
            <p className="mb-3 text-xs text-faint">{g.hint}</p>
            <div className="space-y-4">
              {g.keys.map((k) => {
                const meta = ASSUMPTION_META[k];
                const err = errors[k];
                const edited = !same(parsed[k], saved[k]);
                const off = !same(parsed[k], DEFAULT_ASSUMPTIONS[k]);
                const disabled = k === "panelFixedAzDeg" && draft.panelTracking !== "vertical-fixed";
                return (
                  <div key={k} data-field={k} className={`-mx-2 rounded-sm px-2 py-1.5 motion-safe:transition-colors ${flash === k ? "bg-accent/15 ring-1 ring-accent" : ""}`}>
                    <label htmlFor={`as-${k}`} className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-fg">{meta.label}</span>
                      {edited ? <span className="shrink-0 text-xs text-accent">Edited</span> : off ? <span className="shrink-0 text-xs text-faint">Custom</span> : null}
                    </label>
                    {k === "panelTracking" ? (
                      <select id={`as-${k}`} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} className="mt-1 h-10 w-full rounded-sm border border-line bg-bg px-2 text-sm">
                        {TRACKING.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                      </select>
                    ) : (
                      <div className={`mt-1 flex h-10 items-center rounded-sm border bg-bg focus-within:border-fg ${err ? "border-critical" : "border-line"} ${disabled ? "opacity-50" : ""}`}>
                        <input
                          id={`as-${k}`}
                          type="number"
                          inputMode="decimal"
                          value={draft[k]}
                          min={meta.min}
                          max={meta.max}
                          step={meta.step}
                          disabled={disabled}
                          aria-invalid={!!err}
                          aria-describedby={`as-${k}-why`}
                          onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                          className="num h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
                        />
                        {meta.unit && <span className="pr-2 text-xs text-faint">{meta.unit}</span>}
                      </div>
                    )}
                    {err && <p className="mt-1 text-xs text-critical">{err}</p>}
                    <p id={`as-${k}-why`} className="mt-1 text-xs leading-relaxed text-faint">
                      {meta.why}{" "}
                      <span className="whitespace-nowrap">Default: {k === "panelTracking" ? TRACKING.find((o) => o.v === DEFAULT_ASSUMPTIONS.panelTracking)?.label : <span className="num">{show(DEFAULT_ASSUMPTIONS[k] as number)}{unitText(meta.unit)}</span>}.</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </Modal>
  );
}

function toDraft(a: Assumptions): Record<Key, string> {
  const out = {} as Record<Key, string>;
  for (const k of Object.keys(a) as Key[]) out[k] = k === "panelTracking" ? String(a[k]) : String(+(a[k] as number).toFixed(4));
  return out;
}

function fromDraft(d: Record<Key, string>): Assumptions {
  const out = { ...DEFAULT_ASSUMPTIONS } as Record<Key, unknown>;
  for (const k of Object.keys(d) as Key[]) out[k] = k === "panelTracking" ? d[k] : Number(d[k]);
  return out as Assumptions;
}

const same = (p: unknown, q: unknown) => (typeof p === "number" && typeof q === "number" ? Math.abs(p - q) < 1e-9 || (Number.isNaN(p) && Number.isNaN(q)) : p === q);
