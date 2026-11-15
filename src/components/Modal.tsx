"use client";

import { X } from "@phosphor-icons/react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { btnPrimary, btnSecondary } from "@/lib/ui";

/**
 * Dialog with a sticky header and footer and a body that scrolls on its own (D-083). It is at most 80%
 * of the page content width (the 1600 px header container) and 80% of the viewport height.
 * Escape or a click on the backdrop closes it only when there is nothing unsaved (`dirty` false);
 * otherwise the footer's Discard / Save decide.
 */
export function Modal({ open, title, description, onClose, dirty, footer, children, labelledBy }: {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  dirty?: boolean;
  footer: ReactNode;
  children: ReactNode;
  labelledBy?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const id = labelledBy ?? "modal-title";

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !dirty) onClose();
      if (e.key === "Tab" && panel.current) {
        // keep focus inside the dialog
        const f = [...panel.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])")];
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, dirty, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] motion-safe:animate-[fade-in_160ms_ease-out]" onClick={() => !dirty && onClose()} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="relative flex max-h-[80vh] w-full flex-col overflow-hidden rounded-sm border border-line bg-panel shadow-2xl sm:w-[calc(min(100vw-32px,1568px)*0.8)] motion-safe:animate-[modal-in_180ms_cubic-bezier(0.2,0.7,0.2,1)]"
      >
        <header className="sticky top-0 z-10 flex items-start gap-4 border-b border-line bg-panel px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={id} className="text-xl font-semibold">{title}</h2>
            {description && <div className="mt-1 max-w-3xl text-sm text-muted">{description}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label={dirty ? "Close and discard edits" : "Close"} title={dirty ? "Close and discard edits" : "Close"} className="-mr-2 rounded-sm p-2 text-muted hover:bg-panel-2 hover:text-fg">
            <X size={20} aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
        <footer className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-line bg-panel px-6 py-3.5">{footer}</footer>
      </div>
    </div>,
    document.body,
  );
}

/** Footer buttons shared by the editors: Reset to defaults (left), Discard edits and Save changes (right). */
export function EditorFooter({ dirty, invalid, isDefault, onReset, onDiscard, onSave, status }: {
  dirty: boolean; invalid: boolean; isDefault: boolean; onReset: () => void; onDiscard: () => void; onSave: () => void; status?: ReactNode;
}) {
  return (
    <>
      <button type="button" onClick={onReset} disabled={isDefault} title={isDefault ? "Everything is already at its default" : "Put every value back to its default (still needs Save)"} className={btnSecondary}>
        Reset to defaults
      </button>
      <span className="text-sm text-faint" aria-live="polite">{status}</span>
      <div className="ml-auto flex gap-2">
        <button type="button" onClick={onDiscard} className={btnSecondary}>
          {dirty ? "Discard edits" : "Close"}
        </button>
        <button type="button" onClick={onSave} disabled={!dirty || invalid} title={invalid ? "Fix the highlighted fields first" : !dirty ? "No changes yet" : undefined} className={btnPrimary}>
          Save changes
        </button>
      </div>
    </>
  );
}
