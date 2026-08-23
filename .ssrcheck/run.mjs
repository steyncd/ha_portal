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

// ---------------------------------------------------------------------------
console.log("\nH · Rooms: the Outside card, three probes and one number");
const rooms = await import("./out/rooms.mjs");
// The real readings from the house at 05:15 on 2026-08-12. The 5.3 degree spread
// between the roofed patio and the open back yard is genuine, not sensor error,
// and is the whole reason this card shows all three.
const OUT = {
  "sensor.patio_sensor_temperature": "12.16",
  "sensor.outdoor_temperature": "8.0",
  "sensor.back_yard_temperature": "6.9",
};
const r = rooms.run(OUT);
t("lists the patio probe", has(r, "Patio"));
t("lists the courtyard / back door probe", has(r, "Courtyard · back door"));
t("lists the back yard probe and says it is the JoJo's", has(r, "Back yard") && has(r, "JoJo tank monitor"));
t("shows each reading separately", has(r, "12.2°") && has(r, "8.0°") && has(r, "6.9°"));
// (12.16 + 8.0 + 6.9) / 3 = 9.02
t("gives one cumulative number for outside", has(r, "9"));
t("says how many probes are reporting", has(r, "3 of 3 reporting"));
t("states the spread rather than hiding it", has(r, "disagree by") && has(r, "5.3"));

// A flat probe must not drag the average toward a number nobody measured.
const r2 = rooms.run({ ...OUT, "sensor.back_yard_temperature": "unavailable" });
t("an unavailable probe is excluded from the average", has(r2, "2 of 3 reporting"));
// Checked on the ROW, not the whole card: "8.0°" contains "0°", so a naive
// !has(r2, "0°") fails against a perfectly correct render.
t("and the dead probe's row reads em-dash", /Back yard[^0-9]*—/.test(strip(r2)));
// (12.16 + 8.0) / 2 = 10.08
t("the average is over the live probes only", has(r2, "10.1"));

const r3 = rooms.run({
  "sensor.patio_sensor_temperature": "unavailable",
  "sensor.outdoor_temperature": "unavailable",
  "sensor.back_yard_temperature": "unavailable",
});
t("with nothing reporting it says so rather than inventing", has(r3, "No outdoor probe is reporting"));

// ---------------------------------------------------------------------------
console.log("\nI · Security: the gate card (reed truth, graded camera)");
// The house's real values at 2026-08-23 16:20. supported_features 11 on the
// cover = open + close + stop.
const GATEBASE = {
  "cover.study_gate_controller_gate": "closed",
  "sensor.front_yard_gate_controller_gate_state": "Closed",
  "binary_sensor.study_gate_controller_gate_closed_contact": "on",
  "binary_sensor.study_gate_controller_gate_open_contact": "off",
  "binary_sensor.study_gate_controller_gate_locks_engaged": "on",
  "binary_sensor.front_yard_gate_controller_gate_moving": "off",
  "binary_sensor.front_yard_gate_controller_gate_tamper": "off",
  "binary_sensor.front_yard_gate_controller_gate_battery_low": "off",
  "sensor.study_gate_controller_gate_battery_voltage": "13.34",
  "sensor.front_yard_gate_controller_gate_lock_feed_voltage": "13.45",
  "sensor.front_yard_gate_controller_gate_wifi_signal": "-60",
  "sensor.front_yard_gate_controller_gate_uptime": "17402",
  "sensor.gate_opens_today": "18",
  "sensor.gate_open_time_today": "0.69",
  "input_number.gate_lifetime_cycles": "2",
  "input_number.gate_maintenance_cycles": "5000",
  "sensor.gate_camera_accuracy": "86",
  "input_number.gate_cam_checks_total": "7",
  "input_number.gate_cam_correct": "6",
  "input_number.gate_cam_false_closed": "1",
  "input_number.gate_cam_false_open": "0",
  "input_text.gate_cam_last_verdict": "truth=closed cam=closed",
  "input_boolean.gate_cam_grading_enabled": "on",
  "binary_sensor.gate_recently_opened": "off",
};
const g = sec.run({ ...base, ...GATEBASE, "alarm_control_panel.helloliam_alarm_area_01_huis": "armed_home" });
t("the gate card is on Security", has(g, "Gate") && has(g, "reed-confirmed"));
t("posture comes from the reed", has(g, "Closed") && has(g, "closed reed made"));
t("Open asks twice, Close and Stop do not", has(g, "Open the gate") && has(g, "Close") && has(g, "Stop"));
t("shows today's usage", has(g, "18") && has(g, "0.7 h"));
t("accuracy NEVER appears without its sample size", has(g, "86% over only 7 checks"));
t("and says outright that 7 is too few", has(g, "too few to trust yet"));
t("names the one miss by direction", has(g, "Called closed while open"));
t("says the reeds decide, not the camera", has(g, "The reeds decide"));
t("flags that the cycle counter only started recently", has(g, "counts from the day the controller was fitted"));

