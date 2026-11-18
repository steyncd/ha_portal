// Where the sun is, from the clock — no entity needed.
//
// The model could read sun.sun's azimuth and elevation attributes, but the
// store's attr() deliberately stays LIVE while the time machine is rewound
// (history is fetched without attributes). A model lit by today's sun while
// showing yesterday's house would be wrong in exactly the way the time machine
// exists to prevent. Computing it from a timestamp means the sun follows
// whatever moment is on screen, and it works in mock mode too.
//
// This is the low-precision solar position from the Astronomical Almanac: good
// to roughly a degree between 1950 and 2050, which is far tighter than the
// plan's own bearing is known.

export type SunPosition = {
  /** Degrees clockwise from true north. */
  azimuth: number;
  /** Degrees above the horizon; negative when the sun is down. */
  elevation: number;
};

const RAD = Math.PI / 180;

export function sunAt(t: number, lat: number, lon: number): SunPosition {
  // Days since J2000.0 (2000-01-01 12:00 UTC). The Unix epoch is day −10957.5.
  const d = t / 86_400_000 - 10957.5;
  const meanLon = 280.46 + 0.9856474 * d;
  const anomaly = (357.528 + 0.9856003 * d) * RAD;
  const eclLon = (meanLon + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * RAD;
  const obliquity = (23.439 - 0.0000004 * d) * RAD;

  const rightAsc = Math.atan2(Math.cos(obliquity) * Math.sin(eclLon), Math.cos(eclLon));
  const decl = Math.asin(Math.sin(obliquity) * Math.sin(eclLon));

  // Greenwich mean sidereal time in hours, then the local hour angle.
  const gmst = 18.697374558 + 24.06570982441908 * d;
  const hourAngle = (gmst * 15 + lon) * RAD - rightAsc;

  const phi = lat * RAD;
  const elevation = Math.asin(
    Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(hourAngle),
  );
  const azimuth = Math.atan2(
    -Math.sin(hourAngle),
    Math.tan(decl) * Math.cos(phi) - Math.sin(phi) * Math.cos(hourAngle),
  );
  return { azimuth: ((azimuth / RAD) % 360 + 360) % 360, elevation: elevation / RAD };
}
