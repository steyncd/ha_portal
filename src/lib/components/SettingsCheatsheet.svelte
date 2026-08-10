<script lang="ts">
  // Settings › Cheatsheet — the info pack.
  //
  // EVERY CLAIM ON THIS SCREEN IS READ FROM /Volumes/config, OR IT IS MARKED AS
  // UNCONFIRMED. That rule exists because the first version of this file failed
  // it badly: the button actions came from the design prototype, which was
  // plausible fiction, and every one of them was wrong. The kitchen button's
  // single press is "Arrived Home", not "kitchen lights".
  //
  // A cheatsheet is the one screen where being wrong is worse than being absent.
  // Its entire purpose is that someone trusts it without checking — a
  // house-sitter, Mandri, or Christo in eighteen months. So anything I could not
  // verify in the config is in the "needs confirming" group at the bottom rather
  // than sitting among the facts.
  //
  // Verified 2026-08-10 against feature_kitchen_button.yaml,
  // feature_new_devices.yaml, feature_scenes.yaml, feature_delight.yaml and
  // scripts.yaml.
  import SettingRow from "./SettingRow.svelte";

  type Row = { k: string; s: string; v: string; warn?: boolean };
  type Group = { t: string; lead?: string; rows: Row[] };

  const GROUPS: Group[] = [
    {
      t: "Kitchen button",
      lead:
        "Aqara, by the kitchen door. It is the arrive/leave button — not a light switch, which is what everyone assumes.",
      rows: [
        {
          k: "Single press — Arrived Home",
          s: "Disarms the house and the beams, turns on the under-counter and bedroom lamps, clears away mode and wakes the media player.",
          v: "click",
        },
        {
          k: "Double press — Leaving Home",
          s: "Sets away mode, turns the study heater and media off, announces it on the speakers, tells the household — then starts a countdown and arms via the safe wrapper when it ends.",
          v: "click ×2",
        },
        {
          k: "Triple press — Appliances busy?",
          s: "Speaks what is currently running. Announcement only; it changes nothing.",
          v: "click ×3",
        },
        {
          k: "Quadruple press — Dinner's ready",
          s: "Announcement only, on the speakers.",
          v: "click ×4",
        },
        {
          k: "Hold — Outdoor lights",
          s: "Toggles driveway, gate spotlight, fire pit, pool and study-yard lights together.",
          v: "hold",
        },
        {
          k: "There are two devices called Kitchen Button",
          s: "An Aqara (lumi.sensor_switch) and a Tuya TS0041 are both registered under that name. The automations above are bound to the Aqara.",
          v: "Note",
          warn: true,
        },
      ],
    },
    {
      t: "Bedroom button",
      lead: "Aqara, at the bed. The single press is the only context-aware one in the house.",
      rows: [
        {
          k: "Single press — context-aware",
          s: "Branches on the hour: one behaviour between 04:00 and 18:00, another between 18:00 and 04:00. Daytime and night-time do different things from the same press.",
          v: "click",
        },
        {
          k: "Double press — Bedside lamps",
          s: "Toggles the main bedroom lamp and the reading lamp.",
          v: "click ×2",
        },
        {
          k: "Triple press — Outside lights",
          s: "Toggles the full outdoor set: driveway, gate spotlight, fire pit, pool, study yard, patio.",
          v: "click ×3",
        },
        {
          k: "Hold — Disarm anytime",
          s: "Disarms the house and the beams and turns the kitchen under-counter light on. This is the one button press that unlocks the house, and it needs no conditions.",
          v: "hold",
          warn: true,
        },
      ],
    },
    {
      t: "Patio button",
      lead: "Aqara, outside. Outdoor things only.",
      rows: [
        { k: "Single press — Outdoor lights", s: "Toggles fire pit, pool and study-yard lights.", v: "click" },
        { k: "Double press — Pool pump", s: "Toggles the pool pump.", v: "click ×2" },
        { k: "Long press — Patio lamp", s: "Toggles the patio lamp on its own.", v: "hold" },
      ],
    },
    {
      t: "Scenes, and what they actually do",
      lead:
        "All six are scripts, not HA scenes. Every one that arms goes through a state-guarded wrapper, because on this IDS panel an arm command sent to an already-armed area TOGGLES IT OFF.",
      rows: [
        {
          k: "Evening In",
          s: "Arms BOTH the house and the beams — via arm_home_and_beams, which skips whichever area is already armed — and rearranges the interior lamps. It is not a perimeter-only scene.",
          v: "Scene",
        },
        {
          k: "Goodnight",
          s: "All lights off through lights_off_safe, then arms both areas.",
          v: "Scene",
        },
        {
          k: "Good Morning",
          s: "Disarms both areas, dining lamp and living-room lamp on.",
          v: "Scene",
        },
        {
          k: "Leaving",
          s: "Arms away through the safe wrapper, all lights off, kettle and Nespresso off, and forces occupancy to empty.",
          v: "Scene",
        },
        {
          k: "Movie",
          s: "Turns OFF the dining lamp, the lamps group, the study lamp and the living-room lamp. It only switches things off.",
          v: "Scene",
        },
        { k: "Braai", s: "Activates a scene entity. Outdoor lighting for the braai area.", v: "Scene" },
      ],
    },
    {
      t: "Worth remembering",
      rows: [
        {
          k: "The Back Garden beam is faulty",
          s: "Zone 022. arm_home_and_beams always bypasses it before arming the beams area — that bypass is deliberate and automatic, not something someone forgot.",
          v: "By design",
        },
        {
          k: "The garage beam is bypassed with no expiry",
          s: "Zone 030. Unlike zone 022 this one has no end date, which is the thing maintenance windows exist to prevent. Either clear it or give it an end date.",
          v: "Open",
          warn: true,
        },
        {
          k: "Geysers and the hob are GAS",
          s: "No electric geyser, no geyser schedule, no element. The biggest switchable electrical load is the pool pump.",
          v: "By design",
        },
        {
          k: "There are no thermostats",
          s: "No climate entities exist. Every temperature in the app is monitoring only — there is nothing to set.",
          v: "By design",
        },
        {
          k: "The street lights are flaky",
          s: "A Tapo cloud relay drops commands. A self-heal loop retries every 10 minutes, which masks it; replacing the relay is the real fix.",
          v: "Known",
          warn: true,
        },
        {
          k: "A reload disarms nothing",
          s: "Every safety-adjacent trigger pins from: or not_from:, so an entity going unavailable and returning can no longer read as a real transition. This is the guard the 2026-08-09 incident was missing.",
          v: "Guard",
        },
        {
          k: "An arm command is a toggle on this panel",
          s: "Sent to an area that is already armed, alarm_arm_* DISARMS it. Every path in the config goes through a wrapper that checks state first. Never call the raw service.",
          v: "Guard",
        },
      ],
    },
    {
      // Kept visible rather than deleted: these were in the design pack, they are
      // probably true, and a house-sitter may need them. But they are physical and
      // medical facts I cannot read from a config file, and presenting an
      // unverified allergy as fact is the worst thing this screen could do.
      t: "Needs your confirmation",
      lead:
        "Carried over from the design pack and NOT verifiable from the configuration. Confirm each one and I will move it up into the facts above — or correct it.",
      rows: [
        {
          k: "Water main location",
          s: "The pack says: right of the driveway gate, green cover. Unverified.",
          v: "Confirm",
          warn: true,
        },
        {
          k: "Pool breaker location",
          s: "The pack says: DB board, bottom row, third from left. Unverified.",
          v: "Confirm",
          warn: true,
        },
        {
          k: "Gas shut-off location",
          s: "The pack says: bottle valves outside the laundry. The gas fact itself is confirmed; the location is not.",
          v: "Confirm",
          warn: true,
        },
        {
          k: "Eben — penicillin allergy",
          s: "The design pack states this along with a doctor's name and number. I have removed the details deliberately: a medical claim about a child that nobody has checked does not belong on a screen a house-sitter trusts. Confirm it and I will restore it in full, prominently.",
          v: "Confirm",
          warn: true,
        },
        {
          k: "Zigbee link quality",
          s: "The pack cites kitchen LQI 14 and bedroom LQI 11. Thirty LQI sensors exist but I have no live readings, so those specific numbers are unverified. Open Diagnostics → Zigbee mesh for the real ones.",
          v: "Confirm",
          warn: true,
        },
      ],
    },
  ];
</script>

{#each GROUPS as g (g.t)}
  <section class="grp">
    <h3 class="kicker">{g.t}</h3>
    {#if g.lead}<p class="lead">{g.lead}</p>{/if}
    {#each g.rows as r (r.k)}
      <SettingRow label={r.k} explain={r.s} value={r.v} warn={r.warn} />
    {/each}
  </section>
{/each}

<p class="prov">
  Every claim above except the last group is read from the Home Assistant
  configuration — the button packages, the scene scripts and scripts.yaml —
  and was verified on 10 August 2026. If an automation changes, this screen does
  not update itself: it is written down, not derived.
</p>

<style>
  .grp { margin-bottom: 22px; }
  .lead { font-size: 12px; color: var(--mut); line-height: 1.5; margin: 6px 0 8px; text-wrap: pretty; }
  .prov {
    font-size: 11.5px;
    color: var(--mut);
    line-height: 1.6;
    margin: 4px 0 0;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    text-wrap: pretty;
  }
</style>
