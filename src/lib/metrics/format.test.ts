import { describe, expect, it } from "vitest";
import { fmtElevation, fmtHours } from "./format";

describe("fmtHours", () => {
  it("writes durations with no space before d and h (D-085)", () => {
    expect(fmtHours(158)).toBe("6d 14h");
    expect(fmtHours(72)).toBe("3d");
    expect(fmtHours(12.4)).toBe("12h");
    expect(fmtHours(7.25)).toBe("7.3h");
    expect(fmtHours(0.5)).toBe("30 min");
    expect(fmtHours(47.99)).toBe("48h");
  });
});

describe("fmtElevation", () => {
  it("words the height by sign so negatives never read as 'above'", () => {
    expect(fmtElevation(-1922.4)).toBe("1,922 m below");
    expect(fmtElevation(312.6)).toBe("313 m above");
    expect(fmtElevation(0.3)).toBe("0 m, level with");
  });
  it("shows a dash when there is no value", () => {
    expect(fmtElevation(null)).toBe("—");
    expect(fmtElevation(Number.NaN)).toBe("—");
  });
});
