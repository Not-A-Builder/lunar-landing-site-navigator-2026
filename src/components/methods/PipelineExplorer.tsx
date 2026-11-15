"use client";

import { ArrowRight, Browser, CloudArrowDown, Cpu, ListChecks, type Icon } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { Code } from "./parts";

type Step = { icon: Icon; title: string; when: string; short: string; body: ReactNode[]; cmd?: string[] };

/**
 * The four stages from NASA archive to screen (D-139b). Every statement here describes code in this repo:
 * pipeline/download-raw.sh, fetch-ephemeris.ts, build-terrain.ts, build-deploy-bundle.ts, src/lib/engine,
 * src/lib/metrics/compute.ts and the two API routes.
 */
export function PipelineExplorer({ years, siteCount }: { years: number[]; siteCount: number }) {
  const span = `${years[0]}–${years[years.length - 1]}`;
  const steps: Step[] = [
    {
      icon: CloudArrowDown,
      title: "Fetch",
      when: "Once, offline",
      short: "Download the NASA datasets and query JPL Horizons.",
      body: [
        <>LOLA elevation grids from the PDS Geosciences Node: <b className="font-medium text-fg">LDEM_75S_120M</b> (south polar, 120 m per pixel) and <b className="font-medium text-fg">LDEM_16</b> (whole Moon, 16 pixels per degree).</>,
        <>LOLA average-visibility maps for the Sun and for Earth (avgvisib_75s_120m, 2016 release). These are used only to check our results.</>,
        <>LROC outlines of permanently shadowed regions, USGS Gazetteer named features, and Diviner south-polar summer-maximum and winter-minimum temperature maps.</>,
        <>JPL Horizons (DE441 ephemeris): where the Sun and Earth are, as seen from the Moon, every hour.</>,
      ],
      cmd: ["npm run pipeline:raw", "npm run pipeline:ephemeris"],
    },
    {
      icon: Cpu,
      title: "Precompute",
      when: "Once, offline",
      short: "Turn raw data into compact files the browser can use.",
      body: [
        <>Ephemeris: one table per year for {span}, one row per hour, nine columns (sub-solar point, sub-Earth point, both distances, and the Moon&apos;s elevation at three Deep Space Network antennas).</>,
        <>Terrain: one file for each of the {siteCount} listed sites. It holds 360° horizon masks at six heights (0, 2, 5, 10, 20 and 50 m), masks 1 km away in four directions, a 7 × 7 grid of masks for area statistics, slope, relief, the nearest permanently shadowed region and the closest named features.</>,
        <>A peer summary of all sites (2026–2029, default assumptions), so each site can be ranked against the others.</>,
        <>A compressed bundle of the NASA layers, so the server can build the same terrain file for any coordinate you type in.</>,
      ],
      cmd: ["npm run pipeline:terrain", "npm run pipeline:deploy"],
    },
    {
      icon: Browser,
      title: "Compute",
      when: "In your browser, live",
      short: "Combine sky and terrain for your site and landing time.",
      body: [
        <>The page loads only the ephemeris years your mission touches and the site&apos;s terrain file.</>,
        <>Every 10 minutes of the mission, it turns the hourly sky tables into the Sun&apos;s and Earth&apos;s direction from the site (interpolating between rows) and compares each with the terrain horizon in that direction.</>,
        <>Sunrise, sunset, Earth-rise and Earth-set times are interpolated between samples. Multi-year statistics use 2-hour steps over 2026–2029.</>,
        <>For a typed-in coordinate the server builds the terrain file on demand with the same code (<Code>/api/terrain</Code>). For a year outside {span} it builds that year&apos;s table from Horizons live (<Code>/api/ephemeris/[year]</Code>).</>,
      ],
    },
    {
      icon: ListChecks,
      title: "Show & cite",
      when: "On every page",
      short: "Label each value with where it came from.",
      body: [
        <>Every value carries a status: computed, modelled, reference or your input. Metrics that no public dataset supports are marked unavailable and hidden.</>,
        <>Every value has a tooltip naming its sources, with links. Computed and modelled values also show the calculation steps with this site&apos;s numbers.</>,
        <>Ratings place each value in red / amber / green bands. Mission planners can change both the bands and the mission assumptions.</>,
      ],
    },
  ];
  const [active, setActive] = useState(0);
  const s = steps[active];

  return (
    <div className="mt-10">
      <div role="tablist" aria-label="Pipeline stages" className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line md:grid-cols-4">
        {steps.map((x, i) => {
          const on = i === active;
          return (
            <button
              key={x.title}
              type="button"
              role="tab"
              id={`pipe-tab-${i}`}
              aria-selected={on}
              aria-controls="pipe-panel"
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  const n = (i + (e.key === "ArrowRight" ? 1 : steps.length - 1)) % steps.length;
                  setActive(n);
                  document.getElementById(`pipe-tab-${n}`)?.focus();
                }
              }}
              className={`group relative flex flex-col items-start gap-3 p-5 text-left transition-colors duration-300 ${on ? "bg-panel" : "bg-bg hover:bg-panel"}`}
            >
              {/* progress rule: fills left to right up to the selected step */}
              <span className={`absolute inset-x-0 top-0 h-0.5 origin-left bg-fg transition-transform duration-500 ease-out ${i <= active ? "scale-x-100" : "scale-x-0"}`} aria-hidden />
              <div className="flex w-full items-center justify-between">
                <span className={`num text-xs ${on ? "text-fg" : "text-faint"}`}>0{i + 1}</span>
                <x.icon size={22} weight={on ? "fill" : "regular"} className={`transition-colors ${on ? "text-fg" : "text-faint group-hover:text-muted"}`} aria-hidden />
              </div>
              <div>
                <div className="text-lg font-semibold">{x.title}</div>
                <div className="mt-0.5 text-xs text-faint">{x.when}</div>
              </div>
              <p className={`text-sm leading-snug ${on ? "text-muted" : "text-faint"}`}>{x.short}</p>
            </button>
          );
        })}
      </div>

      <div id="pipe-panel" role="tabpanel" aria-labelledby={`pipe-tab-${active}`} className="border-x border-b border-line bg-panel">
        <div key={active} className="swap-in grid gap-6 p-6 md:grid-cols-[1fr_auto] md:p-8">
          <ol className="space-y-3">
            {s.body.map((b, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted">
                <ArrowRight size={16} className="mt-1 shrink-0 text-faint" aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </ol>
          {s.cmd && (
            <div className="self-start md:min-w-64">
              <div className="text-xs font-medium uppercase tracking-wider text-faint">Rebuild it yourself</div>
              <pre className="mt-2 overflow-x-auto rounded-sm border border-line bg-bg p-3 font-mono text-xs leading-relaxed text-fg">{s.cmd.map((c) => `$ ${c}`).join("\n")}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
