"use client";

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A text trigger that opens a card on hover, focus or tap (D-090). Like InfoTip, the card is portalled
 * to <body>, kept inside the viewport, flips above when there is no room below, and stays open while the
 * pointer is over it.
 */
export function HoverCard({ label, children, className, width = 420, ariaLabel }: { label: ReactNode; children: ReactNode; className?: string; width?: number; ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 80);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 140);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = btnRef.current?.getBoundingClientRect();
      const t = cardRef.current;
      if (!b || !t) return;
      const M = 12, GAP = 8;
      const w = t.offsetWidth, h = t.offsetHeight;
      const vw = window.innerWidth, vh = window.innerHeight;
      const left = Math.min(Math.max(M, b.left), vw - w - M);
      const below = b.bottom + GAP, above = b.top - GAP - h;
      t.style.left = `${left}px`;
      t.style.top = `${below + h <= vh - M ? below : above >= M ? above : Math.max(M, vh - h - M)}px`;
      t.style.visibility = "visible";
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  return (
    <span className="inline-block" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onFocus={show}
        onBlur={hide}
        className={className}
      >
        {label}
      </button>
      {open && createPortal(
        <div
          ref={cardRef}
          id={id}
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={hide}
          style={{ position: "fixed", left: 0, top: 0, visibility: "hidden", width }}
          className="z-50 max-w-[calc(100vw-24px)] rounded-sm border border-line bg-panel p-3.5 text-left text-xs font-normal leading-relaxed text-fg shadow-xl"
        >
          {children}
        </div>,
        document.body,
      )}
    </span>
  );
}
