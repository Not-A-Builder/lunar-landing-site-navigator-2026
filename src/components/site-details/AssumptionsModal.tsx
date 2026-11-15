"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorFooter, Modal } from "@/components/Modal";
import { ScrollThumb } from "@/components/ScrollThumb";
import { ASSUMPTION_META, DEFAULT_ASSUMPTIONS, type Assumptions } from "@/lib/assumptions";
import { useAssumptions } from "@/lib/assumptions-store";
import { useEditor } from "./editor-store";

type Key = keyof Assumptions;

const GROUPS: { title: string; keys: Key[] }[] = [
  { title: "Mission & visibility", keys: ["missionDays", "mastHeightM", "sunDiskThreshold", "earthDiskThreshold", "dsnMinElevDeg"] },
  { title: "Power", keys: ["panelTracking", "panelFixedAzDeg", "panelAreaM2", "panelEfficiency", "batteryWh", "loadW", "survivalLoadW"] },
  { title: "Landing", keys: ["slopeToleranceDeg", "approachAzDeg", "footprintRadiusM", "landerMassKg", "footpadAreaM2", "minSunElevForOpticalNavDeg"] },
  { title: "Communications", keys: ["txPowerW", "landerAntennaGainDbi", "freqGHz", "groundGTdBK", "requiredEbN0dB", "linkMarginDb"] },
  { title: "Rover", keys: ["roverSpeedMPerH", "roverWhPerKm"] },
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
export function AssumptionsModal() {
  const target = useEditor((s) => s.target);
  const close = useEditor((s) => s.close);
  const open = target?.kind === "assumptions";
  return open ? <Editor focus={target.focus as Key | undefined} onClose={close} /> : null;
}

function Editor({ focus, onClose }: { focus?: Key; onClose: () => void }) {
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
      customBody
      onClose={onClose}
      dirty={dirty}
      description="Inputs, not data. Defaults describe an example small solar-powered lander. Every value marked “Modelled” or “Your input” recomputes when you save."
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
      {/* Two scrolling columns (D-123): contents on the left, one field per row on the right. */}
      <ModalToc scrollRef={bodyRef} marked={new Set((Object.keys(draft) as Key[]).filter((k) => !same(parsed[k], saved[k]) || !same(parsed[k], DEFAULT_ASSUMPTIONS[k])))} />
      <div className="relative flex min-w-0 flex-1">
      <div ref={bodyRef} className="no-scrollbar relative min-w-0 flex-1 overflow-y-auto overscroll-contain pb-8 pl-6 pr-9">
        {GROUPS.map((g) => (
          <section key={g.title} id={groupId(g.title)} aria-labelledby={`${groupId(g.title)}-h`} className="pt-5">
            <h3 id={`${groupId(g.title)}-h`} className="text-[20px] font-semibold">{g.title}</h3>
            <div className="mt-2 divide-y divide-line">
              {g.keys.map((k) => {
                const meta = ASSUMPTION_META[k];
                const err = errors[k];
                const edited = !same(parsed[k], saved[k]);
                const off = !same(parsed[k], DEFAULT_ASSUMPTIONS[k]);
                const disabled = k === "panelFixedAzDeg" && draft.panelTracking !== "vertical-fixed";
                return (
                  <div key={k} id={`as-row-${k}`} data-field={k}
                    className={`-mx-2 grid gap-x-8 gap-y-2 rounded-sm px-2 py-4 motion-safe:transition-colors sm:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)] ${flash === k ? "bg-accent/15 ring-1 ring-accent" : ""}`}>
                    {/* Left: label and helper text */}
                    <div className="min-w-0">
                      <label htmlFor={`as-${k}`} className="flex items-baseline gap-2 text-sm">
                        <span className="font-medium text-fg">{meta.label}</span>
                        {/* "Custom" (saved, not the default) looks the same as "Edited" (unsaved change) (D-126). */}
                        {edited ? <span className="shrink-0 text-xs text-accent">Edited</span> : off ? <span className="shrink-0 text-xs text-accent">Custom</span> : null}
                      </label>
                      <p id={`as-${k}-why`} className="mt-1 text-xs leading-relaxed text-faint">
                        {meta.why}{" "}
                        <span className="whitespace-nowrap">Default: {k === "panelTracking" ? TRACKING.find((o) => o.v === DEFAULT_ASSUMPTIONS.panelTracking)?.label : <span className="num">{show(DEFAULT_ASSUMPTIONS[k] as number)}{unitText(meta.unit)}</span>}.</span>
                      </p>
                    </div>
                    {/* Right: the value field */}
                    <div className="min-w-0">
                      {k === "panelTracking" ? (
                        <select id={`as-${k}`} value={draft[k]} aria-describedby={`as-${k}-why`} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} className="h-10 w-full rounded-sm border border-line bg-bg px-2 text-sm">
                          {TRACKING.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                        </select>
                      ) : (
                        <div className={`flex h-10 items-center rounded-sm border bg-bg focus-within:border-fg ${err ? "border-critical" : "border-line"} ${disabled ? "opacity-50" : ""}`}>
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
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <ScrollThumb target={bodyRef} />
      </div>
    </Modal>
  );
}

const groupId = (title: string) => `as-group-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

/**
 * Contents for the editor (D-123), like the page's contents but with no heading: each group and its fields.
 * A click scrolls the fields column so that entry sits at the top and keeps it selected until the user scrolls
 * the column themselves; otherwise the entry at the top of the column is highlighted.
 */
function ModalToc({ scrollRef, marked }: { scrollRef: React.RefObject<HTMLDivElement | null>; marked: Set<Key> }) {
  const items = useMemo(() => GROUPS.flatMap((g) => [
    { id: groupId(g.title), label: g.title, depth: 0, key: null as Key | null },
    ...g.keys.map((k) => ({ id: `as-row-${k}`, label: ASSUMPTION_META[k].label, depth: 1, key: k as Key | null })),
  ]), []);
  const [active, setActive] = useState(items[0].id);
  const clicked = useRef<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      if (clicked.current) return;
      const line = box.getBoundingClientRect().top + 24;
      let cur = items[0].id;
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top <= line) cur = it.id;
      }
      setActive(cur);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    const release = () => { clicked.current = null; };
    update();
    box.addEventListener("scroll", onScroll, { passive: true });
    box.addEventListener("wheel", release, { passive: true });
    box.addEventListener("touchmove", release, { passive: true });
    box.addEventListener("keydown", release);
    box.addEventListener("mousedown", release);
    return () => {
      box.removeEventListener("scroll", onScroll);
      box.removeEventListener("wheel", release);
      box.removeEventListener("touchmove", release);
      box.removeEventListener("keydown", release);
      box.removeEventListener("mousedown", release);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items, scrollRef]);

  // keep the highlighted entry visible inside the contents column
  useEffect(() => {
    const nav = navRef.current, el = nav?.querySelector<HTMLElement>(`[data-toc="${active}"]`);
    if (!nav || !el) return;
    const r = el.getBoundingClientRect(), b = nav.getBoundingClientRect();
    if (r.top < b.top + 8 || r.bottom > b.bottom - 8) nav.scrollTop += r.top - b.top - b.height / 3;
  }, [active]);

  const go = (id: string) => {
    const box = scrollRef.current, el = document.getElementById(id);
    if (!box || !el) return;
    clicked.current = id;
    setActive(id);
    box.scrollTo({ top: box.scrollTop + el.getBoundingClientRect().top - box.getBoundingClientRect().top - (id.startsWith("as-group-") ? 0 : 8), behavior: "instant" });
  };

  return (
    <div className="relative hidden w-60 shrink-0 border-r border-line md:flex">
    <nav ref={navRef} aria-label="Assumption groups" className="no-scrollbar min-w-0 flex-1 overflow-y-auto overscroll-contain py-4 pl-4 pr-6">
      <ul className="space-y-0.5">
        {items.map((it) => (
          <li key={it.id} className={it.depth ? "ml-3 border-l border-line pl-2" : it.id === items[0].id ? "" : "pt-2"}>
            {/* Fields that are custom or edited take the same accent colour as their "Custom" / "Edited" label (D-127). */}
            <button type="button" data-toc={it.id} onClick={() => go(it.id)} aria-current={active === it.id ? "location" : undefined}
              title={it.key && marked.has(it.key) ? "Differs from the default" : undefined}
              className={`block w-full rounded-sm px-1.5 py-1 text-left leading-snug transition-colors ${it.depth ? "text-xs" : "text-sm font-semibold"} ${active === it.id ? "bg-panel-2" : ""} ${it.key && marked.has(it.key) ? "text-accent" : active === it.id ? "text-fg" : "text-muted hover:text-fg"}`}>
              {it.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
    <ScrollThumb target={navRef} />
    </div>
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
