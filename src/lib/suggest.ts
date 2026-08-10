// The catalogue of quick actions the Home surface can fire, plus the ranking
// that powers the "Suggested for now" strip.
//
// Every tappable quick action lives here so a) execution + tap-logging happen in
// ONE place (fireAction), and b) the suggester can rank across the whole set.
// Action ids intentionally match the Favourites catalogue ids (favourites.ts) so
// a pinned favourite and its suggestion are the same thing — pinned items are
// simply excluded from the auto strip.

import { ha } from "./store.svelte";
import { E, ALL_LIGHTS } from "./entities";
import { toast } from "./toast.svelte";
import { prefs } from "./prefs.svelte";
import { NAV, type ViewId } from "./nav";
import { actionLog, bucketFor, type Bucket } from "./actionLog.svelte";

export type ActionKind = "scene" | "toggle" | "arm" | "action";

export type Action = {
  id: string;
  label: string;
  icon: string;
  kind: ActionKind;
  target?: string;
  /** Time buckets where this is a sensible default before we've learned habits
   *  (cold start). Not used once real tap history exists. */
  seed?: Bucket[];
  /** Fire the action (state change only — logging/toast handled by fireAction). */
  do: () => void;
  /** Live "is this on / armed" for toggle & arm tiles. */
  active?: () => boolean;
  /** Optional spoken confirmation over the house speakers. */
  say?: string;
};

const alarmArmed = () => (ha.state(E.alarmMain) ?? "").startsWith("armed");
const OUTDOOR = ["light.street_lights", "switch.driveway_lights_switch", "switch.patio_lamp", "switch.gate_spotlight"];

export const ACTIONS: Action[] = [
  // ── Scenes / experiences (named by intent, not device) ────────────────────
  // "Evening In" is the one people reach for most and it is NOT Goodnight:
  // it arms Stay + beams while deliberately leaving the inside lamps ON, for
  // when you're done outside and settling in front of the TV.
  { id: "eveningin", label: "Evening In", icon: "🌆", kind: "scene", target: E.scEveningIn, seed: ["evening", "afternoon"], do: () => ha.script(E.scEveningIn), say: "Evening in. Alarm armed, lights are staying on." },
  { id: "goodnight", label: "Goodnight", icon: "🌙", kind: "scene", target: E.scGoodnight, seed: ["evening", "late", "night"], do: () => ha.script(E.scGoodnight), say: "Goodnight. Locking up and arming the house." },
  { id: "morning", label: "Good Morning", icon: "☀️", kind: "scene", target: E.scMorning, seed: ["night", "morning"], do: () => ha.script(E.scMorning), say: "Good morning." },
  { id: "away", label: "Leaving", icon: "🚪", kind: "scene", target: E.scAway, seed: ["morning", "midday", "afternoon"], do: () => ha.script(E.scAway), say: "Away mode. Arming up." },
  { id: "movie", label: "Movie", icon: "🎬", kind: "scene", target: E.scMovie, seed: ["evening", "late"], do: () => ha.script(E.scMovie) },
  { id: "braai", label: "Braai", icon: "🔥", kind: "scene", target: "script.braai_mode", seed: ["afternoon", "evening"], do: () => ha.script("script.braai_mode") },

  // ── Security (the single most-used deliberate action) ─────────────────────
  { id: "armaway", label: "Arm Away", icon: "🛡️", kind: "arm", target: E.alarmHome, seed: ["morning", "evening", "late", "night"], do: () => ha.armAway(E.alarmHome), active: alarmArmed, say: undefined },
  { id: "disarm", label: "Disarm", icon: "🔓", kind: "action", target: E.alarmHome, seed: ["morning", "afternoon"], do: () => ha.disarm(E.alarmHome) },

  // ── Lights ────────────────────────────────────────────────────────────────
  { id: "lightsoff", label: "All Lights Off", icon: "🌑", kind: "action", target: E.scLightsOff, seed: ["evening", "late", "night"], do: () => { if (ha.exists(E.scLightsOff)) ha.script(E.scLightsOff); else ha.turnOff(ALL_LIGHTS); } },
  { id: "outdoor", label: "Outside Lights", icon: "🏮", kind: "toggle", target: "light.street_lights", seed: ["evening", "late"], do: () => { const on = OUTDOOR.some((id) => ha.isOn(id)); if (on) ha.turnOff(OUTDOOR); else ha.turnOn(OUTDOOR); }, active: () => OUTDOOR.some((id) => ha.isOn(id)) },

  // ── Pumps & heater ─────────────────────────────────────────────────────────
  { id: "poolpump", label: "Pool Pump", icon: "🏊", kind: "toggle", target: E.poolPump, do: () => ha.toggle(E.poolPump, "Pool pump"), active: () => ha.isOn(E.poolPump) },
  { id: "borehole", label: "Borehole", icon: "🕳️", kind: "toggle", target: E.boreholePump, do: () => ha.toggle(E.boreholePump, "Borehole"), active: () => ha.isOn(E.boreholePump) },
  { id: "waterpump", label: "Water Pump", icon: "💧", kind: "toggle", target: E.waterPump, do: () => ha.toggle(E.waterPump, "Water pump"), active: () => ha.isOn(E.waterPump) },
  { id: "heater", label: "Study Heater", icon: "🔥", kind: "toggle", target: E.heater, seed: ["morning", "night", "late"], do: () => ha.toggle(E.heater, "Study heater"), active: () => ha.isOn(E.heater) },

  // ── Irrigation ─────────────────────────────────────────────────────────────
  { id: "irrigate", label: "Irrigate", icon: "🌿", kind: "scene", target: E.irrStartAll, seed: ["morning"], do: () => ha.script(E.irrStartAll) },
];

