// npm run render-check
//
// The repo has no test runner, and adding one to prove a settings screen works
// would have been a bigger change than the screen. This is the smaller thing
// that still gives real evidence: Svelte's own SSR renderer, the actual
// component, a stubbed HA store, and four entity sets — including the exact 101
// scripts the live config defines.
//
// It answers the one question a type-check cannot: does what appears on screen
// follow the data? Group A is the state until Christo reloads HA; B a remapped
// press; C a mapping pointing at a deleted script; D/E the picker's source and
// the twelve press definitions.
//
// Renders SettingsButtons.svelte for real (Svelte SSR) against four stubbed
// entity sets, to prove what appears on screen is a function of HA's data and
// not of anything written into the component.
const { run } = await import("./out/entry.mjs");
const strip = (h) => h.replace(/<[^>]+>/g, " ").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");
const has = (h, s) => strip(h).includes(s);
let pass = 0, fail = 0;
const t = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "  ok  " : "  FAIL"} ${name}${cond ? "" : "  <-- " + extra}`); };

const SCRIPTS = { "script.arrived_home": "on", "script.leaving_home": "on", "script.goodnight": "on", "script.alarm_arm_home_safe": "on", "script.movie_mode": "on" };
const NAMES = { "script.arrived_home": "Arrived Home", "script.leaving_home": "Leaving Home", "script.goodnight": "Goodnight", "script.alarm_arm_home_safe": "Arm Home (safe)", "script.movie_mode": "Movie mode" };
const KEYS = ["kitchen_single", "kitchen_double", "kitchen_triple", "kitchen_quad", "kitchen_hold", "bedroom_single", "bedroom_double", "bedroom_triple", "bedroom_hold", "patio_single", "patio_double", "patio_hold"];
const H = Object.fromEntries(KEYS.map((k) => [`input_text.btn_${k}`, ""]));

console.log("A · helpers not loaded (the state until HA is reloaded)");
let h = run(SCRIPTS, NAMES);
t("shows the set-up notice", has(h, "helpers are not loaded yet"));
const presses = (h.match(/Single press|Double press|Triple press|Quadruple press|>Hold<|Long press/g) || []).length;
t("all 12 presses still render", presses >= 12, `${presses} found`);
t("every press reads Built-in", (h.match(/Built-in/g) || []).length >= 12, `${(h.match(/Built-in/g) || []).length} found`);
t("real built-in behaviour printed", has(h, "Arrived Home") && has(h, "Toggle the pool pump"));
t("counts 0 of 12 remapped", has(h, "0 of 12"));
t("no Custom or Broken pill", !has(h, "Custom") && !has(h, "Broken"));

console.log("\nB · helpers loaded, patio double remapped to Movie mode");
h = run({ ...SCRIPTS, ...H, "input_text.btn_patio_double": "script.movie_mode", "input_text.btn_last_dispatch": "patio double -> script.movie_mode @ 19:42" }, NAMES);
t("set-up notice gone", !has(h, "helpers are not loaded yet"));
t("remapped press shows Custom", has(h, "Custom"));
t("names the script it runs now", has(h, "Runs Movie mode"));
t("still names the built-in replaced", has(h, "Toggle the pool pump"));
t("counts 1 of 12", has(h, "1 of 12"));
t("last dispatch read from the helper", has(h, "patio double -> script.movie_mode @ 19:42"));

// This is the LIVE state after a fresh reload: the helpers exist, but their
// state is 'unknown' rather than '' because a YAML input_text has no value until
// something writes one. Added after seeing it on the real instance — group A
// covers helpers that are absent, which is a different thing.
console.log("\nB2 · helpers exist but are 'unknown' (the state after a reload)");
h = run({ ...SCRIPTS, ...Object.fromEntries(KEYS.map((k) => [`input_text.btn_${k}`, "unknown"])), "input_text.btn_last_dispatch": "unknown" }, NAMES);
t("set-up notice gone — the helpers do exist", !has(h, "helpers are not loaded yet"));
t("unknown counts as no override", (h.match(/Built-in/g) || []).length >= 12, `${(h.match(/Built-in/g) || []).length} Built-in`);
t("no Custom or Broken pill", !has(h, "Custom") && !has(h, "Broken"));
t("counts 0 of 12", has(h, "0 of 12"));
t("last dispatch reads 'none yet', not 'unknown'", has(h, "none yet"));

console.log("\nC · a mapping whose script was deleted in HA");
h = run({ ...SCRIPTS, ...H, "input_text.btn_bedroom_hold": "script.deleted_thing" }, NAMES);
t("shows Broken", has(h, "Broken"));
t("says the press does nothing", has(h, "currently does nothing"));
t("names the missing script", has(h, "script.deleted_thing"));

console.log("\nD · the picker's source: every script HA has, none dropped");
// The picker panel is click-gated, so SSR cannot render it. What it renders FROM
// is testable directly, and that is the part that could silently drop a script.
const { assignableScripts, BUTTONS, ALL_PRESSES, helperFor } = await import("./buttons.mjs");
// real-scripts.json is the 101 script ids the live config defined on
// 2026-08-10 — a fixture, so this runs with the config mount offline. It is
// what makes "offers all 101" mean something; regenerate it after adding
// scripts in HA (scripts/capture-scripts.mjs).
const fixture = new URL("./real-scripts.json", import.meta.url);
const real = JSON.parse(await (await import("node:fs/promises")).readFile(fixture, "utf8"));
const mixed = [...real, "light.kitchen", "switch.pool_pump", "input_text.btn_patio_hold", "automation.thing"];
const offered = assignableScripts(mixed);
t(`offers all ${real.length} real scripts`, offered.length === real.length, `${offered.length} offered`);
t("drops every non-script entity", offered.every((id) => id.startsWith("script.")));
t("nothing silently filtered out", real.every((id) => offered.includes(id)),
  real.filter((id) => !offered.includes(id)).join(", "));
t("sorted, so the list is scannable", offered.join() === [...offered].sort().join());
t("the alarm scripts ARE offered (all guarded, verified)", offered.includes("script.alarm_arm_home_safe") && offered.includes("script.alarm_disarm"));

console.log("\nE · the twelve presses and their helper ids");
t("12 presses across 3 buttons", ALL_PRESSES.length === 12 && BUTTONS.length === 3, `${ALL_PRESSES.length}/${BUTTONS.length}`);
t("no duplicate helper ids", new Set(ALL_PRESSES.map((p) => helperFor(p.key))).size === 12);
t("every helper is input_text.btn_*", ALL_PRESSES.every((p) => /^input_text\.btn_[a-z_]+$/.test(helperFor(p.key))));
t("every press documents its built-in behaviour", ALL_PRESSES.every((p) => p.current && p.current.length > 10));
t("the 3 alarm-changing presses are flagged", ALL_PRESSES.filter((p) => p.security).length === 3,
  ALL_PRESSES.filter((p) => p.security).map((p) => p.key).join(", "));

// ---------------------------------------------------------------------------
console.log("\nF · Security zones: all of them, real status, working controls");
// Built from the LIVE entity ids captured from the panel, so this proves the
// derivation against the real naming — including zone 032, which has no
// descriptive suffix, and the bypass sensors whose ids look like zone names.
const { deriveZones } = await import("./zones.mjs");
const sec = await import("./out/security.mjs");
const zoneIds = JSON.parse(await (await import("node:fs/promises"))
  .readFile(new URL("./zone-entities.json", import.meta.url), "utf8"));

const derived = deriveZones(zoneIds);
t("derives all 32 zones the panel exposes", derived.length === 32, `${derived.length}`);
t("every zone has a bypass AND an unbypass button", derived.every((z) => z.bypassBtn && z.unbypassBtn));
t("every derived id is one the panel really has", derived.every((z) => zoneIds.includes(z.id) && zoneIds.includes(z.bypass)));
t("zone 032 (no name suffix) is included", derived.some((z) => z.n === "032" && z.label === "Zone 032"));
t("zone 030 Beam · Garage is included — it was missing before", derived.some((z) => z.label === "Beam · Garage"));
t("a bypass sensor is never mistaken for a zone", !derived.some((z) => z.label.toLowerCase().includes("bypass")));
t("labels read as kind · place", derived.some((z) => z.label === "Beam · Back Garden") && derived.some((z) => z.label === "PIR · TV Room"));
t("single place names are not split", derived.some((z) => z.label === "Front Door") && derived.some((z) => z.label === "Lounge Windows"));

// Render the screen with zone 022 bypassed and 013 open — the live shape.
const base = Object.fromEntries(zoneIds.map((id) => [id, id.startsWith("button.") ? "unknown" : "off"]));
const view = sec.run({
  ...base,
  "binary_sensor.helloliam_alarm_zone_022_bypass_beam_back_garden": "on",
  "binary_sensor.helloliam_alarm_zone_013_front_door": "on",
  "alarm_control_panel.helloliam_alarm_area_01_huis": "armed_home",
  "alarm_control_panel.helloliam_alarm_area_02_beams": "armed_away",
});
t("renders all 32 zone rows", (view.match(/class="zrow/g) || []).length === 32, `${(view.match(/class="zrow/g) || []).length} rows`);
t("counts 32 of 32", has(view, "Zones · 32 of 32"));
t("the bypassed zone reads Bypassed, not Clear", has(view, "Bypassed"));
t("the open zone reads Open", has(view, "Open"));
t("offers Restore for the bypassed zone", has(view, "Restore"));
t("offers Bypass for the others", has(view, "Bypass"));
t("has a Restore all for the one bypassed zone", has(view, "Restore all 1"));
// Attribute text, so it is checked in the raw HTML — strip() removes tags.
t("search placeholder counts the real zones", view.includes("Search 32 zones"));
t("explains that a bypassed zone will not trigger", has(view, "will not trigger"));
t("states the measured confirmation range", has(view, "fifteen seconds to about three minutes"));
// The auto-restore rule differs by armed state, and getting it backwards would
// tell Christo a bypass is temporary when it will actually last all night.
t("armed: says the bypass lasts the whole armed session", has(view, "stays for this whole armed session"));
t("armed: does NOT claim it auto-restores in an hour", !has(view, "is restored automatically"));

// BOTH areas, because the auto-restore rule checks both — and when the beams
// entity is missing the screen deliberately shows the armed wording, since
// promising an auto-restore it cannot guarantee is the worse error.
const clear = sec.run({
  ...base,
  "alarm_control_panel.helloliam_alarm_area_01_huis": "disarmed",
  "alarm_control_panel.helloliam_alarm_area_02_beams": "disarmed",
});
t("with nothing bypassed there is no Restore all", !has(clear, "Restore all"));
t("disarmed: says an hour-old bypass is auto-restored", has(clear, "restored automatically"));
t("disarmed: does not claim the session rule", !has(clear, "stays for this whole armed session"));
t("all zones read Clear", (clear.match(/Clear/g) || []).length >= 32, `${(clear.match(/Clear/g) || []).length}`);

// ---------------------------------------------------------------------------
console.log("\nG · Security is now the FULL page, not a read-only hub");
// The nav used to land on SecurityHub, which had no arm/disarm and no zone
// controls. These assert the things that must be on the page you actually land on.
const full = sec.run({
  ...base,
  "alarm_control_panel.helloliam_alarm_area_01_huis": "armed_home",
  "alarm_control_panel.helloliam_alarm_area_02_beams": "armed_away",
  "binary_sensor.helloliam_alarm_zone_022_bypass_beam_back_garden": "on",
  "input_text.alarm_last_event": JSON.stringify({
    f: "disarmed", t: "armed_home", at: new Date(Date.now() - 90 * 60_000).toISOString(),
    a: "Christo", s: "ui", ar: "house",
  }),
});
t("area controls are on the page", has(full, "Zones · 32 of 32"));
t("provenance line names who armed it", has(full, "by Christo"));
t("provenance carries since-when, not a bare state", has(full, "Continuously armed for"));
t("the audit-log section is present", has(full, "Every arm and disarm"));
t("spokes to cameras / traffic / timeline", has(full, "Cameras") && has(full, "Timeline"));
t("bypass control still there", has(full, "Restore") && has(full, "Bypass"));

// The unexplained case is the one this screen exists for.
const flap = sec.run({
  ...base,
  "alarm_control_panel.helloliam_alarm_area_01_huis": "disarmed",
  "input_text.alarm_last_event": JSON.stringify({
    f: "armed_home", t: "disarmed", at: new Date(Date.now() - 60_000).toISOString(),
    a: "", s: "flap", ar: "house",
  }),
});
t("an actor-less disarm is called out", has(flap, "State changed with no actor"));
t("and it is not dressed up as normal", !has(flap, "Disarmed for"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
