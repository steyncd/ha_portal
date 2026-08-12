#!/usr/bin/env node
// Portal integrity checks — the static half of "does every link work".
//
// No test runner needed and none added: these are assertions over the source,
// which is the only place the answers actually live. Run with `npm run check`.
//
// Every check here exists because a REAL bug got through. That is the bar for
// adding one — not "this would be nice to assert" but "this broke, and nothing
// caught it".
//
//   1 · runes in a plain .ts file        — Diagnostics died with
//                                          rune_outside_svelte. Second time:
//                                          queue.ts did the same thing weeks ago.
//   2 · onnav() target with no route     — a link that navigates nowhere.
//   3 · NAV id with no route             — a rail item that cannot open.
//   4 · route with no NAV entry          — unreachable by ⌘K, invisible to
//                                          visible(), and the $effect bounces
//                                          you to Home.
//   5 · RAIL id not in NAV               — a rail slot rendering undefined.
//   6 · collapsed id with no route       — a "still deep-links" chip that lies.
//   7 · hub views missing onnav prop     — a board whose links silently no-op.
//   8 · Value without digits             — informational: the tank printed
//                                          99.13725490196078.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const fails = [];
const warns = [];
const fail = (check, msg) => fails.push(`${check}: ${msg}`);
const warn = (check, msg) => warns.push(`${check}: ${msg}`);

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = await walk("src");
const read = new Map();
for (const f of files) read.set(f, await readFile(f, "utf8"));

const app = read.get("src/App.svelte") ?? "";
const nav = read.get("src/lib/nav.ts") ?? "";

