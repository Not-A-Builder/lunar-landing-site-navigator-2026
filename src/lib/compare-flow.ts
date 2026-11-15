import { serialiseScenarios, type Scenario } from "@/lib/scenarios";

/**
 * "Select scenarios to compare" flow (D-128). The site selection page runs as a focused step of the
 * comparison when its URL carries `back` (the page to return to): `/?s=A&t=…&back=/site/x?t=…`.
 * The header loses its page links and shows the title and a close (×) instead; closing returns to `back`.
 */

/** Only same-origin paths count as a return target (no `//host` or absolute URLs). */
export const validBack = (back: string | null): string | null => (back && back.startsWith("/") && !back.startsWith("//") ? back : null);

/**
 * URL that opens the flow with `scenarios` already saved and the next slot's landing time set to `t`.
 * `edit` opens that saved scenario in the form instead, ready to change (a card clicked on Compare, D-131).
 */
export function compareFlowHref(scenarios: Scenario[], back: string, t?: string, edit?: number): string {
  const q = [
    scenarios.length ? `s=${serialiseScenarios(scenarios)}` : "",
    t ? `t=${encodeURIComponent(t)}` : "",
    edit !== undefined ? `edit=${edit}` : "",
    `back=${encodeURIComponent(back)}`,
  ].filter(Boolean);
  return `/?${q.join("&")}`;
}

// Set when the flow is opened from inside the app, so closing can step back in history (no duplicate
// entry for the page we return to). A reload or a shared link has no entry, so closing replaces instead.
let entry: { back: string; n: number } | null = null;
let entries = 0;

/** Call when a link opens the flow. Each entry also tells the selection page to start a fresh form. */
export function markFlowEntry(back: string) {
  entry = { back, n: ++entries };
}

/** Changes every time the flow is opened from inside the app. */
export const flowEntryId = () => entries;

type Nav = { back: () => void; replace: (href: string, opts?: { scroll?: boolean }) => void };

/** Leaves the flow: back to where it was opened from. */
export function exitCompareFlow(router: Nav, back: string) {
  if (entry?.back === back) {
    entry = null;
    router.back();
  } else router.replace(back, { scroll: false });
}
