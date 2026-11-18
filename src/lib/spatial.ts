// Where things are — the spatial registry behind the house model.
//
// The portal has always known WHAT is in the house and almost never WHERE: 32
// alarm zones, the cameras and the irrigation zones are lists. This file is the
// start of the answer. It holds only positions that are not in doubt, and it
// says so when something has none — an unplaced zone is listed as unplaced, it
// is not dropped and it is not guessed.
//
// Units are METRES. The origin is the centre of the drawing box from plan.ts;
// +x runs along the drawing's width (plan right) and +z along its depth (plan
// down). Height is the model's business, not this file's.

import { PLAN, PLAN_W_MM, PLAN_H_MM, type PlanRoom } from "./plan";
import type { Zone } from "./zones";

export const HOUSE_W = PLAN_W_MM / 1000;
export const HOUSE_D = PLAN_H_MM / 1000;

/** A room footprint: (x, z) is its min corner, w runs along x, d along z. */
export type RoomRect = { id: string; label: string; x: number; z: number; w: number; d: number; open: boolean };

export function roomRects(plan: PlanRoom[] = PLAN): RoomRect[] {
  return plan.map((r) => ({
    id: r.id,
    label: r.label,
    x: (r.left / 100 - 0.5) * HOUSE_W,
    z: (r.top / 100 - 0.5) * HOUSE_D,
    w: (r.w / 100) * HOUSE_W,
    d: (r.h / 100) * HOUSE_D,
    open: !!r.open,
  }));
}

/**
 * Compass bearing of the drawing's top edge, in degrees clockwise from north.
 *
 * READ OFF AN AERIAL PHOTO Christo supplied on 2026-11-18, not surveyed. The
 * south eave, the long solar array and the entrance roof all run 13–14° below
 * the photo's horizontal, so the plan's "up" points about 14° east of north.
 * Trust it to ±3°: enough to put the afternoon shadow on the correct side of the
 * house, not enough to time a sunbeam through a window.
 *
 * The same photo confirms how the plan sits on the ground: Patio is the
 * north-west corner, Entry the south-west, the bedrooms run along the north-east.
 */
export const NORTH_DEG = 14;

/** Rounded to two decimals on purpose — a kilometre is far finer than the sun
 *  needs, and the full coordinates have no reason to be in the bundle. */
export const SITE_LAT = -25.78;
export const SITE_LON = 28.31;

/** Metres east and north of the house centre → plan coordinates. */
export function enToPlan(e: number, n: number, northDeg = NORTH_DEG): { x: number; z: number } {
  const t = (northDeg * Math.PI) / 180;
  return { x: e * Math.cos(t) - n * Math.sin(t), z: -(e * Math.sin(t) + n * Math.cos(t)) };
}

/**
 * Unit vector pointing AT the sun, in plan coordinates (y up).
 * `azimuth` is degrees clockwise from north, `elevation` degrees above the horizon.
 */
export function sunVector(azimuth: number, elevation: number, northDeg = NORTH_DEG): { x: number; y: number; z: number } {
  const a = (azimuth * Math.PI) / 180;
  const el = (elevation * Math.PI) / 180;
  const flat = enToPlan(Math.sin(a) * Math.cos(el), Math.cos(a) * Math.cos(el), northDeg);
  return { x: flat.x, y: Math.sin(el), z: flat.z };
}

/**
 * The yard outline — four corners, metres east and north of the house centre.
 *
 * Read off the same aerial photo, by following what bounds the plot: the edge of
 * Wyoming St, the wall shared with the red-roofed neighbour (it shows as a line
 * under the carport), and the strip along the north-east side. The plot is a
 * diamond on a north-up map, turned roughly 30° from the house, so the model's
 * ground is this outline and not a rectangle drawn round the house. Each corner
 * is good to perhaps four metres.
 *
 * HOW CHRISTO NAMES THE CORNERS, which is not how a compass does: he reads the
 * plot with the street as its west side. So his "south-west corner" is the true
 * WEST tip, where the gate is, and his "south-east corner" is the true SOUTH
 * tip, where the carport is. Both of his corrections on 2026-11-18 only make
 * sense read that way, and both then agree with the photo. He looked at the
 * drawn result the same day and confirmed it.
 */
export type EN = { e: number; n: number };
export const YARD: { west: EN; north: EN; east: EN; south: EN } = {
  west: { e: -25.9, n: -6.1 }, // street meets the neighbour's wall — the gate corner
  north: { e: -3.6, n: 22.1 },
  east: { e: 23.0, n: -5.5 },
  south: { e: -0.5, n: -24.5 }, // the carport corner
};
/** Outline in drawing order: street frontage first (west → north), then round. */
export const YARD_RING: EN[] = [YARD.west, YARD.north, YARD.east, YARD.south];

const along = (a: EN, b: EN, metres: number): EN => {
  const len = Math.hypot(b.e - a.e, b.n - a.n);
  return { e: a.e + ((b.e - a.e) / len) * metres, n: a.n + ((b.n - a.n) / len) * metres };
};
/** Compass bearing, in degrees, of the line from a to b. */
export const bearing = (a: EN, b: EN) => (Math.atan2(b.e - a.e, b.n - a.n) * 180) / Math.PI;

/**
 * The yard features.
 *
 * `e` / `n` are metres east and north of the centre of the drawing box.
 * `bearing` is the compass direction a feature's long side runs along, for the
 * two that are built against a boundary. Pool and JoJo are the spots Christo
 * marked on the photo; the house calibrates the scale (his Patio and Entrance
 * marks land within a metre or two of where the plan puts those rooms), but
 * they are marks on a photo taken at an angle, under trees: right to about three
 * metres. Sizes are generic, not measured — nobody has paced the pool.
 */
