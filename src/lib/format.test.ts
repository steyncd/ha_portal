import { describe, it, expect } from "vitest";
import { n, power, rand, dur, thousands, greeting, tempColor, dailyMax } from "./format";

describe("n", () => {
  // Grouping/decimal separators are locale-dependent, so assert separator-agnostically.
  it("dashes on null", () => expect(n(null)).toBe("—"));
  it("groups thousands", () => expect(n(1234)).toMatch(/^1[\s,]234$/));
  it("rounds to digits", () => expect(n(1.239, 2)).toMatch(/^1[.,]24$/));
  it("no fraction by default", () => expect(n(1.9)).toBe("2"));
});

describe("power", () => {
  it("null → dash W", () => expect(power(null)).toEqual({ val: "—", unit: "W" }));
  it("under 1000 stays W, rounded", () => expect(power(499.6)).toEqual({ val: "500", unit: "W" }));
  it("1000 boundary → kW", () => expect(power(1000)).toEqual({ val: "1.00", unit: "kW" }));
  it("scales kW with 2dp", () => expect(power(1500)).toEqual({ val: "1.50", unit: "kW" }));
  it("handles negative (export)", () => expect(power(-2000)).toEqual({ val: "-2.00", unit: "kW" }));
});

describe("rand", () => {
  it("null → dash", () => expect(rand(null)).toBe("—"));
  it("rounds, no decimals", () => expect(rand(1234.6)).toMatch(/^R 1[\s,]235$/));
});

describe("dur", () => {
  it("null → dash", () => expect(dur(null)).toBe("—"));
  it("sub-hour minutes", () => expect(dur(432)).toBe("7m"));
  it("hours + minutes", () => expect(dur(25920)).toBe("7h 12m"));
  it("rounds to nearest minute", () => expect(dur(59)).toBe("1m"));
});

describe("thousands", () => {
  it("null → dash", () => expect(thousands(null)).toBe("—"));
  it("rounds", () => expect(thousands(3582.4)).toBe((3582).toLocaleString()));
});

describe("greeting", () => {
  it("morning before 12", () => expect(greeting(6)).toBe("Good morning"));
  it("noon flips to afternoon", () => expect(greeting(12)).toBe("Good afternoon"));
  it("afternoon before 17", () => expect(greeting(16)).toBe("Good afternoon"));
  it("17 flips to evening", () => expect(greeting(17)).toBe("Good evening"));
});

describe("tempColor", () => {
  // v2 maps temperature onto the luminance-descending --heat-1..5 ramp (CVD-safe).
  it("null → muted", () => expect(tempColor(null)).toBe("var(--mut)"));
  it("cold → heat-1", () => expect(tempColor(10)).toBe("var(--heat-1)"));
  it("cool → heat-2", () => expect(tempColor(15)).toBe("var(--heat-2)"));
  it("comfort → heat-3", () => expect(tempColor(19)).toBe("var(--heat-3)"));
  it("warm → heat-4", () => expect(tempColor(23)).toBe("var(--heat-4)"));
  it("hot → heat-5", () => expect(tempColor(27)).toBe("var(--heat-5)"));
});

describe("dailyMax", () => {
  it("buckets to per-day peaks with 'Today' last", () => {
    const now = Date.now();
    const today0 = new Date(now); today0.setHours(9, 0, 0, 0);
    const y = new Date(now - 86_400_000); y.setHours(9, 0, 0, 0);
    const out = dailyMax([
      { t: y.getTime(), v: 3 },
      { t: y.getTime() + 3_600_000, v: 5 }, // higher peak same (yesterday)
      { t: today0.getTime(), v: 8 },
    ], 3);
    expect(out).toHaveLength(3);
    expect(out[out.length - 1].label).toBe("Today");
    expect(out[out.length - 1].value).toBe(8);
    expect(out[out.length - 2].value).toBe(5); // yesterday peak
    expect(out[0].value).toBeNull(); // two days ago: no data
  });
});
