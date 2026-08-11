// npm run entities
//
// Cross-checks every entity id written into src/ against the entities Home
// Assistant actually has right now, and reports the ones that do not resolve.
//
// WHY THIS EXISTS, and why it uses the LIVE API rather than the registry:
// .storage/core.entity_registry omits anything without a unique_id, which is
// most YAML template sensors and every MQTT entity in this house. Checking
// against the registry produces a long list of "missing" entities that are
// perfectly real — which is worse than not checking, because it trains you to
// ignore the output. /api/states is the authority: 4,653 entries, everything
// that exists.
//
// It only looks inside string literals. An earlier version regexed the source
// directly and reported `text.trim`, `date.slice` and `button.on` as missing
// entities, because `domain.object_id` and a JavaScript property access are
// the same shape.
//
// The token comes from secrets.yaml on the config mount, so this runs on
// Christo's machine and nowhere else. Nothing is written; it is a read-only GET.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const CONFIG = "/Volumes/config";
const HA = "https://ha.helloliam.co.za";

const DOMAINS = [
  "sensor", "binary_sensor", "switch", "light", "input_boolean", "input_number",
  "input_text", "input_select", "input_datetime", "alarm_control_panel", "climate",
  "cover", "lock", "media_player", "person", "device_tracker", "camera", "script",
  "scene", "automation", "button", "number", "select", "todo", "calendar",
  "weather", "vacuum", "fan", "water_heater", "counter", "timer", "zone", "group",
];
// Second halves that are service names, not object_ids. `input_number.set_value`
// is a service call and looks exactly like an entity id.
const SERVICES = new Set([
  "set_value", "turn_on", "turn_off", "toggle", "select_option", "reload", "press",
  "set_datetime", "increment", "decrement", "trigger", "create", "dismiss",
  "get_forecasts", "add_item", "update_item", "remove_item", "get_items", "apply",
  "process", "speak", "send_message", "play_media", "snapshot", "record", "read",
]);

const EID = new RegExp(`^(${DOMAINS.join("|")})\\.([a-z0-9_]+)$`);
const STR = /'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g;

async function token() {
  const src = await readFile(join(CONFIG, "secrets.yaml"), "utf8");
  const m = src.match(/^me_history_token:\s*(.+)$/m);
  if (!m) throw new Error("no me_history_token in secrets.yaml");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

// Test files are skipped for the same reason mock.ts is excluded below: a fixture
// entity id is SUPPOSED to be fake. src/lib/trends.test.ts uses "sensor.x", and
// reporting that as a broken reference is reporting the point of the file.
const isTest = (name) => /\.test\.ts$/.test(name);

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "test") continue;              // src/test/ — harness + smoke tests
      out.push(...(await walk(p)));
    } else if (/\.(ts|svelte)$/.test(e.name) && !isTest(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const refs = new Map();
for (const f of await walk("src")) {
  const lines = (await readFile(f, "utf8")).split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(STR)) {
      const s = (m[1] ?? m[2] ?? m[3] ?? "").trim();
      const hit = EID.exec(s);
      if (!hit || SERVICES.has(hit[2])) continue;
      if (!refs.has(s)) refs.set(s, []);
      refs.get(s).push(`${f}:${i + 1}`);
    }
  });
}

let live;
try {
  const res = await fetch(`${HA}/api/states`, {
    headers: { Authorization: `Bearer ${await token()}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  live = new Set((await res.json()).map((e) => e.entity_id));
} catch (e) {
  console.error(`Cannot reach Home Assistant (${e.message}).`);
  console.error("Needs the config mount for the token and the house reachable.");
  process.exit(2);
}

// Entities that do not exist YET, on purpose, with the reason. This list is
// short and each line has to justify itself — a checker that always prints two
// known items is a checker you learn to skim past, and then you skim past the
// third.
const EXPECTED = new Map([
  ["sensor.study_bt_device_scanner_desk_temperature",
   "ESP32-S3 desk scanner not flashed yet (same hardware as the desk LED)"],
  ["sensor.study_bt_device_scanner_desk_humidity",
   "ESP32-S3 desk scanner not flashed yet"],
]);

// mock.ts describes a fake house for dev mode. Its entities are SUPPOSED not to
// exist; reporting them as missing would be reporting the point of the file.
const isMock = (where) => where.every((w) => w.startsWith("src/lib/mock.ts"));

const missing = [...refs].filter(([id]) => !live.has(id));
const mocked = missing.filter(([, w]) => isMock(w));
const notMock = missing.filter(([, w]) => !isMock(w));
const pending = notMock.filter(([id]) => EXPECTED.has(id));
const real = notMock.filter(([id]) => !EXPECTED.has(id));

console.log(`${refs.size} entity ids in src/ · ${live.size} live in HA`);
console.log(`${real.length} unexplained · ${pending.length} known pending · ${mocked.length} mock-only\n`);

for (const [id] of pending.sort()) console.log(`· ${id}\n    expected: ${EXPECTED.get(id)}`);
if (pending.length && real.length) console.log("");

for (const [id, where] of real.sort()) {
  // Suggest a live entity in the same domain with a similar object_id — most of
  // these turn out to be a re-typed copy of a name that exists.
  const dom = id.split(".")[0];
  const obj = id.slice(dom.length + 1);
  const near = [...live]
    .filter((e) => e.startsWith(dom + "."))
    .map((e) => {
      const o = e.slice(dom.length + 1);
      const a = new Set(obj.split("_")), b = new Set(o.split("_"));
      const shared = [...a].filter((x) => b.has(x)).length;
      return { e, score: shared / Math.max(a.size, b.size) };
    })
    .filter((x) => x.score >= 0.5)
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    .map((x) => x.e);
  console.log(`✗ ${id}`);
  console.log(`    ${where.join(", ")}`);
  if (near.length) console.log(`    maybe: ${near.join(" · ")}`);
}

if (real.length) {
  console.log(`\n${real.length} to sort out. A reference that does not resolve renders`);
  console.log(`as "—" rather than crashing, which is why these can sit for months.`);
} else {
  console.log("Every entity the portal references exists in Home Assistant.");
}
process.exit(0);
