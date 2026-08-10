// Stubbed HA store: a fixed entity set, so what renders is provably a function
// of the data and not of anything hard-coded in the component.
const ents: Record<string, { state: string; attributes: Record<string, unknown> }> = {};
export function setEntities(list: Record<string, string>, names: Record<string, string> = {}) {
  for (const k of Object.keys(ents)) delete ents[k];
  for (const [id, st] of Object.entries(list)) ents[id] = { state: st, attributes: names[id] ? { friendly_name: names[id] } : {} };
}
export const ha = {
  get entities() { return ents; },
  exists: (id: string) => id in ents,
  state: (id: string) => ents[id]?.state,
  num: (id: string) => { const v = Number(ents[id]?.state); return Number.isFinite(v) ? v : null; },
  attr: (id: string, a: string) => ents[id]?.attributes?.[a],
  setText: async () => {},
};
