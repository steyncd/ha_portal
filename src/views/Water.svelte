<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E } from "../lib/entities";
  import { n, dailyMax } from "../lib/format";
  import AreaChart from "../lib/components/AreaChart.svelte";
  import BarChart from "../lib/components/BarChart.svelte";

  const tank = $derived(ha.num(E.tankLevel));
  const low = $derived(ha.state(E.tankLowAlert) === "on");

  let tankHist = $state<{ t: number; v: number }[]>([]);
  let useBars = $state<{ label: string; value: number | null }[]>([]);
  onMount(async () => {
    tankHist = await ha.history(E.tankLevel, 24 * 7);
    useBars = dailyMax(await ha.history(E.waterUsedToday, 24 * 7), 7);
  });

  const pumps = [
    { id: E.waterPump, icon: "💧", name: "Water Pump" },
    { id: E.poolPump, icon: "🏊", name: "Pool Pump" },
    { id: E.boreholePump, icon: "🕳️", name: "Borehole" },
  ];
</script>

<div class="col">
  <div class="top">
    <div class="card gauge">
      <div class="lb" style="align-self:flex-start">JoJo Tank · {ha.state(E.tankStatus) ?? "—"}</div>
      <div class="tank"><div class="fill" class:low style="height:{tank ?? 0}%"></div><div class="tpct">{n(tank)}%</div></div>
      <div class="gt"><div class="gv">{n(ha.num(E.tankVolume))} L · {n(ha.num(E.tankDays))} days</div><div class="sub">flow {n(ha.num("sensor.jojo_tank_flow_rate"), 1)} L/min</div></div>
    </div>
    <div class="right">
      <div class="card pad">
        <div class="lb" style="margin-bottom:13px">Pumps</div>
        <div class="pgrid">
          {#each pumps as p}
            <button class="ptile" class:on={ha.isOn(p.id)} onclick={() => ha.toggle(p.id)}>
              <span class="pi">{p.icon}</span><span class="pn">{p.name}</span><span class="ps">{ha.isOn(p.id) ? "Running" : "Off"}</span>
            </button>
          {/each}
        </div>
      </div>
      <div class="stats">
        <div class="card s"><div class="lb">Used today</div><div class="sv">{n(ha.num(E.waterUsedToday))}<span class="u"> L</span></div><div class="sub">yest. {n(ha.num(E.waterUsedYesterday))} L</div></div>
        <div class="card s"><div class="lb">7-day avg</div><div class="sv">{n(ha.num(E.waterAvg7d))}<span class="u"> L</span></div><div class="sub">per day</div></div>
        <div class="card s"><div class="lb">Borehole</div><div class="sv">{n(ha.num(E.boreholeToday))}<span class="u"> L</span></div><div class="sub">{n(ha.num(E.boreholeMonth))} L month</div></div>
      </div>
    </div>
  </div>

  <div class="charts">
    <div class="card pad">
      <div class="rh"><span class="lb">Daily use · 7 days</span><span class="sub">L</span></div>
      <BarChart bars={useBars} height={150} />
    </div>
    <div class="card pad">
      <div class="rh"><span class="lb">Tank level · 7 days</span><span class="sub" style="color:var(--water)">Now {n(tank)}%</span></div>
      <AreaChart data={tankHist} color="var(--water)" unit="%" fixedMin={0} fixedMax={100} height={150} />
    </div>
  </div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; max-width: 1180px; margin: 0 auto; }
  .top { display: grid; grid-template-columns: 320px 1fr; gap: 14px; }
  @media (max-width: 760px) { .top { grid-template-columns: 1fr; } }
  .gauge { padding: 22px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .tank { width: 80px; height: 150px; border-radius: 16px; background: rgba(255, 255, 255, 0.06); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16); overflow: hidden; position: relative; }
  .tank .fill { position: absolute; left: 0; right: 0; bottom: 0; background: linear-gradient(180deg, #7dd3fc, var(--water)); opacity: 0.9; transition: height 0.6s; }
  .tank .fill.low { background: linear-gradient(180deg, #fda4af, var(--error)); }
  .tpct { position: absolute; inset: 0; display: grid; place-items: center; font-size: 26px; font-weight: 800; color: #04121c; }
  .gt { text-align: center; }
  .gv { font-size: 15px; font-weight: 700; }
  .sub { font-size: 12px; color: var(--dim); margin-top: 3px; }
  .right { display: flex; flex-direction: column; gap: 14px; }
  .pad { padding: 18px; }
  .pgrid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  .ptile { display: flex; flex-direction: column; gap: 7px; padding: 15px; border-radius: 14px; background: rgba(255, 255, 255, 0.045); text-align: left; }
  .ptile.on { background: var(--soft); box-shadow: inset 0 0 0 1.5px var(--line); }
  .pi { font-size: 18px; }
  .pn { font-size: 12.5px; font-weight: 600; }
  .ps { font-size: 10.5px; color: var(--text-2); }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .s { padding: 16px; }
  .sv { font-size: 24px; font-weight: 800; margin-top: 5px; }
  .u { font-size: 13px; color: var(--dim); }
  .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 760px) { .charts { grid-template-columns: 1fr; } }
  .rh { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
</style>
