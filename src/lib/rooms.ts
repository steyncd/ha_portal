// Room-aware scenes — the portal half of packages/feature_room_scenes.yaml.
//
// One verb ("Relax", "Bright", "Off") resolves to the right lights for whichever
// room it's aimed at (the Josh.ai / Control4 "experience" pattern). Keep the
// `key` values in sync with the room keys in the HA script.

export type RoomKey = "main_bedroom" | "liam" | "eben" | "study" | "living" | "kitchen" | "hallway" | "patio";

export type RoomScene = { key: "bright" | "relax" | "off"; label: string; icon: string };

/** The scenes offered per room. `goodnight` exists in HA too but reads as
 *  "off" in the UI — one less near-duplicate button for the family. */
export const ROOM_SCENES: RoomScene[] = [
  { key: "bright", label: "Bright", icon: "☀️" },
  { key: "relax", label: "Relax", icon: "🌙" },
  { key: "off", label: "Off", icon: "🌑" },
];

export type SceneRoom = {
  key: RoomKey;
  label: string;
  icon: string;
  /** Every light this room controls — used to show a live "n on" count. */
  lights: string[];
};

export const SCENE_ROOMS: SceneRoom[] = [
  { key: "main_bedroom", label: "Main Bedroom", icon: "🛏️", lights: ["switch.main_bedroom_light", "switch.main_bedroom_lamp", "switch.bedroom_reading_lamp", "switch.main_bedroom_dresser_light"] },
  { key: "living", label: "Living & Dining", icon: "🛋️", lights: ["light.dining_room_lamp", "switch.living_room_lamp", "switch.tv_room_lamp"] },
  { key: "kitchen", label: "Kitchen", icon: "🍳", lights: ["switch.kitchen_lights", "switch.kitchen_under_counter_lights"] },
  { key: "study", label: "Study", icon: "📚", lights: ["light.study_light_1", "light.study_light_2", "light.study_lamp"] },
  { key: "liam", label: "Liam's Room", icon: "🧒", lights: ["light.liam_study_lamp"] },
  { key: "eben", label: "Eben's Room", icon: "🧒", lights: ["light.eben_room_lamp"] },
  { key: "hallway", label: "Hallway & Bath", icon: "🚶", lights: ["switch.hallway_light", "switch.main_bathroom_light"] },
  { key: "patio", label: "Patio", icon: "🪑", lights: ["switch.patio_lamp"] },
];
