"use client";

import { CaretRight } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollThumb } from "@/components/ScrollThumb";
import type { TocItem } from "@/components/site-details/PageToc";

/** Breathing room between whatever is pinned at the top and the section a contents click lands on. */
const GAP_PX = 16;
/** Pointer must rest this long on the rail before the panel opens (so sweeping past doesn't flash it). */
const OPEN_DELAY_MS = 70;
/** Leaving the rail and panel closes it after this long (so a brief overshoot doesn't). */
const CLOSE_DELAY_MS = 200;
/** Vertical pitch of the rail's dashes (px). */
const PITCH = 12;

/**
 * Where the reading line sits: below everything pinned at the top (app header, the comparison's card bar
 * and, while it is pinned, the timeline row; all marked `data-sticky-top`). A contents click puts its
 * target's top here, and the scroll tracking picks the last entry that has reached it (as D-116).
 */
function readingLine() {
  let top = 64;
  document.querySelectorAll("[data-sticky-top]").forEach((e) => { top = Math.max(top, e.getBoundingClientRect().bottom); });
  return top + GAP_PX;
}

type Flat = { id: string; label: string; depth: number; parents: string[] };

/**
 * Contents for the comparison (D-135). At rest, a rail of dashes at the page's left edge: one per section
 * and sub-section, the one being read highlighted, gliding as you scroll. Point at the rail (or focus it) and
 * the rest of the page dims while the full contents list opens in the same spot. There you can scroll it,
 * expand / collapse each category's metrics (mission planner), and click to jump. Leaving it, Escape, a
 * click on the dimmed page, or a jump closes it.
 */
