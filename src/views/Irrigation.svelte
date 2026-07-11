<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { E, IRRIGATION_ZONES } from "../lib/entities";
  import { n } from "../lib/format";
  import { toast } from "../lib/toast.svelte";
  import Toggle from "../lib/components/Toggle.svelte";

  const current = $derived(ha.state(E.irrCurrentZone));
  const runtime = $derived(ha.num(E.irrRuntime) ?? 10);

  function startZone(zone: string) {
    ha.setSelect(E.irrZoneSelect, zone);
    ha.script(E.irrStartZone);
    toast.show(`Starting ${zone} · ${runtime} min`);
  }
  function stopAll() {
    ha.script(E.irrStopAll);
    toast.show("Stopping all zones");
  }
  function setRuntime(e: Event) {
    ha.setNumber(E.irrRuntime, Number((e.target as HTMLInputElement).value));
  }
</script>

<div class="col">
  <div class="card header">
    <div><div class="ttl">🌿 Wyze Irrigation · {IRRIGATION_ZONES.length} zones</div><div class="sub">Fed from borehole & tank · watered {n(ha.num(E.irrTimeToday))} min today</div></div>
    <button class="stopall" onclick={stopAll}>Stop all</button>
  </div>

  <div class="two">
    <div class="card pad">
      <div class="rh"><span class="lb">Smart irrigation</span><Toggle on={ha.isOn(E.irrIntelligence)} onchange={() => ha.toggleBoolean(E.irrIntelligence)} /></div>
      <div class="sub">{ha.isOn(E.irrIntelligence) ? "Auto-skips runs when rain is forecast and adapts to soil conditions." : "Manual scheduling — runs as programmed."}</div>
      <div class="rt">
        <div class="rtrow"><span class="lb">Run time per zone</span><span class="rtv">{n(runtime)} min</span></div>
        <input type="range" min="1" max="30" value={runtime} oninput={setRuntime} />
      </div>
    </div>
    <div class="card pad">
      <div class="lb" style="margin-bottom:12px">This month</div>
      <div class="mo">
        <div class="mov">{n(ha.num(E.irrTimeMonth))}<span class="u"> min</span></div>
        <div class="sub">total watering time</div>
      </div>
      <div class="soil">💧 Soil-moisture sensors not connected — add them to see per-zone moisture here.</div>
    </div>
  </div>

  <div class="zones">
    {#each IRRIGATION_ZONES as z}
      {@const running = current === z}
      <div class="zone card" class:on={running}>
        <div class="zh"><span class="zn">{z}</span><span class="zst" style="color:{running ? 'var(--success)' : 'var(--muted)'}">{running ? "Running" : "Idle"}</span></div>
        <div class="zb">
          <span class="sub">{running ? `${n(runtime)} min cycle` : "Tap to run"}</span>
          {#if running}
            <button class="zbtn stop" onclick={stopAll}>Stop</button>
          {:else}
            <button class="zbtn" onclick={() => startZone(z)}>Start</button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; max-width: 1180px; margin: 0 auto; }
  .header { padding: 18px 20px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
  .ttl { font-size: 16px; font-weight: 700; }
  .sub { font-size: 12px; color: var(--dim); margin-top: 3px; }
  .stopall { padding: 10px 16px; border-radius: 12px; background: rgba(255, 255, 255, 0.06); color: var(--text); font-size: 12.5px; font-weight: 600; }
  .stopall:hover { background: rgba(255, 255, 255, 0.1); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 760px) { .two { grid-template-columns: 1fr; } }
  .pad { padding: 20px; }
  .rh { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .rt { margin-top: 16px; }
  .rtrow { display: flex; justify-content: space-between; margin-bottom: 9px; }
  .rtv { font-size: 13px; font-weight: 800; color: var(--acc); }
  input[type="range"] { width: 100%; height: 6px; cursor: pointer; accent-color: var(--acc); }
  .mo { margin-bottom: 14px; }
  .mov { font-size: 30px; font-weight: 800; letter-spacing: -1px; }
  .u { font-size: 14px; color: var(--dim); }
  .soil { font-size: 12px; color: var(--muted); padding: 12px 14px; border-radius: 12px; background: rgba(255, 255, 255, 0.03); }
  .zones { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
  .zone { padding: 17px; }
  .zone.on { box-shadow: inset 0 0 0 1.5px var(--line), inset 0 1px 0 rgba(255, 255, 255, 0.1); background: linear-gradient(180deg, var(--soft), rgba(255, 255, 255, 0.028)); }
  .zh { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .zn { font-size: 13.5px; font-weight: 600; }
  .zst { font-size: 11px; font-weight: 700; }
  .zb { display: flex; align-items: center; justify-content: space-between; }
  .zbtn { padding: 8px 15px; border-radius: 10px; background: var(--grad); color: #0b1017; font-size: 12px; font-weight: 700; }
  .zbtn.stop { background: color-mix(in srgb, var(--error) 22%, transparent); color: #fecdd6; }
</style>