// ── 1 · Runes only compile in .svelte and .svelte.ts ────────────────────────
// The failure mode is nasty: the build SUCCEEDS and the view throws at runtime,
// so it only shows up when somebody opens that screen.
const RUNE = /(?<![\w.$])\$(state|derived|effect|props)\b\s*[({.]/;
for (const [f, src] of read) {
  if (!f.endsWith(".ts") || f.endsWith(".svelte.ts")) continue;
  // Strip comments — several files legitimately DISCUSS runes in prose.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  if (RUNE.test(code)) fail("runes", `${f} uses a rune but is not a .svelte.ts file`);
}

// ── Route table ────────────────────────────────────────────────────────────
const routes = new Set([...app.matchAll(/^\s{4}([a-z][a-zA-Z]*):\s*\(\)\s*=>\s*import\(/gm)].map((m) => m[1]));
if (routes.size < 20) fail("routes", `only parsed ${routes.size} routes from App.svelte — the regex has drifted`);

// ── NAV / RAIL ─────────────────────────────────────────────────────────────
const navIds = [...nav.matchAll(/\{\s*id:\s*"([a-z][a-zA-Z]*)"/g)].map((m) => m[1]);
const railBlock = nav.match(/export const RAIL[^=]*=\s*\[([\s\S]*?)\]/);
const railIds = railBlock ? [...railBlock[1].matchAll(/"([a-z][a-zA-Z]*)"/g)].map((m) => m[1]) : [];
const collapsed = [...nav.matchAll(/collapsed:\s*\[([^\]]*)\]/g)]
  .flatMap((m) => [...m[1].matchAll(/"([a-z][a-zA-Z]*)"/g)].map((x) => x[1]));

// ── 2 · every onnav("x") target must be a route ─────────────────────────────
// "__palette" is the command palette, not a view.
// Pseudo-ids handled directly in go() rather than being routes: the command
// palette and the two time-machine verbs.
const SPECIAL = new Set(["__palette", "__timemachine", "__live"]);
for (const [f, src] of read) {
  if (!f.endsWith(".svelte")) continue;
  for (const m of src.matchAll(/onnav\(\s*"([^"]+)"\s*\)/g)) {
    const id = m[1];
    if (SPECIAL.has(id)) continue;
    if (!routes.has(id)) fail("onnav", `${f} navigates to "${id}" which has no route in App.svelte`);
  }
}

// ── 3 · every NAV id must be a route ───────────────────────────────────────
for (const id of navIds) {
  if (!routes.has(id)) fail("nav→route", `NAV has "${id}" with no route`);
}

// ── 4 · every route must have a NAV entry ──────────────────────────────────
// This is what visible() and ⌘K read. A route absent from NAV cannot be found,
// and the "bounce to Home" guard sends you away from it.
for (const id of routes) {
  if (!navIds.includes(id)) fail("route→nav", `route "${id}" has no NAV entry — unreachable by ⌘K and deep link`);
}

// ── 5 · every RAIL id must be in NAV ───────────────────────────────────────
for (const id of railIds) {
  if (!navIds.includes(id)) fail("rail", `RAIL lists "${id}" which is not in NAV — the rail would render undefined`);
}

// ── 6 · every collapsed id must be a route ─────────────────────────────────
// The note column promises these "still exist and still deep-link".
for (const id of collapsed) {
  if (!routes.has(id)) fail("collapsed", `hub folds "${id}" but it has no route — the chip would go nowhere`);
}

// ── 7 · views using onnav must be given it ─────────────────────────────────
const propsLine = app.match(/if \(\[([^\]]*)\]\.includes\(id\)\) return \{ onnav: go \}/);
const given = propsLine ? [...propsLine[1].matchAll(/"([a-z][a-zA-Z]*)"/g)].map((m) => m[1]) : [];
const VIEW_FILE = new Map();
for (const id of routes) {
  const m = app.match(new RegExp(`^\\s{4}${id}:\\s*\\(\\)\\s*=>\\s*import\\("\\./(views/[^"]+)"\\)`, "m"));
  if (m) VIEW_FILE.set(id, `src/${m[1]}`);
}
for (const [id, file] of VIEW_FILE) {
  const src = read.get(file);
  if (!src) continue;
  const needsIt = /\bonnav\b/.test(src.split("</script>")[0] ?? "");
  if (needsIt && !given.includes(id)) {
    fail("onnav-prop", `${file} (route "${id}") declares onnav but App does not pass it — every link on it is a no-op`);
  }
}

// ── 8 · Value without explicit digits (informational) ──────────────────────
for (const [f, src] of read) {
  if (!f.endsWith(".svelte")) continue;
  for (const m of src.matchAll(/<Value\s[^>]*>/g)) {
    if (!/digits/.test(m[0])) warn("digits", `${f} renders <Value> without digits — relies on Value's magnitude default`);
  }
}

// ── 9 · Button mapping keys must match the HA helpers ─────────────────────
// Added because this pair CANNOT fail loudly: buttons.ts derives the helper id
// from a key string, so renaming a key here just points the portal at an
// input_text that does not exist — the row renders, the write succeeds, HA
// creates nothing, and the press keeps its old behaviour forever. Silent.
{
  const cfg = "/Volumes/config/packages/feature_button_mapping.yaml";
  const btns = read.get("src/lib/buttons.ts") ?? "";
  const keys = [...btns.matchAll(/\{\s*key:\s*"([a-z_]+)"/g)].map((m) => m[1]);
  if (!keys.length) fail("buttons", "src/lib/buttons.ts defines no press keys");
  let yaml = null;
  try {
    yaml = await readFile(cfg, "utf8");
  } catch {
    warn("buttons", `${cfg} not readable (config mount offline) — ${keys.length} press keys unverified`);
  }
  if (yaml) {
    const helpers = new Set([...yaml.matchAll(/^  (btn_[a-z_]+):/gm)].map((m) => m[1]));
    for (const k of keys) {
      if (!helpers.has(`btn_${k}`)) {
        fail("buttons", `press key "${k}" has no input_text.btn_${k} in feature_button_mapping.yaml — remapping it would silently do nothing`);
      }
    }
    for (const h of helpers) {
      if (h === "btn_last_dispatch") continue;
      if (!keys.includes(h.replace(/^btn_/, ""))) {
        warn("buttons", `input_text.${h} exists in HA but no press in buttons.ts uses it — orphan helper`);
      }
    }
    // The guard is what stops a press firing twice. Its absence is a real,
    // visible bug (button does two things), but only when that press is remapped.
    const guarded = new Set();
    for (const f of ["feature_kitchen_button.yaml", "feature_new_devices.yaml"]) {
      let src = "";
      try { src = await readFile(`/Volumes/config/packages/${f}`, "utf8"); } catch { continue; }
      for (const m of src.matchAll(/input_text\.btn_([a-z_]+)/g)) guarded.add(m[1]);
    }
    if (guarded.size) {
      for (const k of keys) {
        if (!guarded.has(k)) {
          fail("buttons", `press "${k}" has no btn_override_free guard on its built-in automation — remapping it would fire BOTH the script and the built-in`);
        }
      }
    }
  }
}

// ── 10 · Every icon index.html references must EXIST ──────────────────────
// Added after /favicon.ico turned out to be missing: this is an SPA whose
// hosting rewrite sends any unknown path to /index.html, so a missing icon does
// not 404 — it returns HTML with content-type text/html, and the browser quietly
// falls back to its own generic default. A dead icon link is therefore invisible
// in every way except the tab looking wrong.
{
  const html = await readFile("index.html", "utf8");
  const refs = [...html.matchAll(/<link[^>]+href="\/([^"]+)"[^>]*>/g)]
    .filter((m) => /rel="(icon|apple-touch-icon|mask-icon)"/.test(m[0]))
    .map((m) => m[1]);
  if (!refs.length) fail("icons", "index.html references no icons at all");
  for (const r of refs) {
    try {
      await readFile(`public/${r}`);
    } catch {
      fail("icons", `index.html links /${r} but public/${r} does not exist — the SPA rewrite will serve index.html as the icon`);
    }
  }
  // The browser asks for this one whether or not it is linked.
  try {
    await readFile("public/favicon.ico");
  } catch {
    fail("icons", "public/favicon.ico is missing — browsers request it unprompted and will get HTML");
  }
}

// ── Report ─────────────────────────────────────────────────────────────────
console.log(`routes ${routes.size} · NAV ${navIds.length} · RAIL ${railIds.length} · folded ${collapsed.length}`);
if (warns.length) {
  console.log(`\n${warns.length} note${warns.length > 1 ? "s" : ""}:`);
  for (const w of warns) console.log(`  · ${w}`);
}
if (fails.length) {
  console.error(`\n${fails.length} FAILURE${fails.length > 1 ? "S" : ""}:`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("\nintegrity OK");
