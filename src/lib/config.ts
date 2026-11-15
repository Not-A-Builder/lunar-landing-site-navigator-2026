/** App-wide constants. Change here, not inline. Decisions behind each value live in LOGS.md. */

/** Max scenarios (site + date) on the Compare page. User said "2 or 3"; 3 pending confirmation (LOGS D-007). */
export const MAX_COMPARE = 3;

/** Default analysis window shown on Site Details (days). Covers one full synodic month (~29.53 d). */
export const DEFAULT_WINDOW_DAYS = 30;

/** Default ephemeris sampling step for timelines. */
export const DEFAULT_STEP = "1h";

/** Platform name (D-143). VISTA = Visibility & Illumination Site Trade-off Analyzer. */
export const SITE_TITLE = "Lunar VISTA";
export const SITE_FULL_NAME = "Visibility & Illumination Site Trade-off Analyzer";

/** Wordmark per theme (owner-supplied, D-143). Intrinsic size of the SVG artboards. */
export const LOGO = {
  dark: { src: "/brand/lunar-vista-dark.svg", width: 1663, height: 240 },
  light: { src: "/brand/lunar-vista-light.svg", width: 1660, height: 240 },
} as const;

/**
 * Where the capitals of LUNAR VISTA sit inside the wordmark artboards (both 240 high), measured from the SVGs'
 * opaque pixels: caps 40–180; the swoosh under VISTA reaches 214. Used to centre the mark on the lettering.
 */
export const LOGO_CAPS = { top: 40, bottom: 180, artboard: 240 } as const;

/** Square mark (the favicon artwork, same in both themes), shown left of the wordmark in the header (D-143). */
export const LOGO_MARK = "/brand/lunar-vista-mark.svg";
