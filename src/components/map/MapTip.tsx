"use client";

import { X } from "@phosphor-icons/react";

/**
 * The name tooltip over a map pin: a translucent panel in the current theme with a pointer under it.
 * It is positioned imperatively every frame (`placeMapTip`), so moving the map never re-renders React.
 * For the custom point it also shows a × that clears the point (`onClose`).
 */
export function MapTip({ ref, onClose }: { ref: React.Ref<HTMLDivElement>; onClose?: () => void }) {
  return (
    <div ref={ref} style={{ opacity: 0 }} className="pointer-events-none absolute left-0 top-0 z-10 transition-opacity duration-100">
      <div className="relative flex items-center gap-1 whitespace-nowrap rounded-sm border border-line bg-panel/80 py-1 pl-2 pr-2 text-sm font-medium text-fg shadow-md backdrop-blur-sm data-[closable]:pr-1">
        <span data-tip-text aria-hidden />
        <button
          type="button"
          data-tip-close
          onClick={onClose}
          aria-label="Clear the custom point"
          title="Clear point (Esc)"
          style={{ display: "none" }}
          className="pointer-events-auto -my-0.5 inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted hover:bg-panel-2 hover:text-fg"
        >
          <X size={14} weight="bold" />
        </button>
        <svg width={14} height={7} viewBox="0 0 14 7" className="absolute left-1/2 top-full -translate-x-1/2" aria-hidden>
          <path d="M0 0 L7 7 L14 0 Z" fill="var(--panel)" fillOpacity={0.8} />
          <path d="M0 0 L7 7 L14 0" fill="none" stroke="var(--line)" />
        </svg>
      </div>
    </div>
  );
}

/** pointer height + gap between the pointer tip and the pin's edge, px */
const POINTER = 7 + 3;

/**
 * Show the tooltip with its pointer touching the top of a pin at (x, y) px of radius `pinRadius`,
 * or hide it (text null or not visible). `closable` shows the × (custom point only).
 */
export function placeMapTip(el: HTMLDivElement | null, x: number, y: number, text: string | null, pinRadius: number, visible = true, closable = false) {
  if (!el) return;
  const close = el.querySelector<HTMLElement>("[data-tip-close]");
  if (!text || !visible || !Number.isFinite(x) || !Number.isFinite(y)) {
    el.style.opacity = "0";
    if (close) close.style.display = "none";
    return;
  }
  const t = el.querySelector<HTMLElement>("[data-tip-text]");
  if (t && t.textContent !== text) t.textContent = text;
  if (close) close.style.display = closable ? "" : "none";
  el.firstElementChild?.toggleAttribute("data-closable", closable);
  el.style.transform = `translate(${x.toFixed(1)}px, ${(y - pinRadius - POINTER).toFixed(1)}px) translate(-50%, -100%)`;
  el.style.opacity = "1";
}
