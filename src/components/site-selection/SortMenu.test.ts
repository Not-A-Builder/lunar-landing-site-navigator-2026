import { describe, expect, it } from "vitest";
import { sortSites } from "./SortMenu";

// Synthetic rows: only names and latitudes matter to the sort.
const rows = [
  { name: "Luna 16", lat: -0.5 },
  { name: "shackleton crater", lat: -89.7 },
  { name: "Luna 9", lat: 7.1 },
  { name: "Amundsen crater", lat: -84.4 },
  { name: "Beta", lat: -84.4 },
];
const names = (r: typeof rows) => r.map((x) => x.name);

describe("sortSites", () => {
  it("sorts by name A to Z, ignoring case and comparing numbers naturally", () => {
    expect(names(sortSites(rows, "name-asc"))).toEqual(["Amundsen crater", "Beta", "Luna 9", "Luna 16", "shackleton crater"]);
  });
  it("sorts by name Z to A", () => {
    expect(names(sortSites(rows, "name-desc"))).toEqual(["shackleton crater", "Luna 16", "Luna 9", "Beta", "Amundsen crater"]);
  });
  it("sorts closest to the south pole first, ties by name", () => {
    expect(names(sortSites(rows, "pole-near"))).toEqual(["shackleton crater", "Amundsen crater", "Beta", "Luna 16", "Luna 9"]);
  });
  it("sorts farthest from the south pole first, ties by name", () => {
    expect(names(sortSites(rows, "pole-far"))).toEqual(["Luna 9", "Luna 16", "Amundsen crater", "Beta", "shackleton crater"]);
  });
  it("does not mutate its input", () => {
    const copy = [...rows];
    sortSites(rows, "pole-near");
    expect(rows).toEqual(copy);
  });
});
