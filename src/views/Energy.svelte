<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E, APPLIANCES } from "../lib/entities";
  import { n, power, rand, dailyMax } from "../lib/format";
  import PowerFlow from "../lib/components/PowerFlow.svelte";
  import AreaChart from "../lib/components/AreaChart.svelte";
  import BarChart from "../lib/components/BarChart.svelte";

  type Range = "day" | "week" | "month";
  let range = $state<Range>("day");

  let socHist = $state<{ t: number; v: number }[]>([]);
  let pvHist = $state<{ t: number; v: number }[]>([]);
  let solarWeek = $state<{ label: string; value: number | null }[]>([]);
  onMount(async () => {
    socHist = await ha.history(E.batterySoc, 24);
    pvHist = await ha.history(E.pvPower, 24);
    solarWeek = dailyMax(await ha.history(E.solarYieldToday, 24 * 7), 7);
  });

  const victron = $derived([
    { icon: "🔌", color: "var(--water)", name: "Inverter / VE.Bus", rows: [
      { k: "State", v: ha.state(E.inverterState) ?? "—" },
      { k: "AC load", v: `${power(ha.num(E.loads)).val} ${power(ha.num(E.loads)).unit}` },
      { k: "Essential", v: `${power(ha.num(E.essentialLoads)).val} ${power(ha.num(E.essentialLoads)).unit}` },
      { k: "Grid", v: `${power(ha.num(E.gridPower)).val} ${power(ha.num(E.gridPower)).unit}` },
    ] },
    { icon: "☀️", color: "var(--solar)", name: "Solar / MPPT", rows: [
      { k: "PV now", v: `${power(ha.num(E.pvPower)).val} ${power(ha.num(E.pvPower)).unit}` },
      { k: "MPPT 1", v: `${n(ha.num("sensor.victron_mppt1_pv_power"))} W` },
      { k: "MPPT 2", v: `${n(ha.num("sensor.victron_mppt2_pv_power"))} W` },
      { k: "Yield", v: `${n(ha.num(E.pvYieldToday), 1)} kWh` },
    ] },
    { icon: "🔋", color: "var(--acc)", name: "Battery bank", rows: [
      { k: "SoC", v: `${n(ha.num(E.batterySoc))}%` },
      { k: "Power", v: `${power(ha.num(E.batteryPower)).val} ${power(ha.num(E.batteryPower)).unit}` },
      { k: "Voltage", v: `${n(ha.num(E.batteryVoltage), 1)} V` },
      { k: "Temp", v: `${n(ha.num(E.batteryTemp))}°C` },
    ] },
  ]);
</script>

