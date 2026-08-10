<script lang="ts">
  // Settings › Cheatsheet — Phase 4.
  //
  // The things that get forgotten, written once. This is the only section in
  // Settings that changes nothing: it exists because the house has knowledge in
  // it that lives nowhere except in Christo's head, and a house-sitter, a
  // spouse, or Christo in eighteen months all need the same page.
  //
  // Content is from the prototype verbatim where it is a house fact. Nothing
  // here is inferred — every claim is one the config or the incident log
  // supports.
  import SettingRow from "./SettingRow.svelte";

  type Row = { k: string; s: string; v: string; warn?: boolean };
  type Group = { t: string; lead?: string; rows: Row[] };

  const GROUPS: Group[] = [
    {
      t: "Physical buttons",
      lead: "Three Zigbee buttons. Nothing critical sits behind any of them, which is deliberate — two are on weak links.",
      rows: [
        {
          k: "Kitchen button",
          s: "Single: kitchen lights · Double: everything downstairs off · Hold: Braai scene",
          v: "Aqara",
          warn: true,
        },
        {
          k: "Bedroom button",
          s: "Single is context-aware — bedtime, get-up, back-to-bed or daytime, chosen by the time and the alarm state. Double: all lamps off. Hold: Goodnight.",
          v: "Aqara",
          warn: true,
        },
        {
          k: "Patio button",
          s: "Single: stoep light · Double: fire pit · Hold: everything outside off",
          v: "Aqara",
        },
        {
          k: "Weak links",
          s: "Kitchen LQI 14, bedroom LQI 11. Presses are occasionally missed. The fix is a mains-powered router nearer to them, not a new button.",
          v: "Known",
          warn: true,
        },
      ],
    },
    {
      t: "Scenes, and what they actually do",
      lead: "Evening In is the one people misremember: it is not Goodnight.",
      rows: [
        { k: "Evening In", s: "Arms the perimeter beams, leaves the interior lights on. For when you are in for the night but still up.", v: "Scene" },
        { k: "Goodnight", s: "All lamps off, both areas armed, pool pump off until 09:00", v: "Scene" },
        { k: "Movie", s: "TV room down low, dining off, TV backlight on", v: "Scene" },
        { k: "Braai", s: "Fire pit, stoep and back yard on. Beams held disarmed until the scene ends — so walking to the braai does not set the alarm off.", v: "Scene" },
        { k: "Leaving / Away", s: "Everything off, both areas armed, irrigation keeps its own schedule", v: "Scene" },
        { k: "Good Morning", s: "Kitchen and passage on, briefing on the kitchen speaker", v: "Scene" },
      ],
    },
    {
      t: "Worth remembering",
      rows: [
        {
          k: "Geysers and the hob are GAS",
          s: "There is no electric geyser, no geyser schedule and no element. The biggest switchable electrical load is the pool pump.",
          v: "By design",
        },
        {
          k: "Gas shut-off",
          s: "Bottle valves outside the laundry. Not an isolator, not the DB board.",
          v: "Outside",
        },
        {
          k: "There are no thermostats",
          s: "Every temperature in the app is monitoring only. Nothing to set.",
          v: "By design",
        },
        { k: "Water main", s: "Right of the driveway gate, green cover", v: "Outside" },
        { k: "Pool breaker", s: "DB board, bottom row, third from left", v: "DB" },
        {
          k: "The street lights are flaky",
          s: "A Tapo cloud relay drops commands. A self-heal loop retries every 10 minutes; replacing the relay is the real fix.",
          v: "Known",
          warn: true,
        },
        {
          k: "Eben · penicillin allergy",
          s: "Tell any doctor or pharmacist before anything is prescribed.",
          v: "Medical",
          warn: true,
        },
        {
          k: "A reload disarms nothing",
          s: "Every safety-adjacent trigger pins from: or not_from:, so an entity going unavailable and coming back can no longer look like a real transition. This is the guard the 2026-08-09 incident was missing.",
          v: "Guard",
        },
        {
          k: "The house is one floor",
          s: "One continuous level. The floor plan in Rooms uses the real coordinates.",
          v: "By design",
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

<style>
  .grp { margin-bottom: 22px; }
  .lead { font-size: 12px; color: var(--mut); line-height: 1.5; margin: 6px 0 8px; text-wrap: pretty; }
</style>
