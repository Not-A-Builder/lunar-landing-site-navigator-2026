import { beforeEach, describe, expect, it } from "vitest";
import { collapseRevisits, historyHref, scenariosAt, useHistory } from "./history";

const NOW = Date.parse("2026-11-15T09:42:17Z");
const q = (s: string) => new URLSearchParams(s);

describe("scenariosAt", () => {
  it("reads a site details URL, keeping its landing time", () => {
    expect(scenariosAt("/site/haworth", q("t=2026-12-01T06:00:00Z"), NOW)).toEqual([{ siteId: "haworth", t: "2026-12-01T06:00:00Z" }]);
  });
  it("records the current UTC hour when the URL has no landing time", () => {
    expect(scenariosAt("/site/haworth", q(""), NOW)).toEqual([{ siteId: "haworth", t: "2026-11-15T09:00:00Z" }]);
  });
  it("turns a custom point into a custom scenario id", () => {
    expect(scenariosAt("/site/custom", q("lat=-89.5&lon=12.25&t=2026-12-01T06:00:00Z"), NOW)).toEqual([
      { siteId: "custom:-89.5,12.25", t: "2026-12-01T06:00:00Z" },
    ]);
    expect(scenariosAt("/site/custom", q("lat=-89.5"), NOW)).toBeNull();
  });
  it("records comparisons with two or more scenarios only", () => {
    const two = scenariosAt("/compare", q("s=a@2026-12-01T06%3A00%3A00Z,b@2026-12-02T06%3A00%3A00Z"), NOW);
    expect(two).toHaveLength(2);
    expect(scenariosAt("/compare", q("s=a@2026-12-01T06%3A00%3A00Z"), NOW)).toBeNull();
    expect(scenariosAt("/", q("s=a@x,b@y"), NOW)).toBeNull();
    expect(scenariosAt("/sources", q(""), NOW)).toBeNull();
  });
});

describe("historyHref", () => {
  it("opens one scenario as site details and several as a comparison", () => {
    expect(historyHref([{ siteId: "haworth", t: "2026-12-01T06:00:00Z" }])).toBe("/site/haworth?t=2026-12-01T06%3A00%3A00Z");
    expect(historyHref([{ siteId: "custom:-89.5,12.25", t: "2026-12-01T06:00:00Z" }])).toBe("/site/custom?lat=-89.5&lon=12.25&t=2026-12-01T06%3A00%3A00Z");
    expect(historyHref([{ siteId: "a", t: "2026-12-01T06:00:00Z" }, { siteId: "b", t: "2026-12-02T06:00:00Z" }])).toBe(
      "/compare?s=a@2026-12-01T06%3A00%3A00Z,b@2026-12-02T06%3A00%3A00Z",
    );
  });
  it("round-trips through scenariosAt", () => {
    const sc = [{ siteId: "custom:-89.5,12.25", t: "2026-12-01T06:00:00Z" }, { siteId: "b", t: "2026-12-02T06:00:00Z" }];
    const url = new URL(historyHref(sc), "http://x");
    expect(scenariosAt(url.pathname, url.searchParams, NOW)).toEqual(sc);
  });
});

describe("history store", () => {
  const A = [{ siteId: "a", t: "2026-12-01T06:00:00Z" }];
  const A2 = [{ siteId: "a", t: "2026-12-02T06:00:00Z" }];
  const AB = [...A, { siteId: "b", t: "2026-12-01T06:00:00Z" }];
  beforeEach(() => useHistory.setState({ entries: [], starred: [] }));

  it("keeps duplicates across visits, newest first, and updates within one visit", () => {
    const { record } = useHistory.getState();
    record(A, "v1", 1);
    record(A2, "v1", 2); // landing time moved on the same page
    record(AB, "v2", 3);
    record(A, "v3", 4); // not consecutive with the earlier A, so kept
    const e = useHistory.getState().entries;
    expect(e.map((x) => [x.id, x.at])).toEqual([["v3", 4], ["v2", 3], ["v1", 2]]);
    expect(e[2].scenarios).toEqual(A2);
  });

  it("keeps one starred entry per scenario set, refreshed by each opening", () => {
    const { record, toggleStar } = useHistory.getState();
    const H = 3_600_000;
    record(AB, "v1", 1);
    toggleStar(AB, 99);
    expect(useHistory.getState().starred).toMatchObject([{ scenarios: AB, at: 1 }]);
    record(AB, "v2", 5 * H); // reopened hours later: a new entry
    record(AB, "v3", 7 * H);
    expect(useHistory.getState().starred).toMatchObject([{ scenarios: AB, at: 7 * H }]);
    expect(useHistory.getState().entries).toHaveLength(3);
    useHistory.getState().clear();
    expect(useHistory.getState().starred).toHaveLength(1);
    useHistory.getState().toggleStar(AB, 10);
    expect(useHistory.getState().starred).toHaveLength(0);
  });

  it("merges a consecutive revisit within 30 minutes into one entry, keeps later ones", () => {
    const { record } = useHistory.getState();
    const min = 60_000;
    record(A, "v1", 0);
    record(A, "v2", 20 * min); // within 30 min: replaces v1
    record(A, "v3", 45 * min); // 25 min after v2: chain continues
    expect(useHistory.getState().entries.map((x) => [x.id, x.at])).toEqual([["v3", 45 * min]]);
    record(A, "v4", 80 * min); // 35 min later: separate entry
    expect(useHistory.getState().entries.map((x) => x.id)).toEqual(["v4", "v3"]);
  });
});

describe("collapseRevisits", () => {
  const min = 60_000;
  const e = (id: string, siteId: string, at: number) => ({ id, scenarios: [{ siteId, t: "2026-12-01T06:00:00Z" }], at });
  it("keeps the newest of each run of quick revisits, measured between neighbours", () => {
    const list = [e("d", "a", 70 * min), e("c", "a", 45 * min), e("b", "a", 20 * min), e("x", "b", 10 * min), e("a", "a", 0)];
    expect(collapseRevisits(list).map((x) => x.id)).toEqual(["d", "x", "a"]);
    expect(collapseRevisits([e("n", "a", 31 * min), e("o", "a", 0)]).map((x) => x.id)).toEqual(["n", "o"]);
  });
});
