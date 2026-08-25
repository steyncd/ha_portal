const DESTS = [
  { person: "christo", channel: "push", label: "Christo \xB7 push", short: "Push" },
  { person: "mandri", channel: "push", label: "Mandri \xB7 push", short: "Push" },
  { person: "christo", channel: "whatsapp", label: "Christo \xB7 WhatsApp", short: "WhatsApp" },
  { person: "mandri", channel: "whatsapp", label: "Mandri \xB7 WhatsApp", short: "WhatsApp" },
  { person: "christo", channel: "email", label: "Christo \xB7 email", short: "Email" },
  { person: "mandri", channel: "email", label: "Mandri \xB7 email", short: "Email" }
];
const destKey = (d) => `${d.person}:${d.channel}`;
const CHANNELS = ["push", "whatsapp", "email"];
const PEOPLE = ["christo", "mandri"];
function prettify(slug) {
  const CAPS = { ai: "AI", pc: "PC" };
  return slug.split("_").map((w, i) => CAPS[w] ? CAPS[w] : i === 0 ? w[0].toUpperCase() + w.slice(1) : w).join(" ");
}
const RELATED = [
  "input_boolean.notification_quiet_hours_enabled",
  "input_boolean.notification_batching_enabled",
  "input_boolean.frigate_snapshot_notifications",
  "input_boolean.printer_ink_notifications",
  "input_boolean.desk_led_notify",
  "input_boolean.occupancy_arrival_disarm_notify_enabled"
];
const CRITICAL = ["alarm", "emergency", "safety", "security", "gate_security", "gate_tamper"];
const isCritical = (key) => CRITICAL.includes(key);
function buildMatrix(ids) {
  const rows = /* @__PURE__ */ new Map();
  const flags = [];
  const row = (key) => {
    let r = rows.get(key);
    if (!r) rows.set(key, r = { key, label: prettify(key), cells: {}, perPerson: {} });
    return r;
  };
  for (const id of ids) {
    const m = /^input_boolean\.notify_(.+)$/.exec(id);
    if (!m) continue;
    const rest = m[1];
    let hit = new RegExp(`^(.+)_(${CHANNELS.join("|")})_(${PEOPLE.join("|")})$`).exec(rest);
    if (hit) {
      row(hit[1]).cells[`${hit[3]}:${hit[2]}`] = { id, shared: false };
      continue;
    }
    hit = new RegExp(`^(.+)_(${CHANNELS.join("|")})$`).exec(rest);
    if (hit) {
      const r = row(hit[1]);
      for (const p of PEOPLE) r.cells[`${p}:${hit[2]}`] = { id, shared: true };
      continue;
    }
    hit = new RegExp(`^(.+)_(${PEOPLE.join("|")})$`).exec(rest);
    if (hit) {
      row(hit[1]).perPerson[hit[2]] = id;
      continue;
    }
    const mast = /^(.+)_(enabled|active)$/.exec(rest);
    if (mast) {
      row(mast[1]).master = id;
      continue;
    }
    flags.push(id);
  }
  const out = [];
  for (const r of rows.values()) {
    if (Object.keys(r.cells).length === 0 && Object.keys(r.perPerson).length === 0) {
      if (r.master) flags.push(r.master);
      continue;
    }
    out.push(r);
  }
  for (const r of RELATED) if (ids.includes(r)) flags.push(r);
  out.sort((a, b) => {
    const ca = isCritical(a.key), cb = isCritical(b.key);
    if (ca !== cb) return ca ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
  return { rows: out, flags: [...new Set(flags)].sort() };
}
function columnIds(rows, d) {
  const seen = /* @__PURE__ */ new Set();
  for (const r of rows) {
    const c = r.cells[destKey(d)];
    if (c) seen.add(c.id);
  }
  return [...seen];
}
export {
  DESTS,
  buildMatrix,
  columnIds,
  destKey,
  isCritical,
  prettify
};
