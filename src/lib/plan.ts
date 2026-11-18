// The floor plan — ONE source for the flat plan (Rooms) and the 3D model (Model).
//
// This array lived inside Rooms.svelte until the model needed the same geometry.
// Two copies of fourteen rectangles would have drifted the first time a sensor
// was repointed, so it moved here verbatim and both views import it.
//
// Positions are PERCENTAGES of the drawing box, which is 18 600 mm wide by
// 14 800 mm deep (the aspect ratio the flat plan has always used). `spatial.ts`
// turns them into metres for the model.

import type { RoomKey } from "./rooms";

export type Dev = { id: string; label: string; icon: string; power?: string };
export type TempSrc = { id: string; label: string };
export type PlanRoom = {
  id: string;
  label: string;
  left: number;
  top: number;
  w: number;
  h: number;
  temps?: TempSrc[];
  hum?: string;
  occ?: string;
  lights?: Dev[];
  appliances?: Dev[];
  /** Roofed but not walled in. The model draws these as a slab with no walls.
   *  Patio is `open_patio` by name; Braai is flagged because its only probe is
   *  the patio sensor that OUTDOOR_TEMPS describes as "sheltered, under the
   *  roof" and the Outside card counts as an outdoor reading. Flip the flag if
   *  the braai room is in fact enclosed. */
  open?: boolean;
  /** Key into SCENE_ROOMS (rooms.ts) — which room-scene set this room belongs
   *  to. Derived by matching light membership, not typed from memory: Dining and
   *  TV Room share "living", Passage is the "hallway" set. Rooms with no scene
   *  set (Bath, Guest, En-suite, Braai, Entry) leave it out. */
  scene?: RoomKey;
};

/** The drawing box the percentages refer to, in millimetres. */
export const PLAN_W_MM = 18600;
export const PLAN_H_MM = 14800;

