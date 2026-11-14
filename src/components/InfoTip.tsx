"use client";

import { Info } from "@phosphor-icons/react";
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
        className="ml-1 inline-flex items-center justify-center rounded-sm align-[-2px] text-faint hover:text-fg"
      >
        <Info size={17} aria-hidden />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={`absolute top-7 z-40 block w-96 max-w-[85vw] rounded-sm border border-line bg-panel p-3 text-left text-xs font-normal leading-relaxed text-fg shadow-lg ${align === "right" ? "right-0" : "left-0"}`}
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
        </span>
      )}
    </span>
  );
}
