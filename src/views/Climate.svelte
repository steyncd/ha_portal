<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E, ROOMS } from "../lib/entities";
  import { n, tempColor } from "../lib/format";
  import KpiCard from "../lib/components/KpiCard.svelte";
  import Section from "../lib/components/Section.svelte";
  import AreaChart from "../lib/components/AreaChart.svelte";

  const indoor = $derived(ha.num(E.indoorAvg));
  const condition = $derived(ha.state(E.weather) ?? "—");
  const outTemp = $derived(ha.attr(E.weather, "temperature") as number | undefined);
  const conditionLabel = $derived(
    condition.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  );

  let indoorHist = $state<{ t: number; v: number }[]>([]);
  let roomHist = $state<Record<string, { t: number; v: number }[]>>({});

  onMount(async () => {
    indoorHist = await ha.history(E.indoorAvg, 24);
    const results = await Promise.all(ROOMS.map((r) => ha.history(r.id, 24)));
    const map: Record<string, { t: number; v: number }[]> = {};
    ROOMS.forEach((r, i) => (map[r.id] = results[i]));
    roomHist = map;
  });
</script>

<div class="kpis">
  <KpiCard icon="🌡️" label="Indoor Average" value={n(indoor, 1)} unit="°C" accent={tempColor(indoor)}
    foots={[{ v: conditionLabel, l: "Outside" }, { v: outTemp != null ? `${n(outTemp, 0)}°C` : "—", l: "Outdoor" }]} />
  <div class="card chart-card">
    <div class="ch-head"><span class="t-label">Indoor Avg · 24h</span><span class="ch-now">{n(indoor, 1)}°C</span></div>
    <AreaChart data={indoorHist} color={tempColor(indoor)} unit="°" digits={0} height={120} />
  </div>
</div>

<Section title="Rooms" hint="24-hour trend">
  <div class="rooms">
    {#each ROOMS as room}
      {@const t = ha.num(room.id)}
      {@const h = room.humidity ? ha.num(room.humidity) : null}
      <div class="room card">
        <div class="rtop">
          <span class="rlabel">{room.label}</span>
          {#if h != null}<span class="rhum">💧 {n(h)}%</span>{/if}
        </div>
        <div class="rtemp" style="color:{tempColor(t)}">{n(t, 1)}<span class="deg">°C</span></div>
        <div class="spark">
          <AreaChart data={roomHist[room.id] ?? []} color={tempColor(t)} height={44} mini />
        </div>
      </div>
    {/each}
  </div>
</Section>

<style>
  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 12px;
    margin-top: 20px;
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
  .rooms {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 12px;
  }
  .room {
    padding: 16px 16px 8px;
  }
  .rtop {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .rlabel {
    font-size: 13px;
    color: var(--text-2);
    font-weight: 600;
  }
  .rhum {
    font-size: 11px;
    color: var(--muted);
  }
  .rtemp {
    font-size: 30px;
    font-weight: 700;
    letter-spacing: -1px;
    margin-top: 8px;
  }
  .deg {
    font-size: 15px;
    color: var(--text-2);
    margin-left: 2px;
  }
  .spark {
    margin-top: 6px;
  }
</style>
