"use client";

import { useSyncExternalStore } from "react";

/**
 * Light / dark theme (LOGS D-040). Every page load starts dark: the root layout renders
 * <html data-theme="dark"> (D-072). The header toggle switches theme for the rest of the visit; the
 * choice is not saved, so the next load is dark again.
 */
export type Theme = "light" | "dark";

const read = (): Theme => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");

function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => "dark");
}

export function setTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
}

/** Current value of a CSS colour token, e.g. cssVar("--accent"). */
export function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
