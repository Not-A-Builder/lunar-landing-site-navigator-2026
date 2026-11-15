/**
 * Time series of Sun/Earth geometry and visibility for one site over a window.
 * Everything downstream (windows, metrics, charts) is derived from this.
 */
import { CONST } from "./constants";
import { EphemerisSet } from "./ephemeris";
import { angularRadius, diskAboveHorizon, diskOverlapFraction, separation, topocentric, type Site } from "./geometry";
import { horizonAt, type HorizonMask } from "./terrain";

export type Series = {
  n: number;
  stepMs: number;
  t: Float64Array;
  sunAz: Float32Array;
  sunEl: Float32Array;
  /** terrain horizon elevation in the Sun's direction */
  sunHz: Float32Array;
  /** visible fraction of the solar disk (terrain + Earth eclipse), 0–1 */
  sunFrac: Float32Array;
  /** fraction of the solar disk covered by Earth (solar eclipse seen from the Moon), 0–1 */
  eclipse: Float32Array;
  sunAU: Float32Array;
  earthAz: Float32Array;
  earthEl: Float32Array;
  earthHz: Float32Array;
  /** visible fraction of Earth's disk above the terrain horizon, 0–1 */
  earthFrac: Float32Array;
  earthKm: Float32Array;
  /** sub-Earth point = optical libration (deg) */
  libLon: Float32Array;
  libLat: Float32Array;
  /** number of DSN complexes with the Moon above `dsnMinEl` */
  dsnCount: Uint8Array;
  /** Moon elevation above the local horizon at each DSN complex (deg), in `DSN_COMPLEXES` order */
  dsnEl: [Float32Array, Float32Array, Float32Array];
};

export type SeriesOptions = { dsnMinEl: number };

export function computeSeries(
  eph: EphemerisSet,
  site: Site,
  mask: HorizonMask,
  startMs: number,
  endMs: number,
  stepMs: number,
  opts: SeriesOptions,
): Series {
  const n = Math.max(1, Math.floor((endMs - startMs) / stepMs) + 1);
  const s: Series = {
    n, stepMs,
    t: new Float64Array(n),
    sunAz: new Float32Array(n), sunEl: new Float32Array(n), sunHz: new Float32Array(n),
    sunFrac: new Float32Array(n), eclipse: new Float32Array(n), sunAU: new Float32Array(n),
    earthAz: new Float32Array(n), earthEl: new Float32Array(n), earthHz: new Float32Array(n),
    earthFrac: new Float32Array(n), earthKm: new Float32Array(n),
    libLon: new Float32Array(n), libLat: new Float32Array(n), dsnCount: new Uint8Array(n),
    dsnEl: [new Float32Array(n), new Float32Array(n), new Float32Array(n)],
  };
  const R = CONST.moonRadiusKm;
  for (let i = 0; i < n; i++) {
    const t = startMs + i * stepMs;
    const e = eph.sample(t);
    const sun = topocentric(site, e.sun, R);
    const earth = topocentric(site, e.earth, R);
    const rS = angularRadius(CONST.sunRadiusKm, sun.distKm);
    const rE = angularRadius(CONST.earthRadiusKm, earth.distKm);
    const sunHz = horizonAt(mask, sun.az);
    const earthHz = horizonAt(mask, earth.az);
    const ecl = diskOverlapFraction(rS, rE, separation(sun, earth));
    s.t[i] = t;
    s.sunAz[i] = sun.az; s.sunEl[i] = sun.el; s.sunHz[i] = sunHz;
    s.eclipse[i] = ecl;
    s.sunFrac[i] = diskAboveHorizon(sun.el, rS, sunHz) * (1 - ecl);
    s.sunAU[i] = sun.distKm / 149_597_870.7;
    s.earthAz[i] = earth.az; s.earthEl[i] = earth.el; s.earthHz[i] = earthHz;
    s.earthFrac[i] = diskAboveHorizon(earth.el, rE, earthHz);
    s.earthKm[i] = earth.distKm;
    s.libLon[i] = e.earth.lon > 180 ? e.earth.lon - 360 : e.earth.lon;
    s.libLat[i] = e.earth.lat;
    s.dsnEl[0][i] = e.dsn[0]; s.dsnEl[1][i] = e.dsn[1]; s.dsnEl[2][i] = e.dsn[2];
    s.dsnCount[i] = (e.dsn[0] >= opts.dsnMinEl ? 1 : 0) + (e.dsn[1] >= opts.dsnMinEl ? 1 : 0) + (e.dsn[2] >= opts.dsnMinEl ? 1 : 0);
  }
  return s;
}
