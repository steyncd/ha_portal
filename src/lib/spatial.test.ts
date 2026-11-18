import { describe, it, expect } from "vitest";
import { PLAN } from "./plan";
import { SCENE_ROOMS } from "./rooms";
import { deriveZones } from "./zones";
import { HOUSE_W, HOUSE_D, NORTH_DEG, SITE, YARD, YARD_RING, ZONE_ROOM, bearing, bearingToPlanTurn, enToPlan, placeZones, roomRects, slotPosition, streetLabelPoint, sunVector } from "./spatial";

describe("roomRects", () => {
  const rects = roomRects();

  it("converts every plan room, in metres, centred on the drawing box", () => {
    expect(rects).toHaveLength(PLAN.length);
    const study = rects.find((r) => r.id === "study")!;
    // 19.4% of 18.6 m wide, 27% of 14.8 m deep.
    expect(study.w).toBeCloseTo(3.608, 2);
    expect(study.d).toBeCloseTo(3.996, 2);
    // left 22.6% → 22.6% − 50% of 18.6 m from the centre.
    expect(study.x).toBeCloseTo(-5.096, 2);
  });

  it("keeps every room inside the 18.6 × 14.8 m box", () => {
    for (const r of rects) {
      // The plan's percentages overrun by up to 0.1% where rooms meet; 5 cm of
      // tolerance covers that without hiding a room typed in the wrong place.
      expect(r.x, r.id).toBeGreaterThanOrEqual(-HOUSE_W / 2 - 0.05);
      expect(r.z, r.id).toBeGreaterThanOrEqual(-HOUSE_D / 2 - 0.05);
      expect(r.x + r.w, r.id).toBeLessThanOrEqual(HOUSE_W / 2 + 0.05);
      expect(r.z + r.d, r.id).toBeLessThanOrEqual(HOUSE_D / 2 + 0.05);
    }
  });

  it("marks only the roofed-but-open rooms as open", () => {
    expect(rects.filter((r) => r.open).map((r) => r.id).sort()).toEqual(["braai", "open_patio"]);
  });
});

describe("plan ↔ room scenes", () => {
  it("every scene key on the plan is a real scene room", () => {
    const keys = new Set(SCENE_ROOMS.map((s) => s.key));
    for (const r of PLAN) if (r.scene) expect(keys.has(r.scene), r.id).toBe(true);
  });

  it("a room shares at least one light with the scene set it claims", () => {
    // This is the check that the mapping was derived, not typed from memory: a
    // room that points at a scene controlling none of its lights is a mistake.
    for (const r of PLAN) {
      if (!r.scene) continue;
      const set = new Set(SCENE_ROOMS.find((s) => s.key === r.scene)!.lights);
      const shared = (r.lights ?? []).filter((l) => set.has(l.id));
      expect(shared.length, `${r.id} → ${r.scene}`).toBeGreaterThan(0);
    }
  });
});

describe("placeZones", () => {
  const ids = [
    "binary_sensor.helloliam_alarm_zone_009_pir_kitchen",
    "binary_sensor.helloliam_alarm_zone_009_bypass_pir_kitchen",
    "binary_sensor.helloliam_alarm_zone_020_door_kitchen",
    "binary_sensor.helloliam_alarm_zone_020_bypass_door_kitchen",
    "binary_sensor.helloliam_alarm_zone_025_pir_main_room",
    "binary_sensor.helloliam_alarm_zone_025_bypass_pir_main_room",
    "binary_sensor.helloliam_alarm_zone_018_beam_pool",
    "binary_sensor.helloliam_alarm_zone_018_bypass_beam_pool",
  ];
  const zones = deriveZones(ids);

  it("places a zone in its room and numbers the slots within that room", () => {
    const { placed } = placeZones(zones);
    const kitchen = placed.filter((p) => p.room === "kitchen");
    expect(kitchen.map((p) => p.zone.n)).toEqual(["009", "020"]);
    expect(kitchen.map((p) => p.slot)).toEqual([0, 1]);
    expect(kitchen.every((p) => p.of === 2)).toBe(true);
    expect(placed.find((p) => p.zone.n === "025")!.room).toBe("main");
  });

  it("keeps a zone with no known room instead of dropping it", () => {
    const { placed, unplaced } = placeZones(zones);
    expect(unplaced.map((z) => z.n)).toEqual(["018"]);
    expect(placed.length + unplaced.length).toBe(zones.length);
  });

  it("only points at rooms that exist on the plan", () => {
    const rooms = new Set(PLAN.map((r) => r.id));
    for (const [n, room] of Object.entries(ZONE_ROOM)) expect(rooms.has(room), `zone ${n}`).toBe(true);
  });
});

describe("slotPosition", () => {
  it("spreads slots across the room and keeps them inside it", () => {
    const r = roomRects().find((x) => x.id === "kitchen")!;
    const a = slotPosition(r, 0, 2);
    const b = slotPosition(r, 1, 2);
    expect(a.x).toBeLessThan(b.x);
    for (const p of [a, b]) {
      expect(p.x).toBeGreaterThan(r.x);
      expect(p.x).toBeLessThan(r.x + r.w);
      expect(p.z).toBeGreaterThan(r.z);
      expect(p.z).toBeLessThan(r.z + r.d);
    }
  });
});

