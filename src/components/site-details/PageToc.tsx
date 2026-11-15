"use client";

import { CaretRight } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";

export type TocItem = { id: string; label: string; children?: TocItem[] };

/** Height of the sticky app header (`h-16` in AppHeader). */
const APP_HEADER_PX = 64;
/** Breathing room between whatever is pinned at the top and the section a contents click lands on. */
const GAP_PX = 16;

/**
 * Where the reading line sits: just below the app header and, when it is pinned, the site timeline bar
 * (D-099). A contents click puts its target's top here, and the scroll tracking picks the last entry whose
 * top has reached it, so the two always agree (D-116).
 */
function readingLine() {
  let top = APP_HEADER_PX;
  const bar = document.querySelector<HTMLElement>("[data-sticky-bar]")?.getBoundingClientRect();
  if (bar && bar.top <= APP_HEADER_PX + 0.5 && bar.bottom > APP_HEADER_PX) top = Math.max(top, bar.bottom);
  return top + GAP_PX;
}

/**
 * Contents list for the site details page, like Wikipedia's (D-082): sticky in the left column, the
 * section in view is highlighted, and a click jumps there instantly. Sections with sub-items (each metric)
 * open while they are in view or when their caret is clicked.
 */
export function PageToc({ items }: { items: TocItem[] }) {
  const flat = useMemo(() => {
    const out: { id: string; parents: string[] }[] = [];
    const walk = (xs: TocItem[], parents: string[]) => xs.forEach((x) => { out.push({ id: x.id, parents }); if (x.children) walk(x.children, [...parents, x.id]); });
    walk(items, []);
    return out;
  }, [items]);
  const [active, setActive] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  /** The entry the user last clicked. It stays selected until the user scrolls the page themselves (D-116). */
  const clicked = useRef<string | null>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      if (clicked.current) return;
      // the last entry whose top has reached the reading line is the one being read
      const line = readingLine() + 1;
      let cur: string | null = null;
      for (const f of flat) {
        const el = document.getElementById(f.id);
        if (el && el.getBoundingClientRect().top <= line) cur = f.id;
      }
      setActive(cur ?? flat[0]?.id ?? null);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    // Any scrolling the user does themselves hands the highlight back to the scroll tracking.
    const release = () => { clicked.current = null; };
    const onKey = (e: KeyboardEvent) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) release(); };
    // A press outside the contents (the scrollbar, a chart that moves the page) also counts as the user taking over.
    const onDown = (e: MouseEvent) => { if (!(e.target instanceof Element && e.target.closest('nav[aria-label="Contents"]'))) release(); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchmove", release, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchmove", release);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [flat]);

  const activeTrail = useMemo(() => {
    const f = flat.find((x) => x.id === active);
    return new Set(f ? [...f.parents, f.id] : []);
  }, [flat, active]);

  // keep the highlighted entry visible inside the (scrollable) contents column
  useEffect(() => {
    if (!active) return;
    const el = document.querySelector<HTMLElement>(`[data-toc="${active}"]`);
    const box = el?.closest<HTMLElement>("[data-toc-scroll]");
    if (!el || !box) return;
    const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (r.top < b.top + 8 || r.bottom > b.bottom - 8) box.scrollTop += r.top - b.top - b.height / 3;
  }, [active]);

  /**
   * Jump to an entry (D-116): put its top on the reading line, below the app header and the pinned
   * timeline. Pinning can change as the page moves, so re-measure until the target stays put. The clicked
   * entry stays selected even when the page can't scroll that far (near the bottom).
   */
  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    clicked.current = id;
    setActive(id);
    el.scrollIntoView({ behavior: "instant", block: "start" });
    const align = () => {
      if (clicked.current !== id) return; // the user has scrolled since
      for (let i = 0; i < 4; i++) {
        const d = el.getBoundingClientRect().top - readingLine();
        if (Math.abs(d) < 1) break;
        const before = window.scrollY;
        window.scrollBy({ top: d, behavior: "instant" });
        if (window.scrollY === before) break; // top or bottom of the page
      }
    };
    align();
    // The pinned timeline settles its height a frame or two after a jump: align again once it has.
    requestAnimationFrame(() => requestAnimationFrame(align));
    setTimeout(align, 150);
  };

  const render = (xs: TocItem[], depth: number) => (
    <ul className={depth ? "ml-3 border-l border-line pl-2" : "space-y-0.5"}>
      {xs.map((x) => {
        const isActive = active === x.id;
        const inTrail = activeTrail.has(x.id);
        const hasKids = !!x.children?.length;
        const open = hasKids && (expanded[x.id] ?? (inTrail || depth === 0));
        return (
          <li key={x.id}>
            <div className="flex items-start">
              {hasKids && depth > 0 ? (
                <button type="button" aria-label={`${open ? "Collapse" : "Expand"} ${x.label}`} aria-expanded={open} title={open ? "Hide the metrics in this section" : "Show the metrics in this section"}
                  onClick={() => setExpanded((e) => ({ ...e, [x.id]: !open }))}
                  className="mt-[5px] -ml-1 mr-0.5 shrink-0 rounded-sm p-0.5 text-faint hover:text-fg">
                  <CaretRight size={12} className={`transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                data-toc={x.id}
                onClick={() => go(x.id)}
                aria-current={isActive ? "location" : undefined}
                className={`block min-w-0 flex-1 rounded-sm px-1.5 py-1 text-left leading-snug transition-colors ${depth === 0 ? "text-sm font-semibold" : depth === 1 ? "text-sm" : "text-xs"} ${
                  isActive ? "bg-panel-2 text-fg" : inTrail ? "text-fg" : "text-muted hover:text-fg"
                }`}
              >
                {x.label}
              </button>
            </div>
            {open && render(x.children!, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <nav aria-label="Contents" className="text-sm">
      <div className="mb-2 px-1.5 text-xs font-semibold uppercase tracking-wider text-faint">Contents</div>
      {render(items, 0)}
    </nav>
  );
}
