/**
 * NASA Deep Space Network complexes (one 70 m antenna each), used to know when a DSN station can
 * see the Moon. Coordinates: DSN Telecommunications Link Design Handbook 810-005, module 301 Rev. P
 * (approved 2026-05-20), Table 5 "Geodetic Coordinates for DSN Stations With Respect to the WGS 84
 * Ellipsoid", p. 16. JPL Horizons resolves the same antennas via CENTER='-NN@399' (verified 2026-11-14).
 */
export const DSN_COMPLEXES = [
  { id: "gold", name: "Goldstone (DSS 14, 70 m)", horizonsCenter: "-14@399", lat: 35.4259009, lonE: 243.1104618, heightKm: 1.00139 },
  { id: "canb", name: "Canberra (DSS 43, 70 m)", horizonsCenter: "-43@399", lat: -35.4024242, lonE: 148.9812673, heightKm: 0.688867 },
  { id: "madr", name: "Madrid (DSS 63, 70 m)", horizonsCenter: "-63@399", lat: 40.4312098, lonE: 355.7519915, heightKm: 0.864816 },
] as const;
