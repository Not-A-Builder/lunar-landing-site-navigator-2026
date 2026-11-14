/**
 * Physical constants. Each value lists its source id (see src/lib/sources.ts).
 * Values are definitional standards or NASA fact-sheet numbers, verified 2026-11-14 (LOGS D-022).
 */
export const CONST = {
  /** LOLA reference sphere: all LOLA DEM heights are relative to this radius. [lola-pds] */
  moonRadiusKm: 1737.4,
  /** Nominal solar radius (IAU 2015 Resolution B3), also NSSDCA Sun fact sheet. [nssdc-sun] */
  sunRadiusKm: 695_700,
  /** Earth equatorial radius. [nssdc-earth] */
  earthRadiusKm: 6378.137,
  /** Lunar surface gravity, m/s². [nssdc-moon] */
  moonGravity: 1.62,
  /** Total solar irradiance at 1 AU, W/m². [nssdc-moon] */
  solarConstant: 1361,
  /** Bond albedo of the Moon. [nssdc-moon] */
  bondAlbedo: 0.11,
  /** Speed of light, km/s (exact). Printed in every Horizons header. [jpl-horizons] */
  cKmS: 299_792.458,
  /** Stefan–Boltzmann constant, W m⁻² K⁻⁴ (CODATA, exact since 2019). */
  sigma: 5.670374419e-8,
} as const;

export type Constants = typeof CONST;
