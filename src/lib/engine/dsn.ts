/**
 * NASA Deep Space Network complexes (one 70 m antenna each), used to know when a DSN station can
 * see the Moon. Coordinates: DSN Telecommunications Link Design Handbook 810-005, module 301 Rev. P
 * (approved 2026-05-20), Table 5 "Geodetic Coordinates for DSN Stations With Respect to the WGS 84
 * Ellipsoid", p. 16. JPL Horizons resolves the same antennas via CENTER='-NN@399' (verified 2026-11-14).
 */
export const DSN_COMPLEXES = [
  { id: "gold", short: "Goldstone", place: "California", name: "Goldstone (DSS 14, 70 m)", horizonsCenter: "-14@399", lat: 35.4259009, lonE: 243.1104618, heightKm: 1.00139 },
  { id: "canb", short: "Canberra", place: "Australia", name: "Canberra (DSS 43, 70 m)", horizonsCenter: "-43@399", lat: -35.4024242, lonE: 148.9812673, heightKm: 0.688867 },
  { id: "madr", short: "Madrid", place: "Spain", name: "Madrid (DSS 63, 70 m)", horizonsCenter: "-63@399", lat: 40.4312098, lonE: 355.7519915, heightKm: 0.864816 },
] as const;

/**
 * Display order for charts: the order the Moon rises at each complex as Earth turns (east to west:
 * Canberra 149° E, then Madrid 4° W, then Goldstone 117° W), so the lanes read as a relay.
 * Values are indices into `DSN_COMPLEXES` (= the ephemeris column order).
 */
export const DSN_RELAY_ORDER = [1, 2, 0] as const;
