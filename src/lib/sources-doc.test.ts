import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSourcesMd } from "../../scripts/sources-md-input";

describe("SOURCES.md", () => {
  it("is up to date with the source registries (run `npm run sources:doc` if this fails)", () => {
    const root = join(__dirname, "../..");
    const expected = buildSourcesMd((p) => readFileSync(join(root, p), "utf8"));
    expect(readFileSync(join(root, "SOURCES.md"), "utf8")).toBe(expected);
  });
});
