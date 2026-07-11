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
  let plates = $state<{ t: number; s: string }[]>([]);
  onMount(async () => {
    weekBars = dailyMax(await ha.history(E.vehiclesToday, 24 * 7), 7);
    plates = await ha.historyStates(E.lastPlate, 24 * 3);
  });

  function ago(t: number) {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
  }

  // peak callouts
  const peakSlot = $derived([...tod].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0]);
  const weekend = ["Sat", "Sun"];
  const wkStats = $derived.by(() => {
    const wd = weekBars.filter((b) => !weekend.includes(b.label) && b.value != null);
    const we = weekBars.filter((b) => weekend.includes(b.label) && b.value != null);
    const avg = (a: typeof wd) => (a.length ? a.reduce((s, b) => s + (b.value ?? 0), 0) / a.length : 0);
    const busiest = [...weekBars].filter((b) => b.value != null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
    return { weekday: Math.round(avg(wd)), weekendv: Math.round(avg(we)), busiest };
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

  <!-- peak callout -->
  <div class="callout">
    <div class="co"><span class="cov">{peakSlot?.label ?? "—"}</span><span class="cok">busiest time of day</span></div>
    <div class="co"><span class="cov">{wkStats.busiest?.label ?? "—"}</span><span class="cok">busiest day this week</span></div>
    <div class="co"><span class="cov">{thousands(wkStats.weekday)} <span class="vs">vs</span> {thousands(wkStats.weekendv)}</span><span class="cok">weekday vs weekend / day</span></div>
  </div>

  <div class="card pad">
    <div class="rh"><span class="lb">Vehicles past gate · 7 days</span><span class="sub">{thousands(ha.num(E.vehiclesWeek))} total</span></div>
    <BarChart bars={weekBars} height={150} />
  </div>

  <!-- ANPR plate history -->
  <div class="card pad">
    <div class="rh"><span class="lb">Recognised plates · gate ANPR</span><span class="sub">last {plates.length}</span></div>
    {#if plates.length}
      <div class="plates">
        {#each plates.slice(0, 12) as p}
          <div class="prow"><span class="plate">{p.s}</span><span class="pago">{ago(p.t)}</span></div>
        {/each}
      </div>
    {:else}
      <div class="sub">No plates recognised recently.</div>
    {/if}
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
  .callout { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  @media (max-width: 640px) { .callout { grid-template-columns: 1fr; } }
  .co { padding: 15px 18px; border-radius: 16px; background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.025)); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08); }
  .cov { font-size: 20px; font-weight: 800; }
  .cov .vs { font-size: 12px; color: var(--muted); font-weight: 600; }
  .cok { display: block; font-size: 11px; color: var(--muted); margin-top: 3px; }
  .plates { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; }
  .prow { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 13px; border-radius: 11px; background: rgba(255, 255, 255, 0.045); }
  .plate { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; }
  .pago { font-size: 10.5px; color: var(--muted-2); }
</style>
