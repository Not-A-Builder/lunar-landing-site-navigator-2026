/** Interval logic over boolean time series. Interval edges are linearly interpolated between samples. */

export type Interval = { start: number; end: number };

/**
 * Turn a signed margin series (value > 0 means "condition holds") into intervals.
 * Crossing times are interpolated between samples, so edges are sharper than the sampling step.
 */
export function intervalsFromMargin(t: ArrayLike<number>, margin: (i: number) => number): Interval[] {
  const out: Interval[] = [];
  const n = t.length;
  let open: number | null = null;
  let prev = margin(0);
  if (prev > 0) open = t[0];
  for (let i = 1; i < n; i++) {
    const cur = margin(i);
    if ((prev > 0) !== (cur > 0)) {
      const f = prev === cur ? 0 : prev / (prev - cur);
      const tc = t[i - 1] + (t[i] - t[i - 1]) * Math.max(0, Math.min(1, f));
      if (cur > 0) open = tc;
      else if (open !== null) {
        out.push({ start: open, end: tc });
        open = null;
      }
    }
    prev = cur;
  }
  if (open !== null) out.push({ start: open, end: t[n - 1] });
  return out;
}

export const hours = (ms: number) => ms / 3_600_000;

export function totalMs(iv: Interval[]) {
  return iv.reduce((a, b) => a + (b.end - b.start), 0);
}

export function longestMs(iv: Interval[]) {
  return iv.reduce((a, b) => Math.max(a, b.end - b.start), 0);
}

/** Gaps between intervals inside [from, to] (the complement). */
export function complement(iv: Interval[], from: number, to: number): Interval[] {
  const out: Interval[] = [];
  let cur = from;
  for (const x of iv) {
    if (x.start > cur) out.push({ start: cur, end: Math.min(x.start, to) });
    cur = Math.max(cur, x.end);
  }
  if (cur < to) out.push({ start: cur, end: to });
  return out.filter((g) => g.end > g.start);
}

export function intersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    const s = Math.max(a[i].start, b[j].start);
    const e = Math.min(a[i].end, b[j].end);
    if (e > s) out.push({ start: s, end: e });
    if (a[i].end < b[j].end) i++;
    else j++;
  }
  return out;
}

/** Interval containing time t, if any. */
export function containing(iv: Interval[], t: number) {
  return iv.find((x) => x.start <= t && t <= x.end) ?? null;
}

/** Next interval starting after t. */
export function nextAfter(iv: Interval[], t: number) {
  return iv.find((x) => x.start > t) ?? null;
}
