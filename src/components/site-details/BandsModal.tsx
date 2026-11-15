"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorFooter, Modal } from "@/components/Modal";
import { BandStrip } from "@/components/RagBadge";
import { useAssumptions } from "@/lib/assumptions-store";
import { BAND_DEFS, BAND_KEYS, bandIsValid, type BandKey, type BandOverrides } from "@/lib/bands";
import { getMetric } from "@/lib/metrics";
import { rate, type MetricValue } from "@/lib/metrics/types";
import type { Persona } from "@/lib/persona";
import { useEditor } from "./editor-store";

type Draft = Record<BandKey, { amber: string; green: string }>;
const show = (v: number) => String(+v.toFixed(2));

/** Rating-band editor (D-083). Edits stay in a draft until "Save changes". */
export function BandsModal({ persona, values }: { persona: Persona; values?: Record<string, MetricValue> }) {
  const target = useEditor((s) => s.target);
  const close = useEditor((s) => s.close);
  return target?.kind === "bands" ? <Editor focus={target.focus as BandKey | undefined} onClose={close} persona={persona} values={values} /> : null;
}

function Editor({ focus, onClose, persona, values }: { focus?: BandKey; onClose: () => void; persona: Persona; values?: Record<string, MetricValue> }) {
  const a = useAssumptions((s) => s.a);
  const saved = useAssumptions((s) => s.bands);
  const setAllBands = useAssumptions((s) => s.setAllBands);
  const defaults = useMemo(() => Object.fromEntries(BAND_KEYS.map((k) => [k, BAND_DEFS[k].defaults(a)])) as Record<BandKey, { amber: number; green: number }>, [a]);
  const initial = useMemo(() => {
    const d = {} as Draft;
    for (const k of BAND_KEYS) {
      const o = saved[k] && bandIsValid(BAND_DEFS[k].better, saved[k]!) ? saved[k]! : defaults[k];
      d[k] = { amber: show(o.amber), green: show(o.green) };
    }
    return d;
  }, [saved, defaults]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [flash, setFlash] = useState<BandKey | null>(focus ?? null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const parsed = (k: BandKey) => ({ amber: Number(draft[k].amber), green: Number(draft[k].green) });
  const valid = (k: BandKey) => draft[k].amber.trim() !== "" && draft[k].green.trim() !== "" && bandIsValid(BAND_DEFS[k].better, parsed(k));
  const eq = (p: { amber: number; green: number }, q: { amber: number; green: number }) => Math.abs(p.amber - q.amber) < 1e-9 && Math.abs(p.green - q.green) < 1e-9;
  const changed = BAND_KEYS.filter((k) => draft[k].amber !== initial[k].amber || draft[k].green !== initial[k].green);
  const invalid = BAND_KEYS.some((k) => !valid(k));
  const isDefault = BAND_KEYS.every((k) => valid(k) && eq(parsed(k), defaults[k]));

  /** metrics on this page rated by each band set, with this site's value */
  const usedBy = useMemo(() => {
    const out = {} as Record<BandKey, { name: string; value: number }[]>;
    for (const k of BAND_KEYS) out[k] = [];
    for (const v of Object.values(values ?? {})) {
      const k = v.rating?.key as BandKey | undefined;
      if (k && out[k] && typeof v.value === "number") out[k].push({ name: getMetric(v.id)?.name ?? v.id, value: v.value });
    }
    return out;
  }, [values]);

  useEffect(() => {
    if (!focus) return;
    const el = bodyRef.current?.querySelector<HTMLElement>(`[data-band="${focus}"]`);
    el?.scrollIntoView({ block: "center" });
    el?.querySelector<HTMLElement>("input")?.focus({ preventScroll: true });
    const t = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(t);
  }, [focus]);

  const save = () => {
    if (invalid) return;
    const next: BandOverrides = {};
    for (const k of BAND_KEYS) if (!eq(parsed(k), defaults[k])) next[k] = parsed(k);
    setAllBands(next);
    onClose();
  };

  return (
    <Modal
      open
      title="Rating bands"
      labelledBy="bands-title"
      onClose={onClose}
      dirty={changed.length > 0}
      description={
        persona === "enthusiast"
          ? "These lines decide when a result counts as good, a trade-off or challenging. They are planning choices, not laws of nature."
          : "Thresholds that turn a value into red / amber / green, and into the 1–10 scores on Compare. Each starts at a stated default; two follow your mission assumptions until you change them."
      }
      footer={
        <EditorFooter
          dirty={changed.length > 0}
          invalid={invalid}
          isDefault={isDefault}
          onReset={() => setDraft(Object.fromEntries(BAND_KEYS.map((k) => [k, { amber: show(defaults[k].amber), green: show(defaults[k].green) }])) as Draft)}
          onDiscard={onClose}
          onSave={save}
          status={invalid ? "Some bands are out of order." : changed.length ? `${changed.length} unsaved change${changed.length === 1 ? "" : "s"}` : "No unsaved changes"}
        />
      }
    >
      <div ref={bodyRef} className="divide-y divide-line">
        {BAND_KEYS.map((k) => {
          const d = BAND_DEFS[k];
          const ok = valid(k);
          const p = ok ? parsed(k) : defaults[k];
          const dom = d.domain(a, p);
          const spec = { better: d.better, amber: p.amber, green: p.green, min: Math.min(dom.min, p.amber, p.green), max: Math.max(dom.max, p.amber, p.green), unit: d.unit, basis: d.basis(a) };
          const users = usedBy[k];
          const sample = users[0]?.value ?? (p.amber + p.green) / 2;
          const custom = ok && !eq(parsed(k), defaults[k]);
          return (
            <div key={k} data-band={k} className={`grid gap-x-8 gap-y-3 py-5 first:pt-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.1fr)] motion-safe:transition-colors ${flash === k ? "-mx-3 rounded-sm bg-accent/15 px-3 ring-1 ring-accent" : ""}`}>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">{d.label}</span>
                  {custom && <span className="text-xs text-accent">Custom</span>}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-faint">{d.better === "higher" ? "Higher is better. " : "Lower is better. "}{d.basis(a)}</p>
                {users.length > 0 && <p className="mt-1 text-xs text-muted">Rates: {users.map((u) => u.name).join(" · ")}</p>}
              </div>
              <div className="flex gap-4">
                {(["amber", "green"] as const).map((f) => (
                  <label key={f} className="min-w-0 flex-1 text-xs text-muted">
                    {f === "amber" ? "Trade-off starts at" : "Good starts at"}
                    <span className={`mt-1 flex h-10 items-center rounded-sm border bg-bg focus-within:border-fg ${ok ? "border-line" : "border-critical"}`}>
                      <input
                        type="number"
                        step="any"
                        value={draft[k][f]}
                        aria-label={`${d.label}: ${f === "amber" ? "trade-off" : "good"} threshold`}
                        onChange={(e) => setDraft({ ...draft, [k]: { ...draft[k], [f]: e.target.value } })}
                        className="num h-full min-w-0 flex-1 bg-transparent px-2 text-sm text-fg outline-none"
                      />
                      <span className="pr-2 text-faint">{d.unit.trim()}</span>
                    </span>
                    <span className="mt-1 block text-faint">Default <span className="num">{show(defaults[k][f])}{d.unit}</span></span>
                  </label>
                ))}
              </div>
              <div className="min-w-0">
                {ok ? (
                  <>
                    <BandStrip rating={rate(sample, spec)} value={sample} />
                    {users[0] && <p className="mt-1 text-xs text-faint">Marker: this site&apos;s value for {users[0].name} (<span className="num">{show(users[0].value)}{d.unit}</span>)</p>}
                  </>
                ) : (
                  <p className="text-xs text-critical">{d.better === "higher" ? "“Good” must be at or above “Trade-off”." : "“Good” must be at or below “Trade-off”."} Not saved until fixed.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
