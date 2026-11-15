/**
 * The Enthusiast persona's metric selection (D-109). Enthusiasts see only the main, plain-language
 * metrics of each category, not the obscure or technical ones. This is a curated presentation choice:
 * it picks which computed metrics to show and how to label and explain them, and adds no values of its own.
 *
 * - `card`: a main takeaway, listed first in its category under this short label, with its rating
 *   (good / trade-off / challenging) when it has one.
 * - `subtext`: show the sheet's enthusiast line (`views.enthusiast`) under the question. Only set where
 *   that line adds something; most just repeat or reword the question, so they stay hidden.
 * - `tip`: the metric's tooltip for enthusiasts (D-112), in plain language. It describes what the app
 *   actually computes (`src/lib/metrics/compute.ts`), so keep the two in step. Thresholds the user
 *   can change are given as "by default"; no site values appear here.
 *
 * Metrics not listed here are hidden for enthusiasts. Categories with none listed (or none available
 * at a site) disappear for them. Order on the page follows the catalog.
 */
export type EnthusiastPick = { card?: string; subtext?: boolean; tip: string };

export const ENTHUSIAST_METRICS: Record<string, EnthusiastPick> = {
  // Overall decision metrics
  "overall.joint-sunlit-dte-window": {
    card: "Sunlight and Earth together",
    tip: "The total time during the mission when the site has sunlight for power and Earth in view for direct radio contact, both at once. The percentage is that time as a share of the whole mission.",
  },
  "overall.longest-gap-without-simultaneous-sun-and-dte-visibility": {
    card: "Longest wait for both",
    tip: "The longest stretch of the mission without sunlight and Earth in view at the same time. Through it the lander is missing power, a direct link home, or both, so it has to get by on its battery and its own decisions.",
  },
  "overall.comparison-against-site-alternatives": {
    card: "How it ranks",
    tip: "Where this site places among the app's list of south-pole sites when they are ranked by how much of the time they get sunlight, averaged over 2026 to 2029. Number 1 is the sunniest. Use Compare to line up sites for your own dates.",
  },
  "overall.sensitivity-to-time-shift": {
    tip: "How much the total time in sunlight changes if the landing happens one day earlier or later. A small change means the date is forgiving; a big one means the plan depends on landing on time.",
  },
  "overall.constraint-failure-explanation": {
    tip: "The app runs four basic checks: the ground is not too steep for the lander, the battery can last through the longest darkness, Earth comes into view at least once, and the battery never runs empty. This lists the checks that fail, or says that none do. The limits come from the app's default mission assumptions.",
  },
  "overall.joint-illumination-and-slope-qualifying-area": {
    subtext: true,
    tip: "How much of the ground around the site is both gentle enough to land on (no steeper than the lander's slope limit) and in sunlight at least half the time over the next year. More of it leaves more room if the landing drifts off target.",
  },

  // Sun
  "sun.solar-availability-fraction": {
    card: "Time in sunlight",
    tip: "The share of the mission when the site is in sunlight. It counts as sunlit when enough of the Sun shows above the surrounding hills (by default, at least half of it). This is about time in the light, not how much power the panels make.",
  },
  "sun.longest-continuous-darkness": {
    card: "Longest darkness",
    subtext: true,
    tip: "The longest single stretch of the mission without sunlight. The lander has to survive it on battery power alone, which is often the hardest test for a mission near the pole.",
  },
  "sun.longest-continuous-sunlight": {
    card: "Longest sunlight",
    tip: "The longest single stretch of unbroken sunlight during the mission: the best window for charging up and getting work done.",
  },
  "sun.instantaneous-terrain-shadow-state": {
    card: "At landing",
    tip: "Whether the Sun is shining on the site at the landing time, allowing for hills and ridges that can hide it, even far-off ones. \"Partly lit\" means some of the Sun shows, but not enough to count as sunlit.",
  },
  "sun.sunrise-sunset-crossings": {
    tip: "How many times the Sun rises above or sets behind the hills during the mission, and when the next one is. Near the pole the Sun circles low along the horizon, so these moments can be days apart.",
  },
  "sun.total-dark-duration": {
    tip: "All the time the site spends without sunlight during the mission, added up. Unlike the longest darkness, it counts every dark stretch, short or long.",
  },
  "sun.disk-weighted-annual-illumination-rate": {
    tip: "How much of the Sun this spot sees on average, over 2026 to 2029. Times when only part of the Sun shows above the hills count partly, so this measures the average amount of Sun in view rather than how often the site is lit.",
  },

  // Earth
  "earth.total-dte-visibility-fraction": {
    card: "Time with Earth in view",
    tip: "The share of the mission when Earth is above the surrounding hills, so an antenna could point straight at it. It counts when enough of Earth shows (by default, at least half). This is when direct contact is possible, not whether a station on Earth is free to listen.",
  },
  "earth.longest-dte-blackout": {
    card: "Longest without Earth",
    tip: "The longest single stretch of the mission when Earth is below the horizon or hidden behind hills. Without a relay satellite, the lander can't talk to Earth directly during it, so it has to store its data and act on its own.",
  },
  "earth.dte-geometric-line-of-sight": {
    card: "At landing",
    tip: "Whether Earth is above the hills at the landing time, giving an antenna on the ground a clear line to it. A clear line is needed for contact but doesn't guarantee it: a station on Earth also has to be listening.",
  },
  "earth.dte-visibility-intervals": {
    tip: "How many separate stretches of the mission have Earth in view. The \"When you can see Earth\" chart above shows when each one starts and ends.",
  },

  // Spatial context
  "spatial.named-region-landmark-proximity": {
    card: "Nearest named feature",
    tip: "The closest feature with an official name, such as a crater or mountain, from the international list of lunar place names, with its distance and compass direction from the site.",
  },
  "spatial.nearside-farside-orientation": {
    card: "Side of the Moon",
    tip: "Whether the site is on the half of the Moon that always faces Earth. Near the pole Earth sits low in the sky, so hills often decide whether it can be seen. The percentage is the share of this mission with Earth in view.",
  },
  "spatial.site-elevation-above-datum": {
    tip: "How high the ground is compared with a smooth reference sphere the size of the Moon, which stands in for sea level because the Moon has no seas. Higher ground can see over more of the hills around it.",
  },

  // Terrain
  "terrain.horizon-elevation-profile-mask": {
    card: "Highest horizon",
    tip: "How high the hills and ridges rise above flat ground, looking all the way around the site. The highest point, and the direction it lies in, is where the Sun or Earth is most easily blocked. A value below zero means the land drops away, as it does when you stand on a peak.",
  },

  // Landing
  "landing.terrain-relative-navigation-capability": {
    card: "Camera navigation at landing",
    tip: "Whether there is enough light at the landing time for the lander's cameras to recognise the ground below and steer to a safe spot. It checks that the site is sunlit and the Sun is at least a little above the horizon; it doesn't model any particular camera.",
  },

  // Trajectory
  "trajectory.landing-abort-alternate-sites": {
    card: "Places to divert to",
    tip: "The three nearest other south-pole sites in the app's list, with their distances. They suggest where a lander might divert if this spot turns out to be unsafe. This doesn't check whether it would have the fuel to get there.",
  },

  // Science
  "science.cold-trap-thermal-stability": {
    tip: "Ice can only last for very long times where it stays extremely cold. This shows the warmest the site gets in summer, measured from orbit by NASA's Diviner instrument (in kelvin, where 0 K is absolute zero), and the distance to the nearest permanently shadowed region (PSR), a place that never sees the Sun and where ice is most likely to be.",
  },

  // Logistics
  "logistics.site-infrastructure-reuse-potential": {
    tip: "The closest place where a spacecraft has already landed, and how far away it is. Being near earlier landings could let future missions reuse what is already there.",
  },

  // Heritage
  "heritage.cultural-heritage-preservation-zones": {
    card: "Protected history nearby",
    tip: "How far the site is from the nearest spacecraft left on the Moon by an earlier landing, and from the nearest Apollo landing site. NASA's 2011 recommendations ask new landers to aim at least 2 km away from U.S. historic sites, to protect them from engine exhaust and blasted dust.",
  },
  "heritage.nearby-active-planned-missions-interference": {
    tip: "The closest site where another mission is planned, from NASA, commercial and international plans, with its distance. Missions close together may need to coordinate landings and radio use. Plans and dates often change.",
  },
};

export const enthusiastPick = (id: string): EnthusiastPick | undefined => ENTHUSIAST_METRICS[id];
