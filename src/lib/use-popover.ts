"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Open/close state for a popover anchored inside `ref`: closes on a pointer press outside it or on Escape.
 * Used by the persona menu, the date and time pickers and the filter menu. A popover rendered in a
 * portal attaches `panelRef` so presses inside it count as inside.
 */
export function usePopover<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { ref, panelRef, open, setOpen };
}
