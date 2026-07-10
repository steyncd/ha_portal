<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { E } from "../lib/entities";
  import { n } from "../lib/format";
  import KpiCard from "../lib/components/KpiCard.svelte";
  import Section from "../lib/components/Section.svelte";
  import BarChart from "../lib/components/BarChart.svelte";
  import Pill from "../lib/components/Pill.svelte";

  const intensity = $derived(ha.state(E.trafficIntensity) ?? "—");
  const intensityColor = $derived.by(() => {
    switch (intensity.toLowerCase()) {
      case "high": return "var(--error)";
      case "moderate": return "var(--warning)";
      case "low": return "var(--success)";
      default: return "var(--muted)";
    }
  });
  const plate = $derived(ha.state(E.lastPlate));

  const todBars = $derived([
    { label: "Morning", value: ha.num(E.trafficMorning), color: "var(--solar)" },
    { label: "Afternoon", value: ha.num(E.trafficAfternoon), color: "var(--warning)" },
    { label: "Evening", value: ha.num(E.trafficEvening), color: "var(--brand)" },
    { label: "Night", value: ha.num(E.trafficNight), color: "#8b5cf6" },
  ]);

  const stats = $derived([
    { v: n(ha.num(E.vehiclesWeek)), l: "Vehicles week" },
    { v: n(ha.num(E.vehiclesMonth)), l: "Vehicles month" },
    { v: n(ha.num(E.pedestriansWeek)), l: "People week" },
    { v: n(ha.num(E.pedestriansMonth)), l: "People month" },
    { v: n(ha.num(E.personDetections)), l: "Person alerts" },
    { v: n(ha.num(E.vehicleDetections)), l: "Vehicle alerts" },
  ]);
</script>

<div class="head">
  <Pill label="Traffic: {intensity}" color={intensityColor} />
  {#if plate && plate !== "None"}
    <Pill label="Last plate: {plate}" color="var(--brand)" />
  {/if}
</div>

<div class="kpis">
  <KpiCard icon="🚗" label="Vehicles Today" value={n(ha.num(E.vehiclesToday))} unit="" accent="var(--brand)"
    foots={[{ v: n(ha.num(E.vehiclesWeek)), l: "This week" }]} />
  <KpiCard icon="🚶" label="People Today" value={n(ha.num(E.pedestriansToday))} unit="" accent="var(--success)"
    foots={[{ v: n(ha.num(E.pedestriansWeek)), l: "This week" }]} />
  <KpiCard icon="📹" label="Gate Detections" value={n(ha.num(E.gateDetections))} unit="" accent="var(--warning)"
    foots={[{ v: n(ha.num(E.vehicleDetections)), l: "Vehicles" }, { v: n(ha.num(E.personDetections)), l: "People" }]} />
</div>

<Section title="Sidewalk Traffic" hint="people by time of day">
  <div class="card chart-card"><BarChart bars={todBars} unit="" height={160} /></div>
</Section>

<Section title="Analytics">
  <div class="mini-grid">
    {#each stats as s}
      <div class="mini"><div class="mv">{s.v}</div><div class="t-foot">{s.l}</div></div>
    {/each}
  </div>
</Section>

<style>
  .head {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 22px 2px 0;
  }
  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
    margin-top: 14px;
  }
  .chart-card {
    padding: 18px;
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
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 4px;
  }
</style>
