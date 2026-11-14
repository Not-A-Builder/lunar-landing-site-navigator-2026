"use client";

import { CaretDown, Check } from "@phosphor-icons/react";
import { useEffect, useId } from "react";
import { useAssumptions } from "@/lib/assumptions-store";
import { PERSONAS, usePersona } from "@/lib/persona";
import { usePopover } from "@/lib/use-popover";

/** Rehydrates persisted persona + assumptions after first paint (avoids SSR/client mismatch). */
export function PersonaHydrator() {
  useEffect(() => {
    usePersona.persist.rehydrate();
    useAssumptions.persist.rehydrate();
  }, []);
  return null;
}

/** Global view switcher, read as a sentence: "I am [a mission planner ▾]". */
export function PersonaToggle() {
  const persona = usePersona((s) => s.persona);
  const setPersona = usePersona((s) => s.setPersona);
  const { ref, open, setOpen } = usePopover();
  const menuId = useId();
  const current = PERSONAS.find((p) => p.id === persona) ?? PERSONAS[0];

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <div ref={ref} className="relative flex items-center gap-2 text-sm">
      <span className="text-muted">I am</span>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title="Changes how much technical detail every page shows"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-medium transition-colors ${open ? "border-fg" : "border-line hover:border-muted"}`}
      >
        {current.phrase}
        <CaretDown size={14} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label="I am" onKeyDown={onMenuKey} className="absolute right-0 top-full z-40 mt-1.5 w-72 rounded-sm border border-line bg-panel p-1 shadow-lg">
          {PERSONAS.map((p) => {
            const active = p.id === persona;
            return (
              <button
                key={p.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                autoFocus={active}
                onClick={() => {
                  setPersona(p.id);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 rounded-sm px-2.5 py-2 text-left outline-none hover:bg-panel-2 focus-visible:bg-panel-2"
              >
                <Check size={16} weight="bold" className={`mt-1 shrink-0 ${active ? "text-fg" : "invisible"}`} aria-hidden />
                <span>
                  <span className={`block ${active ? "font-medium" : ""}`}>{p.phrase}</span>
                  <span className="block text-xs text-muted">{p.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
