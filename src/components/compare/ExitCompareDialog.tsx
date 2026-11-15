"use client";

import { SignOut } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import { btnPrimary, btnSecondary } from "@/lib/ui";

/**
 * "Exit this comparison?" (D-130). Opened by "Exit comparison" on the comparison and by the app title in the
 * header while a comparison is open; confirming goes to site selection. Browser Back still returns here.
 */
export const useExitCompare = create<{ open: boolean; setOpen: (open: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

export function ExitCompareDialog() {
  const open = useExitCompare((s) => s.open);
  const setOpen = useExitCompare((s) => s.setOpen);
  const router = useRouter();
  const stay = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    stay.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && panel.current) {
        const f = [...panel.current.querySelectorAll<HTMLElement>("button")];
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, setOpen]);

  // Leaving the page (e.g. browser Back) never leaves the dialog open for next time.
  useEffect(() => () => setOpen(false), [setOpen]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] motion-safe:animate-[fade-in_160ms_ease-out]" onClick={() => setOpen(false)} aria-hidden />
      <div ref={panel} role="alertdialog" aria-modal="true" aria-labelledby="exit-compare-title" aria-describedby="exit-compare-desc"
        className="relative w-full max-w-md rounded-sm border border-line bg-panel p-6 shadow-2xl motion-safe:animate-[modal-in_180ms_cubic-bezier(0.2,0.7,0.2,1)]">
        <h2 id="exit-compare-title" className="text-xl font-semibold">Exit this comparison?</h2>
        <p id="exit-compare-desc" className="mt-2 text-sm leading-relaxed text-muted">
          You&apos;ll go back to site selection. Your mission assumptions and rating bands stay as they are, and the browser&apos;s Back button returns to this comparison.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button ref={stay} type="button" onClick={() => setOpen(false)} className={btnSecondary}>Stay</button>
          <button type="button" onClick={() => { setOpen(false); router.push("/"); }} className={btnPrimary}>
            <SignOut size={18} aria-hidden /> Exit comparison
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
