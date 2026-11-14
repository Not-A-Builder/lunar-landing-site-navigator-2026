"use client";

import { ArrowsDownUp, Check } from "@phosphor-icons/react";
import { useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { usePopover } from "@/lib/use-popover";

/** Orders for the site list (D-068). Default is name A–Z. */
export const SORTS = [
  { id: "name-asc", label: "Name, A to Z" },
  { id: "name-desc", label: "Name, Z to A" },
  { id: "pole-near", label: "Closest to the south pole first" },
  { id: "pole-far", label: "Farthest from the south pole first" },
] as const;
export type SortId = (typeof SORTS)[number]["id"];
export const DEFAULT_SORT: SortId = "name-asc";

// "Luna 9" before "Luna 16"; case and accents ignored.
const byName = new Intl.Collator("en", { numeric: true, sensitivity: "base" }).compare;

/**
 * Sorts sites with coordinates. Distance from the south pole is the angular distance 90° + latitude,
 * so ordering by latitude is enough; ties fall back to name A–Z.
 */
export function sortSites<T extends { name: string; lat: number }>(list: T[], sort: SortId): T[] {
  const out = [...list];
  switch (sort) {
    case "name-asc":
      return out.sort((a, b) => byName(a.name, b.name));
    case "name-desc":
      return out.sort((a, b) => byName(b.name, a.name));
    case "pole-near":
      return out.sort((a, b) => a.lat - b.lat || byName(a.name, b.name));
    case "pole-far":
      return out.sort((a, b) => b.lat - a.lat || byName(a.name, b.name));
  }
}

/** Sort icon that opens a single-choice menu of list orders. A dot on the icon means a non-default order. */
export function SortMenu({ value, onChange }: { value: SortId; onChange: (next: SortId) => void }) {
  const { ref, panelRef, open, setOpen } = usePopover();
  const btnRef = useRef<HTMLButtonElement>(null);

  // Same placement as FilterMenu: beside the button, portalled and kept inside the viewport.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = btnRef.current?.getBoundingClientRect();
      const m = panelRef.current;
      if (!b || !m) return;
      const M = 8;
      m.style.left = `${Math.min(b.right + 6, window.innerWidth - m.offsetWidth - M)}px`;
      m.style.top = `${Math.max(M, Math.min(b.top, window.innerHeight - m.offsetHeight - M))}px`;
      m.style.visibility = "visible";
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, panelRef]);
  const menuId = useId();
  const current = SORTS.find((s) => s.id === value)!;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(panelRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Sort list (${current.label})`}
        title={`Sort: ${current.label}`}
        onClick={() => setOpen(!open)}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-sm border text-fg transition-colors ${open ? "border-fg bg-panel" : "border-line bg-panel/60 hover:border-muted hover:bg-panel"}`}
      >
        <ArrowsDownUp size={20} />
        {value !== DEFAULT_SORT && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          id={menuId}
          role="menu"
          aria-label="Sort list"
          onKeyDown={onKey}
          style={{ position: "fixed", left: 0, top: 0, visibility: "hidden" }}
          className="z-50 w-80 rounded-sm border border-line bg-panel p-1 shadow-xl"
        >
          {SORTS.map((s) => {
            const on = s.id === value;
            return (
              <button
                key={s.id}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                autoFocus={on}
                onClick={() => {
                  onChange(s.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-left text-sm outline-none hover:bg-panel-2 focus-visible:bg-panel-2"
              >
                <Check size={18} weight="bold" className={`shrink-0 ${on ? "" : "invisible"}`} aria-hidden />
                {s.label}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
