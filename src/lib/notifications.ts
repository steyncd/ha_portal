// Notification destinations, DERIVED from Home Assistant's own helpers.
//
// The house already had 83 notify_* toggles when this was written, and not one of
// them was reachable from the portal — they lived only in HA's UI. They are
// organised as CATEGORY x CHANNEL x PERSON, which is the right shape for the
// automations that read them and the wrong shape for the question a person
// actually asks: "stop sending Mandri WhatsApps."
//
// So this parses the ids into a matrix — categories down, the six destinations
// across — and the screen can then act on a whole column. Nothing new is created:
// every switch here is one an automation already reads, which is the difference
// between a settings screen and a wall of decoration.
//
// THE NAMING IS NOT UNIFORM, and pretending otherwise would mislabel real
// switches. Four shapes exist in the wild:
//
//   notify_security_push_christo     category + channel + person   -> one cell
//   notify_alarm_push                category + channel, NO person -> spans both
//   notify_safety_christo            category + person, NO channel -> whole row
//   notify_gate_tamper               neither                       -> a feature flag
//
// A `notify_alarm_push` cell controls BOTH people, and the UI has to say so
// rather than render it under Christo and quietly move Mandri too.

export type Person = "christo" | "mandri";
export type Channel = "push" | "whatsapp" | "email";

export type Dest = { person: Person; channel: Channel; label: string; short: string };

/** The six destinations, in the order Christo asked for them. */
export const DESTS: Dest[] = [
  { person: "christo", channel: "push", label: "Christo · push", short: "Push" },
  { person: "mandri", channel: "push", label: "Mandri · push", short: "Push" },
  { person: "christo", channel: "whatsapp", label: "Christo · WhatsApp", short: "WhatsApp" },
  { person: "mandri", channel: "whatsapp", label: "Mandri · WhatsApp", short: "WhatsApp" },
  { person: "christo", channel: "email", label: "Christo · email", short: "Email" },
  { person: "mandri", channel: "email", label: "Mandri · email", short: "Email" },
];

export type Cell = {
  id: string;
  /** True when this one switch moves both people at once. */
  shared: boolean;
};

export type Row = {
  /** Slug, e.g. "security". */
  key: string;
  /** Human label, e.g. "Security". */
  label: string;
  /** Destination -> the switch that controls it, where one exists. */
  cells: Partial<Record<string, Cell>>;
  /** A category-wide on/off, where the house has one. */
  master?: string;
  /** Person-scoped masters with no channel (notify_safety_christo). */
  perPerson: Partial<Record<Person, string>>;
};

export const destKey = (d: Dest) => `${d.person}:${d.channel}`;

const CHANNELS: Channel[] = ["push", "whatsapp", "email"];
const PEOPLE: Person[] = ["christo", "mandri"];

/** "daily_energy" -> "Daily energy". Acronyms the house uses are kept upper. */
export function prettify(slug: string): string {
  const CAPS: Record<string, string> = { ai: "AI", pc: "PC" };
  return slug
    .split("_")
    .map((w, i) => (CAPS[w] ? CAPS[w] : i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Build the matrix from raw entity ids.
 *
 * Anything that is not a destination toggle comes back in `flags` rather than
 * being dropped — the request was for ALL the notification settings, and quiet
 * hours and the per-report enables matter as much as the destinations do.
 */
/**
 * Notification switches the house does NOT name notify_*, so the matrix parser
 * would never see them. Listed explicitly rather than pattern-matched, because
 * "anything containing notif" would also drag in unrelated helpers.
 */
const RELATED = [
  "input_boolean.notification_quiet_hours_enabled",
  "input_boolean.notification_batching_enabled",
  "input_boolean.frigate_snapshot_notifications",
  "input_boolean.printer_ink_notifications",
  "input_boolean.desk_led_notify",
  "input_boolean.occupancy_arrival_disarm_notify_enabled",
];

/** Categories where switching a destination off means missing something urgent. */
const CRITICAL = ["alarm", "emergency", "safety", "security", "gate_security", "gate_tamper"];

export const isCritical = (key: string) => CRITICAL.includes(key);

export function buildMatrix(ids: string[]): { rows: Row[]; flags: string[] } {
  const rows = new Map<string, Row>();
  const flags: string[] = [];

  const row = (key: string) => {
    let r = rows.get(key);
    if (!r) rows.set(key, (r = { key, label: prettify(key), cells: {}, perPerson: {} }));
    return r;
  };

  for (const id of ids) {
    const m = /^input_boolean\.notify_(.+)$/.exec(id);
    if (!m) continue;
    const rest = m[1];

    // 1. category + channel + person
    let hit = new RegExp(`^(.+)_(${CHANNELS.join("|")})_(${PEOPLE.join("|")})$`).exec(rest);
    if (hit) {
      row(hit[1]).cells[`${hit[3]}:${hit[2]}`] = { id, shared: false };
      continue;
    }
    // 2. category + channel, no person: one switch for both.
    hit = new RegExp(`^(.+)_(${CHANNELS.join("|")})$`).exec(rest);
    if (hit) {
      const r = row(hit[1]);
      for (const p of PEOPLE) r.cells[`${p}:${hit[2]}`] = { id, shared: true };
      continue;
    }
    // 3. category + person, no channel: a whole-row master for that person.
    hit = new RegExp(`^(.+)_(${PEOPLE.join("|")})$`).exec(rest);
    if (hit) {
      row(hit[1]).perPerson[hit[2] as Person] = id;
      continue;
    }
    // 4. a category master, if it is named like one.
    const mast = /^(.+)_(enabled|active)$/.exec(rest);
    if (mast) {
      row(mast[1]).master = id;
      continue;
    }
    // 5. everything else is a feature flag, kept rather than dropped.
    flags.push(id);
  }

  // A row with no destinations at all is really a flag that happened to parse.
  const out: Row[] = [];
  for (const r of rows.values()) {
    if (Object.keys(r.cells).length === 0 && Object.keys(r.perPerson).length === 0) {
      if (r.master) flags.push(r.master);
      continue;
    }
    out.push(r);
  }
  // The differently-named ones, only if the house actually has them.
  for (const r of RELATED) if (ids.includes(r)) flags.push(r);

  // Critical categories first: the rows where a wrong setting costs the most
  // should not be somewhere down an alphabetical list.
  out.sort((a, b) => {
    const ca = isCritical(a.key), cb = isCritical(b.key);
    if (ca !== cb) return ca ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
  return { rows: out, flags: [...new Set(flags)].sort() };
}

/** Every distinct switch behind one destination column, for the bulk toggle. */
export function columnIds(rows: Row[], d: Dest): string[] {
  const seen = new Set<string>();
  for (const r of rows) {
    const c = r.cells[destKey(d)];
    if (c) seen.add(c.id);
  }
  return [...seen];
}
