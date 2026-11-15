"use client";

import { CaretRight } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

export type TocItem = { id: string; label: string; children?: TocItem[] };

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

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      // the last section whose top has passed 30% of the viewport is the one being read
      const line = window.innerHeight * 0.3;
      let cur: string | null = null;
      for (const f of flat) {
        const el = document.getElementById(f.id);
        if (el && el.getBoundingClientRect().top <= line) cur = f.id;
      }
      setActive(cur ?? flat[0]?.id ?? null);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
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

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "instant", block: "start" });
    // A pinned bar (the site timeline, D-099) can cover the target: nudge it to just below the bar.
    const bar = document.querySelector<HTMLElement>("[data-sticky-bar]");
    if (bar) {
      const b = bar.getBoundingClientRect(), r = el.getBoundingClientRect();
      const pinned = b.top >= 63.5 && b.top <= 64.5; // fully pinned under the 64px app header, not being pushed out
      if (pinned && r.top < b.bottom + 16) window.scrollBy({ top: r.top - b.bottom - 16, behavior: "instant" });
    }
    setActive(id);
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
