/**
 * Shared control styles (D-091, D-092). One source for every text button on the platform so
 * primary and secondary buttons always share height, border box, type and states.
 *
 * - Buttons: 44px (`h-11`), 16px medium label, 1px border on both variants.
 * - Secondary buttons get a `panel-2` fill, a step lighter than both the page (`bg`) and
 *   modal/card (`panel`) surfaces, so their full box reads as clearly as the primary's solid fill.
 *   A border-only button looks shorter than a filled one of the same height.
 * - Fields are 40px (`h-10`); see `FIELD_H`.
 */
const BTN =
  "inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-sm border px-4 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export const btnPrimary = `${BTN} border-primary bg-primary text-primary-ink hover:opacity-90 disabled:hover:opacity-40`;
export const btnSecondary = `${BTN} border-line bg-panel-2 text-fg hover:border-muted disabled:hover:border-line`;

/** Height of every text, number, search, select and date/time field. */
export const FIELD_H = "h-10";