export const actionById = (id: string): Action | undefined => ACTIONS.find((a) => a.id === id);

/**
 * Fire an action by id — the single execution path for every quick tile.
 * Runs the action, records the tap for frecency, shows a toast, and (opt-in)
 * speaks a confirmation. `record` defaults true; pass false for programmatic
 * fires that shouldn't count as a habit signal.
 */
export function fireAction(id: string, opts: { record?: boolean; announce?: boolean } = {}) {
  const a = actionById(id);
  if (!a) return;
  a.do();
  if (opts.record !== false) actionLog.record(id);
  // Toggles are deliberately silent here: ha.toggle has already raised an UNDO
  // toast carrying the real prior state. Firing a plain toast after it would
  // overwrite that undo with a message that looks identical but does nothing —
  // an Undo button that vanishes a frame after it appears.
  if (a.kind === "arm") toast.show("Arming away");
  else if (a.id === "disarm") toast.show("Disarmed");
  else if (a.kind !== "toggle") toast.show(a.label);
  if (opts.announce && a.say) ha.announce(a.say);
}

/**
 * Rank the "Suggested for now" strip.
 *
 * Blends learned frecency (actionLog.score) with a small cold-start seed prior so
 * the strip is never empty and orders sensibly on day one; as real taps
 * accumulate they dominate the seed. Pinned favourites and user-hidden actions
 * are excluded — the strip complements the stable pinned row, never duplicates it.
 */
export function suggestions(n = 5, now = Date.now()): { action: Action; learned: boolean }[] {
  const bucket = bucketFor(new Date(now));
  const pinned = new Set(prefs.favourites);
  const hidden = new Set(prefs.hiddenSuggestions);

  const scored = ACTIONS.filter((a) => !pinned.has(a.id) && !hidden.has(a.id)).map((a) => {
    const base = actionLog.score(a.id, now, bucket);
    // Cold-start prior: strong if seeded for this bucket, mild if seeded at all.
    const seedBonus = a.seed?.includes(bucket) ? 0.5 : a.seed ? 0.12 : 0;
    return { action: a, score: base + seedBonus, learned: base > 0.001 };
  });

  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, n).map(({ action, learned }) => ({ action, learned }));
}

// Views always worth offering before we've learned anything, and as filler when
// the user has only visited a couple of pages.
const VIEW_SEED: ViewId[] = ["overview", "climate", "energy", "cameras", "security"];

/**
 * "Jump to" ranking — the features actually reached for most, by view frecency.
 * Falls back to a sensible seed list on a fresh install, and always tops up to
 * `n` so the row never looks broken. `home` is excluded (you're already there).
 */
export function topViews(n = 5, now = Date.now()): { id: ViewId; name: string; ic: string; learned: boolean }[] {
  const ranked = actionLog.rank("v", now).filter((r) => r.id !== "home" && r.id !== "settings");
  const order: ViewId[] = [];
  for (const r of ranked) {
    if (NAV.some((v) => v.id === r.id)) order.push(r.id as ViewId);
    if (order.length >= n) break;
  }
  const learnedCount = order.length;
  for (const s of VIEW_SEED) {
    if (order.length >= n) break;
    if (!order.includes(s)) order.push(s);
  }
  return order.map((id, i) => {
    const item = NAV.find((v) => v.id === id);
    return { id, name: item?.name ?? id, ic: item?.ic ?? "layout", learned: i < learnedCount };
  });
}
