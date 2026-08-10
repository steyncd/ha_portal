#!/usr/bin/env node
// Build the entity dependency index. PLATFORM-CONCEPTS §2.
//
// The 111 packages ALREADY ARE the graph — nothing new is needed in Home
// Assistant. This inverts them: for every entity, which files reference it and
// in what capacity.
//
// Why it matters. The freshness work can say "this SoC reading is 14 minutes
// old". It cannot say "and it feeds the battery-to-6am estimate, the reserve
// guard and two automations" — which is the sentence that tells you whether to
// care. The same gap is why `light.outdoor_lights_2` going unavailable was
// invisible even though a live guard references it.
//
// DO NOT HAND-MAINTAIN THIS. If it is not generated it will be wrong within a
// month, and a dependency list that is wrong is worse than none: it will tell
// you something is safe to remove when it is not.
//
// Usage:  node scripts/build-dependency-index.mjs [configDir] [outFile]

import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, basename } from "node:path";

const CONFIG = process.argv[2] || "/Volumes/config";
const OUT = process.argv[3] || "src/lib/generated/dependencies.json";

// Domains worth indexing. Deliberately not every domain HA has — this is the
// set that appears in this house's config and that a reader would ever ask
// "what depends on this" about.
const DOMAINS = [
  "sensor", "binary_sensor", "switch", "light", "input_boolean", "input_number",
  "input_datetime", "input_select", "input_text", "alarm_control_panel", "script",
  "scene", "automation", "cover", "lock", "climate", "person", "group", "counter",
  "camera", "media_player", "number", "select", "button", "device_tracker", "sun",
  "weather", "todo", "calendar", "zone", "timer", "vacuum", "fan", "water_heater",
];
const REF = new RegExp(`\\b(?:${DOMAINS.join("|")})\\.[a-z0-9_]+`, "g");

// `input_number.set_value` is a SERVICE call, not an entity, and the regex
// cannot tell them apart — they are both domain.name. Without this filter the
// busiest "entity" in the house is a service, which makes the whole index look
// wrong at first glance and quietly inflates every count.
const SERVICE_NAMES = new Set([
  "set_value", "turn_on", "turn_off", "toggle", "select_option", "select_next",
  "select_previous", "set_datetime", "press", "reload", "set_temperature",
  "set_hvac_mode", "increment", "decrement", "set_options", "start", "stop",
  "pause", "cancel", "finish", "log", "create", "snapshot", "apply", "trigger",
  "send_command", "play_media", "volume_set", "set_percentage", "set_level",
  "alarm_arm_away", "alarm_arm_home", "alarm_arm_night", "alarm_arm_vacation",
  "alarm_disarm", "alarm_trigger", "set_default_level", "set_cover_position",
  "open_cover", "close_cover", "stop_cover", "lock", "unlock", "reset",
  "add_item", "update_item", "remove_item", "get_items", "set_kelvin",
]);
const isService = (id) => SERVICE_NAMES.has(id.slice(id.indexOf(".") + 1));

/** What kind of thing is doing the referencing. */
function kindOf(file, text) {
  const b = basename(file);
  if (b === "automations.yaml") return "automation";
  if (b === "scripts.yaml") return "script";
  if (b === "scenes.yaml") return "scene";
  // A package can contain several. Pick the dominant one by what it declares,
  // because "package" as a kind tells the reader nothing actionable.
  const counts = {
    automation: (text.match(/^\s*-?\s*(?:id|alias):/gm) || []).length,
    template: (text.match(/^\s{0,4}template:/gm) || []).length * 20,
    script: (text.match(/^script:/gm) || []).length * 20,
  };
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top && top[1] > 0 ? top[0] : "config";
}

async function* walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      // Skip the noise: backups and vendored integrations are not this house's
      // configuration and would swamp the real references.
      if (["backups", "custom_components", "deps", ".storage", "www", "tts", "__pycache__", ".git"].includes(e.name)) continue;
      yield* walk(p);
    } else if (/\.ya?ml$/.test(e.name)) {
      yield p;
    }
  }
}

const index = {}; // entityId -> [{ file, kind }]
let files = 0;

for await (const f of walk(CONFIG)) {
  let text;
  try {
    const s = await stat(f);
    // A 5MB YAML is a dump, not config.
    if (s.size > 5_000_000) continue;
    text = await readFile(f, "utf8");
  } catch { continue; }
  files++;
  const kind = kindOf(f, text);
  const rel = f.replace(`${CONFIG}/`, "");
  const seen = new Set();
  for (const m of text.matchAll(REF)) {
    const id = m[0];
    if (isService(id)) continue;
    // Dedupe per file: 40 references to the same entity in one package is one
    // dependency, not forty.
    const key = `${id}|${rel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    (index[id] ||= []).push({ file: rel, kind });
  }
}

// Entities referenced by exactly one file and only as a definition are not
// really "depended on" — keep them, but the UI can tell the difference by count.
const entities = Object.keys(index).sort();
const out = {
  generatedAt: new Date().toISOString(),
  configDir: CONFIG,
  files,
  entityCount: entities.length,
  index,
};

await writeFile(OUT, JSON.stringify(out, null, 0));

const busiest = entities
  .map((id) => [id, index[id].length])
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8);

console.log(`dependency index: ${entities.length} entities across ${files} files -> ${OUT}`);
console.log("most-depended-on:");
for (const [id, n] of busiest) console.log(`  ${n.toString().padStart(3)}  ${id}`);