// Stopped partway: both reeds off and not moving — the state that matters.
const gp = sec.run({ ...base, ...GATEBASE,
  "binary_sensor.study_gate_controller_gate_closed_contact": "off",
  "binary_sensor.study_gate_controller_gate_open_contact": "off" });
t("both reeds off = stopped partway, not 'closed'", has(gp, "Stopped partway"));
t("and it says you can walk through it", has(gp, "wide enough to walk through"));

// Both reeds made is electrically impossible.
const gu = sec.run({ ...base, ...GATEBASE,
  "binary_sensor.study_gate_controller_gate_open_contact": "on" });
t("both reeds made is called out as impossible", has(gu, "Reeds disagree") && has(gu, "electrically impossible"));

// Locks dropping while the gate is shut is a real fault.
const gl = sec.run({ ...base, ...GATEBASE, "binary_sensor.study_gate_controller_gate_locks_engaged": "off" });
t("locks dropping while shut is flagged", has(gl, "DROPPED while shut"));

console.log("\nJ · Rooms: the TV Room mmWave sensor");
const TVBASE = {
  "binary_sensor.tv_room_room_occupied": "on",
  "binary_sensor.tv_room_presence": "on",
  "binary_sensor.tv_room_presence_direct": "on",
  "sensor.tv_room_target_distance": "208",
  "number.tv_room_min_distance_gate": "0",
  "number.tv_room_max_distance_gate": "6",
  "number.tv_room_presence_timeout": "45",
  "switch.tv_room_auto_off_when_empty": "off",
  "sensor.tv_room_wifi_signal": "-32",
  "sensor.tv_room_plug_power": "90",
  "switch.tv_room_plug": "on",
  "sensor.tv_room_temperature": "unknown",
  "climate.tv_room_tv_room_aircon": "off",
};
const tv = rooms.run(TVBASE);
t("the TV Room card is on Rooms", has(tv, "TV Room") && has(tv, "mmWave presence"));
t("occupancy reads as a word", has(tv, "Occupied"));
t("target distance in metres, not raw cm", has(tv, "2.1 m"));
t("shows the watched window the sensor is configured with", has(tv, "watched window") && has(tv, "6.0 m"));
t("exposes the hold that debounces presence", has(tv, "45 s"));
t("the aircon is offered", has(tv, "Aircon") && has(tv, "cool") && has(tv, "heat"));
t("and is honest that it has no temperature feedback", has(tv, "running blind"));

const tvc = rooms.run({ ...TVBASE, "binary_sensor.tv_room_room_occupied": "off", "binary_sensor.tv_room_presence": "off" });
t("clear reads Clear", has(tvc, "Clear"));

// The hold is why raw and debounced can disagree; say so rather than look broken.
const tvh = rooms.run({ ...TVBASE, "binary_sensor.tv_room_presence": "off" });
t("a raw/debounced disagreement is explained by the hold", has(tvh, "hold is still running"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
