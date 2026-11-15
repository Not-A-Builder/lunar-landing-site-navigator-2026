import { MAX_COMPARE, SITE_FULL_NAME, SITE_TITLE } from "@/lib/config";

/**
 * What the name stands for (D-143, D-146, D-147): Lunar VISTA = Visibility & Illumination Site Trade-off Analyzer,
 * one tall card per letter with what that word means in the tool. Shown as the footer of the home page and of
 * Data & methods. Counts come from the generated data, not typed in.
 */
export function NameFooter({ sites, metrics, className = "" }: { sites: number; metrics: number; className?: string }) {
  const letters: { word: string; text: string }[] = [
    { word: "Visibility", text: "Is Earth above the site’s real horizon? That decides direct-to-Earth radio contact." },
    { word: "Illumination", text: "How much of the Sun’s disk clears the terrain, which drives solar power and temperature." },
    { word: "Site", text: `${sites} landing sites with cited coordinates, or any point you type in.` },
    { word: "Trade-off", text: `Up to ${MAX_COMPARE} site-and-date scenarios side by side, with the reasons they differ.` },
    { word: "Analyzer", text: `${metrics} metrics, each computed, modelled from your inputs, quoted from a source, or hidden.` },
  ];
  return (
    <footer aria-labelledby="name-h" className={`reveal border-t border-line pt-10 ${className}`}>
      <p id="name-h" className="text-base text-muted">
        <span className="font-medium text-fg">{SITE_TITLE}</span> stands for Lunar {SITE_FULL_NAME}.
      </p>
      <dl className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
        {letters.map(({ word, text }, i) => (
          <div
            key={word}
            className={`relative flex min-h-80 flex-col justify-end overflow-hidden bg-bg p-6 sm:min-h-125 ${i === letters.length - 1 ? "sm:col-span-2 lg:col-span-1" : ""}`}
          >
            {/* Hero letter: huge, faded, bleeding off the top-right corner. */}
            <span
              aria-hidden
              className="pointer-events-none absolute top-[-0.2em] right-[-0.06em] select-none text-[16rem] leading-none font-bold tracking-tight text-fg/8"
            >
              {word[0]}
            </span>
            <dt className="relative text-lg font-semibold text-fg">
              {word}
              {i === 0 && <span className="font-normal text-faint"> &amp;</span>}
            </dt>
            <dd className="relative mt-2 max-w-[34ch] text-sm leading-relaxed text-muted">{text}</dd>
          </div>
        ))}
      </dl>
    </footer>
  );
}
