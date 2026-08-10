// Twin instances — slots bound to real entity ids. PLATFORM-CONCEPTS §1.
//
// This is the file you edit to add a room. Everything else is derived.
//
// Bound against the live entity registry, and deliberately honest about gaps: an
// absent slot is written as null rather than omitted, so "this room has no
// humidity sensor" is a recorded fact rather than something you rediscover by
// finding an em-dash on screen.

import type { Template } from "./templates";

export type Instance = {
  template: Template["id"];
  id: string;
  name: string;
  /** slot key -> entity id, or an array for multi-slots, or null when absent. */
  slots: Record<string, string | string[] | null>;
};

export const INSTANCES: Instance[] = [
  // ── Rooms (8 sensor-bearing; the plan has 14 including the ones with nothing
  //    in them, which stay in Rooms.svelte's PLAN because they still need drawing)
  {
    template: "room", id: "study", name: "Study",
    slots: {
      temp: "sensor.study_sensor_temperature",
      humidity: "sensor.study_sensor_humidity",
      occupancy: "binary_sensor.study_occupancy",
      lights: ["light.study_lamp", "light.study_light_1", "light.study_light_2"],
      appliances: ["switch.study_heater", "switch.work_pc", "switch.study_router_and_ha"],
    },
  },
  {
    template: "room", id: "main", name: "Main bedroom",
    slots: {
      temp: "sensor.main_room_temperature",
      humidity: "sensor.main_bedroom_lamp_si7021_humidity",
      occupancy: "binary_sensor.main_bed_occupancy_stable",
      lights: ["switch.main_bedroom_lamp", "switch.main_bedroom_light", "switch.main_bedroom_dresser_light"],
      appliances: ["switch.main_bedroom_plugs"],
    },
  },
  {
    template: "room", id: "liam", name: "Liam",
    slots: {
      temp: "sensor.liam_s_room_temperature",
      humidity: "sensor.liam_s_room_humidity",
      occupancy: null,
      lights: ["light.liam_study_lamp"],
      appliances: null,
    },
  },
  {
    template: "room", id: "eben", name: "Eben",
    slots: {
      temp: "sensor.eben_s_room_temperature",
      // No humidity sensor in Eben's room. Recorded, not omitted.
      humidity: null,
      occupancy: null,
      lights: ["light.eben_room_lamp"],
      appliances: null,
    },
  },
  {
    template: "room", id: "kitchen", name: "Kitchen",
    slots: {
      temp: "sensor.kitchen_sensor_temperature",
      humidity: "sensor.kitchen_sensor_humidity",
      occupancy: "binary_sensor.helloliam_alarm_zone_009_pir_kitchen",
      lights: ["switch.kitchen_lights", "switch.kitchen_under_counter_lights"],
      appliances: [
        "switch.main_fridge", "switch.dishwasher", "switch.kettle",
        "switch.microwave", "switch.air_fryer", "switch.nespresso",
      ],
    },
  },
  {
    template: "room", id: "tv", name: "TV Room",
    slots: {
      temp: "sensor.living_room_sensor_temperature",
      humidity: "sensor.living_room_sensor_humidity",
      occupancy: "binary_sensor.lounge_area_occupancy",
      lights: ["switch.living_room_lamp", "switch.tv_room_lamp"],
      appliances: ["switch.living_room_main_tv_plug"],
    },
  },
  {
    template: "room", id: "guest", name: "Guest",
    slots: {
      temp: "sensor.guest_room_temperature",
      humidity: "sensor.guest_room_humidity",
      occupancy: "binary_sensor.helloliam_alarm_zone_002_pir_guest_room",
      lights: ["light.guest_room_guest_room"],
      appliances: null,
    },
  },
  {
    template: "room", id: "braai", name: "Braai",
    slots: {
      temp: "sensor.patio_sensor_temperature",
      humidity: "sensor.patio_sensor_humidity",
      occupancy: null,
      lights: ["light.back_yard_fire_pit_light"],
      appliances: null,
    },
  },

  // ── Pumps (3) ─────────────────────────────────────────────────────────────
  {
    template: "pump", id: "borehole", name: "Borehole",
    slots: {
      switch: "switch.borehole_pump",
      power: "sensor.borehole_pump_power",
      runtime: "sensor.borehole_pump_runtime_today",
    },
  },
  {
    template: "pump", id: "pressure", name: "Pressure pump",
    slots: {
      switch: "switch.water_pump",
      power: "sensor.water_pump_power",
      runtime: "sensor.water_pump_runtime_today",
    },
  },
  {
    template: "pump", id: "pool", name: "Pool pump",
    slots: {
      switch: "switch.pool_pump",
      power: "sensor.pool_pump_power",
      runtime: null,
    },
  },

  // ── Light areas (6) ───────────────────────────────────────────────────────
  { template: "lightarea", id: "outdoor", name: "Outdoor", slots: { members: ["light.street_lights", "switch.driveway_lights_switch", "switch.gate_spotlight"], bright: null, soft: null } },
  { template: "lightarea", id: "stoep", name: "Stoep", slots: { members: ["switch.patio_lamp"], bright: null, soft: null } },
  { template: "lightarea", id: "lounge", name: "Lounge", slots: { members: ["switch.living_room_lamp", "switch.tv_room_lamp"], bright: null, soft: null } },
  { template: "lightarea", id: "kitchenlights", name: "Kitchen", slots: { members: ["switch.kitchen_lights", "switch.kitchen_under_counter_lights"], bright: null, soft: null } },
  { template: "lightarea", id: "bedrooms", name: "Bedrooms", slots: { members: ["light.liam_study_lamp", "light.eben_room_lamp", "switch.main_bedroom_lamp"], bright: null, soft: null } },
  { template: "lightarea", id: "passage", name: "Passage", slots: { members: ["switch.hallway_light"], bright: null, soft: null } },
];

/** Instances of one template. */
export const instancesOf = (template: string) => INSTANCES.filter((i) => i.template === template);

/** Slots left unbound, per instance — the honest coverage report. */
export function unbound(i: Instance): string[] {
  return Object.entries(i.slots).filter(([, v]) => v == null).map(([k]) => k);
}