describe("aerial calibration", () => {
  const rects = roomRects();
  const patio = rects.find((r) => r.id === "open_patio")!;
  const entry = rects.find((r) => r.id === "entrance")!;

  // These two marks are the check on the whole reading of the photo: Christo
  // labelled Patio and Entrance on it, the plan already knows where those rooms
  // are, and if the bearing or the scale were wrong the marks would land
  // somewhere else. They are literals here on purpose — they are evidence, not
  // configuration.
  it("lands the photo's Patio mark inside the plan's patio", () => {
    const p = enToPlan(-4.3, 7.0);
    expect(p.x).toBeGreaterThan(patio.x);
    expect(p.x).toBeLessThan(patio.x + patio.w);
    expect(p.z).toBeGreaterThan(patio.z);
    expect(p.z).toBeLessThan(patio.z + patio.d);
  });

  it("lands the photo's Entrance mark within 3 m of the plan's entry", () => {
    const p = enToPlan(-10.9, -4.6);
    const dist = Math.hypot(p.x - (entry.x + entry.w / 2), p.z - (entry.z + entry.d / 2));
    expect(dist).toBeLessThan(3);
  });

  it("puts north up and slightly left of the drawing", () => {
    expect(NORTH_DEG).toBeGreaterThan(0);
    const north = enToPlan(0, 1);
    expect(north.z).toBeLessThan(-0.9); // plan-up is −z
    expect(north.x).toBeLessThan(0);
    expect(Math.hypot(north.x, north.z)).toBeCloseTo(1, 6);
  });

  it("keeps every yard feature outside the walls", () => {
    for (const s of SITE) {
      const p = enToPlan(s.e, s.n);
      const inside = rects.some((r) => p.x > r.x && p.x < r.x + r.w && p.z > r.z && p.z < r.z + r.d);
      expect(inside, s.id).toBe(false);
    }
  });
});

describe("sunVector", () => {
  it("is a unit vector that rises with elevation and sits on the horizon at 0°", () => {
    const low = sunVector(40, 0);
    const high = sunVector(40, 60);
    expect(low.y).toBeCloseTo(0, 6);
    expect(high.y).toBeCloseTo(Math.sin(Math.PI / 3), 6);
    for (const v of [low, high]) expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(1, 6);
  });

  it("puts a northern sun on the plan-up side and a western sun on the plan-left side", () => {
    expect(sunVector(0, 30).z).toBeLessThan(0);
    expect(sunVector(270, 30).x).toBeLessThan(0);
  });
});

describe("yard outline", () => {
  // Signed distance INSIDE the outline, in metres: positive is inside. The ring
  // runs clockwise on a map (west → north → east → south), so inside is to the
  // right of each edge.
  const inside = (p: { e: number; n: number }) =>
    Math.min(...YARD_RING.map((a, i) => {
      const b = YARD_RING[(i + 1) % YARD_RING.length];
      const len = Math.hypot(b.e - a.e, b.n - a.n);
      return ((b.n - a.n) * (p.e - a.e) - (b.e - a.e) * (p.n - a.n)) / len;
    }));
  const dist = (a: { e: number; n: number }, b: { e: number; n: number }) => Math.hypot(a.e - b.e, a.n - b.n);
  const planToEN = (x: number, z: number) => {
    const t = (NORTH_DEG * Math.PI) / 180;
    return { e: x * Math.cos(t) - z * Math.sin(t), n: -x * Math.sin(t) - z * Math.cos(t) };
  };

  it("holds the whole house", () => {
    for (const r of roomRects()) {
      for (const [x, z] of [[r.x, r.z], [r.x + r.w, r.z], [r.x + r.w, r.z + r.d], [r.x, r.z + r.d]]) {
        expect(inside(planToEN(x, z)), r.id).toBeGreaterThan(1);
      }
    }
  });

  it("holds every yard feature, with the gate on the boundary itself", () => {
    for (const s of SITE) {
      if (s.kind === "gate") expect(Math.abs(inside(s)), s.id).toBeLessThan(0.01);
      else expect(inside(s), s.id).toBeGreaterThan(2);
    }
  });

  it("puts the gate at the west corner, on the street frontage", () => {
    // Christo: "the main gate is on the south west corner of the yard" — his
    // south-west is the plot's west tip. See the note on YARD.
    const gate = SITE.find((s) => s.kind === "gate")!;
    expect(dist(gate, YARD.west)).toBeLessThan(6);
    expect(gate.bearing).toBeCloseTo(bearing(YARD.west, YARD.north), 6);
  });

  it("puts the carport in the south corner, squared to the neighbour's wall", () => {
    // Christo: "the carport pretty much in the south east corner".
    const carport = SITE.find((s) => s.kind === "carport")!;
    expect(dist(carport, YARD.south)).toBeLessThan(9);
    for (const other of [YARD.west, YARD.north, YARD.east]) expect(dist(carport, other)).toBeGreaterThan(dist(carport, YARD.south));
    expect(carport.bearing).toBeCloseTo(bearing(YARD.west, YARD.south), 6);
  });

  it("writes Street outside the yard", () => {
    expect(inside(streetLabelPoint())).toBeLessThan(-2);
  });

  it("turns a feature so its long side runs along the bearing it was given", () => {
    // A turn of φ about the vertical axis carries the local +z axis to
    // (sin φ, cos φ) in plan x/z. That must be the plan direction of the bearing.
    const b = bearing(YARD.west, YARD.north);
    const turn = bearingToPlanTurn(b);
    const want = enToPlan(Math.sin((b * Math.PI) / 180), Math.cos((b * Math.PI) / 180));
    expect(Math.sin(turn)).toBeCloseTo(want.x, 6);
    expect(Math.cos(turn)).toBeCloseTo(want.z, 6);
  });
});
