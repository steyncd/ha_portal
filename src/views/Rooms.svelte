<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { n, power, tempColor } from "../lib/format";
  import AreaChart from "../lib/components/AreaChart.svelte";
  import { lightSheet } from "../lib/lightSheet.svelte";

  type Dev = { id: string; label: string; icon: string; power?: string };
  type TempSrc = { id: string; label: string };
  type Room = { id: string; label: string; left: number; top: number; w: number; h: number; temps?: TempSrc[]; hum?: string; occ?: string; lights?: Dev[]; appliances?: Dev[] };

  const PLAN: Room[] = [
    { id: "open_patio", label: "Patio", left: 0, top: 0, w: 33.6, h: 24.3 },
    { id: "braai", label: "Braai", left: 0, top: 24.3, w: 22.6, h: 27, temps: [{ id: "sensor.patio_sensor_temperature", label: "Braai" }], hum: "sensor.patio_sensor_humidity", lights: [{ id: "light.back_yard_fire_pit_light", label: "Fire Pit", icon: "🔥" }] },
    {
      id: "study", label: "Study", left: 22.6, top: 24.3, w: 19.4, h: 27, occ: "binary_sensor.study_occupancy",
      temps: [
        { id: "sensor.study_bt_device_scanner_desk_temperature", label: "Desk" },
        { id: "sensor.study_temperature", label: "Study" },
      ],
      hum: "sensor.study_bt_device_scanner_desk_humidity",
      lights: [
        { id: "light.study_lamp", label: "Study Lamp", icon: "📖", power: "sensor.study_lamp_power" },
        { id: "light.study_light_1", label: "Study Light 1", icon: "💡", power: "sensor.study_light_1_power" },
        { id: "light.study_light_2", label: "Study Light 2", icon: "💡", power: "sensor.study_light_2_power" },
      ],
      appliances: [{ id: "switch.study_heater", label: "Study Heater", icon: "🔥", power: "sensor.study_heater_current_consumption" }],
    },
    { id: "liam", label: "Liam", left: 41.9, top: 28.4, w: 17.2, h: 23, temps: [{ id: "sensor.liam_s_room_temperature", label: "Liam" }], hum: "sensor.liam_s_room_humidity" },
    { id: "eben", label: "Eben", left: 59.1, top: 28.4, w: 16.1, h: 23, temps: [{ id: "sensor.adjusted_temperature", label: "Eben" }], lights: [{ id: "light.eben_room_lamp", label: "Eben Lamp", icon: "💡", power: "sensor.eben_room_lamp_power" }] },
    {
      id: "main", label: "Main", left: 75.3, top: 28.4, w: 24.7, h: 23,
      temps: [{ id: "sensor.main_room_temperature", label: "Main" }], hum: "sensor.main_bedroom_lamp_si7021_humidity",
      lights: [
        { id: "switch.main_bedroom_lamp", label: "Bedside", icon: "🛏️", power: "sensor.main_bedroom_lamp_power" },
        { id: "light.main_bedroom_light", label: "Ceiling", icon: "💡" },
        { id: "light.main_bedroom_dresser_light", label: "Dresser", icon: "🪞" },
      ],
    },
    {
      id: "tv", label: "TV Room", left: 0, top: 51.4, w: 25.3, h: 33.8, occ: "binary_sensor.lounge_area_occupancy",
      temps: [{ id: "sensor.living_room_sensor_temperature", label: "TV Room" }], hum: "sensor.living_room_sensor_humidity",
      lights: [
        { id: "switch.living_room_lamp", label: "Living", icon: "🛋️", power: "sensor.living_room_lamp_power" },
        { id: "switch.tv_room_lamp", label: "TV Lamp", icon: "📺", power: "sensor.tv_room_lamp_power" },
      ],
    },
    { id: "dining", label: "Dining", left: 25.3, top: 51.4, w: 15.6, h: 33.8, temps: [{ id: "sensor.living_room_sensor_temperature", label: "Dining" }], hum: "sensor.living_room_sensor_humidity", lights: [{ id: "light.dining_room_lamp", label: "Dining", icon: "🍽️", power: "sensor.dining_room_lamp_power" }] },
    {
      id: "kitchen", label: "Kitchen", left: 40.9, top: 57.4, w: 15.6, h: 27.7,
      temps: [{ id: "sensor.kitchen_sensor_temperature", label: "Kitchen" }], hum: "sensor.kitchen_sensor_humidity",
      lights: [
        { id: "switch.kitchen_lights", label: "Ceiling", icon: "💡", power: "sensor.kitchen_lights_power" },
        { id: "switch.kitchen_under_counter_lights", label: "Counter", icon: "✨", power: "sensor.kitchen_under_counter_lights_power" },
      ],
      appliances: [
        { id: "switch.main_fridge", label: "Fridge", icon: "🧊", power: "sensor.main_fridge_current_consumption" },
        { id: "switch.dishwasher", label: "Dishwasher", icon: "🍽️", power: "sensor.dishwasher_current_consumption" },
        { id: "switch.kettle", label: "Kettle", icon: "🫖", power: "sensor.kettle_current_consumption" },
        { id: "switch.microwave", label: "Microwave", icon: "🍲", power: "sensor.microwave_current_consumption" },
        { id: "switch.air_fryer", label: "Air Fryer", icon: "🍟", power: "sensor.air_fryer_current_consumption" },
        { id: "switch.nespresso", label: "Nespresso", icon: "☕", power: "sensor.nespresso_current_consumption" },
      ],
    },
    { id: "passage", label: "Passage", left: 40.9, top: 51.4, w: 59.1, h: 6.1 },
    { id: "bath", label: "Bath", left: 56.5, top: 57.4, w: 11.8, h: 27.7 },
    { id: "bed3", label: "Bed 3", left: 68.3, top: 57.4, w: 16.7, h: 27.7, temps: [{ id: "sensor.guest_room_temperature", label: "Guest" }], hum: "sensor.guest_room_humidity", lights: [{ id: "light.guest_room_guest_room", label: "Guest Lamp", icon: "🛏️", power: "sensor.guest_room_lamp_power" }] },
    { id: "ensuite", label: "En-suite", left: 85, top: 57.4, w: 15.1, h: 27.7 },
    { id: "entrance", label: "Entry", left: 0, top: 85.1, w: 15.6, h: 14.9 },
  ];

  // 5-band temperature heat scale (house runs cold; bands per prototype 14/17/21.5/25)
  function heat(t: number | null): string {
    if (t == null) return "rgba(255,255,255,.03)";
    const c = t < 14 ? "#3b82f6" : t < 17 ? "#38bdf8" : t < 21.5 ? "#34d399" : t < 25 ? "#fbbf24" : "#fb7185";
    return `color-mix(in srgb, ${c} 26%, transparent)`;
  }
  const HEAT_LEGEND = [
    { c: "#3b82f6", l: "<14°" }, { c: "#38bdf8", l: "14–17°" }, { c: "#34d399", l: "17–21°" }, { c: "#fbbf24", l: "22–25°" }, { c: "#fb7185", l: ">25°" },
  ];

  let activeId = $state("study");
  const active = $derived(PLAN.find((r) => r.id === activeId)!);
  const temps = $derived(active.temps ?? []);
  const primaryId = $derived(temps[0]?.id);
  const temp = $derived(primaryId ? ha.num(primaryId) : null);
  const hum = $derived(active.hum ? ha.num(active.hum) : null);
  const devices = $derived([...(active.lights ?? []), ...(active.appliances ?? [])]);
  const roomPower = $derived(devices.reduce((s, d) => s + (d.power && ha.isOn(d.id) ? (ha.num(d.power) ?? 0) : 0), 0));
  const occupied = $derived(active.occ ? ha.isOn(active.occ) : null);

  let hist = $state<{ t: number; v: number }[]>([]);
  $effect(() => {
    const t = primaryId;
    hist = [];
    if (t) ha.history(t, 24).then((h) => (hist = h));
  });

  const comfort = $derived.by(() => {
    if (temp == null) return { label: "No sensor", color: "var(--muted)" };
    if (temp < 14) return { label: "Cold", color: "#3b82f6" };
    if (temp < 17) return { label: "Cool", color: "var(--water)" };
    if (temp < 21.5) return { label: "Comfortable", color: "var(--success)" };
    if (temp < 25) return { label: "Warm", color: "var(--warning)" };
    return { label: "Hot", color: "var(--error)" };
  });

  const pw = (id?: string) => (id ? `${power(ha.num(id)).val} ${power(ha.num(id)).unit}` : "");
