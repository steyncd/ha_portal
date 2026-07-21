<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { APPLIANCE_AREAS, APPLIANCES, type Appliance } from "../lib/entities";
  import { power } from "../lib/format";
  import StatusChip from "../lib/components/StatusChip.svelte";
  import Icon from "../lib/components/Icon.svelte";

  // Three-state: ON (drawing power), IDLE (switched on but <1 W), OFF (standby).
  // Metering plugs (meter:true) have unreliable switch state — on/off from power only.
  const appState = (a: Appliance): "on" | "idle" | "off" => {
    const w = ha.num(a.power) ?? 0;
    if (a.meter) return w > (a.threshold ?? 5) ? "on" : "off";
    if (!ha.isOn(a.sw)) return "off";
    return w >= 1 ? "on" : "idle";
  };

  const draw = (items: Appliance[]) =>
    items.reduce((s, a) => s + (appState(a) !== "off" ? (ha.num(a.power) ?? 0) : 0), 0);

  const totalDraw = $derived(draw(APPLIANCES));
  const onCount = $derived(APPLIANCES.filter((a) => appState(a) !== "off").length);
</script>

<div class="col">
  <div class="kpis">
    <div class="card k">
      <div class="lb">Total draw</div>
      <div class="big">{power(totalDraw).val}<span class="u"> {power(totalDraw).unit}</span></div>
      <div class="sub" style="color:var(--warning)">{onCount} appliance{onCount === 1 ? "" : "s"} on</div>
    </div>
    <div class="card k">
      <div class="lb">Tracked</div>
      <div class="big">{APPLIANCES.length}</div>
      <div class="sub">across {APPLIANCE_AREAS.length} areas</div>
    </div>
  </div>

  {#each APPLIANCE_AREAS as area}
    {@const d = draw(area.items)}
    <div class="card pad">
      <div class="ah">
        <div class="at">
          <span class="aic"><Icon name={area.ic} size={17} /></span>
          <span class="an">{area.name}</span>
        </div>
        <span class="adraw" class:live={d > 0}>{power(d).val} {power(d).unit}</span>
      </div>
      <div class="appgrid">
        {#each area.items as a}
          {@const p = ha.num(a.power)}
          {@const st = appState(a)}
          {@const avail = ha.available(a.sw)}
          <button class="app" class:on={st === "on"} class:idle={st === "idle"} onclick={() => ha.toggle(a.sw)} disabled={!avail}>
            <span class="aicn"><Icon name={a.ic} size={18} /></span>
            <span class="al">
              <span class="anm">{a.label}</span>
              <span class="aw">{!avail ? "Offline" : p != null ? `${power(p).val} ${power(p).unit}` : "—"}</span>
            </span>
            {#if !avail}
              <StatusChip state="off" label="Offline" />
            {:else}
              <StatusChip state={st === "on" ? "ok" : st === "idle" ? "idle" : "off"} label={st === "on" ? "On" : st === "idle" ? "Idle" : "Off"} />
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }
  .kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .k { padding: 16px; }
  .big { font-size: 30px; font-weight: 800; letter-spacing: -1px; margin-top: 6px; }
  .u { font-size: 15px; color: var(--dim); }
  .sub { font-size: 11.5px; color: var(--dim); margin-top: 3px; }

  .pad { padding: 20px 22px; }
  .ah { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
  .at { display: flex; align-items: center; gap: 11px; min-width: 0; }
  .aic { width: 34px; height: 34px; flex-shrink: 0; border-radius: 10px; display: grid; place-items: center; font-size: 16px; background: var(--soft); box-shadow: inset 0 0 0 1px var(--line); }
  .an { font-size: 15px; font-weight: 700; letter-spacing: -0.2px; }
  .adraw { flex-shrink: 0; font-size: 12px; font-weight: 700; color: var(--muted-2); padding: 4px 11px; border-radius: 999px; background: rgba(255, 255, 255, 0.05); }
  .adraw.live { color: var(--warning); background: color-mix(in srgb, var(--warning) 16%, transparent); }

  .appgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
  .app { display: flex; align-items: center; gap: 12px; padding: 13px 15px; border-radius: 14px; background: rgba(255, 255, 255, 0.05); text-align: left; }
  .app:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); }
  .app.on { background: color-mix(in srgb, var(--warning) 14%, transparent); box-shadow: inset 0 0 0 1.5px var(--warning); }
  .app.idle { background: color-mix(in srgb, var(--warning) 6%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 22%, transparent); }
  .app:disabled { opacity: 0.4; cursor: default; }
  .aicn { font-size: 18px; flex-shrink: 0; }
  .al { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .anm { font-size: 13.5px; font-weight: 600; }
  .aw { font-size: 12px; color: var(--dim); font-variant-numeric: tabular-nums; }
  .app :global(.status) { flex-shrink: 0; }

  @media (max-width: 640px) { .kpis { grid-template-columns: 1fr; } }
</style>
