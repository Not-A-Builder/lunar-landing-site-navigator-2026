import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("quotes only cells that need it", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell(1.5)).toBe("1.5");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell("a, b")).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
  });

  it("joins rows", () => {
    expect(toCsv([["a", "b"], [1, "x,y"]])).toBe('a,b\n1,"x,y"');
  });
});
