// Twins — design once, deploy many. PLATFORM-CONCEPTS §1.
//
// Five template shapes cover sixty-five real things in this house, and every one
// of them is currently written out by hand. That is why feature_solcast.yaml,
// solar_forecast.yaml and feature_solar_intel.yaml all exist: three files that
// are the same shape with different entity ids, because there was no shape to
// instantiate.
//
// THE TEST THAT IT WORKED: adding a room is one JSON object, and that room
// arrives already knowing how to be stale, how to be put under maintenance, and
// how to appear on the plan. If adding a room still means editing four files,
// this layer has not earned its place.
//
// This file declares the SHAPES. `instances.ts` binds slots to real entity ids.
// The generator (`npm run twins`) turns the pair into the entity map — which is
// why entities.ts becomes a build artefact rather than something you edit.

/** A slot is one endpoint a template needs, and whether it can be absent. */
export type Slot = {
  key: string;
  /** HA domain the slot accepts. */
  domain: string;
  /** Optional slots are the difference between a template and a straitjacket:
   *  Bath has no temperature sensor and Eben's room has no humidity. */
  optional?: boolean;
  /** What it is for, in one line. */
  purpose: string;
};

export type Template = {
  id: string;
  name: string;
  /** How many real things this shape covers. */
  expected: number;
  slots: Slot[];
  /** Behaviour every instance inherits for free. This is the actual payoff. */
  inherits: string[];
};

export const TEMPLATES: Template[] = [
  {
    id: "room",
    name: "Room",
    expected: 8,
    slots: [
      { key: "temp", domain: "sensor", optional: true, purpose: "primary temperature" },
      { key: "humidity", domain: "sensor", optional: true, purpose: "relative humidity" },
      { key: "occupancy", domain: "binary_sensor", optional: true, purpose: "someone is in here" },
      { key: "lights", domain: "light", optional: true, purpose: "members, for the room scene verbs" },
      { key: "appliances", domain: "switch", optional: true, purpose: "metered things in this room" },
    ],
    inherits: [
      "a comfort band from the shared five-band ramp",
      "a freshness threshold from the cadence blob",
      "a position on the floor plan",
      "both plan overlays — temperature, and power & people",
      "eligibility for a maintenance window",
    ],
  },
  {
    id: "appliance",
    name: "Metered appliance",
    expected: 17,
    slots: [
      { key: "switch", domain: "switch", purpose: "the thing itself" },
      { key: "power", domain: "sensor", purpose: "instantaneous draw" },
      { key: "energy", domain: "sensor", optional: true, purpose: "cumulative, for cost" },
    ],
    inherits: [
      "a 30-day rolling baseline",
      "step-change drift detection against that baseline",
      "a cost line using the current tariff",
      "a row on the Rooms inventory",
    ],
  },
  {
    id: "zone",
    name: "Alarm zone",
    expected: 31,
    slots: [
      { key: "state", domain: "binary_sensor", purpose: "open or closed" },
      { key: "bypass", domain: "binary_sensor", optional: true, purpose: "excluded from arming" },
    ],
    inherits: [
      "an actor on every state change",
      "a bypass expiry — a suppression without an end time is not allowed",
      "a place in the Security zone list",
    ],
  },
  {
    id: "lightarea",
    name: "Light area",
    expected: 6,
    slots: [
      { key: "members", domain: "light", purpose: "the lights in this area" },
      { key: "bright", domain: "scene", optional: true, purpose: "the bright set" },
      { key: "soft", domain: "scene", optional: true, purpose: "the soft set" },
    ],
    inherits: ["the scene verbs (bright / soft / off)", "a room association on the plan"],
  },
  {
    id: "pump",
    name: "Pump",
    expected: 3,
    slots: [
      { key: "switch", domain: "switch", purpose: "the pump" },
      { key: "power", domain: "sensor", purpose: "draw while running" },
      { key: "runtime", domain: "sensor", optional: true, purpose: "minutes or hours today" },
    ],
    inherits: [
      "a p95 run length from its own history",
      "a week-on-week cycle trend",
      "a 'ran longer than it usually does' rule",
    ],
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);
export const totalExpected = TEMPLATES.reduce((s, t) => s + t.expected, 0);
