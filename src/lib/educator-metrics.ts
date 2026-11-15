/**
 * The Educator persona's metric selection (D-118): a slightly less technical version of the Mission planner
 * view. Educators see more metrics than enthusiasts (every enthusiast pick is here too) but skip the most
 * obscure planner ones (pixel counts, model cadence, reference frames, raw radio-link budgets and the like).
 * A curated presentation choice: it picks which computed metrics to show and how to name and explain them,
 * and adds no values of its own.
 *
 * - `label`: the metric's name for educators, at high-school / first-year-university level.
 * - `tip`: its tooltip, at the same level: what it is, how the app gets it, and any caveat. It describes
 *   what `src/lib/metrics/compute.ts` actually does, so keep the two in step. Thresholds users can change
 *   are called mission assumptions or "by default"; the only figures are fixed ones the app itself uses
 *   (the 2026–2029 multi-year span, the 1737.4 km reference sphere, 5° and 15° slope cut-offs, the 18.6-year
 *   cycle, the 2 km NASA heritage distance).
 *
 * Metrics not listed here are hidden for educators. Order on the page follows the catalog.
 */
export type EducatorPick = { label: string; tip: string };

export const EDUCATOR_METRICS: Record<string, EducatorPick> = {
  // Overall decision metrics
  "overall.joint-sunlit-dte-window": {
    label: "Sunlight and Earth contact at the same time",
    tip: "Time in the mission when the site is sunlit and Earth is above the local horizon, so a lander has solar power and a direct-to-Earth (DTE) radio path together. Found by overlapping the sunlit windows with the Earth-in-view windows, both computed every 10 minutes from JPL Horizons positions and the LOLA terrain horizon.",
  },
  "overall.longest-gap-without-simultaneous-sun-and-dte-visibility": {
    label: "Longest gap without sunlight and Earth together",
    tip: "The longest continuous stretch outside those joint windows, when the lander is missing power, contact, or both. It drives how much battery storage and onboard autonomy the mission needs.",
  },
  "overall.feasible-operational-hours-total": {
    label: "Time with power, Earth and a ground station",
    tip: "Joint sunlight-and-Earth time, narrowed to when at least one Deep Space Network (DSN) complex (Goldstone, Madrid or Canberra) has the Moon high enough above its horizon to track it. Closer to the time a real mission could both operate and talk to Earth.",
  },
  "overall.mission-constraint-compatibility": {
    label: "Mission checks passed",
    tip: "Four pass/fail checks: the slope is within the lander's tilt tolerance, the battery can outlast the longest darkness, Earth comes into view at least once, and the modelled battery never runs empty. The limits come from the mission assumptions.",
  },
  "overall.comparison-against-site-alternatives": {
    label: "Sunlight rank among south-pole sites",
    tip: "This site's rank among the app's curated south-pole sites by sunlit share of the time, averaged over 2026 to 2029 with the same terrain-horizon method. It compares long-term averages; use Compare for specific dates.",
  },
  "overall.sensitivity-to-time-shift": {
    label: "Effect of landing a day early or late",
    tip: "The analysis is re-run with the landing one day earlier and one day later; this is the largest change in total sunlit time, also as a percentage. Low sensitivity means the result doesn't hinge on the exact date.",
  },
  "overall.sensitivity-to-mast-height": {
    label: "Benefit of raising the equipment",
    tip: "The analysis is repeated with the panel or antenna raised on masts of increasing height; this is the extra sunlit time gained per metre. Raised equipment sees over nearby ridges that shadow the ground.",
  },
  "overall.risk-weighted-percentile-performance": {
    label: "Spread of outcomes across landing dates",
    tip: "The mission's sunlit share is recomputed for a landing on each of the 365 days from the chosen date. P5, P50 and P95 are the 5th, 50th (median) and 95th percentiles of those results, showing how much the choice of date matters.",
  },
  "overall.constraint-failure-explanation": {
    label: "Why checks fail",
    tip: "The failing items from the mission checks, with the numbers behind each one, for example how far the longest darkness exceeds the time the battery can last.",
  },
  "overall.joint-illumination-and-slope-qualifying-area": {
    label: "Ground that is both sunny and gentle",
    tip: "The area of the analysis grid around the site whose cells are no steeper than the lander's slope tolerance and sunlit at least half of the next year, following the screening method of Liu et al. (2023). More such ground leaves room for landing error.",
  },

  // Sun
  "sun.sun-azimuth": {
    label: "Sun direction (azimuth)",
    tip: "The Sun's compass bearing from the site at landing, in degrees clockwise from north, from JPL Horizons. Near the pole the Sun circles the whole horizon over each lunar day.",
  },
  "sun.sun-elevation": {
    label: "Sun height above the horizon (elevation)",
    tip: "The Sun's angle above the flat (geometric) horizon at landing, from JPL Horizons. Near the pole the Sun stays low, so the terrain horizon in that direction (given in the note) decides whether it is actually visible.",
  },
  "sun.instantaneous-terrain-shadow-state": {
    label: "Sunlit or shadowed at landing",
    tip: "Whether enough of the Sun's disk clears the terrain horizon at landing to count as sunlit (by default, at least half the disk). \"Partly lit\" means some of the disk shows, but less than that threshold.",
  },
  "sun.sunrise-sunset-crossings": {
    label: "Sunrises and sunsets",
    tip: "How many times the Sun crosses the terrain horizon during the mission, and when the next crossing is. Because the polar Sun skims along the horizon, a small ridge can add an extra sunset and sunrise.",
  },
  "sun.solar-availability-fraction": {
    label: "Sunlit share of the mission",
    tip: "The fraction of the mission's 10-minute time steps in which the Sun counts as visible above the terrain horizon. It measures time in light, not energy; see the solar array output for energy.",
  },
  "sun.full-vs-partial-solar-illumination": {
    label: "Full, partial or no Sun",
    tip: "How the mission's time splits between the whole solar disk visible, only part of it visible (cut by the horizon), and none. The Sun is about half a degree across, so at grazing angles it is often partly hidden.",
  },
  "sun.longest-continuous-darkness": {
    label: "Longest darkness",
    tip: "The longest unbroken stretch of the mission without sunlight. A solar-powered lander must survive it on stored energy, so it sets battery size and heater needs.",
  },
  "sun.total-dark-duration": {
    label: "Total time in darkness",
    tip: "All the dark time in the mission added up (mission length minus sunlit time). Unlike the longest darkness, short dark gaps count too.",
  },
  "sun.longest-continuous-sunlight": {
    label: "Longest sunlight",
    tip: "The longest unbroken stretch of sunlight in the mission: the best window for recharging and for power-hungry work.",
  },
  "sun.illumination-seasonality-multiyear-average": {
    label: "Average sunlight over several years",
    tip: "The sunlit share averaged over 2026 to 2029, which smooths out the Moon's small seasons (its spin axis is only slightly tilted, but near the pole that matters). The detail shows the range between the best and worst months.",
  },
  "sun.solar-eclipse-intervals": {
    label: "Eclipses of the Sun by Earth",
    tip: "Times in the mission when Earth passes in front of the Sun as seen from the site; from Earth this is a lunar eclipse. Solar power drops to zero while it lasts.",
  },
  "sun.disk-weighted-annual-illumination-rate": {
    label: "Disk-weighted sunlight rate",
    tip: "The time average of the visible fraction of the Sun's disk over 2026 to 2029, where a half-hidden Sun counts as half. This is the annual illumination rate used by Liu et al. (2023); the sunlit share instead applies a yes/no threshold.",
  },
  "sun.continuous-solar-months-per-year-disk-threshold": {
    label: "Months a year with no darkness",
    tip: "On average, how many lunar months a year the Sun never drops below the sunlit threshold at this site, over 2026 to 2029, as in Bryant (2009).",
  },
  "sun.total-dark-days-during-polar-winter-synodic-month": {
    label: "Dark days in the worst month",
    tip: "Total dark time, in days, in the darkest lunar (synodic) month between 2026 and 2029: the local polar winter. Bryant (2009) uses it to compare polar sites.",
  },
  "sun.winter-month-longest-uninterrupted-darkness": {
    label: "Longest darkness in the worst month",
    tip: "The longest single dark interval within that darkest lunar month: the toughest survival test a lander would face here in winter.",
  },
  "sun.surface-versus-elevated-solar-visibility-profile": {
    label: "Sunlight at ground level vs on a mast",
    tip: "The sunlit share of the mission for a panel at ground level compared with one on the tallest mast tested. Raised equipment clears more of the nearby terrain that casts shadows.",
  },
  "sun.solar-array-generating-power": {
    label: "Solar array output",
    tip: "Average and peak electrical power from the solar panels, modelled from the sunlight reaching them: solar intensity at the Moon's distance from the Sun, the visible share of the Sun's disk, the panels' angle to the Sun, and their area and efficiency (mission assumptions).",
  },
  "sun.battery-charge-energy-reserve": {
    label: "Lowest battery charge",
    tip: "A step-by-step energy balance: the battery starts full, gains the array output and loses the lander's power use at each step. This is the lowest charge it reaches, and when.",
  },
  "sun.maximum-survivable-darkness": {
    label: "How long the battery lasts in darkness",
    tip: "Battery capacity divided by the survival (heater) load: how long the lander could last with no sunlight at all. Compare it with the longest darkness.",
  },
  "sun.peak-power-deficit-minimum-energy-margin": {
    label: "Energy shortfall or reserve",
    tip: "If the battery would run empty, the total energy the mission falls short by; otherwise the smallest energy left in reserve. A shortfall means the lander can't get through the mission as configured.",
  },

  // Earth
  "earth.earth-azimuth": {
    label: "Earth direction (azimuth)",
    tip: "Earth's compass bearing from the site at landing, from JPL Horizons. Because the Moon keeps one face toward Earth, Earth stays in about the same part of the sky, wobbling slightly (libration).",
  },
  "earth.earth-elevation": {
    label: "Earth height above the horizon (elevation)",
    tip: "Earth's angle above the flat horizon at landing. Near the south pole Earth sits low, so the terrain horizon in that direction (given in the note) decides whether it is visible.",
  },
  "earth.libration-of-earth-in-lunar-sky": {
    label: "Libration: Earth's wobble in the sky",
    tip: "How far the sub-Earth point (where Earth is straight overhead on the Moon) wanders over several years. The Moon's tilted, elliptical orbit makes Earth trace a small loop in the lunar sky, which can lift it above or drop it below a polar horizon.",
  },
  "earth.dte-geometric-line-of-sight": {
    label: "Direct-to-Earth line of sight at landing",
    tip: "Whether enough of Earth's disk clears the terrain horizon at landing (by default, at least half). Radio needs a straight, unobstructed path, and the Moon has no atmosphere to bend signals around hills.",
  },
  "earth.dte-visibility-intervals": {
    label: "Earth-in-view windows",
    tip: "How many separate periods in the mission have Earth in view: the windows for direct-to-Earth communication. The \"Earth from the site\" chart shows when each starts and ends.",
  },
  "earth.total-dte-visibility-fraction": {
    label: "Share of the mission with Earth in view",
    tip: "The fraction of the mission when enough of Earth's disk is above the terrain horizon. This is geometry only: actual contact also needs a ground station and a working radio link.",
  },
  "earth.longest-dte-blackout": {
    label: "Longest time without Earth in view",
    tip: "The longest continuous stretch with Earth hidden by the horizon or terrain. Without a relay satellite the lander must run autonomously and store its data for that long.",
  },
  "earth.dte-visibility-ground-station-availability": {
    label: "Earth in view with a DSN station available",
    tip: "Time when Earth is in view from the site and the Moon is high enough above the horizon at a Deep Space Network complex (Goldstone, Madrid or Canberra) to track it: a step from geometry toward real contact time.",
  },
  "earth.two-way-light-time-and-latency": {
    label: "Signal round-trip time",
    tip: "How long a radio signal takes from Earth to the site and back at the speed of light, over the mission's range of Earth–Moon distances. Controllers can't react faster than this.",
  },
  "earth.contact-concurrency-with-sunlight": {
    label: "Overlap of Earth contact and sunlight",
    tip: "Time with both Earth in view and sunlight, and what share of the Earth-in-view time is also sunlit. Contact while the lander has power is the most useful kind.",
  },
  "earth.high-ground-terrestrial-los-reflector-relay-opportunity": {
    label: "Nearby high point for a relay",
    tip: "The point in the analysis grid around the site that sees Earth most over a year, assuming a 10 m mast there, and whether the site has a line of sight to it. A relay there could pass signals on when Earth is hidden from the site.",
  },
  "earth.earth-visibility-sensitivity-to-tower-height-three-disk-levels": {
    label: "Earth visibility vs antenna height",
    tip: "The share of the mission with any, the selected (by default half) and all of Earth's disk in view, for antennas on masts of several heights. It shows how much a taller antenna helps.",
  },

  // Spatial context
  "spatial.selenographic-latitude": {
    label: "Latitude",
    tip: "Angle north (+) or south (−) of the lunar equator in the Moon's standard coordinate system, the one LOLA and JPL Horizons use. −90° is the south pole.",
  },
  "spatial.selenographic-longitude": {
    label: "Longitude",
    tip: "Angle east (+) or west (−) of the lunar prime meridian, which passes through the Moon's mean Earth-facing point. Near the pole the meridians converge, so a large difference in longitude can be a short distance.",
  },
  "spatial.site-elevation-above-datum": {
    label: "Elevation",
    tip: "Height of the ground above a 1737.4 km-radius reference sphere (the LOLA datum), the Moon's stand-in for sea level. High ground sees past more of the surrounding terrain.",
  },
  "spatial.distance-to-pole": {
    label: "Distance to the south pole",
    tip: "Great-circle distance from the site to the south pole, measured along the 1737.4 km reference sphere.",
  },
  "spatial.nearside-farside-orientation": {
    label: "Near side or far side",
    tip: "Whether the site is within 90° of longitude of the Earth-facing meridian, i.e. on the near side. Near the pole this is only a rough guide, since terrain and libration decide when Earth is visible; the share of the mission with Earth in view is given alongside.",
  },
  "spatial.named-region-landmark-proximity": {
    label: "Nearest named feature",
    tip: "The closest landform in the IAU Gazetteer of Planetary Nomenclature (craters, mountains and other officially named features), with its distance and compass bearing.",
  },

  // Terrain
  "terrain.local-slope-magnitude": {
    label: "Slope at the site",
    tip: "How steep the ground is, from LOLA elevations across the baseline given in the value. Landers have a tilt limit, and slope also changes how directly sunlight strikes the surface.",
  },
  "terrain.slope-aspect": {
    label: "Slope direction (aspect)",
    tip: "The compass direction the ground slopes down toward. It affects which parts of the Sun's circuit around the sky light the surface most directly.",
  },
  "terrain.micro-roughness-relief": {
    label: "Local relief",
    tip: "The height difference between the highest and lowest ground within 1 km of the site, from the LOLA elevation model. Rocks and craters smaller than the model's pixels (see the note) aren't captured.",
  },
  "terrain.obstacle-free-landing-area": {
    label: "Gentle ground around the site",
    tip: "The share of the analysis grid around the site no steeper than the lander's slope tolerance. Slope only: boulders and small craters below the elevation model's resolution aren't included.",
  },
  "terrain.horizon-elevation-profile-mask": {
    label: "Terrain horizon",
    tip: "The elevation angle of the skyline in every compass direction, traced through LOLA terrain far from the site and including the Moon's curvature. The Sun or Earth is visible only above this line; the value gives its highest point and average.",
  },
  "terrain.horizon-azimuth-far-field-occlusion": {
    label: "Distance to the highest horizon",
    tip: "How far away the terrain forming the highest point of the horizon is. Ridges many kilometres away can still block the low polar Sun and Earth.",
  },
  "terrain.vertical-clearance-edge-drop": {
    label: "Nearby drop-offs",
    tip: "How far the lowest ground within 500 m lies below the site, from the elevation model: a sign of crater rims, scarps or steep edges nearby.",
  },

  // Regolith & environment
  "regolith.regolith-thickness": {
    label: "Regolith (soil) thickness",
    tip: "Typical depth of the loose surface layer (regolith) on older highland terrain: a Moon-wide reference value from the literature, not a measurement at this site.",
  },
  "regolith.particle-size-distribution": {
    label: "Soil grain size",
    tip: "Typical grain size of lunar soil from returned samples: a Moon-wide reference value. Fine, sharp grains cling to equipment and wear it down.",
  },
  "regolith.bulk-density-porosity": {
    label: "Soil density",
    tip: "Typical in-place density of the upper lunar soil, gaps between grains included: a Moon-wide reference value. Denser soil is firmer and conducts heat better.",
  },
  "regolith.bearing-capacity-and-expected-sinkage": {
    label: "Lander footpad pressure",
    tip: "The pressure the lander's feet put on the ground: lander mass × lunar gravity ÷ footpad area (mission assumptions). The note compares it with a reference bearing capacity of lunar soil.",
  },
  "regolith.minimum-maximum-surface-temperature": {
    label: "Surface temperature extremes",
    tip: "Summer maximum and winter minimum temperatures at the site, measured from orbit by the Diviner radiometer on NASA's Lunar Reconnaissance Orbiter, in kelvin (0 K is absolute zero). Hardware has to survive both.",
  },

  // Landing
  "landing.terrain-relative-navigation-capability": {
    label: "Camera navigation at landing",
    tip: "Whether lighting at landing allows terrain-relative navigation, where the lander matches camera images to maps to find its position. It needs the site sunlit and the Sun above a minimum elevation (a mission assumption).",
  },
  "landing.descent-sun-glare-and-visual-contrast": {
    label: "Sun glare during descent",
    tip: "The angle between the Sun and the direction the lander approaches from (a mission assumption). With a low Sun close to that direction, cameras risk glare and hard-to-read shadows.",
  },
  "landing.landing-area-hazard-probability": {
    label: "Share of steep ground nearby",
    tip: "The share of the area around the site steeper than the lander's slope tolerance: a simple proxy for the chance of touching down on unsafe ground. Boulders and small craters aren't included.",
  },
  "landing.post-landing-stability-and-egress": {
    label: "Stable after landing?",
    tip: "Compares the slope at the site with the lander's tilt tolerance. Within it, the lander should sit stably and be able to deploy its payloads.",
  },

  // Trajectory
  "trajectory.descent-lighting-comm-continuity": {
    label: "Light and Earth contact at touchdown",
    tip: "Whether the site is sunlit and Earth is in view at the landing time. Landing in light helps the cameras; Earth in view allows live monitoring of touchdown.",
  },
  "trajectory.landing-abort-alternate-sites": {
    label: "Nearest alternative sites",
    tip: "The three closest other south-pole sites in the app's curated list. Distance only: it doesn't check propellant, or whether those sites suit the same date.",
  },

  // Science
  "science.scientific-target-identification": {
    label: "Nearby science targets",
    tip: "Named features near the site from the IAU gazetteer, plus the nearest permanently shadowed region (PSR) from NASA's LRO-based PSR maps. PSRs are prime targets because they can trap water ice.",
  },
  "science.distance-to-science-targets": {
    label: "Distance to the nearest shadowed region",
    tip: "How far away the nearest permanently shadowed region (PSR) is, and in which direction. A shorter trip makes it easier for a rover to sample possible ice.",
  },
  "science.permanently-shadowed-region-psr-coverage": {
    label: "Never-lit ground nearby",
    tip: "How many cells of the analysis grid around the site get no sunlight at all over the next year. True permanent shadow is defined over the Moon's 18.6-year cycle, so one year slightly over-counts.",
  },
  "science.psr-access-distance-and-difficulty": {
    label: "Rover trip to the shadowed region",
    tip: "The straight-line distance to the nearest PSR, with the driving time and energy it would take at the rover speed and energy use set in the mission assumptions. Real routes are longer.",
  },
  "science.cold-trap-thermal-stability": {
    label: "Cold-trap conditions",
    tip: "Ice survives over geological time only where it stays very cold. This gives the site's summer maximum temperature measured by Diviner and the distance to the nearest PSR, where cold traps are found.",
  },

  // Logistics
  "logistics.activity-timeline-critical-path": {
    label: "First window with power and contact",
    tip: "When the first period with both sunlight and Earth in view begins after landing, and how long it lasts. Activities that need both have to wait for it.",
  },
  "logistics.operational-mode-autonomy-rules": {
    label: "Time the lander must run on its own",
    tip: "The longest stretch without Earth in view, during which the lander must follow onboard rules with no commands from Earth.",
  },
  "logistics.deployment-and-workspace-area": {
    label: "Very flat working area",
    tip: "The area of grid cells around the site with slopes of 5° or less, suitable for setting up equipment.",
  },
  "logistics.operational-safety-margins-reserve-time": {
    label: "Time until the next sunset or sunrise",
    tip: "If the site is lit at landing, the time until the first sunset; if it is dark, the wait until sunrise. It is the time budget for the first activities, or for surviving the first night.",
  },
  "logistics.site-infrastructure-reuse-potential": {
    label: "Nearest past landing",
    tip: "The closest earlier landing site in the app's list, and its distance. Missions near earlier ones could build on their data or hardware; this doesn't assess what is actually still there.",
  },

  // Rover
  "rover.traversable-slope-cross-slope": {
    label: "Ground a rover can drive",
    tip: "The share of the area around the site with slopes under 15°, the slope capability of NASA's VIPER rover (see the note). Steeper ground is risky to drive across.",
  },
  "rover.route-length-and-cumulative-ascent": {
    label: "Route to the nearest shadowed region",
    tip: "The straight-line distance to the nearest PSR: a lower bound on the drive, since real routes detour around slopes and craters.",
  },
  "rover.traverse-energy-consumption": {
    label: "Energy for the round trip",
    tip: "Energy to drive to the nearest PSR and back: distance × the rover's energy use per kilometre (a mission assumption).",
  },
  "rover.dynamic-sunlight-along-route": {
    label: "Sunlight across the surrounding area",
    tip: "The average sunlit share of the mission across the grid around the site: a guide to how much light a rover would find while driving nearby.",
  },
  "rover.safe-haven-waypoints": {
    label: "Best nearby spot to recharge",
    tip: "The best-lit grid cell with gentle slopes near the site, with its distance and sunlit share: a place a rover could park to recharge or wait out darkness.",
  },

  // Space weather
  "space-weather.solar-energetic-particle-sep-events": {
    label: "Solar particle storms",
    tip: "Typical radiation dose from large solar energetic particle events (bursts of high-energy protons from solar eruptions) under average shielding: a Moon-wide reference value from the literature. The Moon has no magnetic field or atmosphere to block them.",
  },
  "space-weather.galactic-cosmic-ray-exposure": {
    label: "Cosmic-ray radiation",
    tip: "The background dose rate from galactic cosmic rays measured in lunar orbit by the CRaTER instrument on NASA's Lunar Reconnaissance Orbiter: a reference value for the whole Moon, not this site.",
  },
  "space-weather.recent-local-impact-detection-new-craters": {
    label: "New impact craters",
    tip: "The number of new craters found by comparing LROC images of the same areas taken years apart: a Moon-wide count showing that impacts still reshape the surface today.",
  },
  "space-weather.eclipse-occultation-by-orbital-bodies": {
    label: "Eclipses during the mission",
    tip: "How many times Earth blocks the Sun as seen from the site during the mission. Each one is a temporary loss of solar power.",
  },

  // Heritage
  "heritage.previous-landing-impact-locations": {
    label: "Nearest previous landing",
    tip: "The closest earlier landing or impact site in the app's list, with its distance and direction.",
  },
  "heritage.mission-outcome-and-anomaly-history": {
    label: "What happened there",
    tip: "The recorded outcome of that nearest earlier mission, for example a successful landing, a tip-over or a crash. Past results show which hazards are real.",
  },
  "heritage.cultural-heritage-preservation-zones": {
    label: "Distance to historic sites",
    tip: "Distance to the nearest hardware left by an earlier mission and to the nearest Apollo site. NASA's 2011 recommendations ask landers to target at least 2 km from U.S. heritage sites, to avoid damage from rocket exhaust and blasted dust.",
  },
  "heritage.nearby-active-planned-missions-interference": {
    label: "Nearest planned mission",
    tip: "The closest site where another mission is planned (NASA CLPS, Artemis, commercial or international). Nearby missions may need to coordinate landing times, radio frequencies and keep-out zones; plans often change.",
  },
};

export const educatorPick = (id: string): EducatorPick | undefined => EDUCATOR_METRICS[id];