<div class="col">
  <div class="kpis">
    <div class="card k"><div class="lb">Battery</div><div class="big">{n(ha.num(E.batterySoc))}<span class="u">%</span></div><div class="sub" style="color:var(--water)">{n(ha.num(E.batteryPower))} W → home</div></div>
    <div class="card k"><div class="lb">Solar today</div><div class="big">{n(ha.num(E.solarYieldToday), 1)}<span class="u"> kWh</span></div><div class="sub" style="color:var(--solar)">live {power(ha.num(E.pvPower)).val} {power(ha.num(E.pvPower)).unit}</div></div>
    <div class="card k"><div class="lb">Grid import</div><div class="big">{n(ha.num(E.gridImportToday), 1)}<span class="u"> kWh</span></div><div class="sub">{rand(ha.num(E.energyCostToday))} today</div></div>
    <div class="card k"><div class="lb">Grade</div><div class="big" style="color:var(--success)">{ha.state(E.energyGrade) ?? "—"}</div><div class="sub">{n(ha.num(E.gridIndepToday))}% independent</div></div>
  </div>

  <div class="card pad">
    <div class="rh">
      <span class="lb">Production & use</span>
      <div class="tabs">
        {#each ["day", "week", "month"] as r}
          <button class="tab" class:active={range === r} onclick={() => (range = r as Range)}>{r[0].toUpperCase() + r.slice(1)}</button>
        {/each}
      </div>
    </div>
    {#if range === "day"}
      <div class="ch2"><span class="lb">Battery state of charge · 24h</span><span class="sub">Now {n(ha.num(E.batterySoc))}%</span></div>
      <AreaChart data={socHist} color="var(--acc)" unit="%" fixedMin={0} fixedMax={100} height={150} />
      <div class="ch2" style="margin-top:16px"><span class="lb">Solar power · 24h</span></div>
      <AreaChart data={pvHist} color="var(--solar)" unit="W" fixedMin={0} height={130} />
    {:else}
      <div class="ch2"><span class="lb">Solar yield · 7 days</span><span class="sub">kWh</span></div>
      <BarChart bars={solarWeek} digits={1} height={170} />
    {/if}
  </div>

  <div class="card pad">
    <div class="lb" style="margin-bottom:6px">Live power flow</div>
    <PowerFlow big />
    <div class="flowlegend">
      <span>☀️ Solar {power(ha.num(E.pvPower)).val} {power(ha.num(E.pvPower)).unit}</span>
      <span>🔋 Battery {n(ha.num(E.batteryPower))} W</span>
      <span>🔌 Grid {power(ha.num(E.gridPower)).val} {power(ha.num(E.gridPower)).unit}</span>
      <span>🏠 Load {power(ha.num(E.loads)).val} {power(ha.num(E.loads)).unit}</span>
    </div>
  </div>

  <div class="card pad">
    <div class="rh"><span class="lb">Victron system · inverter & chargers</span><span class="ok">● {ha.state(E.gridLostAlarm) === "0" ? "VE.Bus OK · grid connected" : "grid lost"}</span></div>
    <div class="vgrid">
      {#each victron as d}
        <div class="vtile">
          <div class="vhead"><span class="vic" style="background:color-mix(in srgb,{d.color} 18%,transparent)">{d.icon}</span><span class="vn">{d.name}</span></div>
          <div class="vrows">
            {#each d.rows as r}<div><div class="vv">{r.v}</div><div class="vk">{r.k}</div></div>{/each}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <div class="card pad">
    <div class="lb" style="margin-bottom:13px">Appliances & plugs — live draw</div>
    <div class="appgrid">
      {#each APPLIANCES as a}
        {@const p = ha.num(a.power)}
        <button class="app" class:on={ha.isOn(a.sw)} onclick={() => ha.toggle(a.sw)} disabled={!ha.exists(a.sw)}>
          <span class="al"><span class="an">{a.label}</span><span class="aw">{p != null ? `${power(p).val} ${power(p).unit}` : "—"}</span></span>
          <span class="apill" class:apon={ha.isOn(a.sw)}>{ha.isOn(a.sw) ? "ON" : "OFF"}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; max-width: 1180px; margin: 0 auto; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  @media (max-width: 760px) { .kpis { grid-template-columns: 1fr 1fr; } }
  .k { padding: 16px; }
  .big { font-size: 30px; font-weight: 800; letter-spacing: -1px; margin-top: 6px; }
  .u { font-size: 15px; color: var(--dim); }
  .sub { font-size: 11.5px; color: var(--dim); margin-top: 3px; }
  .pad { padding: 20px 22px; }
  .rh { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
  .ok { font-size: 11.5px; color: var(--success); font-weight: 600; }
  .tabs { display: flex; gap: 4px; background: rgba(255, 255, 255, 0.05); border-radius: 11px; padding: 4px; }
  .tab { padding: 7px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--text); }
  .tab.active { background: var(--grad); color: #0b1017; }
  .ch2 { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
  .flowlegend { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 18px; font-size: 12px; color: var(--dim); margin-top: 6px; }
  .vgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(198px, 1fr)); gap: 12px; }
  .vtile { padding: 15px; border-radius: 14px; background: rgba(255, 255, 255, 0.04); }
  .vhead { display: flex; align-items: center; gap: 9px; margin-bottom: 13px; }
  .vic { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; font-size: 15px; }
  .vn { font-size: 12.5px; font-weight: 700; }
  .vrows { display: grid; grid-template-columns: 1fr 1fr; gap: 11px 10px; }
  .vv { font-size: 14.5px; font-weight: 800; }
  .vk { font-size: 9.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1px; }
  .appgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .app { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 15px; border-radius: 14px; background: rgba(255, 255, 255, 0.05); text-align: left; }
  .app.on { background: color-mix(in srgb, var(--warning) 14%, transparent); box-shadow: inset 0 0 0 1.5px var(--warning); }
  .app:disabled { opacity: 0.4; }
  .al { display: flex; flex-direction: column; gap: 2px; }
  .an { font-size: 13.5px; font-weight: 600; }
  .aw { font-size: 12px; color: var(--dim); }
  .apill { flex-shrink: 0; padding: 4px 10px; border-radius: 999px; font-size: 10.5px; font-weight: 800; background: rgba(255, 255, 255, 0.08); color: var(--muted); }
  .apill.apon { background: color-mix(in srgb, var(--warning) 30%, transparent); color: #fff; }
</style>
