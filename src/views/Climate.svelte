<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { E, ROOMS } from "../lib/entities";
  import { n, tempColor } from "../lib/format";
  import KpiCard from "../lib/components/KpiCard.svelte";
  import Section from "../lib/components/Section.svelte";

  const indoor = $derived(ha.num(E.indoorAvg));
  const condition = $derived(ha.state(E.weather) ?? "—");
  const outTemp = $derived(ha.attr(E.weather, "temperature") as number | undefined);

  const conditionLabel = $derived(
    condition.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  );
</script>

<div class="kpis">
  <KpiCard
    icon="🌡️"
    label="Indoor Average"
    value={n(indoor, 1)}
    unit="°C"
    accent={tempColor(indoor)}
    foots={[{ v: conditionLabel, l: "Outside" }, { v: outTemp != null ? `${n(outTemp, 0)}°C` : "—", l: "Outdoor temp" }]}
  />
</div>

<Section title="Rooms" hint="temperature · humidity">
  <div class="rooms">
    {#each ROOMS as room}
      {@const t = ha.num(room.id)}
      {@const h = room.humidity ? ha.num(room.humidity) : null}
      <div class="room card">
        <div class="rtop">
          <span class="rlabel">{room.label}</span>
        </div>
        <div class="rtemp" style="color:{tempColor(t)}">
          {n(t, 1)}<span class="deg">°C</span>
        </div>
        {#if h != null}
          <div class="rhum">💧 {n(h)}% humidity</div>
        {/if}
      </div>
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
  .rooms {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
  }
  .room {
    padding: 18px;
  }
  .rlabel {
    font-size: 13px;
    color: var(--text-2);
    font-weight: 600;
  }
  .rtemp {
    font-size: 34px;
    font-weight: 700;
    letter-spacing: -1px;
    margin-top: 10px;
  }
  .deg {
    font-size: 16px;
    color: var(--text-2);
    margin-left: 2px;
  }
  .rhum {
    font-size: 11.5px;
    color: var(--muted);
    margin-top: 8px;
  }
</style>
