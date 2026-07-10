<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E, DECO_NODES, INK } from "../lib/entities";
  import { n } from "../lib/format";
  import KpiCard from "../lib/components/KpiCard.svelte";
  import RingGauge from "../lib/components/RingGauge.svelte";
  import Section from "../lib/components/Section.svelte";
  import BarRow from "../lib/components/BarRow.svelte";
  import AreaChart from "../lib/components/AreaChart.svelte";

  const cpu = $derived(ha.num(E.routerCpu));
  const mem = $derived(ha.num(E.routerMem));
  const lowBatt = $derived(ha.num(E.lowBatteryDevices));

  let devHist = $state<{ t: number; v: number }[]>([]);
  onMount(async () => {
    devHist = await ha.history(E.routerDevices, 24);
  });

  function uptime(sec: number | null): string {
    if (sec == null) return "—";
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    return `${d}d ${h}h`;
  }
</script>

<div class="kpis">
  <KpiCard icon="🌐" label="Internet" value={n(ha.num(E.routerDown), 1)} unit="↓ Mbps" accent="var(--brand)"
    foots={[{ v: `${n(ha.num(E.routerUp), 1)} ↑`, l: "Upload" }, { v: uptime(ha.num(E.routerUptime)), l: "Uptime" }]} />
  <KpiCard icon="📶" label="Devices Online" value={n(ha.num(E.routerDevices))} unit="" accent="var(--success)"
    foots={[{ v: `${n(ha.num(E.monitoredLoads))} W`, l: "Monitored" }, { v: `${n(ha.num(E.unmonitoredLoads))} W`, l: "Unmonitored" }]} />
  <KpiCard icon="🔋" label="Battery Health" value={n(ha.num(E.batteryHealth))} unit="%" accent="var(--success)"
    foots={[{ v: `${n(lowBatt)}`, l: "Low-batt devices" }, { v: ha.state(E.energyGrade) ?? "—", l: "Energy grade" }]} />
</div>

<Section title="Router Load">
  <div class="gauges">
    <div class="card g"><RingGauge pct={cpu} color="var(--warning)" size={110} label="CPU" /></div>
    <div class="card g"><RingGauge pct={mem} color="var(--error)" size={110} label="Memory" /></div>
    <div class="card chart-card wide">
      <div class="ch-head"><span class="t-label">Devices Online · 24h</span><span class="ch-now">{n(ha.num(E.routerDevices))}</span></div>
      <AreaChart data={devHist} color="var(--success)" digits={0} height={110} />
    </div>
  </div>
</Section>

<Section title="Mesh Nodes">
  <div class="nodes">
    {#each DECO_NODES as node}
      {@const online = ha.state(node.id) === "home"}
      <div class="node card">
        <span class="ndot" class:online></span>
        <span class="nlabel">{node.label}</span>
        <span class="nstate">{online ? "Online" : "Offline"}</span>
      </div>
    {/each}
  </div>
</Section>

<Section title="Printer Ink" hint={ha.state(E.printer) ?? ""}>
  <div class="card box">
    {#each INK as ink}
      {@const v = ha.num(ink.id)}
      <BarRow label={ink.label} value="{n(v)}%" pct={v} color={ink.color} />
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
  .gauges {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }
  .g {
    display: grid;
    place-items: center;
    padding: 20px;
  }
  .wide {
    grid-column: span 2;
    min-width: 240px;
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
  .nodes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
  }
  .node {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 15px 16px;
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    box-shadow: var(--shadow);
  }
  .ndot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--muted);
  }
  .ndot.online {
    background: var(--success);
    box-shadow: 0 0 8px var(--success);
  }
  .nlabel {
    font-size: 13px;
    font-weight: 600;
    flex: 1;
  }
  .nstate {
    font-size: 11px;
    color: var(--muted);
  }
  .box {
    padding: 20px;
  }
</style>
