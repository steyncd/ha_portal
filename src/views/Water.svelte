<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E } from "../lib/entities";
  import { n, dailyMax } from "../lib/format";
  import KpiCard from "../lib/components/KpiCard.svelte";
  import TankGauge from "../lib/components/TankGauge.svelte";
  import Section from "../lib/components/Section.svelte";
  import AreaChart from "../lib/components/AreaChart.svelte";
  import BarChart from "../lib/components/BarChart.svelte";
  import Tile from "../lib/components/Tile.svelte";

  const tank = $derived(ha.num(E.tankLevel));
  const low = $derived(ha.state(E.tankLowAlert) === "on");

  let tankHist = $state<{ t: number; v: number }[]>([]);
  let usageBars = $state<{ label: string; value: number | null }[]>([]);
  let boreholeBars = $state<{ label: string; value: number | null }[]>([]);

  onMount(async () => {
    tankHist = await ha.history(E.tankLevel, 48);
    usageBars = dailyMax(await ha.history(E.waterUsedToday, 24 * 7), 7);
    boreholeBars = dailyMax(await ha.history(E.boreholeToday, 24 * 7), 7);
  });
</script>

<div class="kpis">
  <KpiCard icon="🚰" label="JoJo Tank" value={n(tank)} unit="%"
    accent={low ? "var(--error)" : "var(--water)"}
    foots={[{ v: `${n(ha.num(E.tankDays))} days`, l: "Remaining" }, { v: ha.state(E.tankStatus) ?? "—", l: "Status" }]}>
    {#snippet right()}<TankGauge pct={tank} color={low ? "var(--error)" : "var(--water)"} />{/snippet}
  </KpiCard>
  <KpiCard icon="💧" label="Used Today" value={n(ha.num(E.waterUsedToday))} unit="L" accent="var(--water)"
    foots={[{ v: `${n(ha.num(E.waterUsedYesterday))} L`, l: "Yesterday" }, { v: `${n(ha.num(E.waterAvg7d))} L`, l: "7-day avg" }]} />
  <KpiCard icon="🕳️" label="Borehole Today" value={n(ha.num(E.boreholeToday))} unit="L" accent="var(--brand)"
    foots={[{ v: `${n(ha.num(E.boreholeMonth))} L`, l: "This month" }, { v: ha.state(E.boreholeStatus) ?? "—", l: "Status" }]} />
</div>

<div class="card chart-card">
  <div class="ch-head"><span class="t-label">Tank Level · 48h</span><span class="ch-now">{n(tank)}% · {n(ha.num(E.tankVolume))} L</span></div>
  <AreaChart data={tankHist} color={low ? "var(--error)" : "var(--water)"} unit="%" fixedMin={0} fixedMax={100} height={150} />
</div>

<div class="charts">
  <Section title="Water Used" hint="last 7 days · L">
    <div class="card chart-card"><BarChart bars={usageBars} unit="" height={150} /></div>
  </Section>
  <Section title="Borehole Pumped" hint="last 7 days · L">
    <div class="card chart-card"><BarChart bars={boreholeBars} unit="" height={150} /></div>
  </Section>
</div>

<Section title="Pumps">
  <div class="tiles">
    <Tile icon="💧" name="Water Pump" sub={ha.isOn(E.waterPump) ? "Running" : "Off"}
      on={ha.isOn(E.waterPump)} accent="var(--water)" onclick={() => ha.toggle(E.waterPump)} />
    <Tile icon="🏊" name="Pool Pump" sub={ha.isOn(E.poolPump) ? "Running" : "Off"}
      on={ha.isOn(E.poolPump)} accent="var(--water)" onclick={() => ha.toggle(E.poolPump)} />
    <Tile icon="🕳️" name="Borehole" sub={ha.isOn(E.boreholePump) ? "Running" : "Off"}
      on={ha.isOn(E.boreholePump)} accent="var(--water)" onclick={() => ha.toggle(E.boreholePump)} />
  </div>
</Section>

<style>
  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
    margin-top: 20px;
  }
  .chart-card {
    padding: 16px 18px 10px;
    margin-top: 12px;
  }
  .ch-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 10px;
  }
  .ch-now {
    font-size: 15px;
    font-weight: 700;
  }
  .charts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
  }
  .charts :global(section) {
    margin-top: 20px;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 10px;
  }
</style>
