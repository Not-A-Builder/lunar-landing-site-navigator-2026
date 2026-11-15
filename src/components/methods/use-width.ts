"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Width of an element in CSS pixels, kept current with a ResizeObserver. Charts on the Data & methods
 * page draw in real pixels, so their text stays at 14 px on every screen instead of scaling with a viewBox.
 */
export function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
