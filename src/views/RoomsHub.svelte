<script lang="ts">
  // Rooms — the hub board. Phase 3.2, fold map per Design's answer §B.
  //
  // Rooms is the THINGS IN THE HOUSE hub: the inventory, not the flow. Design's
  // reasoning, which I think is right — a metered appliance is a thing in a room
  // that happens to draw power, and you look for the dishwasher where the
  // dishwasher is, not on a page about money. Same logic puts Devices,
  // Automations and System here: they are all "what is in this house and is it
  // working".
  //
  // The floor plan stays the centrepiece rather than becoming a row in a list.
  // It is the one surface Christo uses that no other view can replace, and it
  // renders inside the board's multiples slot so the stats sit above it without
  // pushing it off the screen.
  import { ha } from "../lib/store.svelte";
  import { E, ALL_LIGHTS, APPLIANCES } from "../lib/entities";
  import { n, power } from "../lib/format";
  import { comfortBand } from "../lib/fn";
  import HubBoard, { type Stat, type Row } from "../lib/components/HubBoard.svelte";
  import Rooms from "./Rooms.svelte";

  let { onnav }: { onnav: (id: string) => void } = $props();

  const indoor = $derived(ha.readingNum("sensor.indoor_average_temperature"));
  const litCount = $derived(ALL_LIGHTS.filter((id) => ha.isOn(id)).length);
  const appsOn = $derived(APPLIANCES.filter((a) => ha.isOn(a.sw)));
  const houseLoad = $derived(ha.num("sensor.victron_ac_consumption_l1"));

  // Room temperature spread — the number that says "somewhere in this house is
  // uncomfortable" without you having to look at eight rooms.
  const ROOM_TEMPS = [
    "sensor.study_sensor_temperature",
    "sensor.main_room_temperature",
    "sensor.liam_s_room_temperature",
    "sensor.eben_s_room_temperature",
    "sensor.kitchen_sensor_temperature",
    "sensor.living_room_sensor_temperature",
    "sensor.guest_room_temperature",
    "sensor.patio_sensor_temperature",
  ];
  const temps = $derived(ROOM_TEMPS.map((id) => ha.num(id)).filter((v): v is number => v != null));
  const spread = $derived(temps.length >= 2 ? Math.max(...temps) - Math.min(...temps) : null);

  // Automations that have never fired — the honest health number, read live from
  // last_triggered rather than typed in.
  const autos = $derived(Object.keys(ha.entities).filter((id) => id.startsWith("automation.")));
  const neverRun = $derived(
    autos.filter((id) => ha.state(id) === "on" && !ha.attr(id, "last_triggered")).length,
  );

  const stats = $derived<Stat[]>([
    {
      key: "Comfort",
      reading: indoor,
      unit: "°",
      units: temps.length ? `${temps.length} rooms · ${n(Math.min(...temps), 1)}–${n(Math.max(...temps), 1)}°` : undefined,
      note: spread != null
        ? spread > 6
          ? `${n(spread, 1)}° apart — somewhere is uncomfortable`
          : `${n(spread, 1)}° apart, evenly heated`
        : undefined,
      warn: spread != null && spread > 6,
    },
    {
      key: "Lights",
      value: `${litCount}`,
      units: `of ${ALL_LIGHTS.length}`,
      note: litCount === 0 ? "all off" : "the plan shows which rooms",
    },
    {
      key: "Appliances",
      value: `${appsOn.length} on`,
      units: `${APPLIANCES.length} metered`,
      note: houseLoad != null ? `house drawing ${power(houseLoad).val} ${power(houseLoad).unit}` : undefined,
      open: () => onnav("appliances"),
    },
    {
      key: "Automations",
      value: `${autos.length}`,
      units: `${neverRun} ${neverRun === 1 ? "has" : "have"} never fired`,
      note: neverRun ? "a trigger that cannot fire, usually" : "all have run at least once",
      warn: neverRun > 0,
      open: () => onnav("automations"),
    },
  ]);

  const rows = $derived<Row[]>([
    { key: "Lights", sub: `${litCount} on · every light, grouped by room`, value: "Open", tint: "var(--energy)", open: () => onnav("lights") },
    { key: "Appliances", sub: `${APPLIANCES.length} metered plugs with their own baselines`, value: "Open", tint: "var(--load)", open: () => onnav("appliances") },
    { key: "Devices", sub: "everything the house knows about, by integration", value: "Open", tint: "var(--mut)", open: () => onnav("devices") },
    { key: "Automations", sub: "what ran, what did not, and what it did", value: "Open", tint: "var(--mut)", open: () => onnav("automations") },
    { key: "System", sub: "the box, the versions and the reloads", value: "Open", tint: "var(--mut)", open: () => onnav("system") },
    ...appsOn.slice(0, 3).map((a) => ({
      key: a.label,
      sub: "running now",
      value: a.power && ha.num(a.power) != null ? `${power(ha.num(a.power)!).val} ${power(ha.num(a.power)!).unit}` : "on",
      tint: "var(--load)",
    })),
  ]);

  // Scope chips derived from what is actually on this board, per §6 rule 1.
  const scopes = $derived(
    ["Lights", "Appliances", "Devices", "Automations", "System"].filter((s) =>
      rows.some((r) => `${r.key} ${r.sub ?? ""}`.toLowerCase().includes(s.toLowerCase())),
    ),
  );
</script>

<HubBoard
  hub="climate"
  {scopes}
  sub="the inventory — what is in this house, and is it working"
  {stats}
  listTitle="The inventory"
  {rows}
  noteTitle="Why the plan lives here"
  note="A metered appliance is a thing in a room that happens to draw power — you look for the dishwasher where the dishwasher is, not on a page about money. Devices, Automations and System follow the same logic: they are the inventory of the house rather than the flow through it."
  {onnav}
>
  {#snippet multiples()}
    <!-- The plan is the centrepiece, not a row. It is the one surface no other
         view can replace, so it renders in full rather than as a link. -->
    <Rooms />
  {/snippet}
</HubBoard>
