// The Centurion CP75 gate controller (ESPHome), added to the house 2026-08-23.
//
// THE ONE IDEA THAT SHAPES THIS SCREEN: the reed switches are GROUND TRUTH and
// the camera is a student being graded against them. That is the architecture
// packages/feature_gate_controller.yaml deliberately established — gate-open
// detection was repointed off the camera/LLM guess onto the physical closed
// reed, and the camera's classifier is now scored against it
// (feature_gate_camera_teach.yaml) rather than trusted.
//
// So the card leads with the reed, and shows the camera's accuracy as a claim
// under assessment — never as the answer. Research on communicating model
// confidence is blunt about this: a confident wrong answer costs more trust than
// an honest uncertain one, and a bare percentage with no sample size invites
// exactly the wrong reading. 86% over SEVEN checks is not 86% over seven hundred.

export const GATE = {
  /** device_class: gate, supported_features 11 = open + close + stop. */
  cover: "cover.study_gate_controller_gate",
  /** Closed / Opening / Open / Moving / Stopped Partway — the controller's own word. */
  state: "sensor.front_yard_gate_controller_gate_state",

  // Physical ground truth.
  closedContact: "binary_sensor.study_gate_controller_gate_closed_contact",
  openContact: "binary_sensor.study_gate_controller_gate_open_contact",
  locks: "binary_sensor.study_gate_controller_gate_locks_engaged",
  moving: "binary_sensor.front_yard_gate_controller_gate_moving",
  tamper: "binary_sensor.front_yard_gate_controller_gate_tamper",
  batteryLow: "binary_sensor.front_yard_gate_controller_gate_battery_low",

  battery: "sensor.study_gate_controller_gate_battery_voltage",
  lockFeed: "sensor.front_yard_gate_controller_gate_lock_feed_voltage",
  wifi: "sensor.front_yard_gate_controller_gate_wifi_signal",
  uptime: "sensor.front_yard_gate_controller_gate_uptime",
  version: "sensor.front_yard_gate_controller_gate_esphome_version",
  ip: "sensor.front_yard_gate_controller_gate_ip_address",

  // Usage and service, from feature_gate_smarts.yaml.
  opensToday: "sensor.gate_opens_today",
  openTimeToday: "sensor.gate_open_time_today",
  cycles: "input_number.gate_lifetime_cycles",
  serviceAt: "input_number.gate_maintenance_cycles",
  recentlyOpened: "binary_sensor.gate_recently_opened",

  // Camera grading, from feature_gate_camera_teach.yaml.
  camAccuracy: "sensor.gate_camera_accuracy",
  camChecks: "input_number.gate_cam_checks_total",
  camCorrect: "input_number.gate_cam_correct",
  camFalseClosed: "input_number.gate_cam_false_closed",
  camFalseOpen: "input_number.gate_cam_false_open",
  camVerdict: "input_text.gate_cam_last_verdict",
  camGrading: "input_boolean.gate_cam_grading_enabled",

  trigger: "button.study_gate_controller_gate_trigger",
} as const;

export type GatePosture = "closed" | "open" | "moving" | "partway" | "unknown";

/**
 * What the gate is doing, decided from the REEDS rather than the cover entity.
 *
 * The cover entity is derived from the same hardware, but the two reeds together
 * say something neither the cover nor the camera can: BOTH OFF means the gate is
 * neither shut nor fully open — it is somewhere in between, which is either
 * mid-travel or stopped partway. That distinction is the one that matters,
 * because a gate stopped partway is a gate someone can walk through.
 */
export function posture(closed: boolean, open: boolean, moving: boolean): GatePosture {
  if (moving) return "moving";
  if (closed && !open) return "closed";
  if (open && !closed) return "open";
  // Both reeds off and not moving: stopped somewhere in the middle.
  if (!closed && !open) return "partway";
  // Both reeds ON is electrically impossible — a stuck or shorted reed.
  return "unknown";
}

export const POSTURE_WORD: Record<GatePosture, string> = {
  closed: "Closed",
  open: "Open",
  moving: "Moving",
  partway: "Stopped partway",
  unknown: "Reeds disagree",
};

/**
 * Accuracy as a sentence, with its sample size — never a bare percentage.
 *
 * Under about ten checks the number is noise: one miss moves it by fourteen
 * points. Saying so is more useful than a precise-looking figure nobody should
 * yet act on.
 */
export function accuracyWords(pct: number | null, checks: number | null): string {
  if (pct == null || checks == null || checks < 1) return "not graded yet";
  const n = `${Math.round(checks)} check${Math.round(checks) === 1 ? "" : "s"}`;
  if (checks < 10) return `${Math.round(pct)}% over only ${n} — too few to trust yet`;
  return `${Math.round(pct)}% over ${n}`;
}
