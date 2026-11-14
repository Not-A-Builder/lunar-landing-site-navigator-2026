import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildHorizonsUrl, parseAzElTable } from "./horizons";

// Real Horizons output: Earth seen from (lat -89.45, E-lon 230.22, 1.9 km), 2026-12-01 00:00-03:00 UTC, 1h.
const fixture = readFileSync(join(__dirname, "__fixtures__/earth-from-south-pole.txt"), "utf8");

describe("parseAzElTable", () => {
  it("parses rows with presence flags", () => {
    const rows = parseAzElTable(fixture);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({ t: "2026-12-01T00:00:00Z", az: 136.439303, el: -2.009011 });
    expect(rows[3].t).toBe("2026-12-01T03:00:00Z");
  });

  it("throws on results without a data block", () => {
    expect(() => parseAzElTable("No ephemeris for target")).toThrow();
  });
});

describe("buildHorizonsUrl", () => {
  it("normalises west longitudes to east-positive and quotes values", () => {
    const url = new URL(
      buildHorizonsUrl({
        body: "sun",
        site: { lat: -89.45, lon: -129.78, altKm: 1.9 },
        start: "2026-12-01",
        stop: "2026-12-02",
        step: "1h",
      }),
    );
    expect(url.searchParams.get("COMMAND")).toBe("'10'");
    expect(url.searchParams.get("CENTER")).toBe("'coord@301'");
    expect(url.searchParams.get("SITE_COORD")).toBe("'230.22,-89.45,1.9'");
  });
});
