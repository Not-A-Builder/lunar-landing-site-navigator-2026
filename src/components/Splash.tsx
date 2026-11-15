"use client";

import { useEffect, useRef, useState } from "react";
import { SITE_FULL_NAME, SITE_TITLE } from "@/lib/config";
import { BrandLogo } from "./BrandLogo";

/* The limb of a large Moon rising at the foot of the screen, echoing the favicon. Circle r = 2400 with its top at
   (800, 780) in a 1600 × 1000 box; the arc ends below the bottom edge at x = −300 and 1900. */
const LIMB_Y = 1046.9;
const LIMB_FILL = `M -300 ${LIMB_Y} A 2400 2400 0 0 1 1900 ${LIMB_Y} L 1900 1100 L -300 1100 Z`;
const RIM_LEFT = `M 800 780 A 2400 2400 0 0 0 -300 ${LIMB_Y}`;
const RIM_RIGHT = `M 800 780 A 2400 2400 0 0 1 1900 ${LIMB_Y}`;

/**
 * Decorative crater field (not data): x, y, radius in the 1600 × 1000 box, from a seeded power-law draw (many
 * small, few large), with a few larger ones placed where narrow screens still see them and none behind the footer
 * line. Fixed literals, so server and client render identical markup.
 */
const CRATERS: [number, number, number][] = [
  [700, 878, 46], [1180, 900, 40], [960, 905, 32], [300, 915, 30], [430, 958, 24], [1420, 930, 26], [1376, 871, 3], [408, 856, 3],
  [1661, 1015, 30], [1742, 1024, 3], [1592, 941, 4], [330, 943, 7], [-142, 1028, 2.5], [202, 870, 2.5], [834, 855, 3], [281, 1030, 3],
  [14, 977, 4.5], [446, 990, 6], [1538, 971, 6.5], [1650, 995, 6], [1539, 977, 7], [512, 816, 7.5], [21, 1011, 4], [1672, 977, 3],
  [211, 959, 5], [1298, 929, 5], [121, 956, 9.5], [1529, 945, 5.5], [1723, 987, 2.5], [123, 1034, 4.5], [280, 928, 12.5], [144, 899, 3],
  [-132, 1023, 3.5], [567, 900, 4], [648, 795, 9], [1653, 957, 4.5], [1362, 960, 3], [649, 845, 2.5], [745, 901, 3], [-132, 988, 13],
  [1233, 867, 3], [1735, 976, 2.5], [195, 999, 12], [202, 965, 10], [1538, 939, 3], [433, 874, 2.5], [1345, 884, 3.5], [286, 881, 4.5],
  [96, 1006, 30], [1092, 892, 4], [295, 894, 6.5], [481, 812, 4], [205, 879, 2.5], [1225, 930, 3], [376, 867, 3.5], [1239, 1000, 4],
  [663, 791, 4.5], [386, 994, 16], [214, 887, 3.5], [1596, 1019, 3], [195, 1009, 9.5], [1044, 825, 3], [1016, 926, 3], [-17, 958, 8],
  [1240, 827, 2.5], [575, 907, 3], [8, 992, 2.5], [1198, 980, 3.5], [-126, 1034, 5.5], [-36, 938, 2.5], [40, 990, 3.5], [339, 879, 4.5],
  [1632, 1026, 7], [276, 962, 4], [249, 850, 2.5], [409, 990, 3], [739, 911, 3], [1710, 1009, 3.5], [486, 869, 3], [1146, 956, 2.5],
  [1586, 950, 3], [370, 931, 5.5], [-122, 1009, 6], [602, 901, 3], [568, 846, 3], [-60, 1024, 2.5], [320, 853, 10], [1463, 930, 6],
  [1365, 867, 3], [907, 869, 3.5],
];

const limbY = (x: number) => 3180 - Math.sqrt(2400 * 2400 - (x - 800) * (x - 800));
const f1 = (n: number) => Math.round(n * 10) / 10;

/**
 * One crater as a fine line drawing, foreshortened by how close it sits to the limb (the surface is seen at a
 * grazing angle there). Light comes from the right, so the inner wall on the left is in shadow. Detail grows with
 * size, as on real craters: small ones are simple bowls; from ~8 px a flat floor; from ~16 px a terraced inner wall
 * and the faint edge of the ejecta blanket; from ~26 px a central peak. Fades in from the centre outward.
 */
