<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E, APPLIANCES } from "../lib/entities";
  import { n, power, rand, dailyMax } from "../lib/format";
  import KpiCard from "../lib/components/KpiCard.svelte";
  import Section from "../lib/components/Section.svelte";
  import PowerFlow from "../lib/components/PowerFlow.svelte";
  import AreaChart from "../lib/components/AreaChart.svelte";
  import BarChart from "../lib/components/BarChart.svelte";
  import Tile from "../lib/components/Tile.svelte";

  const soc = $derived(ha.num(E.batterySoc));
  const pv = $derived(power(ha.num(E.pvPower)));
  const grid = $derived(power(ha.num(E.gridPower)));
  const loads = $derived(power(ha.num(E.loads)));
  const battP = $derived(ha.num(E.batteryPower));
  const gridW = $derived(Math.abs(ha.num(E.gridPower) ?? 0));

  let socHist = $state<{ t: number; v: number }[]>([]);
  let pvHist = $state<{ t: number; v: number }[]>([]);
  let solarBars = $state<{ label: string; value: number | null }[]>([]);

  onMount(async () => {
    socHist = await ha.history(E.batterySoc, 24);
    pvHist = await ha.history(E.pvPower, 24);
    solarBars = dailyMax(await ha.history(E.solarYieldToday, 24 * 7), 7);
  });

  const stats = $derived([
    { v: rand(ha.num(E.energyCostToday)), l: "Cost today" },
    { v: rand(ha.num(E.energyCostMonth)), l: "Proj. month" },
    { v: rand(ha.num(E.solarSavings)), l: "Total saved" },
    { v: `${n(ha.num(E.gridIndepMonth))}%`, l: "Independence mo." },
    { v: `${n(ha.num(E.batteryVoltage), 1)} V`, l: "Batt voltage" },
    { v: `${n(ha.num(E.batteryTemp), 0)}°C`, l: "Batt temp" },
    { v: `${n(ha.num(E.batteryHealth))}%`, l: "Batt health" },
    { v: ha.state(E.energyGrade) ?? "—", l: "Energy grade" },
  ]);
</script>

<Section title="Live Power Flow">
  <PowerFlow
    pv={ha.num(E.pvPower)}
    battP={ha.num(E.batteryPower)}
    gridP={ha.num(E.gridPower)}
    load={ha.num(E.loads)}
    {soc}
  />
</Section>

<div class="kpis">
  <KpiCard icon="🔋" label="Battery" value={n(soc)} unit="%" accent="var(--brand)"
    foots={[{ v: `${battP != null && battP < 0 ? "−" : "+"}${power(Math.abs(battP ?? 0)).val} ${power(Math.abs(battP ?? 0)).unit}`, l: ha.state(E.batteryState) ?? "" }]} />
  <KpiCard icon="☀️" label="Solar PV" value={pv.val} unit={pv.unit} accent="var(--solar)"
    foots={[{ v: `${n(ha.num(E.pvYieldToday), 1)} kWh`, l: "Yield today" }]} />
  <KpiCard icon="🏠" label="House Load" value={loads.val} unit={loads.unit} accent="var(--warning)"
    foots={[{ v: `${power(ha.num(E.essentialLoads)).val} ${power(ha.num(E.essentialLoads)).unit}`, l: "Essential" }]} />
  <KpiCard icon="🔌" label="Grid" value={grid.val} unit={grid.unit} accent={gridW > 20 ? "var(--error)" : "var(--success)"}
    foots={[{ v: ha.state(E.gridLostAlarm) === "0" ? "Connected" : "Lost", l: "Mains" }]} />
</div>

<div class="charts">
  <div class="card chart-card">
    <div class="ch-head"><span class="t-label">Battery · 24h</span><span class="ch-now">{n(soc)}%</span></div>
    <AreaChart data={socHist} color="var(--brand)" unit="%" fixedMin={0} fixedMax={100} />
  </div>
  <div class="card chart-card">
    <div class="ch-head"><span class="t-label">Solar Power · 24h</span><span class="ch-now">{pv.val} {pv.unit}</span></div>
    <AreaChart data={pvHist} color="var(--solar)" unit="W" fixedMin={0} />
  </div>
</div>

<Section title="Solar Yield" hint="last 7 days · kWh">
  <div class="card chart-card">
    <BarChart bars={solarBars} unit="" digits={1} height={160} />
  </div>
</Section>

<Section title="Energy Stats">
  <div class="mini-grid">
    {#each stats as s}
      <div class="mini"><div class="mv">{s.v}</div><div class="t-foot">{s.l}</div></div>
    {/each}
  </div>
</Section>

<Section title="Appliances" hint="tap to switch">
  <div class="tiles">
    {#each APPLIANCES as a}
      {@const p = ha.num(a.power)}
      <Tile icon={a.icon} name={a.label}
        sub={ha.isOn(a.sw) ? (p != null ? `${power(p).val} ${power(p).unit}` : "On") : "Off"}
        on={ha.isOn(a.sw)} accent="var(--warning)" disabled={!ha.exists(a.sw)}
        onclick={() => ha.toggle(a.sw)} />
    {/each}
  </div>
</Section>

<style>
  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 12px;
    margin-top: 20px;
  }
  .charts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 12px;
    margin-top: 12px;
  }
  .chart-card {
    padding: 16px 18px 10px;
  }
  .ch-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 10px;
  }
  .ch-now {
    font-size: 16px;
    font-weight: 700;
  }
  .mini-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 10px;
  }
  .mini {
    padding: 15px;
    background: var(--card);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--border);
    border-radius: var(--r);
    box-shadow: var(--shadow);
  }
  .mv {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
  }
</style>
