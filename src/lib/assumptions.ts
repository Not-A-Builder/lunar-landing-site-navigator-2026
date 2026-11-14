/**
 * Mission assumptions: the inputs a planner would set for their own vehicle. Defaults describe a
 * generic small solar-powered lander and are clearly labelled as examples in the UI. Changing any of
 * them recomputes every dependent metric. Each assumption lists why the default was chosen.
 */
export type Assumptions = {
  missionDays: number;
  mastHeightM: number;
  sunDiskThreshold: number;
  earthDiskThreshold: number;
  dsnMinElevDeg: number;
  panelAreaM2: number;
  panelEfficiency: number;
  panelTracking: "vertical-tracking" | "vertical-fixed" | "horizontal";
  panelFixedAzDeg: number;
  batteryWh: number;
  loadW: number;
  survivalLoadW: number;
  slopeToleranceDeg: number;
  approachAzDeg: number;
  footprintRadiusM: number;
  landerMassKg: number;
  footpadAreaM2: number;
  txPowerW: number;
  landerAntennaGainDbi: number;
  freqGHz: number;
  groundGTdBK: number;
  requiredEbN0dB: number;
  linkMarginDb: number;
  roverSpeedMPerH: number;
  roverWhPerKm: number;
  minSunElevForOpticalNavDeg: number;
};

export type AssumptionMeta = { label: string; unit: string; why: string; min?: number; max?: number; step?: number };

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  missionDays: 14,
  mastHeightM: 2,
  sunDiskThreshold: 0.5,
  earthDiskThreshold: 0.5,
  dsnMinElevDeg: 10,
  panelAreaM2: 2,
  panelEfficiency: 0.28,
  panelTracking: "vertical-tracking",
  panelFixedAzDeg: 0,
  batteryWh: 3000,
  loadW: 200,
  survivalLoadW: 60,
  slopeToleranceDeg: 10,
  approachAzDeg: 0,
  footprintRadiusM: 100,
  landerMassKg: 1500,
  footpadAreaM2: 0.6,
  txPowerW: 20,
  landerAntennaGainDbi: 20,
  freqGHz: 8.45,
  groundGTdBK: 55.0,
  requiredEbN0dB: 2.5,
  linkMarginDb: 3,
  roverSpeedMPerH: 200,
  roverWhPerKm: 150,
  minSunElevForOpticalNavDeg: 0.5,
};

export const ASSUMPTION_META: Record<keyof Assumptions, AssumptionMeta> = {
  missionDays: { label: "Mission length", unit: "days", min: 1, max: 60, step: 0.5, why: "Analysis window starts at the landing time. Artemis III plans a 6.5-day surface stay; one lunar day is ~29.5 days." },
  mastHeightM: { label: "Array / antenna height", unit: "m", min: 0, max: 50, step: 0.5, why: "Height of the solar array and antenna above the ground. Higher sees over nearby terrain (Bryant 2009)." },
  sunDiskThreshold: { label: "Sunlit if this much of the Sun's disk is visible", unit: "0–1", min: 0.01, max: 1, step: 0.05, why: "Liu et al. (2023) and Bryant (2009) use 0, 50% and 100% disk levels. 50% is the midpoint." },
  earthDiskThreshold: { label: "Earth in view if this much of Earth's disk is visible", unit: "0–1", min: 0.01, max: 1, step: 0.05, why: "Bryant (2009) reports DTE for 0, 50% and 100% of Earth's disk." },
  dsnMinElevDeg: { label: "Minimum Moon elevation at a DSN station", unit: "deg", min: 0, max: 30, step: 1, why: "Ground antennas avoid very low elevations (terrain masks, atmosphere). 10° is a common planning floor." },
  panelAreaM2: { label: "Solar array area", unit: "m²", min: 0.1, max: 50, step: 0.1, why: "Example value for a small lander." },
  panelEfficiency: { label: "Array efficiency", unit: "0–1", min: 0.05, max: 0.4, step: 0.01, why: "Typical triple-junction space cells are near 0.28–0.30 at beginning of life." },
  panelTracking: { label: "Array mounting", unit: "", why: "Vertical arrays rotating to face the Sun suit the low polar Sun (VIPER used vertical arrays)." },
  panelFixedAzDeg: { label: "Fixed array facing azimuth", unit: "deg", min: 0, max: 359, step: 1, why: "Only used for a fixed vertical array." },
  batteryWh: { label: "Battery capacity", unit: "Wh", min: 100, max: 50000, step: 100, why: "Example value. For scale, NASA's VIPER rover carries 5,420 Wh and was designed to survive about 50 h of shadow (NTRS 20240013903)." },
  loadW: { label: "Operating load", unit: "W", min: 10, max: 5000, step: 10, why: "Example value for a small lander." },
  survivalLoadW: { label: "Survival (heater) load in darkness", unit: "W", min: 5, max: 2000, step: 5, why: "Example value; heaters dominate in the dark." },
  slopeToleranceDeg: { label: "Lander slope tolerance", unit: "deg", min: 2, max: 20, step: 0.5, why: "Default 10° = NASA VIPER delivery requirement (max effective lander slope, VIPER AFPP p.7). Vehicle-specific." },
  approachAzDeg: { label: "Descent approach azimuth", unit: "deg", min: 0, max: 359, step: 1, why: "Direction the lander flies in from (affects glare and terrain clearance)." },
  footprintRadiusM: { label: "Landing ellipse radius", unit: "m", min: 10, max: 5000, step: 10, why: "Example 100 m (precision landing class)." },
  landerMassKg: { label: "Landed mass", unit: "kg", min: 50, max: 50000, step: 50, why: "Example value for a small lander." },
  footpadAreaM2: { label: "Total footpad area", unit: "m²", min: 0.05, max: 20, step: 0.05, why: "Example value (four pads)." },
  txPowerW: { label: "Transmitter RF power", unit: "W", min: 1, max: 200, step: 1, why: "Example X-band transmitter." },
  landerAntennaGainDbi: { label: "Lander antenna gain", unit: "dBi", min: 0, max: 45, step: 1, why: "Example medium-gain antenna." },
  freqGHz: { label: "Downlink frequency", unit: "GHz", min: 2, max: 32, step: 0.05, why: "X-band deep-space downlink allocation is around 8.4–8.5 GHz." },
  groundGTdBK: { label: "Ground station G/T", unit: "dB/K", min: 20, max: 70, step: 0.5, why: "DSN 34 m BWG at X-band: 68.25 dBi gain and 21.25 K system noise temperature (DSN 810-005 module 104, Rev P) give G/T ≈ 55.0 dB/K." },
  requiredEbN0dB: { label: "Required Eb/N0", unit: "dB", min: 0, max: 12, step: 0.1, why: "Depends on coding; modern turbo/LDPC codes need roughly 1–3 dB." },
  linkMarginDb: { label: "Design margin", unit: "dB", min: 0, max: 10, step: 0.5, why: "Safety margin kept in reserve." },
  roverSpeedMPerH: { label: "Rover average speed", unit: "m/h", min: 10, max: 5000, step: 10, why: "Example value including stops." },
  roverWhPerKm: { label: "Rover energy per km", unit: "Wh/km", min: 10, max: 5000, step: 10, why: "Example value on moderate slopes." },
  minSunElevForOpticalNavDeg: { label: "Minimum Sun elevation for optical navigation", unit: "deg", min: 0, max: 30, step: 0.5, why: "Camera-based terrain navigation needs some sunlight and shadow contrast." },
};
