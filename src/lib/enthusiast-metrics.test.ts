import { describe, expect, it } from "vitest";
import { catalog } from "./metrics";
import { ENTHUSIAST_METRICS } from "./enthusiast-metrics";

describe("enthusiast metric selection", () => {
  const byId = new Map(catalog.metrics.map((m) => [m.id, m]));

  it("only names metrics that exist in the catalog", () => {
    for (const id of Object.keys(ENTHUSIAST_METRICS)) expect(byId.has(id), id).toBe(true);
  });

  it("never picks a metric the sheet marks as an optional story for enthusiasts (D-108)", () => {
    for (const id of Object.keys(ENTHUSIAST_METRICS)) expect(byId.get(id)!.views.enthusiast).not.toMatch(/optional story/i);
  });

  it("only shows subtext that is real copy, not a sheet placeholder", () => {
    for (const [id, p] of Object.entries(ENTHUSIAST_METRICS)) {
      if (!p.subtext) continue;
      const m = byId.get(id)!;
      expect(m.views.enthusiast).not.toMatch(/hidden unless requested/i);
      expect(m.views.enthusiast.toLowerCase().replace(/\?$/, "")).not.toBe(m.question.toLowerCase().replace(/\?$/, ""));
    }
  });

  it("gives every pick its own enthusiast tooltip", () => {
    for (const [id, p] of Object.entries(ENTHUSIAST_METRICS)) expect(p.tip.trim().length, id).toBeGreaterThan(40);
  });
});
