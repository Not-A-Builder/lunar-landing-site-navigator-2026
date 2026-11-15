"use client";

import { Info } from "@phosphor-icons/react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SOURCES, type SourceId } from "@/lib/sources";

/**
 * Every data point gets one: helper text plus the data sources it was derived from (LOGS D-010, D-021).
 * Opens on hover, keyboard focus or tap, and stays open while the pointer is over it so links are clickable.
 * The card is portalled to <body> with fixed positioning, so scrolling panels never clip it; it is kept
 * inside the viewport and flips above the icon when there is no room below.
 * `trigger` replaces the icon with text (dotted underline), e.g. a chart lane label (D-098).
 */
export function InfoTip({
  title,
  children,
  sources,
  sourceLabel,
  sourceUrl,
  align = "left",
  trigger,
}: {
  title: string;
  children?: React.ReactNode;
  sources?: SourceId[];
  sourceLabel?: string;
  sourceUrl?: string | null;
  align?: "left" | "right";
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    timer.current = setTimeout(() => setOpen(false), 120);
  };
  const uniq = [...new Set(sources ?? [])];
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = btnRef.current?.getBoundingClientRect();
      const t = tipRef.current;
      if (!b || !t) return;
      const M = 12, GAP = 8;
      const w = t.offsetWidth, h = t.offsetHeight;
      const vw = window.innerWidth, vh = window.innerHeight;
      const left = Math.min(Math.max(M, align === "right" ? b.right - w : b.left - 8), vw - w - M);
      const below = b.bottom + GAP, above = b.top - GAP - h;
      const top = below + h <= vh - M ? below : above >= M ? above : Math.max(M, vh - h - M);
      t.style.left = `${left}px`;
      t.style.top = `${top}px`;
      t.style.visibility = "visible";
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, align]);

  return (
    <span className="relative inline-block align-middle" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={btnRef}
        type="button"
        aria-label={`About ${title}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onFocus={show}
        onBlur={hide}
        className={trigger
          ? "cursor-pointer whitespace-nowrap rounded-sm underline decoration-dotted decoration-faint underline-offset-[3px] hover:text-fg hover:decoration-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          : "ml-1 inline-flex items-center justify-center rounded-sm align-[-2px] text-faint hover:text-fg"}
      >
        {trigger ?? <Info size={17} aria-hidden />}
      </button>
      {open && createPortal(
        <div
          ref={tipRef}
          id={id}
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={hide}
          style={{ position: "fixed", left: 0, top: 0, visibility: "hidden" }}
          className="z-50 block w-96 max-w-[calc(100vw-24px)] rounded-sm border border-line bg-panel p-3 text-left text-xs font-normal leading-relaxed text-fg shadow-lg"
        >
          <span className="mb-1 block font-semibold">{title}</span>
          {children && <span className="block text-muted">{children}</span>}
          {(uniq.length > 0 || sourceLabel) && (
            <span className="mt-2 block border-t border-line pt-2 text-xs">
              <span className="block text-faint">Data sources</span>
              {uniq.map((s) => (
                <a key={s} href={SOURCES[s].url} target={SOURCES[s].url.startsWith("/") ? undefined : "_blank"} rel="noreferrer" className="block text-fg underline decoration-line underline-offset-2 hover:decoration-fg">
                  {SOURCES[s].name}
                  <span className="text-faint"> · {SOURCES[s].provider}</span>
                </a>
              ))}
              {sourceLabel && (
                <span className="block">
                  {sourceUrl ? (
                    <a href={sourceUrl} target="_blank" rel="noreferrer" className="underline">{sourceLabel}</a>
                  ) : (
                    sourceLabel
                  )}
                </span>
              )}
            </span>
          )}
        </div>,
        document.body,
      )}
    </span>
  );
}
