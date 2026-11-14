"use client";

import { useEffect, useRef } from "react";

const MIN_THUMB = 28;
const INSET = 4;

/**
 * A persistent vertical scrollbar, drawn in a gutter on the right edge, for a scroll container whose native bar is hidden
 * (`.no-scrollbar`). It shows only while the content overflows (macOS hides native bars until you
 * scroll). Drag the thumb, or click the track to move a page. Place it in a `relative` parent that
 * wraps the scroller.
 */
export function ScrollThumb({ target }: { target: React.RefObject<HTMLElement | null> }) {
  const track = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const update = () => {
      const { scrollHeight: sh, clientHeight: ch, scrollTop: st } = el;
      const over = sh > ch + 1;
      if (track.current) track.current.style.display = over ? "" : "none";
      const t = thumb.current;
      if (!t || !over) return;
      const len = ch - 2 * INSET;
      const h = Math.max(MIN_THUMB, (len * ch) / sh);
      t.style.height = `${h}px`;
      t.style.transform = `translateY(${((len - h) * st) / (sh - ch)}px)`;
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
      mo.disconnect();
    };
  }, [target]);

  const onThumbDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = target.current, t = thumb.current;
    if (!el || !t) return;
    e.preventDefault();
    e.stopPropagation();
    t.setPointerCapture(e.pointerId);
    const startY = e.clientY, startTop = el.scrollTop;
    const ratio = (el.scrollHeight - el.clientHeight) / (el.clientHeight - 2 * INSET - t.offsetHeight);
    const move = (ev: PointerEvent) => {
      el.scrollTop = startTop + (ev.clientY - startY) * ratio;
    };
    const up = () => {
      t.removeEventListener("pointermove", move);
      t.removeEventListener("pointerup", up);
      t.removeEventListener("pointercancel", up);
    };
    t.addEventListener("pointermove", move);
    t.addEventListener("pointerup", up);
    t.addEventListener("pointercancel", up);
  };

  const onTrackDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = target.current, t = thumb.current;
    if (!el || !t) return;
    const thumbTop = t.getBoundingClientRect().top;
    el.scrollBy({ top: (e.clientY < thumbTop ? -1 : 1) * el.clientHeight * 0.9, behavior: "smooth" });
  };

  return (
    <div ref={track} aria-hidden onPointerDown={onTrackDown} style={{ display: "none", paddingBlock: INSET }} className="group absolute bottom-0 right-0 top-0 z-10 w-3.5 cursor-default border-l border-line bg-panel-2/50">
      <div
        ref={thumb}
        onPointerDown={onThumbDown}
        className="mx-auto w-1.5 rounded-sm bg-muted/60 shadow-[0_2px_6px_rgba(0,0,0,0.35),0_1px_2px_rgba(0,0,0,0.25)] transition-[width,background-color] group-hover:w-2 group-hover:bg-muted/85 active:bg-muted"
      />
    </div>
  );
}
