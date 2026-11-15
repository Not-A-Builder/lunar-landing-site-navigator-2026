"use client";

import { useEffect, useRef, useState } from "react";
import { SITE_FULL_NAME, SITE_TITLE } from "@/lib/config";
import { SPLASH_KEY, SPLASH_SEEN_SCRIPT } from "@/lib/splash";
import { BrandLogo } from "./BrandLogo";

/* The limb of a large Moon rising at the foot of the screen, echoing the favicon. Circle r = 2400 with its top at
   (800, 780) in a 1600 × 1000 box; the arc ends below the bottom edge at x = −300 and 1900. */
const LIMB_Y = 1046.9;
const LIMB_FILL = `M -300 ${LIMB_Y} A 2400 2400 0 0 1 1900 ${LIMB_Y} L 1900 1100 L -300 1100 Z`;
const RIM_LEFT = `M 800 780 A 2400 2400 0 0 0 -300 ${LIMB_Y}`;
const RIM_RIGHT = `M 800 780 A 2400 2400 0 0 1 1900 ${LIMB_Y}`;

/** Each word of the full name with its VISTA initial picked out. */
function FullName() {
  return (
    <>
      {SITE_FULL_NAME.split(" ").map((w, i) => (
        <span key={i}>
          {i > 0 && " "}
          {/^[A-Z]/.test(w) ? <><b className="splash-initial">{w[0]}</b>{w.slice(1)}</> : w}
        </span>
      ))}
    </>
  );
}

/**
 * First-load splash (D-144), always in the dark theme: the wordmark, the full name, and a counter that runs
 * 1% → 100% in 4 s before the overlay fades into the page underneath (which loads meanwhile).
 * All motion is CSS (globals.css, "Splash"), so it starts at first paint even before React hydrates and still
 * clears if JavaScript fails. React only removes the overlay from the DOM once its exit animation ends.
 */
/**
 * Marks <html> before first paint when this tab has already seen the splash, so CSS hides it with no flash.
 * Rendered into the server HTML only: React warns about <script> it renders on the client (e.g. on hot reload),
 * and React 19 hydration skips the unmatched tag.
 */
export function SplashGate() {
  if (typeof window !== "undefined") return null;
  return <script dangerouslySetInnerHTML={{ __html: SPLASH_SEEN_SCRIPT }} />;
}

export function Splash() {
  const ref = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const remove = () => live && setGone(true);
    if (document.documentElement.dataset.splash === "seen") {
      queueMicrotask(remove);
      return () => void (live = false);
    }
    try {
      sessionStorage.setItem(SPLASH_KEY, "1");
    } catch {
      /* private mode etc.: the splash simply plays again next load */
    }
    // Drop the overlay once its exit fade ends. In dev the stylesheet can arrive after hydration, so wait for the
    // event rather than inspecting animations now; the timer only covers a missed event (fade ends ~5 s after load).
    const onEnd = (e: AnimationEvent) => e.target === el && e.animationName === "splash-out" && remove();
    el.addEventListener("animationend", onEnd);
    const backup = window.setTimeout(remove, Math.max(1000, 6500 - performance.now()));
    return () => {
      live = false;
      el.removeEventListener("animationend", onEnd);
      window.clearTimeout(backup);
    };
  }, []);

  if (gone) return null;
  return (
    <div ref={ref} className="splash" role="status" aria-label={`Loading ${SITE_TITLE}`}>
      <svg className="splash-moon" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <defs>
          <radialGradient id="splash-glow">
            <stop offset="0" style={{ stopColor: "var(--splash-fg)", stopOpacity: 0.16 }} />
            <stop offset="1" style={{ stopColor: "var(--splash-fg)", stopOpacity: 0 }} />
          </radialGradient>
          <linearGradient id="splash-surface" x1="0" y1="780" x2="0" y2="1000" gradientUnits="userSpaceOnUse">
            <stop offset="0" style={{ stopColor: "var(--splash-surface)" }} />
            <stop offset="1" style={{ stopColor: "var(--splash-bg)" }} />
          </linearGradient>
          <linearGradient id="splash-rim" x1="-300" y1="0" x2="1900" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0.08" style={{ stopColor: "var(--splash-fg)", stopOpacity: 0 }} />
            <stop offset="0.5" style={{ stopColor: "var(--splash-fg)", stopOpacity: 0.85 }} />
            <stop offset="0.92" style={{ stopColor: "var(--splash-fg)", stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <g className="splash-rise">
          <ellipse className="splash-glow" cx="800" cy="780" rx="760" ry="266" fill="url(#splash-glow)" />
          <path d={LIMB_FILL} fill="url(#splash-surface)" />
          <path className="splash-rim" d={RIM_LEFT} pathLength={1} fill="none" stroke="url(#splash-rim)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <path className="splash-rim" d={RIM_RIGHT} pathLength={1} fill="none" stroke="url(#splash-rim)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>

      <div className="splash-content">
        <BrandLogo theme="dark" preload className="splash-logo" />
        <p className="splash-name">
          <FullName />
        </p>
        <div className="splash-progress" aria-hidden>
          <div className="splash-meta">
            <span>Loading</span>
            <span className="splash-count" />
          </div>
          <div className="splash-track">
            <div className="splash-fill" />
          </div>
        </div>
      </div>

      <p className="splash-foot">NASA Space Apps Challenge 2026</p>
    </div>
  );
}
