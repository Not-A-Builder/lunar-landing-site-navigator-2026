"use client";

import { useId, useRef, useState } from "react";
import { SOURCES, type SourceId } from "@/lib/sources";

/**
 * Every data point gets one: helper text plus the data sources it was derived from (LOGS D-010, D-021).
 * Opens on hover, keyboard focus or tap, and stays open while the pointer is over it so links are clickable.
 */
export function InfoTip({
  title,
  children,
  sources,
  sourceLabel,
  sourceUrl,
  align = "left",
}: {
  title: string;
  children?: React.ReactNode;
  sources?: SourceId[];
  sourceLabel?: string;
  sourceUrl?: string | null;
  align?: "left" | "right";
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

  return (
    <span className="relative inline-block align-middle" onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        aria-label={`About ${title}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onFocus={show}
        onBlur={hide}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-line text-[10px] leading-none text-muted hover:border-muted hover:text-fg"
      >
        i
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={`absolute top-6 z-40 block w-80 max-w-[80vw] rounded-md border border-line bg-panel-2 p-3 text-left text-xs font-normal leading-relaxed text-fg shadow-xl ${align === "right" ? "right-0" : "left-0"}`}
        >
          <span className="mb-1 block font-semibold">{title}</span>
          {children && <span className="block text-muted">{children}</span>}
          {(uniq.length > 0 || sourceLabel) && (
            <span className="mt-2 block border-t border-line pt-2 text-[11px]">
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
        </span>
      )}
    </span>
  );
}