export const PLAN: PlanRoom[] = [
  {
    id: "open_patio", label: "Patio", open: true, scene: "patio", left: 0, top: 0, w: 33.6, h: 24.3, occ: "binary_sensor.helloliam_alarm_zone_023_beam_patio",
    // Labelled "Outside" until 2026-08-12, which read as "the outdoor
    // temperature" when it is one specific probe — the JoJo tank monitor's, in
    // the back yard, which runs several degrees colder than the patio it was
    // sitting under. The Outside card below carries all three.
    temps: [{ id: "sensor.back_yard_temperature", label: "Back yard · JoJo" }],
    lights: [
      { id: "switch.patio_lamp", label: "Patio Lamp", icon: "🪑" },
      { id: "light.back_yard_pool_light", label: "Pool", icon: "🏊", power: "sensor.pool_light_power" },
    ],
  },
  {
    id: "braai", label: "Braai", open: true, left: 0, top: 24.3, w: 22.6, h: 27,
    temps: [{ id: "sensor.patio_sensor_temperature", label: "Braai" }], hum: "sensor.patio_sensor_humidity",
    lights: [{ id: "light.back_yard_fire_pit_light", label: "Fire Pit", icon: "🔥" }],
  },
  {
    id: "study", label: "Study", scene: "study", left: 22.6, top: 24.3, w: 19.4, h: 27, occ: "binary_sensor.study_occupancy",
    temps: [{ id: "sensor.study_sensor_temperature", label: "Study" }], hum: "sensor.study_sensor_humidity",
    lights: [
      { id: "light.study_lamp", label: "Study Lamp", icon: "📖", power: "sensor.study_lamp_power" },
      { id: "light.study_light_1", label: "Study Light 1", icon: "💡", power: "sensor.study_light_1_power" },
      { id: "light.study_light_2", label: "Study Light 2", icon: "💡", power: "sensor.study_light_2_power" },
    ],
    appliances: [
      { id: "switch.study_heater", label: "Heater", icon: "🔥", power: "sensor.study_heater_current_consumption" },
      { id: "switch.work_pc", label: "Work PC", icon: "💻", power: "sensor.work_pc_current_consumption" },
      { id: "switch.study_router_and_ha", label: "Router & HA", icon: "📶", power: "sensor.study_router_and_ha_power" },
    ],
  },
  {
    id: "liam", label: "Liam", scene: "liam", left: 41.9, top: 28.4, w: 17.2, h: 23,
    temps: [{ id: "sensor.liam_s_room_temperature", label: "Liam" }], hum: "sensor.liam_s_room_humidity",
    lights: [{ id: "light.liam_study_lamp", label: "Liam's Lamp", icon: "🛏️" }],
  },
  {
    id: "eben", label: "Eben", scene: "eben", left: 59.1, top: 28.4, w: 16.1, h: 23,
    temps: [{ id: "sensor.eben_s_room_temperature", label: "Eben" }],
    lights: [{ id: "light.eben_room_lamp", label: "Eben Lamp", icon: "💡", power: "sensor.eben_room_lamp_power" }],
  },
  {
    id: "main", label: "Main", scene: "main_bedroom", left: 75.3, top: 28.4, w: 24.7, h: 23, occ: "binary_sensor.main_bed_occupancy_stable",
    temps: [{ id: "sensor.main_room_temperature", label: "Main" }], hum: "sensor.main_bedroom_lamp_si7021_humidity",
    lights: [
      { id: "switch.main_bedroom_lamp", label: "Bedside", icon: "🛏️", power: "sensor.main_bedroom_lamp_power" },
      { id: "switch.main_bedroom_light", label: "Ceiling", icon: "💡" },
      { id: "switch.main_bedroom_dresser_light", label: "Dresser", icon: "🪞" },
      { id: "switch.bedroom_reading_lamp", label: "Reading", icon: "📖" },
      { id: "switch.main_bedroom_outdoor_lights", label: "Outdoor", icon: "🌙" },
    ],
    appliances: [{ id: "switch.main_bedroom_plugs", label: "Plugs", icon: "🔌", power: "sensor.main_bedroom_plugs_current_consumption" }],
  },
  {
    // Occupancy repointed 2026-08-23 from binary_sensor.lounge_area_occupancy
    // to the room's own mmWave sensor. room_occupied is the debounced one that
    // honours the 45 s hold, so the plan does not flicker as someone shifts on
    // the couch — which is exactly what a PIR-derived lounge sensor did.
    id: "tv", label: "TV Room", scene: "living", left: 0, top: 51.4, w: 25.3, h: 33.8, occ: "binary_sensor.tv_room_room_occupied",
    temps: [{ id: "sensor.living_room_sensor_temperature", label: "TV Room" }], hum: "sensor.living_room_sensor_humidity",
    lights: [
      { id: "switch.living_room_lamp", label: "Living", icon: "🛋️", power: "sensor.living_room_lamp_power" },
      { id: "switch.tv_room_lamp", label: "TV Lamp", icon: "📺", power: "sensor.tv_room_lamp_power" },
      { id: "group.lounge_lamps", label: "Lounge Lamps", icon: "🗂️" },
    ],
    appliances: [{ id: "switch.living_room_main_tv_plug", label: "TV", icon: "📺", power: "sensor.living_room_main_tv_plug_power" }],
  },
  {
    id: "dining", label: "Dining", scene: "living", left: 25.3, top: 51.4, w: 15.6, h: 33.8,
    temps: [{ id: "sensor.living_room_sensor_temperature", label: "Dining" }], hum: "sensor.living_room_sensor_humidity",
    lights: [{ id: "light.dining_room_lamp", label: "Dining", icon: "🍽️", power: "sensor.dining_room_lamp_power" }],
  },
  {
    id: "kitchen", label: "Kitchen", scene: "kitchen", left: 40.9, top: 57.4, w: 15.6, h: 27.7, occ: "binary_sensor.helloliam_alarm_zone_009_pir_kitchen",
    temps: [{ id: "sensor.kitchen_sensor_temperature", label: "Kitchen" }], hum: "sensor.kitchen_sensor_humidity",
    lights: [
      { id: "switch.kitchen_lights", label: "Ceiling", icon: "💡", power: "sensor.kitchen_lights_power" },
      { id: "switch.kitchen_under_counter_lights", label: "Counter", icon: "✨", power: "sensor.kitchen_under_counter_lights_power" },
    ],
    appliances: [
      { id: "switch.main_fridge", label: "Fridge", icon: "🧊", power: "sensor.main_fridge_current_consumption" },
      { id: "switch.dishwasher", label: "Dishwasher", icon: "🍽️", power: "sensor.dishwasher_current_consumption" },
      { id: "switch.kettle", label: "Kettle", icon: "🫖", power: "sensor.kettle_current_consumption" },
      { id: "switch.microwave", label: "Microwave", icon: "🍲", power: "sensor.microwave_current_consumption" },
      { id: "switch.air_fryer", label: "Air Fryer", icon: "🍟", power: "sensor.air_fryer_current_consumption" },
      { id: "switch.nespresso", label: "Nespresso", icon: "☕", power: "sensor.nespresso_current_consumption" },
    ],
  },
  {
    id: "passage", label: "Passage", scene: "hallway", left: 40.9, top: 51.4, w: 59.1, h: 6.1, occ: "binary_sensor.hallway_motion_sensor_occupancy",
    lights: [{ id: "switch.hallway_light", label: "Hallway", icon: "🚶" }],
  },
  { id: "bath", label: "Bath", left: 56.5, top: 57.4, w: 11.8, h: 27.7 },
  {
    id: "bed3", label: "Guest", left: 68.3, top: 57.4, w: 16.7, h: 27.7, occ: "binary_sensor.helloliam_alarm_zone_002_pir_guest_room",
    temps: [{ id: "sensor.guest_room_temperature", label: "Guest" }], hum: "sensor.guest_room_humidity",
    lights: [{ id: "light.guest_room_guest_room", label: "Guest Lamp", icon: "🛏️", power: "sensor.guest_room_lamp_power" }],
  },
  { id: "ensuite", label: "En-suite", left: 85, top: 57.4, w: 15.1, h: 27.7, lights: [{ id: "switch.main_bathroom_light", label: "Bathroom", icon: "🚿" }] },
  {
    id: "entrance", label: "Entry", left: 0, top: 85.1, w: 15.6, h: 14.9, occ: "binary_sensor.entrance_entrance_sensor",
    temps: [{ id: "sensor.entrance_entrance_sensor_temperature", label: "Entry" }], hum: "sensor.entrance_entrance_sensor_humidity",
  },
];
