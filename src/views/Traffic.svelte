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
  let plateHist = $state<{ t: number; s: string }[]>([]);
  onMount(async () => {
    weekBars = dailyMax(await ha.history(E.vehiclesToday, 24 * 7), 7);
    plateHist = await ha.historyStates(E.lastPlate, 24 * 30);
  });

  // ---- ANPR: known-vs-unknown + repeat-visitor tracking ----
  const norm = (s: string) => s.toUpperCase().replace(/\s+/g, "");
  const BAD = new Set(["UNKNOWN", "UNAVAILABLE", "NONE", ""]);

  // PLATE=Name pairs from input_text.known_vehicle_plates
  const known = $derived.by(() => {
    const m = new Map<string, string>();
    for (const pair of (ha.state(E.knownPlates) ?? "").split(",")) {
      const [p, name] = pair.split("=");
      if (p && name) m.set(norm(p), name.trim());
    }
    return m;
  });

  type Visitor = { plate: string; count: number; last: number; owner: string };
  const visitors = $derived.by(() => {
    const m = new Map<string, Visitor>();
    for (const p of plateHist) {
      const raw = p.s.trim();
      const k = norm(raw);
      if (BAD.has(k)) continue;
      const e = m.get(k) ?? { plate: raw, count: 0, last: 0, owner: known.get(k) ?? "" };
      e.count++;
      if (p.t > e.last) e.last = p.t;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.count - a.count || b.last - a.last);
  });

  const anpr = $derived.by(() => {
    const total = visitors.reduce((s, v) => s + v.count, 0);
    const knownDet = visitors.filter((v) => v.owner).reduce((s, v) => s + v.count, 0);
    return { total, unique: visitors.length, knownPlates: visitors.filter((v) => v.owner).length, unknownPlates: visitors.filter((v) => !v.owner).length, knownDet, unknownDet: total - knownDet };
  });
  const repeats = $derived(visitors.filter((v) => v.count >= 2));
  const recentUnknown = $derived([...visitors].filter((v) => !v.owner).sort((a, b) => b.last - a.last).slice(0, 6));
  const configured = $derived(known.size > 0);

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

  <!-- ANPR: known vs unknown + repeat visitors -->
  <div class="card pad">
    <div class="rh"><span class="lb">Gate ANPR · known vs unknown · 30 days</span><span class="sub">{anpr.total} recognitions · {anpr.unique} plates</span></div>
    {#if plateHist.length}
      <div class="split">
        <div class="seg kn" style="flex:{Math.max(anpr.knownDet, 0.001)}"><span class="segn">{anpr.knownDet}</span><span class="segl">known · {anpr.knownPlates} plates</span></div>
        <div class="seg un" style="flex:{Math.max(anpr.unknownDet, 0.001)}"><span class="segn">{anpr.unknownDet}</span><span class="segl">unknown · {anpr.unknownPlates} plates</span></div>
      </div>

      <div class="anpr2">
        <div>
          <div class="subhd">Repeat visitors</div>
          {#if repeats.length}
            <div class="vlist">
              {#each repeats.slice(0, 8) as v}
                <div class="vrow" class:kn={v.owner}><span class="plate">{v.plate}</span><span class="who">{v.owner || "Unknown"}</span><span class="cnt">{v.count}×</span><span class="pago">{ago(v.last)}</span></div>
              {/each}
            </div>
          {:else}<div class="sub">No plate seen more than once yet.</div>{/if}
        </div>
        <div>
          <div class="subhd">Recent unknown</div>
          {#if recentUnknown.length}
            <div class="vlist">
              {#each recentUnknown as v}
                <div class="vrow"><span class="plate">{v.plate}</span><span class="who"></span><span class="cnt">{v.count}×</span><span class="pago">{ago(v.last)}</span></div>
              {/each}
            </div>
          {:else}<div class="sub">Every recognised plate is known 👍</div>{/if}
        </div>
      </div>

      {#if !configured}
        <div class="hint">Tip: add <code>PLATE=Name</code> pairs to <code>input_text.known_vehicle_plates</code> in HA to label household vehicles — everything else then shows as unknown.</div>
      {/if}
    {:else}
      <div class="sub">No plates recognised in the last 30 days.</div>
    {/if}
  </div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }
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
  .split { display: flex; gap: 4px; height: 56px; margin-bottom: 20px; }
  .seg { display: flex; flex-direction: column; justify-content: center; padding: 0 15px; border-radius: 11px; min-width: 0; overflow: hidden; }
  .seg.kn { background: color-mix(in srgb, var(--success) 22%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--success) 45%, transparent); }
  .seg.un { background: color-mix(in srgb, var(--warning) 20%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 42%, transparent); }
  .segn { font-size: 19px; font-weight: 800; }
  .segl { font-size: 10.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .anpr2 { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
  @media (max-width: 640px) { .anpr2 { grid-template-columns: 1fr; } }
  .subhd { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); margin-bottom: 11px; }
  .vlist { display: flex; flex-direction: column; gap: 6px; }
  .vrow { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; background: rgba(255, 255, 255, 0.04); }
  .vrow.kn { background: color-mix(in srgb, var(--success) 10%, transparent); }
  .plate { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; }
  .who { font-size: 12px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cnt { font-size: 12px; font-weight: 800; color: var(--acc); }
  .pago { font-size: 10.5px; color: var(--muted-2); }
  .hint { margin-top: 14px; font-size: 11.5px; color: var(--muted-2); }
  .hint code { background: rgba(255, 255, 255, 0.08); padding: 1px 5px; border-radius: 5px; font-size: 11px; }
</style>
