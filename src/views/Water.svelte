<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { E } from "../lib/entities";
  import { n } from "../lib/format";
  import KpiCard from "../lib/components/KpiCard.svelte";
  import TankGauge from "../lib/components/TankGauge.svelte";
  import Section from "../lib/components/Section.svelte";
  import BarRow from "../lib/components/BarRow.svelte";
  import Tile from "../lib/components/Tile.svelte";

  const tank = $derived(ha.num(E.tankLevel));
  const usedToday = $derived(ha.num(E.waterUsedToday));
  const usedYesterday = $derived(ha.num(E.waterUsedYesterday));
  const avg7 = $derived(ha.num(E.waterAvg7d));
  const low = $derived(ha.state(E.tankLowAlert) === "on");
</script>

<div class="kpis">
  <KpiCard
    icon="🚰"
    label="JoJo Tank"
    value={n(tank)}
    unit="%"
    accent={low ? "var(--error)" : "var(--water)"}
    foots={[
      { v: `${n(ha.num(E.tankDays))} days`, l: "Remaining" },
      { v: ha.state(E.tankStatus) ?? "—", l: "Status" },
    ]}
  >
    {#snippet right()}<TankGauge pct={tank} color={low ? "var(--error)" : "var(--water)"} />{/snippet}
  </KpiCard>
  <KpiCard icon="💧" label="Used Today" value={n(usedToday)} unit="L" accent="var(--water)"
    foots={[{ v: `${n(usedYesterday)} L`, l: "Yesterday" }, { v: `${n(avg7)} L`, l: "7-day avg" }]} />
  <KpiCard icon="🕳️" label="Borehole Today" value={n(ha.num(E.boreholeToday))} unit="L" accent="var(--brand)"
    foots={[{ v: `${n(ha.num(E.boreholeMonth))} L`, l: "This month" }, { v: ha.state(E.boreholeStatus) ?? "—", l: "Status" }]} />
</div>

<Section title="Tank Volume">
  <div class="card box">
    <BarRow
      label="Water level"
      value="{n(ha.num(E.tankVolume))} L"
      pct={tank}
      color={low ? "var(--error)" : "var(--water)"}
    />
  </div>
</Section>

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
  .box {
    padding: 20px;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 10px;
  }
</style>
