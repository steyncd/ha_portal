import { describe, it, expect } from "vitest";
import { sunAt } from "./sun";

// Pretoria. The winter solstice is the easiest day to reason about: the sun's
// declination is +23.44°, so at local noon it stands 90 − (25.78 + 23.44) ≈ 40.8°
// above the NORTHERN horizon.
const LAT = -25.78;
const LON = 28.31;
const at = (iso: string) => sunAt(Date.parse(iso), LAT, LON);

describe("sunAt", () => {
  it("puts the midwinter noon sun about 41° up, due north", () => {
    const s = at("2026-06-21T10:08:00Z"); // 12:08 SAST, solar noon at this longitude
    expect(s.elevation).toBeGreaterThan(40);
    expect(s.elevation).toBeLessThan(41.6);
    const offNorth = Math.min(s.azimuth, 360 - s.azimuth);
    expect(offNorth).toBeLessThan(3);
  });

  it("has the sun down before winter sunrise and after winter sunset", () => {
    expect(at("2026-06-21T04:00:00Z").elevation).toBeLessThan(0); // 06:00 SAST, sunrise ≈ 06:54
    expect(at("2026-06-21T16:00:00Z").elevation).toBeLessThan(0); // 18:00 SAST, sunset ≈ 17:24
  });

  it("rises in the east and sets in the west, passing north", () => {
    const morning = at("2026-06-21T06:30:00Z"); // 08:30 SAST
    const afternoon = at("2026-06-21T13:30:00Z"); // 15:30 SAST
    expect(morning.elevation).toBeGreaterThan(0);
    expect(afternoon.elevation).toBeGreaterThan(0);
    expect(morning.azimuth).toBeGreaterThan(0);
    expect(morning.azimuth).toBeLessThan(90);
    expect(afternoon.azimuth).toBeGreaterThan(270);
    expect(afternoon.azimuth).toBeLessThan(360);
  });

  it("stands nearly overhead at midsummer noon", () => {
    // Declination −23.44°, latitude −25.78°: 2.3° short of the zenith.
    const s = at("2026-12-21T10:05:00Z");
    expect(s.elevation).toBeGreaterThan(86);
  });
});
