// Alarm zones, DERIVED FROM HOME ASSISTANT rather than listed here.
//
// This replaces a hand-typed ALARM_ZONES of 25 entries. The panel actually
// exposes 32, so seven zones were invisible in the portal — including 030
// (Beam · Garage), the one the cheatsheet flags as a standing bypass. A zone you
// cannot see is a zone you cannot check, which is the whole point of the screen.
//
// Deriving also means the entity ids cannot drift: they are read, not retyped.
// Every naming irregularity below is a real one on this panel, found by listing
// the live entities:
//
//   binary_sensor.helloliam_alarm_zone_022_beam_back_garden          status
//   binary_sensor.helloliam_alarm_zone_022_bypass_beam_back_garden   is it bypassed
//   button.helloliam_alarm_zone_022_bypass_beam_back_garden          bypass it
//   button.helloliam_alarm_zone_022_unbypass_beam_back_garden        restore it
//
//   ...but zone 032 has NO descriptive suffix at all:
//   binary_sensor.helloliam_alarm_zone_032  /  ..._032_bypass  /  button...032_bypass
//
// So the suffix is optional everywhere, and "bypass" has to be matched as a
// whole path segment — `zone_022_bypass_beam_back_garden` is the bypass STATUS of
// zone 22, not a zone named "bypass beam back garden".

export type Zone = {
  /** Zone number as the panel labels it, e.g. "022". */
  n: string;
  /** Human label: "Beam · Back Garden", or "Zone 032" when the panel gives none. */
  label: string;
  /** Is the zone currently open/triggered. */
  id: string;
  /** Is the zone currently bypassed. */
  bypass: string;
  /** Press to bypass. Null if the panel exposes no button for it. */
  bypassBtn: string | null;
  /** Press to restore. Null if the panel exposes no button for it. */
  unbypassBtn: string | null;
};

const PREFIX = "helloliam_alarm_zone_";

const STATUS = new RegExp(`^binary_sensor\\.${PREFIX}(\\d+)(?:_(.*))?$`);
const BYPASS = new RegExp(`^binary_sensor\\.${PREFIX}(\\d+)_bypass(?:_.*)?$`);
const BTN_BYP = new RegExp(`^button\\.${PREFIX}(\\d+)_bypass(?:_.*)?$`);
const BTN_UNBYP = new RegExp(`^button\\.${PREFIX}(\\d+)_unbypass(?:_.*)?$`);

/**
 * Turn a raw suffix into a label: "beam_back_garden" → "Beam · Back Garden".
 *
 * Built from the entity id, not the friendly_name. The friendly names on this
 * panel are inconsistent — "HelloLiam Alarm Zone 022  - Beam - Back Garden", with
 * a double space and hyphens that collide with hyphenated words — and parsing
 * them back out is more fragile than deriving from the id, which is uniform.
 */
function label(n: string, suffix: string | undefined): string {
  if (!suffix) return `Zone ${n}`;
  const CAPS: Record<string, string> = { pir: "PIR", tv: "TV", p1: "P1", p2: "P2" };
  // The middle dot separates a SENSOR KIND from the place it watches — "Beam ·
  // Pool". Only these three words are kinds on this panel; "Front Door" and
  // "Lounge Windows" are single place names, and "Zone 26" is a number, so
  // splitting any of those would read as two unrelated things.
  const KINDS = new Set(["beam", "pir", "door"]);
  const raw = suffix.split("_").filter(Boolean);
  const words = raw.map((w) => CAPS[w] ?? w[0].toUpperCase() + w.slice(1));
  if (words.length > 1 && KINDS.has(raw[0])) return `${words[0]} · ${words.slice(1).join(" ")}`;
  return words.join(" ");
}

/** All zones the panel exposes, ordered by zone number. */
export function deriveZones(entityIds: string[]): Zone[] {
  const byN = new Map<string, Partial<Zone> & { n: string }>();
  const get = (n: string) => {
    let z = byN.get(n);
    if (!z) byN.set(n, (z = { n }));
    return z;
  };

  for (const id of entityIds) {
    // Bypass STATUS must be tested before plain status: both are binary_sensors
    // and `zone_022_bypass_beam_back_garden` matches the status pattern too, with
    // "bypass_beam_back_garden" as its suffix.
    let m = BYPASS.exec(id);
    if (m) { get(m[1]).bypass = id; continue; }
    m = BTN_UNBYP.exec(id);
    if (m) { get(m[1]).unbypassBtn = id; continue; }
    m = BTN_BYP.exec(id);
    if (m) { get(m[1]).bypassBtn = id; continue; }
    m = STATUS.exec(id);
    if (m) {
      const z = get(m[1]);
      z.id = id;
      z.label = label(m[1], m[2]);
      continue;
    }
  }

  return [...byN.values()]
    // A zone needs both a status and a bypass sensor to be shown. Anything with
    // only one of the pair is a partial match, not a zone.
    .filter((z): z is Zone & { id: string; bypass: string } => !!z.id && !!z.bypass)
    .map((z) => ({
      n: z.n,
      label: z.label ?? `Zone ${z.n}`,
      id: z.id,
      bypass: z.bypass,
      bypassBtn: z.bypassBtn ?? null,
      unbypassBtn: z.unbypassBtn ?? null,
    }))
    .sort((a, b) => a.n.localeCompare(b.n));
}
