/**
 * Edge rulers for the south-polar map: where circles of latitude cross the left/right edges and
 * meridians cross the top/bottom edges of the view. Pure maths on a pixel → (lon, lat) function, so
 * it works for any projection and is unit-testable.
 */

export type Tick = { pos: number; label: string };
export type RulerTicks = { top: Tick[]; bottom: Tick[]; left: Tick[]; right: Tick[] };

const LAT_STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 15, 30];
const LON_STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 45, 90];
/** minimum spacing between labels along an edge, px */
const MIN_GAP = 62;
/** average spacing used to choose the step (thinning then removes the few labels that still crowd) */
const STEP_GAP = 54;
/** keep labels clear of the corners, px */
const CORNER = 30;
const SAMPLE_PX = 2;

/** decimals needed to print multiples of `step` exactly (0.25 → 2, 0.5 → 1, 5 → 0) */
const decimals = (step: number) => (Number.isInteger(step) ? 0 : (String(step).split(".")[1]?.length ?? 0));

export function fmtRulerLat(lat: number, step: number) {
  const d = decimals(step);
  const a = Math.abs(lat);
  if (a < 1e-9) return "0°";
  return `${a.toFixed(d)}°${lat < 0 ? "S" : "N"}`;
}

export function fmtRulerLon(lon: number, step: number) {
  const d = decimals(step);
  const l = ((((lon + 180) % 360) + 360) % 360) - 180; // [-180, 180)
  const a = Math.abs(l);
  if (a < 1e-9) return "0°";
  if (Math.abs(a - 180) < 1e-9) return "180°";
  return `${a.toFixed(d)}°${l < 0 ? "W" : "E"}`;
}

/** Crossings of multiples of `step` along a sampled edge; `values` must be continuous (unwrapped). */
function crossings(values: number[], step: number, length: number): { pos: number; value: number }[] {
  const out: { pos: number; value: number }[] = [];
  const n = values.length;
  for (let i = 1; i < n; i++) {
    const a = values[i - 1], b = values[i];
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) continue;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + 1e-9; k++) {
      const v = k * step;
      if ((v === lo && i > 1) || v > hi) continue; // count a crossing exactly on a sample once
      const t = (v - a) / (b - a);
      const pos = ((i - 1 + t) / (n - 1)) * length;
      if (pos >= CORNER && pos <= length - CORNER) out.push({ pos, value: v });
    }
  }
  return out.sort((x, y) => x.pos - y.pos);
}

/** Drop labels that would overlap the previous one. */
function thin(ticks: { pos: number; value: number }[]) {
  const out: typeof ticks = [];
  for (const t of ticks) if (!out.length || t.pos - out[out.length - 1].pos >= MIN_GAP) out.push(t);
  return out;
}

function unwrap(lons: number[]) {
  const out = lons.slice();
  for (let i = 1; i < out.length; i++) {
    while (out[i] - out[i - 1] > 180) out[i] -= 360;
    while (out[i] - out[i - 1] < -180) out[i] += 360;
  }
  return out;
}

function pickStep(steps: number[], edges: { values: number[]; length: number }[]) {
  for (const step of steps) {
    const ok = edges.every(({ values, length }) => {
      const c = crossings(values, step, length);
      return c.length <= Math.max(1, Math.floor((length - 2 * CORNER) / STEP_GAP));
    });
    if (ok) return step;
  }
  return steps[steps.length - 1];
}

/**
 * @param lonLatAt pixel (x, y) → [lon, lat] in degrees, or null outside the projection
 * @param w, h view size in px
 */
export function computeRulerTicks(lonLatAt: (x: number, y: number) => [number, number] | null, w: number, h: number): RulerTicks {
  const sample = (len: number, at: (p: number) => [number, number] | null) => {
    const n = Math.max(2, Math.ceil(len / SAMPLE_PX) + 1);
    const pts = Array.from({ length: n }, (_, i) => at((i / (n - 1)) * len));
    return { lon: pts.map((p) => (p ? p[0] : NaN)), lat: pts.map((p) => (p ? p[1] : NaN)) };
  };
  const top = sample(w, (x) => lonLatAt(x, 0));
  const bottom = sample(w, (x) => lonLatAt(x, h));
  const left = sample(h, (y) => lonLatAt(0, y));
  const right = sample(h, (y) => lonLatAt(w, y));

  const latEdges = [{ values: left.lat, length: h }, { values: right.lat, length: h }];
  const lonEdges = [{ values: unwrap(top.lon), length: w }, { values: unwrap(bottom.lon), length: w }];
  const latStep = pickStep(LAT_STEPS, latEdges);
  const lonStep = pickStep(LON_STEPS, lonEdges);

  const lat = (e: { values: number[]; length: number }) => thin(crossings(e.values, latStep, e.length)).map((c) => ({ pos: c.pos, label: fmtRulerLat(c.value, latStep) }));
  const lon = (e: { values: number[]; length: number }) => thin(crossings(e.values, lonStep, e.length)).map((c) => ({ pos: c.pos, label: fmtRulerLon(c.value, lonStep) }));
  return { left: lat(latEdges[0]), right: lat(latEdges[1]), top: lon(lonEdges[0]), bottom: lon(lonEdges[1]) };
}
