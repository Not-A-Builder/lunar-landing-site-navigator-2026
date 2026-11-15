import educatorJson from "@/data/educator-copy.json";
import { NumText } from "@/components/Num";
import type { MetricValue } from "@/lib/metrics/types";

type Copy = { lead: string; explain: string; readIt: string };
const COPY = (educatorJson as { metrics: Record<string, Copy> }).metrics;

export const hasEducatorCopy = (id: string) => !!COPY[id];

/**
 * Educator answer (D-121): the result in a plain-English sentence with the computed value in bold. It sits
 * in the value column in place of the bare value. If the copy expects a value but none is available right
 * now (still computing, or not defined for this site), the reason is shown instead of a sentence with a blank.
 */
export function EducatorAnswer({ id, v }: { id: string; v: MetricValue | undefined }) {
  const c = COPY[id];
  const hasValue = !!v && v.status !== "unavailable" && v.display !== "—";
  if (!c) return hasValue ? <p className="text-base font-medium leading-snug text-fg"><NumText>{v!.display}</NumText></p> : null;
  if (!c.lead.includes("{value}")) {
    return (
      <div className="space-y-1 text-base leading-snug text-fg">
        <p>{c.lead}</p>
        {hasValue && <p>For this site and date: <b className="num font-medium">{v!.display}</b></p>}
      </div>
    );
  }
  if (!hasValue) return <p className="text-sm leading-relaxed text-faint">{v?.reason ?? "Not available for this site and date."}</p>;
  const [before, after] = c.lead.split("{value}");
  return (
    <p className="text-base leading-snug text-fg">
      {before}
      <b className="num font-medium">{v!.display}</b>
      {after}
    </p>
  );
}

/** Educator explanation under the metric's name (D-121): the mechanism, then how to read the answer. */
export function EducatorExplain({ id }: { id: string }) {
  const c = COPY[id];
  if (!c) return null;
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      <p className="text-muted">{c.explain}</p>
      <p className="text-muted"><span className="text-faint">How to read it: </span>{c.readIt}</p>
    </div>
  );
}
