<script lang="ts">
  // The TV Room mmWave sensor + its aircon, added to the house 2026-08-23.
  //
  // WHY A DISTANCE BAR AND NOT JUST "OCCUPIED". An mmWave radar knows how far
  // away the target is, and the sensor is configured with distance GATES —
  // number.tv_room_min/max_distance_gate, currently 0 to 6 m. That pair is what
  // decides whether a reading counts as presence at all, so showing the target's
  // position inside that window turns "occupied: yes" into something you can
  // actually reason about: someone at 2.1 m is on the couch, someone at 5.8 m is
  // probably the passage and the window is too wide.
  //
  // THREE PRESENCE ENTITIES, ONE ANSWER. The device exposes presence,
  // presence_direct and room_occupied. room_occupied is the debounced one that
  // honours the timeout, so it leads; the other two are shown as the raw signal
  // behind it, because when they disagree the timeout is the reason and that is
  // worth being able to see.
  import { ha } from "../store.svelte";
  import { n } from "../format";
  import { toast } from "../toast.svelte";

  const TV = {
    occupied: "binary_sensor.tv_room_room_occupied",
    presence: "binary_sensor.tv_room_presence",
    direct: "binary_sensor.tv_room_presence_direct",
    distance: "sensor.tv_room_target_distance",
    minGate: "number.tv_room_min_distance_gate",
    maxGate: "number.tv_room_max_distance_gate",
    timeout: "number.tv_room_presence_timeout",
    autoOff: "switch.tv_room_auto_off_when_empty",
    temp: "sensor.tv_room_temperature",
    hum: "sensor.tv_room_humidity",
    wifi: "sensor.tv_room_wifi_signal",
    plug: "switch.tv_room_plug",
    plugPower: "sensor.tv_room_plug_power",
    aircon: "climate.tv_room_tv_room_aircon",
  };

  const num = (id: string) => (ha.available(id) ? ha.num(id) : null);

  const occupied = $derived(ha.isOn(TV.occupied));
  const raw = $derived(ha.isOn(TV.presence));
  const direct = $derived(ha.isOn(TV.direct));
  const dist = $derived(num(TV.distance));            // cm
  const minM = $derived(num(TV.minGate) ?? 0);        // m
  const maxM = $derived(num(TV.maxGate) ?? 6);        // m
  const timeout = $derived(num(TV.timeout));
  const wifi = $derived(num(TV.wifi));
  const watts = $derived(num(TV.plugPower));

  // Where the target sits inside the configured window, 0–100%.
  const pos = $derived.by(() => {
    if (dist == null || maxM <= minM) return null;
    const m = dist / 100;
    return Math.max(0, Math.min(100, ((m - minM) / (maxM - minM)) * 100));
  });

  // The aircon has NO temperature feedback: climate.current_temperature is null
  // and sensor.tv_room_temperature reads unknown, so nothing in the room tells
  // it — or us — how warm it actually is. Saying that plainly matters more than
  // the target number does.
  const mode = $derived(ha.state(TV.aircon) ?? "unknown");
  const target = $derived(ha.attr(TV.aircon, "temperature") as number | null);
  const feedback = $derived(
    (ha.attr(TV.aircon, "current_temperature") as number | null) ?? num(TV.temp),
  );
  const MODES = ["off", "cool", "heat", "fan_only", "dry"];
</script>

