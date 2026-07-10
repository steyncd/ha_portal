<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { E, APPLIANCES } from "../lib/entities";
  import { n, power, rand } from "../lib/format";
  import KpiCard from "../lib/components/KpiCard.svelte";
  import RingGauge from "../lib/components/RingGauge.svelte";
  import Section from "../lib/components/Section.svelte";
  import BarRow from "../lib/components/BarRow.svelte";
  import Tile from "../lib/components/Tile.svelte";

  const soc = $derived(ha.num(E.batterySoc));
  const pv = $derived(power(ha.num(E.pvPower)));
  const grid = $derived(power(ha.num(E.gridPower)));
  const loads = $derived(power(ha.num(E.loads)));
  const battP = $derived(ha.num(E.batteryPower));

  // Normalise power sources for the flow bars (relative to total load).
  const loadW = $derived(Math.max(1, ha.num(E.loads) ?? 1));
  const pvW = $derived(ha.num(E.pvPower) ?? 0);
  const gridW = $derived(Math.abs(ha.num(E.gridPower) ?? 0));
  const battW = $derived(battP != null && battP < 0 ? Math.abs(battP) : 0);

  const stats = $derived([
    { v: `${n(ha.num(E.solarYieldToday), 1)} kWh`, l: "Solar today" },
    { v: `${n(ha.num(E.solarYieldMonth), 1)} kWh`, l: "Solar month" },
    { v: `${n(ha.num(E.gridIndepMonth))}%`, l: "Independence mo." },
    { v: rand(ha.num(E.energyCostToday)), l: "Cost today" },
    { v: rand(ha.num(E.energyCostMonth)), l: "Proj. month" },
    { v: rand(ha.num(E.solarSavings)), l: "Total saved" },
    { v: `${n(ha.num(E.batteryVoltage), 1)} V`, l: "Batt voltage" },
    { v: `${n(ha.num(E.batteryTemp), 0)}°C`, l: "Batt temp" },
    { v: `${n(ha.num(E.batteryHealth))}%`, l: "Batt health" },
    { v: ha.state(E.energyGrade) ?? "—", l: "Energy grade" },
    { v: ha.state(E.inverterState) ?? "—", l: "Inverter" },
    { v: `${n(ha.num(E.gridImportToday), 1)} kWh`, l: "Grid import" },
  ]);
</script>

<div class="kpis">
  <KpiCard
    icon="🔋"
    label="Battery"
    value={n(soc)}
    unit="%"
    accent="var(--brand)"
    foots={[{ v: `${battP != null && battP < 0 ? "−" : "+"}${power(battP).val} ${power(battP).unit}`, l: ha.state(E.batteryState) ?? "" }]}
  >
    {#snippet right()}<RingGauge pct={soc} color="var(--brand)" />{/snippet}
  </KpiCard>
  <KpiCard icon="☀️" label="Solar PV" value={pv.val} unit={pv.unit} accent="var(--solar)"
    foots={[{ v: `${n(ha.num(E.pvYieldToday), 1)} kWh`, l: "Yield today" }]} />
  <KpiCard icon="🏠" label="House Load" value={loads.val} unit={loads.unit} accent="var(--warning)"
    foots={[{ v: `${power(ha.num(E.essentialLoads)).val} ${power(ha.num(E.essentialLoads)).unit}`, l: "Essential" }]} />
  <KpiCard icon="🔌" label="Grid" value={grid.val} unit={grid.unit} accent={gridW > 20 ? "var(--error)" : "var(--success)"}
    foots={[{ v: ha.state(E.gridLostAlarm) === "0" ? "Connected" : "Lost", l: "Mains" }]} />
</div>

<Section title="Power Sources" hint="share of current load">
  <div class="card flow">
    <BarRow label="☀️ Solar" value={power(pvW).val + " " + power(pvW).unit} pct={(pvW / loadW) * 100} color="var(--solar)" />
    <BarRow label="🔋 Battery" value={power(battW).val + " " + power(battW).unit} pct={(battW / loadW) * 100} color="var(--brand)" />
    <BarRow label="🔌 Grid" value={power(gridW).val + " " + power(gridW).unit} pct={(gridW / loadW) * 100} color="var(--error)" />
  </div>
</Section>

<Section title="Energy Stats">
  <div class="mini-grid">
    {#each stats as s}
      <div class="mini">
        <div class="mv">{s.v}</div>
        <div class="t-foot">{s.l}</div>
      </div>
    {/each}
  </div>
</Section>

<Section title="Appliances" hint="tap to switch">
  <div class="tiles">
    {#each APPLIANCES as a}
      {@const p = ha.num(a.power)}
      <Tile
        icon={a.icon}
        name={a.label}
        sub={ha.isOn(a.sw) ? (p != null ? `${power(p).val} ${power(p).unit}` : "On") : "Off"}
        on={ha.isOn(a.sw)}
        accent="var(--warning)"
        disabled={!ha.exists(a.sw)}
        onclick={() => ha.toggle(a.sw)}
      />
    {/each}
  </div>
</Section>

<style>
  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
    margin-top: 20px;
  }
  .flow {
    padding: 20px;
  }
  .mini-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 10px;
  }
  .mini {
    padding: 14px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r);
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
