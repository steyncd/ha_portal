<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E, PUMPS } from "../lib/entities";
  import { n, power, dailyMax } from "../lib/format";
  import AreaChart from "../lib/components/AreaChart.svelte";
  import BarChart from "../lib/components/BarChart.svelte";

  const tank = $derived(ha.num(E.tankLevel));
  const low = $derived(ha.state(E.tankLowAlert) === "on");
  const days = $derived(ha.num(E.tankDays));
  const daysColor = $derived(days == null ? "var(--muted)" : days < 7 ? "var(--error)" : days < 21 ? "var(--warning)" : "var(--success)");

  // net in/out today: borehole pumped in vs consumption out
  const inToday = $derived(ha.num(E.boreholeToday) ?? 0);
  const outToday = $derived(ha.num(E.waterUsedToday) ?? 0);
  const net = $derived(inToday - outToday);

  let tankHist = $state<{ t: number; v: number }[]>([]);
  let useBars = $state<{ label: string; value: number | null }[]>([]);
  onMount(async () => {
    tankHist = await ha.history(E.tankLevel, 24 * 30);
    useBars = dailyMax(await ha.history(E.waterUsedToday, 24 * 7), 7);
  });

  // pump state from live power: off → idling (on, low W) → pumping (on, high W)
  function pumpState(p: (typeof PUMPS)[number]) {
    const on = ha.isOn(p.sw);
    const w = ha.num(p.power);
    if (!on) return { label: "Off", pumping: false, w };
    return { label: (w ?? 0) > p.threshold ? "Pumping" : "Idling", pumping: (w ?? 0) > p.threshold, w };
  }
  const bhPower = $derived(ha.num(E.boreholePower));
  const bhOn = $derived(ha.isOn(E.boreholePump));
  const bhPumping = $derived(bhOn && (bhPower ?? 0) > 40);
</script>

