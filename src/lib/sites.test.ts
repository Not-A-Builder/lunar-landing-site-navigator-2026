import { describe, expect, it } from "vitest";
import { excludedSites, sites } from "./sites";

describe("curated sites", () => {
  it("every listed site has a cited, verified coordinate (LOGS D-038)", () => {
    for (const s of sites) {
      expect(Number.isFinite(s.lat), s.id).toBe(true);
      expect(Number.isFinite(s.lon), s.id).toBe(true);
      expect(s.lat, s.id).toBeGreaterThanOrEqual(-90);
      expect(s.lat, s.id).toBeLessThanOrEqual(90);
      expect(s.lon, s.id).toBeGreaterThanOrEqual(-180);
      expect(s.lon, s.id).toBeLessThanOrEqual(180);
      expect(s.sourceUrl, s.id).toMatch(/^https?:\/\//);
      expect(s.verification, s.id).toBe("verified");
    }
  });

  it("excluded records say why and never reappear as sites", () => {
    const names = new Set(sites.map((s) => s.name));
    for (const e of excludedSites) {
      expect(e.reason.length, e.name).toBeGreaterThan(0);
      expect(names.has(e.name), e.name).toBe(false);
    }
  });
});
