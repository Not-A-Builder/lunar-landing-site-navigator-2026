import educatorJson from "@/data/educator-copy.json";
import type { MetricValue } from "@/lib/metrics/types";

type Copy = { lead: string; explain: string; readIt: string };
const COPY = (educatorJson as { metrics: Record<string, Copy> }).metrics;

export const hasEducatorCopy = (id: string) => !!COPY[id];

/**
 * Educator view of one metric: the result in a sentence (with the computed value), the mechanism,
 * and how to read it. If the copy expects a value but none is available right now (still computing,
 * or not defined for this site), the reason is shown instead of a sentence with a blank.
 */
export function EducatorText({ id, v }: { id: string; v: MetricValue | undefined }) {
  const c = COPY[id];
  if (!c) return null;
  const hasValue = !!v && v.status !== "unavailable" && v.display !== "—";
  const wantsValue = c.lead.includes("{value}");
  const [before, after] = c.lead.split("{value}");
  return (
    <div className="space-y-1 text-[13px] leading-relaxed">
      {wantsValue ? (
        hasValue ? (
          <p className="text-fg">
            {before}
            <b className="font-semibold">{v!.display}</b>
            {after}
          </p>
        ) : (
          <p className="text-faint">{v?.reason ?? "Not available for this site and date."}</p>
        )
      ) : (
        <>
          <p className="text-fg">{c.lead}</p>
          {hasValue && <p className="text-fg">For this site and date: <b className="font-semibold">{v!.display}</b></p>}
        </>
      )}
      <p className="text-muted">{c.explain}</p>
      <p className="text-muted"><span className="text-faint">How to read it: </span>{c.readIt}</p>
    </div>
  );
}
