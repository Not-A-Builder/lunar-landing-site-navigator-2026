import { describe, expect, it } from "vitest";
import { parseCoordString, parseLatLon } from "./coords";

describe("coordinate parsing", () => {
  it("accepts signed decimals, hemisphere letters, degree signs and 0–360 east", () => {
    expect(parseLatLon("-85.2", "30.1")).toEqual({ ok: true, lat: -85.2, lon: 30.1 });
    expect(parseLatLon("85.2S", "30.1W")).toEqual({ ok: true, lat: -85.2, lon: -30.1 });
    expect(parseLatLon("85.2° S", "329.9")).toEqual({ ok: true, lat: -85.2, lon: -30.1 });
    expect(parseCoordString("85.2S 30.1E")).toEqual({ ok: true, lat: -85.2, lon: 30.1 });
    expect(parseCoordString("-89.45, 230.22")).toEqual({ ok: true, lat: -89.45, lon: -129.78 });
  });
  it("rejects out-of-range and malformed input with a message", () => {
    expect(parseLatLon("95", "0").ok).toBe(false);
    expect(parseLatLon("abc", "0").ok).toBe(false);
    expect(parseLatLon("10N", "10N").ok).toBe(false);
    expect(parseCoordString("85").ok).toBe(false);
  });
});