<div class="col">
  <!-- days-remaining hero -->
  <div class="card hero" class:low>
    <div class="hleft">
      <div class="hbig" style="color:{daysColor}">{n(days)}<span class="hunit"> days</span></div>
      <div class="hlbl">of water left at current use</div>
    </div>
    <div class="hmeta">
      <div class="hm"><span class="hmv" style="color:var(--water)">{n(ha.num(E.tankVolume))} L</span><span class="hmk">in tank · {n(tank)}%</span></div>
      <div class="hm"><span class="hmv">{n(ha.num(E.waterAvg7d))} L</span><span class="hmk">avg use / day</span></div>
      <div class="hm"><span class="hmv" style="color:{net >= 0 ? 'var(--success)' : 'var(--warning)'}">{net >= 0 ? "+" : ""}{n(net)} L</span><span class="hmk">net today (in − out)</span></div>
    </div>
  </div>

  <div class="top">
    <div class="card gauge">
      <div class="lb" style="align-self:flex-start">JoJo Tank · {ha.state(E.tankStatus) ?? "—"}</div>
      <div class="tank"><div class="fill" class:low style="height:{tank ?? 0}%"></div><div class="tpct">{n(tank)}%</div></div>
      <div class="gt"><div class="gv">{n(ha.num(E.tankVolume))} L · {n(ha.num(E.tankDays))} days</div><div class="sub">flow {n(ha.num("sensor.jojo_tank_flow_rate"), 1)} L/min</div></div>
    </div>
    <div class="right">
      <div class="card pad">
        <div class="lb" style="margin-bottom:13px">Pumps · live power</div>
        <div class="pgrid">
          {#each PUMPS as p}
            {@const st = pumpState(p)}
            <button class="ptile" class:on={ha.isOn(p.sw)} class:pumping={st.pumping} onclick={() => ha.toggle(p.sw)}>
              <span class="pi">{p.icon}</span><span class="pn">{p.label}</span>
              <span class="pw">{st.w != null ? `${power(st.w).val} ${power(st.w).unit}` : "—"}</span>
              <span class="ps" class:go={st.pumping}>{st.label}</span>
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

  <!-- borehole live detail -->
  <div class="card pad bh" class:go={bhPumping}>
    <div class="rh">
      <span class="lb">Borehole pump</span>
      <span class="bhstate" class:go={bhPumping}>{!bhOn ? "Off" : bhPumping ? "● Pumping" : "○ Idling (standby)"}</span>
    </div>
    <div class="bhgrid">
      <div class="bhm"><div class="bhv" style="color:{bhPumping ? 'var(--water)' : 'var(--muted)'}">{bhPower != null ? `${power(bhPower).val} ${power(bhPower).unit}` : "—"}</div><div class="bhk">Power now</div></div>
      <div class="bhm"><div class="bhv">{n(ha.num(E.boreholeFlow), 1)}<span class="uu"> L/min</span></div><div class="bhk">Flow rate</div></div>
      <div class="bhm"><div class="bhv">{n(ha.num(E.boreholeToday))}<span class="uu"> L</span></div><div class="bhk">Pumped today</div></div>
      <div class="bhm"><div class="bhv">{ha.state(E.boreholeRunToday) ?? "—"}</div><div class="bhk">Run time today</div></div>
      <div class="bhm"><div class="bhv">{n(ha.num(E.boreholeEnergyToday), 2)}<span class="uu"> kWh</span></div><div class="bhk">Energy today</div></div>
      <div class="bhm"><div class="bhv">R{n(ha.num(E.boreholeCostToday), 2)}</div><div class="bhk">Cost today</div></div>
    </div>
    <div class="note">Sitting at a few watts = idling on standby. A jump to hundreds of watts means it's actually drawing water.</div>
  </div>

  <div class="charts">
    <div class="card pad">
      <div class="rh"><span class="lb">Daily use · 7 days</span><span class="sub">L</span></div>
      <BarChart bars={useBars} height={150} />
    </div>
    <div class="card pad">
      <div class="rh"><span class="lb">Tank level · 30 days</span><span class="sub" style="color:var(--water)">Now {n(tank)}%</span></div>
      <AreaChart data={tankHist} color="var(--water)" unit="%" fixedMin={0} fixedMax={100} height={150} />
    </div>
  </div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; max-width: 1180px; margin: 0 auto; }
  .hero { padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; position: relative; overflow: hidden; }
  .hero::after { content: ""; position: absolute; inset: 0; background: radial-gradient(360px 160px at 8% 130%, color-mix(in srgb, var(--water) 16%, transparent), transparent 70%); pointer-events: none; }
  .hero.low::after { background: radial-gradient(360px 160px at 8% 130%, color-mix(in srgb, var(--error) 18%, transparent), transparent 70%); }
  .hleft { position: relative; }
  .hbig { font-size: 48px; font-weight: 800; letter-spacing: -2px; line-height: 0.9; }
  .hunit { font-size: 22px; }
  .hlbl { font-size: 12.5px; color: var(--dim); margin-top: 5px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700; }
  .hmeta { position: relative; display: grid; grid-template-columns: repeat(3, auto); gap: 8px 22px; }
  @media (max-width: 560px) { .hmeta { grid-template-columns: 1fr 1fr; } }
  .hm { display: flex; flex-direction: column; gap: 2px; }
  .hmv { font-size: 17px; font-weight: 800; }
  .hmk { font-size: 11px; color: var(--muted); }
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
  .ptile { display: flex; flex-direction: column; gap: 4px; padding: 15px; border-radius: 14px; background: rgba(255, 255, 255, 0.045); text-align: left; }
  .ptile.on { background: var(--soft); box-shadow: inset 0 0 0 1.5px var(--line); }
  .ptile.pumping { background: color-mix(in srgb, var(--water) 18%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--water) 60%, transparent); }
  .pi { font-size: 18px; }
  .pn { font-size: 12.5px; font-weight: 600; }
  .pw { font-size: 15px; font-weight: 800; margin-top: 2px; }
  .ps { font-size: 10.5px; color: var(--muted); }
  .ps.go { color: var(--water); font-weight: 700; }
  .bh { position: relative; overflow: hidden; }
  .bh.go { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 16px 40px -24px rgba(0, 0, 0, 0.8), inset 0 0 0 1px color-mix(in srgb, var(--water) 40%, transparent); }
  .bhstate { font-size: 12px; font-weight: 700; color: var(--muted); }
  .bhstate.go { color: var(--water); }
  .bhgrid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; margin: 4px 0 12px; }
  @media (max-width: 760px) { .bhgrid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 420px) { .bhgrid { grid-template-columns: repeat(2, 1fr); } }
  .bhm { min-width: 0; }
  .bhv { font-size: 19px; font-weight: 800; }
  .uu { font-size: 11px; color: var(--dim); font-weight: 600; }
  .bhk { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }
  .note { font-size: 11.5px; color: var(--muted-2); }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .s { padding: 16px; }
  .sv { font-size: 24px; font-weight: 800; margin-top: 5px; }
  .u { font-size: 13px; color: var(--dim); }
  .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 760px) { .charts { grid-template-columns: 1fr; } }
  .rh { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
</style>