export type SiteKind = "pool" | "gate" | "carport" | "tank";
export type SiteFeature = { id: string; kind: SiteKind; label: string; e: number; n: number; bearing?: number };

export const SITE: SiteFeature[] = [
  // The mark reads about (-9.0, 6.4). Moved 1.6 m west — inside the stated
  // tolerance — so the drawn pool does not run under the patio slab.
  { id: "pool", kind: "pool", label: "Pool", e: -10.6, n: 6.8 },
  // On the street frontage, four metres from the west corner, lying along it.
  // The photo mark was eight metres up the same edge; Christo's correction is
  // that the gate is AT the corner.
  { id: "gate", kind: "gate", label: "Main gate", ...along(YARD.west, YARD.north, 4), bearing: bearing(YARD.west, YARD.north) },
  // Tucked into the south corner and squared to the neighbour's wall, as the
  // photo shows it. The mark itself was already there; what was wrong was the
  // rectangle of ground drawn round it.
  { id: "carport", kind: "carport", label: "Carport", e: -1.9, n: -18.0, bearing: bearing(YARD.west, YARD.south) },
  { id: "jojo", kind: "tank", label: "JoJo", e: 8.1, n: -13.7 },
];

/** Where to write "Street": off the middle of the frontage, outside the yard. */
export function streetLabelPoint(metresOut = 3.5): EN {
  const a = YARD.west, b = YARD.north;
  const len = Math.hypot(b.e - a.e, b.n - a.n);
  // Left of the direction of travel west → north is away from the yard.
  return { e: (a.e + b.e) / 2 - ((b.n - a.n) / len) * metresOut, n: (a.n + b.n) / 2 + ((b.e - a.e) / len) * metresOut };
}

/** A compass bearing as a rotation about the vertical axis in plan coordinates. */
export function bearingToPlanTurn(deg: number, northDeg = NORTH_DEG): number {
  const r = (deg * Math.PI) / 180;
  const v = enToPlan(Math.sin(r), Math.cos(r), northDeg);
  return Math.atan2(v.x, v.z);
}

/**
 * Rooms the garage sits under. Christo's note on the photo: "Garage under living
 * room and dining room". The model draws the living level only, so this is shown
 * as an outline on those two floors — it is what makes sense of the family
 * living upstairs — and it is why zones 010 (PIR · Garage) and 030 (Beam ·
 * Garage) stay unplaced: they are on a level this model does not draw yet.
 */
export const GARAGE_UNDER = ["tv", "dining"];

/**
 * Alarm zone number → the plan room it is in.
 *
 * Only zones whose room is settled are here:
 *   002 · 009 · 023  the plan already uses these exact sensors as the occupancy
 *                    of Guest, Kitchen and Patio.
 *   007 · 021 · 025  the panel names the room and the plan has a room of that
 *                    name (TV Room, Passage, Main).
 *   020              "Door · Kitchen".
 *
 * Deliberately absent, each for a stated reason:
 *   003  "Kids Room"   — the plan has Liam and Eben; the panel does not say which.
 *   008 · 016 · 024    — "Lounge" is not a room on this plan.
 *   013 · 014          — "Front Door" is probably Entry. Probably is not settled.
 *   010 · 030          — the garage is on the level below (see GARAGE_UNDER).
 *   every other beam, 019 Roof — outside the walls; needs the yard drawn.
 *
 * Adding one is a single line here. Everything not listed still appears on the
 * model view, in the "not placed yet" list, with its live state.
 */
export const ZONE_ROOM: Record<string, string> = {
  "002": "bed3",
  "007": "tv",
  "009": "kitchen",
  "020": "kitchen",
  "021": "passage",
  "023": "open_patio",
  "025": "main",
};

export type PlacedZone = { zone: Zone; room: string; slot: number; of: number };

/** Split the panel's zones into those with a place on the model and those without. */
export function placeZones(
  zones: Zone[],
  plan: PlanRoom[] = PLAN,
): { placed: PlacedZone[]; unplaced: Zone[] } {
  const known = new Set(plan.map((r) => r.id));
  const byRoom = new Map<string, Zone[]>();
  const unplaced: Zone[] = [];
  for (const z of zones) {
    const room = ZONE_ROOM[z.n];
    // A registry entry pointing at a room that is not on the plan is a typo, not
    // a placement: keep the zone visible in the unplaced list.
    if (!room || !known.has(room)) { unplaced.push(z); continue; }
    const list = byRoom.get(room);
    if (list) list.push(z); else byRoom.set(room, [z]);
  }
  const placed: PlacedZone[] = [];
  for (const [room, list] of byRoom) {
    list.forEach((zone, slot) => placed.push({ zone, room, slot, of: list.length }));
  }
  return { placed, unplaced };
}

/**
 * Where slot `slot` of `of` sits inside a room. Zones in one room are spread
 * along a line a quarter of the way in from the plan-down edge, so two markers
 * never stack and none hides the room's own label at the centre. The position
 * WITHIN the room is a drawing convention; only the room is a fact.
 */
export function slotPosition(r: RoomRect, slot: number, of: number): { x: number; z: number } {
  return { x: r.x + (r.w * (slot + 1)) / (of + 1), z: r.z + r.d * 0.78 };
}