<div class="card pad">
  <div class="rh">
    <span class="an">📺 TV Room</span>
    <span class="sub">
      mmWave presence{#if wifi != null} · {n(wifi, 0)} dBm{/if}
    </span>
  </div>

  <div class="tr">
    <div class="big" style="color:{occupied ? 'var(--acc)' : 'var(--mut)'}">
      {occupied ? "Occupied" : "Clear"}
    </div>
    {#if dist != null}
      <span class="pill"><span class="pd" style="background:var(--acc)"></span>target {n(dist / 100, 1)} m</span>
    {/if}
  </div>

  {#if pos != null}
    <!-- The window the sensor is told to watch, with the target's place in it. -->
    <div class="scale">
      <div class="track"><span class="dot" style="left:{pos}%"></span></div>
      <div class="ends"><span>{n(minM, 1)} m</span><span>watched window</span><span>{n(maxM, 1)} m</span></div>
    </div>
  {/if}

  <div class="rows">
    <div class="row">
      <span class="k">Raw signal</span>
      <span class="v">
        {raw ? "present" : "clear"} · direct {direct ? "yes" : "no"}
        {#if timeout != null}<span class="dim"> · holds {n(timeout, 0)} s</span>{/if}
      </span>
    </div>
    {#if raw !== occupied}
      <div class="row bad">
        <span class="k">Why they differ</span>
        <span class="v">the {n(timeout ?? 0, 0)} s hold is still running</span>
      </div>
    {/if}
    <div class="row">
      <span class="k">Turn things off when empty</span>
      <span class="v">
        <button class="mini" onclick={() => { ha.toggle(TV.autoOff, "Auto-off when empty"); }}>
          {ha.isOn(TV.autoOff) ? "on" : "off"}
        </button>
      </span>
    </div>
    {#if watts != null}
      <div class="row">
        <span class="k">TV plug</span>
        <span class="v">{n(watts, 0)} W{#if !ha.isOn(TV.plug)} · switched off{/if}</span>
      </div>
    {/if}
  </div>

  {#if ha.exists(TV.aircon)}
    <div class="hr"></div>
    <div class="rh">
      <span class="lb">Aircon</span>
      <span class="sub">{target != null ? `set to ${n(target, 0)}°` : "no target"}</span>
    </div>
    <div class="modes">
      {#each MODES as m (m)}
        <button
          class:on={mode === m}
          onclick={() => { ha.setClimate(TV.aircon, m); toast.show(`Aircon ${m.replace("_", " ")}`); }}
        >{m === "fan_only" ? "fan" : m}</button>
      {/each}
    </div>
    <div class="note">
      {#if feedback == null}
        <strong>It is running blind.</strong> The aircon reports no room
        temperature and this sensor's own probe reads unknown, so nothing is
        measuring whether {target != null ? `${n(target, 0)}°` : "the target"} was
        reached. Mode and target are set open-loop until that probe reports.
      {:else}
        Room is {n(feedback, 1)}° against a {n(target, 0)}° target.
      {/if}
    </div>
  {/if}
</div>

<style>
  .an { font-size: 14px; font-weight: 800; color: var(--text); }
  .tr { display: flex; align-items: center; gap: 12px; margin: 12px 0 2px; flex-wrap: wrap; }
  .big { font-size: 26px; font-weight: 800; letter-spacing: -0.4px; }
  .pill { display: inline-flex; align-items: center; gap: 7px; padding: 5px 11px; border-radius: 999px; background: rgba(255,255,255,0.06); font-size: 11.5px; font-weight: 700; color: var(--text-2); }
  .pd { width: 7px; height: 7px; border-radius: 50%; }
  .scale { margin: 16px 0 4px; }
  .track { position: relative; height: 7px; border-radius: 999px; background: linear-gradient(90deg, color-mix(in srgb, var(--acc) 30%, transparent), rgba(255,255,255,0.07)); }
  .dot { position: absolute; top: -4px; width: 15px; height: 15px; border-radius: 50%; background: var(--acc); transform: translateX(-50%); box-shadow: 0 0 10px var(--acc); }
  .ends { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--text-3); margin-top: 7px; }
  .rows { display: grid; gap: 1px; margin-top: 14px; }
  .row { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--line, rgba(255,255,255,0.06)); font-size: 12.5px; }
  .row:last-child { border-bottom: 0; }
  .row .k { color: var(--text-3); font-weight: 600; }
  .row .v { color: var(--text); font-weight: 700; text-align: right; }
  .row.bad .v { color: var(--warning); }
  .dim { color: var(--text-3); font-weight: 500; }
  .mini { padding: 4px 10px; border-radius: 8px; background: rgba(255,255,255,0.08); font-size: 11.5px; font-weight: 700; color: var(--text); min-height: 32px; }
  .hr { height: 1px; background: var(--line, rgba(255,255,255,0.07)); margin: 16px 0 12px; }
  .lb { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--acc); }
  .modes { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
  .modes button { padding: 8px 13px; border-radius: 9px; background: rgba(255,255,255,0.06); font-size: 12px; font-weight: 700; color: var(--text-2); min-height: 40px; }
  .modes button.on { background: var(--acc); color: var(--acc-ink, #10131a); }
  .note { font-size: 11.5px; color: var(--text-3); line-height: 1.55; margin-top: 11px; text-wrap: pretty; }
</style>
