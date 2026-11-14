import proj4 from "proj4";
import { describe, expect, it } from "vitest";
import { SOUTH_POLAR_PROJ } from "@/lib/moon";
import { scaleLengths } from "./ScaleBar";
import { computeRulerTicks, fmtRulerLat, fmtRulerLon } from "./rulers";

proj4.defs(SOUTH_POLAR_PROJ.code, SOUTH_POLAR_PROJ.proj4);

/** A polar-stereographic view centred on the pole, `res` metres per pixel. */
const polarView = (w: number, h: number, res: number) => (x: number, y: number) => {
  const [lon, lat] = proj4(SOUTH_POLAR_PROJ.code, "EPSG:4326", [(x - w / 2) * res, (h / 2 - y) * res]);
  return [lon, lat] as [number, number];
};

describe("ruler labels", () => {
  it("formats latitude and longitude with the step's precision", () => {
    expect(fmtRulerLat(-88.5, 0.5)).toBe("88.5°S");
    expect(fmtRulerLat(-88.25, 0.25)).toBe("88.25°S");
    expect(fmtRulerLat(-88, 1)).toBe("88°S");
    expect(fmtRulerLon(30, 30)).toBe("30°E");
    expect(fmtRulerLon(-90, 30)).toBe("90°W");
    expect(fmtRulerLon(270, 30)).toBe("90°W");
    expect(fmtRulerLon(180, 30)).toBe("180°");
    expect(fmtRulerLon(-180, 30)).toBe("180°");
    expect(fmtRulerLon(360, 30)).toBe("0°");
  });
});

describe("computeRulerTicks (south polar view)", () => {
  const w = 900, h = 800, res = 500; // 450 km × 400 km around the pole
  const ticks = computeRulerTicks(polarView(w, h, res), w, h);

  it("puts 0° at the middle of the top edge and 180° at the middle of the bottom", () => {
    const zero = ticks.top.find((t) => t.label === "0°");
    const south = ticks.bottom.find((t) => t.label === "180°");
    expect(zero && Math.abs(zero.pos - w / 2)).toBeLessThan(3);
    expect(south && Math.abs(south.pos - w / 2)).toBeLessThan(3);
  });

  it("has east longitudes to the right of 0° on the top edge (lon 90°E is right on Trek SP tiles)", () => {
    const e = ticks.top.find((t) => t.label.endsWith("E"));
    expect(e && e.pos).toBeGreaterThan(w / 2);
  });

  it("labels latitude circles on the side edges, symmetric about the pole", () => {
    expect(ticks.left.length).toBeGreaterThan(0);
    expect(ticks.left.every((t) => t.label.endsWith("S"))).toBe(true);
    const l = ticks.left.map((t) => t.label);
    expect(l).toEqual([...l].reverse());
  });

  it("keeps labels apart", () => {
    for (const edge of [ticks.top, ticks.bottom, ticks.left, ticks.right])
      for (let i = 1; i < edge.length; i++) expect(edge[i].pos - edge[i - 1].pos).toBeGreaterThanOrEqual(62);
  });
});

describe("scaleLengths", () => {
  it("chooses round metric and imperial lengths that fit", () => {
    const { metric, imperial } = scaleLengths(1000, 110); // 1 km per px → 110 km fits
    expect(metric.label).toBe("100 km");
    expect(metric.px).toBeCloseTo(100);
    expect(imperial.label).toBe("50 mi");
    expect(imperial.px).toBeCloseTo((50 * 1609.344) / 1000);
  });
  it("drops to metres and feet when zoomed in", () => {
    const { metric, imperial } = scaleLengths(2, 110);
    expect(metric.label).toBe("200 m");
    expect(imperial.label).toBe("500 ft");
  });
});
