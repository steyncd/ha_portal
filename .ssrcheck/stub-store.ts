// Stubbed HA store: a fixed entity set, so what renders is provably a function
// of the data and not of anything hard-coded in the component.
const ents: Record<string, { state: string; attributes: Record<string, unknown> }> = {};

/**
 * A value may be a bare state string, or [state, attributes].
 *
 * The tuple form exists because a climate entity keeps its target in an
 * ATTRIBUTE (temperature), not its state — so without it the aircon test set
 * target to undefined and silently skipped the gap-to-target sentence entirely
 * while still reporting green.
 */
type Val = string | [string, Record<string, unknown>];

export function setEntities(list: Record<string, Val>, names: Record<string, string> = {}) {
  for (const k of Object.keys(ents)) delete ents[k];
  for (const [id, v] of Object.entries(list)) {
    const [st, attrs] = Array.isArray(v) ? v : [v, {}];
    ents[id] = {
      state: st,
      attributes: { ...attrs, ...(names[id] ? { friendly_name: names[id] } : {}) },
    };
  }
}
export const pressed: string[] = [];
export const ha = {
  get entities() { return ents; },
  exists: (id: string) => id in ents,
  state: (id: string) => ents[id]?.state,
  num: (id: string) => { const v = Number(ents[id]?.state); return Number.isFinite(v) ? v : null; },
  attr: (id: string, a: string) => ents[id]?.attributes?.[a],
  setText: async () => {},
  isOn: (id: string) => ents[id]?.state === "on",
  available: (id: string) => !!ents[id] && !["unknown", "unavailable"].includes(ents[id].state),
  pressButton: (id: string) => { pressed.push(id); },
  mockSet: () => {},
  historyStates: async () => [],
  history: async () => [],
  unit: () => "°C",
  name: (id: string) => id,
  toggle: () => {},
  armAway: () => {}, armHome: () => {}, armNight: () => {}, disarm: () => {}, script: () => {},
  status: "connected",
};
