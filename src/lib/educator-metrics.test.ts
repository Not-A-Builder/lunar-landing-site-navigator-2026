import { describe, expect, it } from "vitest";
import { EDUCATOR_METRICS } from "./educator-metrics";
import { ENTHUSIAST_METRICS } from "./enthusiast-metrics";
import { catalog } from "./metrics";

describe("educator metric selection (D-118)", () => {
  const ids = new Set(catalog.metrics.map((m) => m.id));
  const picks = Object.keys(EDUCATOR_METRICS);

  it("only names metrics that exist in the catalog", () => {
    for (const id of picks) expect(ids.has(id), id).toBe(true);
  });

  it("shows more than enthusiasts but fewer than mission planners", () => {
    for (const id of Object.keys(ENTHUSIAST_METRICS)) expect(EDUCATOR_METRICS[id], id).toBeDefined();
    expect(picks.length).toBeGreaterThan(Object.keys(ENTHUSIAST_METRICS).length);
    expect(picks.length).toBeLessThan(catalog.metrics.length);
  });

  it("gives every pick its own label and tooltip", () => {
    for (const [id, p] of Object.entries(EDUCATOR_METRICS)) {
      expect(p.label.trim().length, id).toBeGreaterThan(3);
      expect(p.tip.trim().length, id).toBeGreaterThan(40);
    }
  });
});