function Crater({ c: [x, y, r] }: { c: [number, number, number] }) {
  const k = 0.16 + 0.55 * Math.min(1, (y - limbY(x)) / 240);
  const rx = r, ry = f1(r * k);
  const delay = 0.5 + (Math.min(1100, Math.abs(x - 800)) / 1100) * 2.8 + (r >= 16 ? 0 : 0.3);
  const line = { fill: "none", stroke: "var(--splash-fg)", vectorEffect: "non-scaling-stroke" as const };
  return (
    <g className="splash-crater" style={{ animationDelay: `${f1(delay)}s` }}>
      {r >= 16 && <ellipse cx={x} cy={y} rx={f1(rx * 1.5)} ry={f1(ry * 1.5)} {...line} strokeOpacity={0.12} strokeWidth={0.75} strokeDasharray="1 4" />}
      {r >= 4 && (
        <path
          d={`M ${x} ${f1(y - ry)} A ${rx} ${ry} 0 0 0 ${x} ${f1(y + ry)} A ${f1(rx * 0.5)} ${ry} 0 0 1 ${x} ${f1(y - ry)} Z`}
          fill="var(--splash-fg)"
          fillOpacity={0.07}
        />
      )}
      <ellipse cx={x} cy={y} rx={rx} ry={ry} {...line} strokeOpacity={r >= 16 ? 0.5 : 0.34} strokeWidth={1} />
      {r >= 16 && <ellipse cx={f1(x + rx * 0.05)} cy={y} rx={f1(rx * 0.86)} ry={f1(ry * 0.84)} {...line} strokeOpacity={0.2} strokeWidth={0.75} />}
      {r >= 8 && (
        <ellipse cx={f1(x + rx * 0.14)} cy={f1(y + ry * 0.08)} rx={f1(rx * 0.6)} ry={f1(ry * 0.55)} {...line} strokeOpacity={0.2} strokeWidth={0.75} strokeDasharray="2 3" />
      )}
      {r >= 26 && (
        <>
          <ellipse cx={f1(x + rx * 0.06)} cy={f1(y + ry * 0.04)} rx={f1(rx * 0.1)} ry={f1(ry * 0.14)} {...line} strokeOpacity={0.42} strokeWidth={0.75} />
          <ellipse cx={f1(x - rx * 0.07)} cy={f1(y + ry * 0.1)} rx={f1(rx * 0.05)} ry={f1(ry * 0.08)} {...line} strokeOpacity={0.32} strokeWidth={0.75} />
        </>
      )}
    </g>
  );
}

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
 * Load splash (D-144, D-145b), always in the dark theme: the wordmark, the full name, and a counter that runs
 * 1% → 100% in 5 s before the overlay fades into the page underneath (which loads meanwhile). It plays on every
 * full page load (first visit and each refresh), not on in-app navigation: the root layout stays mounted.
 * All motion is CSS (globals.css, "Splash"), so it starts at first paint even before React hydrates and still
 * clears if JavaScript fails. React only removes the overlay from the DOM once its exit animation ends.
 */
export function Splash() {
  const ref = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const remove = () => live && setGone(true);
    // Drop the overlay once its exit fade ends. In dev the stylesheet can arrive after hydration, so wait for the
    // event rather than inspecting animations now; the timer only covers a missed event (fade ends ~6 s after load).
    const onEnd = (e: AnimationEvent) => e.target === el && e.animationName === "splash-out" && remove();
    el.addEventListener("animationend", onEnd);
    const backup = window.setTimeout(remove, Math.max(1000, 7500 - performance.now()));
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
          <clipPath id="splash-disk">
            <path d={LIMB_FILL} />
          </clipPath>
        </defs>
        <g className="splash-rise">
          <path d={LIMB_FILL} fill="var(--splash-bg)" />
          <g clipPath="url(#splash-disk)">
            {CRATERS.map((c, i) => (
              <Crater key={i} c={c} />
            ))}
          </g>
          <path className="splash-rim" d={RIM_LEFT} pathLength={1} fill="none" stroke="var(--splash-fg)" strokeOpacity={0.7} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <path className="splash-rim" d={RIM_RIGHT} pathLength={1} fill="none" stroke="var(--splash-fg)" strokeOpacity={0.7} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
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
