// Zigbee button mapping. Christo's request: reassign what each press does from
// the portal instead of editing YAML.
//
// HOW IT WORKS, and why this shape rather than the obvious one.
//
// The obvious design is for the portal to rewrite the automation. It must not:
// the portal has no business editing automations, and an automation edited from a
// phone is one nobody can review in git. So instead each (button, press) pair gets
// ONE input_text holding a script entity id, and the automation becomes a
// dispatcher — it reads the helper and calls whatever script is named there.
//
// That keeps the rule the whole project runs on: THE AUTOMATION IS THE SINGLE
// SOURCE OF TRUTH AND THE PORTAL ONLY WRITES WHAT ALREADY EXISTS. The portal
// writes a helper. The automation decides what to do with it.
//
// It also means an unmapped press does nothing at all rather than doing something
// stale — an empty helper is a no-op, which is the safe direction for a button
// that might be reassigned mid-week.
//
// Verified against feature_kitchen_button.yaml and feature_new_devices.yaml on
// 2026-08-10: these are the presses those packages actually handle.

export type Press = {
  /** Suffix of the input_text helper, e.g. "kitchen_single". */
  key: string;
  label: string;
  /** What the ZHA event looks like, for the row's explanation. */
  event: string;
  /** What it does today, from the config. Shown until a helper overrides it. */
  current: string;
  /** Presses that unlock the house get flagged in the UI. */
  security?: boolean;
};

export type ButtonDef = {
  id: string;
  name: string;
  model: string;
  where: string;
  presses: Press[];
};

export const BUTTONS: ButtonDef[] = [
  {
    id: "kitchen",
    name: "Kitchen button",
    model: "Aqara lumi.sensor_switch",
    where: "by the kitchen door",
    presses: [
      { key: "kitchen_single", label: "Single press", event: "click ×1", current: "Arrived Home — disarms both areas, lamps on, clears away mode", security: true },
      { key: "kitchen_double", label: "Double press", event: "click ×2", current: "Leaving Home — away mode, heater off, announce, then arm after a countdown", security: true },
      { key: "kitchen_triple", label: "Triple press", event: "click ×3", current: "Appliances busy? — announcement only" },
      { key: "kitchen_quad", label: "Quadruple press", event: "click ×4", current: "Dinner's ready — announcement only" },
      { key: "kitchen_hold", label: "Hold", event: "hold", current: "Toggle outdoor lights" },
    ],
  },
  {
    id: "bedroom",
    name: "Bedroom button",
    model: "Aqara lumi.sensor_switch",
    where: "at the bed",
    presses: [
      { key: "bedroom_single", label: "Single press", event: "click ×1", current: "Context-aware by hour — one behaviour 04:00–18:00, another 18:00–04:00" },
      { key: "bedroom_double", label: "Double press", event: "click ×2", current: "Toggle the bedside lamps" },
      { key: "bedroom_triple", label: "Triple press", event: "click ×3", current: "Toggle the outside lights" },
      { key: "bedroom_hold", label: "Hold", event: "hold", current: "Disarm anytime — unlocks the house with no conditions", security: true },
    ],
  },
  {
    id: "patio",
    name: "Patio button",
    model: "Aqara lumi.sensor_switch",
    where: "outside",
    presses: [
      { key: "patio_single", label: "Single press", event: "click ×1", current: "Toggle outdoor lights" },
      { key: "patio_double", label: "Double press", event: "click ×2", current: "Toggle the pool pump" },
      { key: "patio_hold", label: "Long press", event: "hold", current: "Toggle the patio lamp" },
    ],
  },
];

export const helperFor = (key: string) => `input_text.btn_${key}`;

/** Every press across every button — for the coverage count. */
export const ALL_PRESSES = BUTTONS.flatMap((b) => b.presses);

/**
 * Scripts a button may be pointed at: all of them, which is the deliberate
 * choice, including the alarm ones.
 *
 * I checked all 101 scripts in the config on 2026-08-10 (see the raw_calls walk
 * in the commit message): every raw `alarm_control_panel.alarm_arm_*` /
 * `alarm_disarm` call in the entire script library already sits behind a
 * panel-state condition. Combined with the dispatcher only ever being able to
 * call `script.*`, that means NO assignment made from this screen can toggle an
 * already-armed area — which on this IDS panel is what a raw arm command does.
 * So there is nothing here that needs hiding for safety.
 *
 * No convenience filtering either. 101 entries is a lot, and the temptation is to
 * hide the ones that look internal — but every guess about which scripts Christo
 * does not want is a script he cannot find, and the search box solves the length
 * problem without guessing.
 */
export function assignableScripts(all: string[]): string[] {
  return all.filter((id) => id.startsWith("script.")).sort();
}
