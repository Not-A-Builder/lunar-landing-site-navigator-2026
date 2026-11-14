"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY } from "./theme-script";

/**
 * Light / dark theme (LOGS D-040). Light is the default. The choice lives on <html data-theme> and in
 * localStorage; an inline script in the root layout applies it before first paint (no flash).
 */
export type Theme = "light" | "dark";

const read = (): Theme => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");

function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => "light");
}

export function setTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* storage blocked: the choice lasts for this page view */
  }
}

/** Current value of a CSS colour token, e.g. cssVar("--accent"). */
export function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
