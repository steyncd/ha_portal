// Refreshes .ssrcheck/real-scripts.json — the list of script entity_ids the HA
// config defines. The render-check asserts the picker offers every one of them,
// so this needs re-running after scripts are added or removed in HA.
//
// Deliberately a dumb top-level-key scan rather than a YAML parse: the only
// thing needed is the keys under `script:` / in scripts.yaml, and adding a YAML
// dependency to the repo for that would be the larger change.
import { readFile, readdir, writeFile } from "node:fs/promises";

const CONFIG = "/Volumes/config";
const ids = new Set();

const topKeys = (src) => [...src.replace(/\r/g, "").matchAll(/^([a-z][a-z0-9_]*):\s*$/gm)].map((m) => m[1]);

// Keys under EVERY top-level `script:` mapping in a package file.
//
// Written out as a tiny state machine rather than one regex because the first
// attempt quietly returned 98 of 101, and the three it dropped were dropped for
// two unrelated reasons worth writing down:
//
//   1. SOME PACKAGE FILES ARE CRLF. feature_desk_led.yaml and
//      feature_tapo_devices.yaml have Windows line endings (Christo edits from
//      the desktop), so an exact `line === "script:"` compares against
//      "script:\r" and never matches. Hence the trim.
//   2. Column-0 `# ---` comments appear INSIDE blocks in this config, and
//      feature_desk_led.yaml has `desk_led_notify` under both `input_boolean:`
//      and `script:`, so the block boundary has to be tracked rather than
//      guessed from the first match.
//
// Both are normal in these files, so the scanner copes rather than the config.
const nestedKeys = (src) => {
  const out = [];
  let inside = false;
  for (const raw of src.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (!line.trim() || /^\s*#/.test(line)) continue;   // blanks and comments, any indent
    if (/^\S/.test(line)) { inside = line.trim() === "script:"; continue; }
    if (!inside) continue;
    const m = line.match(/^  ([a-z][a-z0-9_]*):\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
};

try {
  for (const k of topKeys(await readFile(`${CONFIG}/scripts.yaml`, "utf8"))) ids.add(k);
  for (const f of await readdir(`${CONFIG}/packages`)) {
    if (!f.endsWith(".yaml")) continue;
    for (const k of nestedKeys(await readFile(`${CONFIG}/packages/${f}`, "utf8"))) ids.add(k);
  }
} catch (e) {
  console.error(`Cannot read ${CONFIG} — is the config mount attached?\n${e.message}`);
  process.exit(1);
}

const list = [...ids].map((n) => `script.${n}`).sort();
await writeFile(new URL("../.ssrcheck/real-scripts.json", import.meta.url), JSON.stringify(list, null, 0) + "\n");
console.log(`captured ${list.length} scripts`);