export function CompareToc({ items, collapsible }: { items: TocItem[]; collapsible: boolean }) {
  const flat = useMemo(() => {
    const out: Flat[] = [];
    const walk = (xs: TocItem[], parents: string[]) => xs.forEach((x) => {
      out.push({ id: x.id, label: x.label, depth: parents.length, parents });
      if (x.children) walk(x.children, [...parents, x.id]);
    });
    walk(items, []);
    return out;
  }, [items]);
  // The rail shows sections and sub-sections; planner metrics (a third level) live only in the panel.
  const dashes = useMemo(() => flat.filter((f) => f.depth <= 1), [flat]);

  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const clicked = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLButtonElement>(null);

  // ── Scroll tracking: the last entry whose top has reached the reading line ──
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      if (clicked.current) return;
      const line = readingLine() + 1;
      let cur: string | null = null;
      for (const f of flat) {
        const el = document.getElementById(f.id);
        if (el && el.getBoundingClientRect().top <= line) cur = f.id;
      }
      setActive(cur ?? flat[0]?.id ?? null);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    // The user scrolling the page themselves hands the highlight back to the tracking (not the panel's own list).
    const release = (e: Event) => { if (!(e.target instanceof Element && e.target.closest("[data-cmp-toc]"))) clicked.current = null; };
    const onKey = (e: KeyboardEvent) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) clicked.current = null; };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchmove", release, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", release);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchmove", release);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", release);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [flat]);

  const trail = useMemo(() => {
    const f = flat.find((x) => x.id === active);
    return new Set(f ? [...f.parents, f.id] : []);
  }, [flat, active]);
  // The rail highlights the deepest section or sub-section on the active entry's trail.
  const activeDash = Math.max(0, dashes.findLastIndex((d) => trail.has(d.id)));

  // ── Open / close ──
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const openSoon = () => { clear(); if (!open) timer.current = setTimeout(() => setOpen(true), OPEN_DELAY_MS); };
  const closeSoon = () => { clear(); timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS); };
  const close = useCallback(() => { clear(); setOpen(false); }, []);
  useEffect(() => () => clear(), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { close(); railRef.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);
  // On opening, bring the entry being read into the middle of the list.
  useEffect(() => {
    if (!open || !active) return;
    const box = listRef.current, el = box?.querySelector<HTMLElement>(`[data-toc-item="${active}"]`);
    if (!box || !el) return;
    box.scrollTop = el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- only when it opens, not while it follows the page

  /** Jump to an entry: put its top on the reading line; pinning can change as the page moves, so re-align. */
  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    clicked.current = id;
    setActive(id);
    close();
    el.scrollIntoView({ behavior: "instant", block: "start" });
    const align = () => {
      if (clicked.current !== id) return;
      for (let i = 0; i < 4; i++) {
        const d = el.getBoundingClientRect().top - readingLine();
        if (Math.abs(d) < 1) break;
        const before = window.scrollY;
        window.scrollBy({ top: d, behavior: "instant" });
        if (window.scrollY === before) break;
      }
    };
    align();
    requestAnimationFrame(() => requestAnimationFrame(align));
    setTimeout(align, 150);
  };

  const render = (xs: TocItem[], depth: number) => (
    <ul className={depth === 0 ? "space-y-1" : depth === 1 ? "mt-0.5 space-y-0.5" : "mb-1 ml-4 mt-0.5 border-l border-line pl-2"}>
      {xs.map((x) => {
        const isActive = active === x.id;
        const inTrail = trail.has(x.id);
        // Sections always list their entries; a category's metrics (planner only) open with the caret,
        // and by themselves while the category is being read.
        const kids = !!x.children?.length && depth > 0;
        const show = !!x.children?.length && (depth === 0 || (expanded[x.id] ?? inTrail));
        return (
          <li key={x.id}>
            <div className="flex items-stretch">
              {depth > 0 && (collapsible && kids ? (
                <button type="button" aria-label={`${show ? "Collapse" : "Expand"} ${x.label}`} aria-expanded={show}
                  onClick={() => setExpanded((e) => ({ ...e, [x.id]: !show }))}
                  className="flex w-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-faint transition-colors hover:bg-panel-2 hover:text-fg">
                  <CaretRight size={12} className={`transition-transform duration-200 ${show ? "rotate-90" : ""}`} aria-hidden />
                </button>
              ) : <span className={collapsible && depth === 1 ? "w-6 shrink-0" : depth === 1 ? "w-3 shrink-0" : ""} aria-hidden />)}
              <button type="button" data-toc-item={x.id} onClick={() => go(x.id)} aria-current={isActive ? "location" : undefined}
                className={`block min-w-0 flex-1 cursor-pointer rounded-sm px-2.5 py-1.5 text-left leading-snug transition-colors duration-150 ${
                  depth === 0 ? "text-[15px] font-semibold" : depth === 1 ? "text-sm" : "text-[13px]"} ${
                  isActive ? "bg-primary text-primary-ink" : inTrail ? "bg-panel-2 text-fg" : "text-muted hover:bg-panel-2 hover:text-fg"}`}>
                {x.label}
              </button>
            </div>
            {show && render(x.children!, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Dims the rest of the page (below the app header) while the list is open; a click closes it. */}
      <div aria-hidden onClick={close}
        className={`fixed inset-x-0 bottom-0 top-16 z-[26] bg-bg/70 backdrop-blur-[2px] transition-opacity duration-200 ease-out motion-reduce:transition-none ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />

      <div data-cmp-toc onPointerEnter={openSoon} onPointerLeave={closeSoon}
        onFocus={() => { clear(); setOpen(true); }}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) closeSoon(); }}
        className="fixed left-0 z-[27] hidden -translate-y-1/2 md:block"
        style={{ top: "calc(50% + (65px + var(--cmp-sub-h, 0px)) / 2)" }}>
        {/* The rail: a generous hit area ("near" counts), dashes at the page's left edge. */}
        <button ref={railRef} type="button" aria-label="Contents" aria-expanded={open} aria-controls="cmp-toc-panel" onClick={() => setOpen((o) => !o)}
          className={`relative block cursor-pointer py-6 pl-5 pr-6 transition-opacity duration-200 ${open ? "opacity-0" : "opacity-100"}`}>
          <span className="relative block w-6" style={{ height: dashes.length * PITCH }}>
            {dashes.map((d, k) => (
              <span key={d.id} aria-hidden className="absolute left-0 h-[3px] rounded-[1px] bg-line" style={{ top: k * PITCH + (PITCH - 3) / 2, width: d.depth === 0 ? 24 : 16 }} />
            ))}
            {/* The reading position glides between dashes as the page scrolls. */}
            <span aria-hidden className="absolute left-0 h-[3px] rounded-[1px] bg-fg transition-[transform,width] duration-300 ease-out motion-reduce:transition-none"
              style={{ top: (PITCH - 3) / 2, width: dashes[activeDash]?.depth === 0 ? 24 : 16, transform: `translateY(${activeDash * PITCH}px)` }} />
          </span>
        </button>

        {/* The full list, opening from the rail's spot. */}
        <nav id="cmp-toc-panel" aria-label="Contents" inert={!open}
          className={`absolute left-3 top-1/2 flex w-[min(360px,calc(100vw-24px))] origin-left flex-col rounded-sm border border-line bg-bg shadow-2xl transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
            open ? "-translate-y-1/2 scale-100 opacity-100" : "pointer-events-none -translate-x-2 -translate-y-1/2 scale-[0.97] opacity-0"}`}
          style={{ maxHeight: "min(72vh, calc(100vh - 65px - var(--cmp-sub-h, 0px) - 32px))" }}>
          <div className="relative flex min-h-0 flex-1">
            <div ref={listRef} className="no-scrollbar relative min-w-0 flex-1 overflow-y-auto overscroll-contain p-2 pr-5">{render(items, 0)}</div>
            <ScrollThumb target={listRef} />
          </div>
        </nav>
      </div>
    </>
  );
}
