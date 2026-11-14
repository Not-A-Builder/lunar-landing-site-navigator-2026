"use client";

import { CheckSquare, FunnelSimple, Square } from "@phosphor-icons/react";
import { useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { GROUP_LABELS, type SiteGroup } from "@/lib/sites";
import { usePopover } from "@/lib/use-popover";

/**
 * Filter icon that opens a checkbox menu of the curated lists, with one Select all / Deselect all
 * toggle. A dot on the icon means some lists are off.
 */
export function FilterMenu({
  groups,
  selected,
  onChange,
}: {
  groups: SiteGroup[];
  selected: Set<SiteGroup>;
  onChange: (next: Set<SiteGroup>) => void;
}) {
  const { ref, panelRef, open, setOpen } = usePopover();
  const btnRef = useRef<HTMLButtonElement>(null);

  // The menu opens beside the button, top edges aligned. It is portalled with fixed positioning so the
  // scrolling column doesn't clip it, and kept inside the viewport.
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
  const allOn = groups.every((g) => selected.has(g));
  const filtering = !allOn;
  const toggle = (g: SiteGroup) => {
    const next = new Set(selected);
    if (next.has(g)) next.delete(g);
    else next.add(g);
    onChange(next);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(panelRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemcheckbox]") ?? [])];
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
        aria-label={`Filter lists (${selected.size} of ${groups.length} on)`}
        title="Filter lists"
        onClick={() => setOpen(!open)}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-sm border transition-colors ${open ? "border-fg text-fg" : "border-line text-muted hover:border-muted hover:text-fg"}`}
      >
        <FunnelSimple size={20} />
        {filtering && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          id={menuId}
          role="menu"
          aria-label="Filter lists"
          onKeyDown={onKey}
          style={{ position: "fixed", left: 0, top: 0, visibility: "hidden" }}
          className="z-50 w-80 rounded-sm border border-line bg-panel p-1 shadow-xl"
        >
          {groups.map((g, i) => {
            const on = selected.has(g);
            return (
              <button
                key={g}
                type="button"
                role="menuitemcheckbox"
                aria-checked={on}
                autoFocus={i === 0}
                onClick={() => toggle(g)}
                className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-left text-sm outline-none hover:bg-panel-2 focus-visible:bg-panel-2"
              >
                {on ? <CheckSquare size={20} weight="fill" className="shrink-0" aria-hidden /> : <Square size={20} className="shrink-0 text-muted" aria-hidden />}
                {GROUP_LABELS[g]}
              </button>
            );
          })}
          <div className="mt-1 border-t border-line px-2.5 pb-1 pt-2 text-xs">
            <button type="button" onClick={() => onChange(allOn ? new Set() : new Set(groups))} className="text-muted hover:text-fg">
              {allOn ? "Deselect all" : "Select all"}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