</script>

{#snippet devtile(d: Dev)}
  {@const on = ha.isOn(d.id)}
  {@const w = d.power ? ha.num(d.power) : null}
  <div class="ltile" class:on>
    <div class="ltap" role="button" tabindex="0" onclick={() => ha.toggle(d.id)} onkeydown={(e) => { if (e.key === "Enter") ha.toggle(d.id); }}>
      <span class="li">{d.icon}</span>
      <span class="ll">
        <span class="ln">{d.label}</span>
        <span class="ls">{on ? "On" : "Off"}{d.power ? ` · ${power(w).val} ${power(w).unit}` : ""}</span>
      </span>
    </div>
    {#if d.id.startsWith("light.")}<button class="tune" onclick={() => lightSheet.open(d.id, d.label)} aria-label="tune">⋯</button>{/if}
  </div>
{/snippet}

<div class="grid">
  <div class="card pad">
    <div class="rh"><span class="lb">302 Wyoming · tap a room</span><span class="sub">{n(ha.num("sensor.indoor_average_temperature"), 1)}° avg</span></div>
    <div class="plan">
      {#each PLAN as r}
        {@const t = r.temps?.[0] ? ha.num(r.temps[0].id) : null}
        {@const lit = (r.lights ?? []).some((l) => ha.isOn(l.id)) || (r.appliances ?? []).some((a) => ha.isOn(a.id))}
        {@const occ = r.occ ? ha.isOn(r.occ) : false}
        <button class="room" class:active={activeId === r.id} style="left:{r.left}%;top:{r.top}%;width:{r.w}%;height:{r.h}%;background:{activeId === r.id ? 'var(--soft)' : heat(t)}" onclick={() => (activeId = r.id)}>
          <span class="rn">{r.label}</span>
          {#if t != null}<span class="rt">{n(t, 1)}°</span>{/if}
          {#if lit}<span class="dot"></span>{/if}
          {#if occ}<span class="odot"></span>{/if}
        </button>
      {/each}
    </div>
    <div class="legend">
      <span class="ll2">Cool</span>
      {#each HEAT_LEGEND as h}<span class="lc" style="background:{h.c}" title={h.l}></span>{/each}
      <span class="ll2">Warm</span>
    </div>
  </div>

  <div class="card pad">
    <div class="ah">
      <span class="an">{active.label}{#if occupied != null}<span class="occ" class:oon={occupied}>{occupied ? "occupied" : "empty"}</span>{/if}</span>
      <span class="sub">{roomPower > 0 ? `⚡ ${power(roomPower).val} ${power(roomPower).unit}` : ""}{roomPower > 0 && hum != null ? " · " : ""}{hum != null ? `${n(hum)}% RH` : ""}</span>
    </div>

    {#if temps.length}
      <div class="tr">
        <div class="bigt" style="color:{tempColor(temp)}">{n(temp, 1)}<span class="deg">°</span></div>
        <div class="pill" style="background:color-mix(in srgb,{comfort.color} 15%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,{comfort.color} 34%,transparent)">
          <span class="pd" style="background:{comfort.color};box-shadow:0 0 8px {comfort.color}"></span>{comfort.label}
        </div>
      </div>
      {#if temps.length > 1}
        <div class="chips">
          {#each temps as ts}
            {@const tv = ha.num(ts.id)}
            <span class="chip" class:sel={ts.id === primaryId}><span class="ck">{ts.label}</span><span class="cv" style="color:{tempColor(tv)}">{tv != null ? n(tv, 1) + "°" : "—"}</span></span>
          {/each}
        </div>
      {/if}
      <div class="rh" style="margin:18px 0 2px"><span class="lb">{temps[0].label} temperature · 24h</span></div>
      <AreaChart data={hist} color={comfort.color} unit="°" digits={0} height={120} />
    {/if}

    {#if active.lights?.length}
      <div class="hr"></div>
      <div class="lb" style="margin-bottom:11px">Lights</div>
      <div class="lgrid">{#each active.lights as d}{@render devtile(d)}{/each}</div>
    {/if}

    {#if active.appliances?.length}
      <div class="hr"></div>
      <div class="lb" style="margin-bottom:11px">Appliances</div>
      <div class="lgrid">{#each active.appliances as d}{@render devtile(d)}{/each}</div>
    {/if}

    {#if !temps.length && !active.lights?.length && !active.appliances?.length}
      <div class="none">No sensors or controls in this room.</div>
    {/if}
  </div>
</div>

<style>
  .grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 14px; }
  @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } }
  .pad { padding: 18px; }
  .rh { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .lb { font-size: 13px; font-weight: 700; color: var(--text-2); }
  .sub { font-size: 12px; color: var(--dim); }
  .plan { position: relative; width: 100%; aspect-ratio: 18600 / 14800; border-radius: 14px; background: rgba(255, 255, 255, 0.03); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08); overflow: hidden; }
  .room { position: absolute; padding: 3px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; background: rgba(255, 255, 255, 0.03); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14); overflow: hidden; }
  .room.active { box-shadow: inset 0 0 0 1.5px var(--line); }
  .room:hover { box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28); }
  .dot { position: absolute; top: 4px; right: 4px; width: 6px; height: 6px; border-radius: 50%; background: var(--warning); box-shadow: 0 0 6px var(--warning); }
  .odot { position: absolute; top: 4px; left: 4px; width: 6px; height: 6px; border-radius: 50%; background: var(--success); box-shadow: 0 0 6px var(--success); }
  .occ { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; margin-left: 9px; padding: 3px 8px; border-radius: 999px; background: rgba(255, 255, 255, 0.06); color: var(--muted); vertical-align: middle; }
  .occ.oon { background: color-mix(in srgb, var(--success) 18%, transparent); color: var(--success); }
  .legend { display: flex; align-items: center; justify-content: center; gap: 5px; margin-top: 12px; }
  .legend .lc { width: 26px; height: 9px; border-radius: 2px; }
  .legend .ll2 { font-size: 10.5px; color: var(--muted); margin: 0 5px; }
  .rn { font-size: 10px; font-weight: 700; color: #f5f8ff; white-space: nowrap; text-shadow: 0 1px 3px rgba(5, 9, 15, 0.9); }
  .rt { font-size: 9.5px; font-weight: 700; color: #c4e3ff; text-shadow: 0 1px 3px rgba(5, 9, 15, 0.95); }
  .ah { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px; gap: 10px; }
  .an { font-size: 18px; font-weight: 700; }
  .tr { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
  .bigt { font-size: 64px; font-weight: 800; letter-spacing: -3px; line-height: 0.85; }
  .deg { font-size: 26px; color: #60a5fa; }
  .pill { display: flex; align-items: center; gap: 9px; padding: 9px 15px; border-radius: 999px; font-size: 13px; font-weight: 700; }
  .pd { width: 9px; height: 9px; border-radius: 50%; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .chip { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 10px; background: rgba(255, 255, 255, 0.045); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07); }
  .chip.sel { box-shadow: inset 0 0 0 1.5px var(--line); }
  .ck { font-size: 11.5px; font-weight: 700; color: var(--dim); }
  .cv { font-size: 14px; font-weight: 800; }
  .hr { height: 1px; background: rgba(255, 255, 255, 0.08); margin: 16px 0; }
  .lgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .ltile { position: relative; display: flex; align-items: center; padding: 14px; border-radius: 14px; background: rgba(255, 255, 255, 0.045); }
  .ltile.on { background: color-mix(in srgb, var(--warning) 14%, transparent); box-shadow: inset 0 0 0 1.5px var(--warning); }
  .ltap { display: flex; align-items: center; gap: 11px; cursor: pointer; flex: 1; min-width: 0; }
  .li { font-size: 18px; }
  .ll { display: flex; flex-direction: column; line-height: 1.3; min-width: 0; }
  .ln { font-size: 12.5px; font-weight: 600; }
  .ls { font-size: 11px; color: var(--text-2); font-variant-numeric: tabular-nums; }
  .tune { width: 26px; height: 26px; border-radius: 8px; background: rgba(255, 255, 255, 0.09); font-size: 14px; flex-shrink: 0; }
  @media (max-width: 640px) { .tune { width: 36px; height: 36px; font-size: 16px; } }
  .none { padding: 15px; border-radius: 14px; background: rgba(255, 255, 255, 0.03); font-size: 12.5px; color: var(--muted-2); }
</style>
