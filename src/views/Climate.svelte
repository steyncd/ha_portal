<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { n, tempColor } from "../lib/format";
  import AreaChart from "../lib/components/AreaChart.svelte";
  import { lightSheet } from "../lib/lightSheet.svelte";

  type L = { id: string; label: string; icon: string };
  type Room = { id: string; label: string; left: number; top: number; w: number; h: number; temp?: string; hum?: string; lights: L[] };

  const PLAN: Room[] = [
    { id: "open_patio", label: "Patio", left: 0, top: 0, w: 33.6, h: 24.3, lights: [] },
    { id: "braai", label: "Braai", left: 0, top: 24.3, w: 22.6, h: 27, temp: "sensor.patio_sensor_temperature", hum: "sensor.patio_sensor_humidity", lights: [{ id: "light.back_yard_fire_pit_light", label: "Fire Pit", icon: "🔥" }] },
    { id: "study", label: "Study", left: 22.6, top: 24.3, w: 19.4, h: 27, temp: "sensor.study_bt_device_scanner_desk_temperature", hum: "sensor.study_bt_device_scanner_desk_humidity", lights: [{ id: "light.study_lamp", label: "Study Lamp", icon: "📖" }] },
    { id: "liam", label: "Liam", left: 41.9, top: 28.4, w: 17.2, h: 23, temp: "sensor.liam_s_room_temperature", hum: "sensor.liam_s_room_humidity", lights: [] },
    { id: "eben", label: "Eben", left: 59.1, top: 28.4, w: 16.1, h: 23, temp: "sensor.adjusted_temperature", lights: [{ id: "light.eben_room_lamp", label: "Eben Lamp", icon: "💡" }] },
    { id: "main", label: "Main", left: 75.3, top: 28.4, w: 24.7, h: 23, temp: "sensor.main_room_temperature", hum: "sensor.main_bedroom_lamp_si7021_humidity", lights: [{ id: "switch.main_bedroom_lamp", label: "Bedside", icon: "🛏️" }] },
    { id: "tv", label: "TV Room", left: 0, top: 51.4, w: 25.3, h: 33.8, temp: "sensor.living_room_sensor_temperature", hum: "sensor.living_room_sensor_humidity", lights: [{ id: "switch.living_room_lamp", label: "Living", icon: "🛋️" }, { id: "switch.tv_room_lamp", label: "TV Lamp", icon: "📺" }] },
    { id: "dining", label: "Dining", left: 25.3, top: 51.4, w: 15.6, h: 33.8, temp: "sensor.living_room_sensor_temperature", hum: "sensor.living_room_sensor_humidity", lights: [{ id: "light.dining_room_lamp", label: "Dining", icon: "🍽️" }] },
    { id: "kitchen", label: "Kitchen", left: 40.9, top: 57.4, w: 15.6, h: 27.7, temp: "sensor.kitchen_sensor_temperature", hum: "sensor.kitchen_sensor_humidity", lights: [{ id: "switch.kitchen_lights", label: "Ceiling", icon: "💡" }, { id: "switch.kitchen_under_counter_lights", label: "Counter", icon: "✨" }] },
    { id: "passage", label: "Passage", left: 40.9, top: 51.4, w: 59.1, h: 6.1, lights: [] },
    { id: "bath", label: "Bath", left: 56.5, top: 57.4, w: 11.8, h: 27.7, lights: [] },
    { id: "bed3", label: "Bed 3", left: 68.3, top: 57.4, w: 16.7, h: 27.7, temp: "sensor.guest_room_temperature", lights: [] },
    { id: "ensuite", label: "En-suite", left: 85, top: 57.4, w: 15.1, h: 27.7, lights: [] },
    { id: "entrance", label: "Entry", left: 0, top: 85.1, w: 15.6, h: 14.9, lights: [] },
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

  let activeId = $state("main");
  const active = $derived(PLAN.find((r) => r.id === activeId)!);
  const temp = $derived(active.temp ? ha.num(active.temp) : null);
  const hum = $derived(active.hum ? ha.num(active.hum) : null);

  let hist = $state<{ t: number; v: number }[]>([]);
  $effect(() => {
    const t = active.temp;
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
</script>

<div class="grid">
  <div class="card pad">
    <div class="rh"><span class="lb">302 Wyoming · tap a room</span><span class="sub">{n(ha.num("sensor.indoor_average_temperature"), 1)}° avg</span></div>
    <div class="plan">
      {#each PLAN as r}
        {@const t = r.temp ? ha.num(r.temp) : null}
        <button class="room" class:active={activeId === r.id} style="left:{r.left}%;top:{r.top}%;width:{r.w}%;height:{r.h}%;background:{activeId === r.id ? 'var(--soft)' : heat(t)}" onclick={() => (activeId = r.id)}>
          <span class="rn">{r.label}</span>
          {#if t != null}<span class="rt">{n(t, 1)}°</span>{/if}
        </button>
      {/each}
    </div>
    <div class="legend">
      <span class="ll">Cool</span>
      {#each HEAT_LEGEND as h}<span class="lc" style="background:{h.c}" title={h.l}></span>{/each}
      <span class="ll">Warm</span>
    </div>
  </div>

  <div class="card pad">
    <div class="ah"><span class="an">{active.label}</span><span class="sub">{hum != null ? `${n(hum)}% RH` : "—"}</span></div>
    <div class="tr">
      <div class="bigt" style="color:{tempColor(temp)}">{n(temp, 1)}<span class="deg">°</span></div>
      <div class="pill" style="background:color-mix(in srgb,{comfort.color} 15%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,{comfort.color} 34%,transparent)">
        <span class="pd" style="background:{comfort.color};box-shadow:0 0 8px {comfort.color}"></span>{comfort.label}
      </div>
    </div>
    {#if active.temp}
      <div class="rh" style="margin:18px 0 2px"><span class="lb">Temperature · 24h</span></div>
      <AreaChart data={hist} color={comfort.color} unit="°" digits={0} height={120} />
    {/if}
    <div class="hr"></div>
    <div class="lb" style="margin-bottom:11px">Lights here</div>
    {#if active.lights.length}
      <div class="lgrid">
        {#each active.lights as l}
          <div class="ltile" class:on={ha.isOn(l.id)}>
            <div class="ltap" onclick={() => ha.toggle(l.id)} role="button" tabindex="0" onkeydown={() => {}}>
              <span class="li">{l.icon}</span><span class="ll"><span class="ln">{l.label}</span><span class="ls">{ha.isOn(l.id) ? "On" : "Off"}</span></span>
            </div>
            {#if l.id.startsWith("light.")}<button class="tune" onclick={() => lightSheet.open(l.id, l.label)} aria-label="tune">⋯</button>{/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="none">Climate & sensors only.</div>
    {/if}
  </div>
</div>

<style>
  .grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 14px; }
  @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } }
  .pad { padding: 18px; }
  .rh { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .sub { font-size: 12px; color: var(--dim); }
  .plan { position: relative; width: 100%; aspect-ratio: 18600 / 14800; border-radius: 14px; background: rgba(255, 255, 255, 0.03); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08); overflow: hidden; }
  .room { position: absolute; padding: 3px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; background: rgba(255, 255, 255, 0.03); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14); overflow: hidden; }
  .room.active { box-shadow: inset 0 0 0 1.5px var(--line); }
  .room:hover { box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28); }
  .legend { display: flex; align-items: center; justify-content: center; gap: 5px; margin-top: 12px; }
  .legend .lc { width: 26px; height: 9px; border-radius: 2px; }
  .legend .ll { font-size: 10.5px; color: var(--muted); margin: 0 5px; }
  .rn { font-size: 10px; font-weight: 700; color: #f5f8ff; white-space: nowrap; text-shadow: 0 1px 3px rgba(5, 9, 15, 0.9); }
  .rt { font-size: 9.5px; font-weight: 700; color: #c4e3ff; text-shadow: 0 1px 3px rgba(5, 9, 15, 0.95); }
  .ah { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px; }
  .an { font-size: 18px; font-weight: 700; }
  .tr { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
  .bigt { font-size: 64px; font-weight: 800; letter-spacing: -3px; line-height: 0.85; }
  .deg { font-size: 26px; color: #60a5fa; }
  .pill { display: flex; align-items: center; gap: 9px; padding: 9px 15px; border-radius: 999px; }
  .pd { width: 9px; height: 9px; border-radius: 50%; }
  .pill { font-size: 13px; font-weight: 700; }
  .hr { height: 1px; background: rgba(255, 255, 255, 0.08); margin: 16px 0; }
  .lgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .ltile { position: relative; display: flex; align-items: center; padding: 14px; border-radius: 14px; background: rgba(255, 255, 255, 0.045); }
  .ltile.on { background: color-mix(in srgb, var(--warning) 14%, transparent); box-shadow: inset 0 0 0 1.5px var(--warning); }
  .ltap { display: flex; align-items: center; gap: 11px; cursor: pointer; flex: 1; }
  .li { font-size: 18px; }
  .ll { display: flex; flex-direction: column; line-height: 1.3; }
  .ln { font-size: 12.5px; font-weight: 600; }
  .ls { font-size: 11px; color: var(--text-2); }
  .tune { width: 26px; height: 26px; border-radius: 8px; background: rgba(255, 255, 255, 0.09); font-size: 14px; }
  @media (max-width: 640px) { .tune { width: 36px; height: 36px; font-size: 16px; } }
  .none { padding: 15px; border-radius: 14px; background: rgba(255, 255, 255, 0.03); font-size: 12.5px; color: var(--muted-2); }
</style>
