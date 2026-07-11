<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E } from "../lib/entities";
  import { n, thousands, dailyMax } from "../lib/format";
  import BarChart from "../lib/components/BarChart.svelte";

  const tod = $derived([
    { label: "Morning", value: ha.num(E.trafficMorning), color: "var(--solar)" },
    { label: "Afternoon", value: ha.num(E.trafficAfternoon), color: "var(--warning)" },
    { label: "Evening", value: ha.num(E.trafficEvening), color: "var(--acc)" },
    { label: "Night", value: ha.num(E.trafficNight), color: "#8b5cf6" },
  ]);

  let weekBars = $state<{ label: string; value: number | null }[]>([]);
  onMount(async () => {
    weekBars = dailyMax(await ha.history(E.vehiclesToday, 24 * 7), 7);
  });
</script>

<div class="col">
  <div class="kpis">
    <div class="card k"><div class="lb">🚗 Vehicles</div><div class="big">{thousands(ha.num(E.vehiclesToday))}<span class="u"> today</span></div><div class="sub">{thousands(ha.num(E.vehiclesWeek))} week · {thousands(ha.num(E.vehiclesMonth))} month</div></div>
    <div class="card k"><div class="lb">🚶 Pedestrians</div><div class="big">{thousands(ha.num(E.pedestriansToday))}<span class="u"> today</span></div><div class="sub">{thousands(ha.num(E.pedestriansWeek))} week · {thousands(ha.num(E.pedestriansMonth))} month</div></div>
  </div>

  <div class="card pad">
    <div class="rh"><span class="lb">Sidewalk traffic by time of day</span><span class="int">{ha.state(E.trafficIntensity) ?? "—"}</span></div>
    <div class="tod">
      {#each tod as b}
        {@const max = Math.max(1, ...tod.map((x) => x.value ?? 0))}
        <div class="col2">
          <span class="tv">{n(b.value)}</span>
          <div class="bar" style="height:{((b.value ?? 0) / max) * 100}%;background:{b.color}"></div>
          <span class="tl">{b.label}</span>
        </div>
      {/each}
    </div>
  </div>

  <div class="card pad">
    <div class="rh"><span class="lb">Vehicles past gate · 7 days</span><span class="sub">{thousands(ha.num(E.vehiclesWeek))} total</span></div>
    <BarChart bars={weekBars} height={150} />
  </div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; max-width: 1180px; margin: 0 auto; }
  .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 640px) { .kpis { grid-template-columns: 1fr; } }
  .k { padding: 18px; }
  .big { font-size: 30px; font-weight: 800; margin-top: 6px; }
  .u { font-size: 14px; color: var(--dim); }
  .sub { font-size: 12px; color: var(--dim); margin-top: 3px; }
  .pad { padding: 20px; }
  .rh { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px; }
  .int { font-size: 12px; font-weight: 700; color: var(--acc); }
  .tod { display: flex; align-items: flex-end; gap: 16px; height: 130px; }
  .col2 { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%; justify-content: flex-end; }
  .tv { font-size: 13px; font-weight: 700; }
  .bar { width: 100%; border-radius: 8px 8px 0 0; min-height: 4px; transition: height 0.5s; }
  .tl { font-size: 11px; color: var(--dim); }
</style>
