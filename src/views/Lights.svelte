<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { lightSheet } from "../lib/lightSheet.svelte";
  import { toast } from "../lib/toast.svelte";
  import { LIGHT_AREAS, ALL_LIGHTS, type LightDef } from "../lib/entities";

  const onCount = $derived(ALL_LIGHTS.filter((id) => ha.isOn(id)).length);
  const total = ALL_LIGHTS.length;

  const areaOn = (lights: LightDef[]) => lights.filter((l) => ha.isOn(l.id)).length;
  const dimmable = (id: string) => id.startsWith("light.");

  function setArea(lights: LightDef[], on: boolean, name: string) {
    const ids = lights.map((l) => l.id).filter((id) => ha.exists(id));
    if (!ids.length) return;
    if (on) ha.turnOn(ids);
    else ha.turnOff(ids);
    toast.show(`${name} ${on ? "on" : "off"}`);
  }
</script>

<div class="col">
  <div class="card top">
    <div>
      <div class="lb">Lights</div>
      <div class="big">{onCount}<span class="u"> / {total} on</span></div>
    </div>
    <button class="alloff" onclick={() => { ha.turnOff(ALL_LIGHTS); toast.show("All lights off"); }}>
      🌑 All off
    </button>
  </div>

  {#each LIGHT_AREAS as area}
    {@const on = areaOn(area.lights)}
    <div class="card area">
      <div class="ah">
        <div class="at">
          <span class="aic">{area.icon}</span>
          <span class="an">{area.name}</span>
          <span class="acount" class:lit={on > 0}>{on}/{area.lights.length} on</span>
        </div>
        <div class="actrl">
          <button class="ab" onclick={() => setArea(area.lights, true, area.name)}>On</button>
          <button class="ab" onclick={() => setArea(area.lights, false, area.name)}>Off</button>
        </div>
      </div>
      <div class="grid">
        {#each area.lights as l}
          {@const exists = ha.exists(l.id)}
          <div class="ltile" class:on={ha.isOn(l.id)} class:dead={!exists}>
            <div
              class="ltap"
              role="button"
              tabindex="0"
              onclick={() => exists && ha.toggle(l.id)}
              onkeydown={(e) => { if (exists && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); ha.toggle(l.id); } }}
            >
              <span class="mi">{l.icon}</span>
              <span class="mn">{l.label}</span>
              <span class="qs">{exists ? (ha.isOn(l.id) ? "On" : "Off") : "N/A"}</span>
            </div>
            {#if dimmable(l.id) && exists}
              <button class="tune" onclick={() => lightSheet.open(l.id, l.label)} aria-label="brightness & colour">⋯</button>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; max-width: 1180px; margin: 0 auto; }

  .top { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 18px 20px; }
  .big { font-size: 30px; font-weight: 800; letter-spacing: -1px; margin-top: 4px; }
  .u { font-size: 15px; color: var(--dim); font-weight: 700; }
  .alloff { flex-shrink: 0; padding: 11px 16px; border-radius: 12px; background: rgba(255, 255, 255, 0.06); color: var(--text-2); font-size: 12.5px; font-weight: 600; }
  .alloff:hover { background: rgba(255, 255, 255, 0.1); color: var(--text); }

  .area { padding: 18px 20px; }
  .ah { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
  .at { display: flex; align-items: center; gap: 11px; min-width: 0; }
  .aic { width: 34px; height: 34px; flex-shrink: 0; border-radius: 10px; display: grid; place-items: center; font-size: 16px; background: var(--soft); box-shadow: inset 0 0 0 1px var(--line); }
  .an { font-size: 15px; font-weight: 700; letter-spacing: -0.2px; }
  .acount { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted-2); padding: 3px 9px; border-radius: 999px; background: rgba(255, 255, 255, 0.05); }
  .acount.lit { color: var(--warning); background: color-mix(in srgb, var(--warning) 16%, transparent); }
  .actrl { display: flex; gap: 6px; background: rgba(255, 255, 255, 0.05); border-radius: 11px; padding: 4px; }
  .ab { padding: 7px 15px; border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--text-2); }
  .ab:hover { background: rgba(255, 255, 255, 0.09); color: var(--text); }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .ltile { position: relative; display: flex; flex-direction: column; gap: 5px; padding: 13px; border-radius: 14px; background: rgba(255, 255, 255, 0.05); transition: background 0.15s, box-shadow 0.15s; }
  .ltile.on { background: color-mix(in srgb, var(--warning) 15%, transparent); box-shadow: inset 0 0 0 1.5px var(--warning); }
  .ltile.dead { opacity: 0.4; }
  .ltap { display: flex; flex-direction: column; gap: 5px; cursor: pointer; outline: none; }
  .ltap:focus-visible { box-shadow: 0 0 0 2px var(--acc); border-radius: 8px; }
  .mi { font-size: 17px; }
  .mn { font-size: 12.5px; font-weight: 600; color: #f2f7fc; }
  .qs { font-size: 10.5px; color: var(--text-2); }
  .tune { position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; border-radius: 8px; background: rgba(255, 255, 255, 0.09); color: #dbe6f0; font-size: 14px; }
  .tune:hover { background: rgba(255, 255, 255, 0.18); }
</style>
