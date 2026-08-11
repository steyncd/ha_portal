import { describe, it, expect } from "vitest";
import { toSeries, analyze, analyzeScalars, rank, type MetricDef, type StatPoint } from "./trends";

const def = (over: Partial<MetricDef> = {}): MetricDef => ({
  key: "k", label: "Standby", stat: "sensor.x", unit: "W", domain: "energy", ...over,
});
const pt = (t: number, mean: number | null, over: Partial<StatPoint> = {}): StatPoint =>
  ({ t, mean, min: null, max: null, sum: null, change: null, ...over });

describe("toSeries", () => {
  it("picks the requested field", () => {
    const s = toSeries([pt(1, 5), pt(2, 7)], "mean");
    expect(s).toEqual([{ t: 1, v: 5 }, { t: 2, v: 7 }]);
  });
  it("falls back when the picked field is null", () => {
    const s = toSeries([pt(1, null, { change: 3 })], "mean");
    expect(s).toEqual([{ t: 1, v: 3 }]);
  });
  it("drops non-finite / all-null points", () => {
    const s = toSeries([pt(1, null), pt(2, Infinity), pt(3, 9)], "mean");
    expect(s).toEqual([{ t: 3, v: 9 }]);
  });
});

describe("analyze", () => {
  it("returns null below 6 points", () => {
    const pts = [pt(1, 1), pt(2, 2), pt(3, 3), pt(4, 4), pt(5, 5)];
    expect(analyze(def(), pts)).toBeNull();
  });
  it("detects a rising series", () => {
    const pts = [1, 2, 3, 4, 8, 9, 10, 11].map((v, i) => pt(i, v));
    const t = analyze(def({ minPct: 6 }), pts);
    expect(t).not.toBeNull();
    expect(t!.direction).toBe("up");
    expect(t!.deltaPct).toBeGreaterThan(0);
  });
});

describe("analyzeScalars", () => {
  it("computes deltaPct and direction", () => {
    const t = analyzeScalars(def(), 100, 130, []);
    expect(t).not.toBeNull();
    expect(Math.round(t!.deltaPct)).toBe(30);
    expect(t!.direction).toBe("up");
  });
  it("returns null on a zero baseline", () => {
    expect(analyzeScalars(def(), 0, 50, [])).toBeNull();
  });
  it("marks a bad rise when goodUp is false", () => {
    const t = analyzeScalars(def({ goodUp: false }), 100, 140, []);
    expect(t!.good).toBe(false);
  });
});

describe("rank", () => {
  it("floats a bad movement above an equal-magnitude good one", () => {
    const bad = analyzeScalars(def({ goodUp: false }), 100, 140, [])!;
    const good = analyzeScalars(def({ goodUp: true }), 100, 140, [])!;
    const ordered = rank([good, bad]);
    expect(ordered[0]).toBe(bad);
  });
});
