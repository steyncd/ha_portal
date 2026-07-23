<script lang="ts">
  // Solar Intelligence — three independent forecasts (Solcast · Forecast.Solar ·
  // Victron VRM) vs the CLEAN Victron actual, plus tomorrow's consensus, the
  // forecast-accuracy tracker, and irradiance/cloud context.
  // Entity names per docs/LIFE_OS_INTEGRATIONS.md §3. All guarded — feeds drop.
  import { ha } from "../lib/store.svelte";
  import { n } from "../lib/format";

  const kwh = (id: string) => (ha.available(id) ? ha.num(id) : null);
  const fmt = (v: number | null) => (v == null ? "—" : `${n(v, 1)}`);

  // actual (clean) — never sensor.solar_yield_today (logs impossible values)
  const actualToday = $derived(kwh("sensor.victron_total_pv_yield_today"));
  const actualYesterday = $derived(kwh("sensor.victron_total_pv_yield_yesterday"));

  type Src = { label: string; today: string; tom: string; color: string };
  const SOURCES: Src[] = [
    { label: "Solcast", today: "sensor.solcast_forecast_today", tom: "sensor.solcast_forecast_tomorrow", color: "var(--solar)" },
    { label: "Forecast.Solar", today: "sensor.energy_production_today", tom: "sensor.energy_production_tomorrow", color: "var(--acc)" },
    { label: "Victron VRM", today: "sensor.victron_remote_monitoring_estimated_energy_production_today", tom: "sensor.victron_remote_monitoring_estimated_energy_production_tomorrow", color: "var(--water)" },
  ];

  const today = $derived(SOURCES.map((s) => ({ ...s, v: kwh(s.today) })));
  const tomorrow = $derived(SOURCES.map((s) => ({ ...s, v: kwh(s.tom) })));
  const consensus = $derived(kwh("sensor.solar_forecast_tomorrow_consensus"));
  const maxTom = $derived(Math.max(1, ...tomorrow.map((t) => t.v ?? 0), consensus ?? 0));

  // forecast accuracy tracker (learning until ~a week of data)
  const ACC = [
    { label: "Solcast", id: "sensor.solar_forecast_accuracy_solcast" },
    { label: "Forecast.Solar", id: "sensor.solar_forecast_accuracy_forecast_solar" },
    { label: "Victron VRM", id: "sensor.solar_forecast_accuracy_victron" },
  ];
  const accuracy = $derived(ACC.map((a) => ({ ...a, v: ha.available(a.id) ? ha.num(a.id) : null, unit: ha.unit(a.id) })));
  const hasAccuracy = $derived(accuracy.some((a) => a.v != null));

  // context
  const irradiance = $derived(kwh("sensor.solar_irradiance_today"));
  const cloudTom = $derived(ha.available("sensor.cloud_cover_tomorrow") ? ha.num("sensor.cloud_cover_tomorrow") : null);
</script>

<div class="col">
  <div class="head"><div><h1>Solar Intelligence</h1><p>Three forecasts vs your real Victron output · consensus & accuracy</p></div></div>

  <!-- today: actual vs the three forecasts -->
  <div class="card pad">
    <div class="rh"><span class="lb">Today</span><span class="sub">actual so far vs forecast</span></div>
    <div class="todayrow">
      <div class="actual">
        <div class="av">{fmt(actualToday)}<span class="au"> kWh</span></div>
        <div class="ak">actual so far</div>
      </div>
      <div class="fcs">
        {#each today as t}
          <div class="fc"><span class="fcv" style="color:{t.color}">{fmt(t.v)}</span><span class="fck">{t.label}</span>
            {#if t.v != null && actualToday != null && t.v > 0}<span class="fcd" style="color:{actualToday >= t.v ? 'var(--success)' : 'var(--muted)'}">{actualToday >= t.v ? "ahead" : `${Math.round((actualToday / t.v) * 100)}%`}</span>{/if}
          </div>
        {/each}
      </div>
    </div>
    <div class="note">Yesterday's actual: {fmt(actualYesterday)} kWh.</div>
  </div>

  <!-- tomorrow: forecast comparison + consensus -->
  <div class="card pad">
    <div class="rh"><span class="lb">Tomorrow's forecast</span>{#if consensus != null}<span class="cons">consensus <b>{fmt(consensus)} kWh</b></span>{/if}</div>
    <div class="bars">
      {#each tomorrow as t}
        <div class="brow">
          <span class="bl">{t.label}</span>
          <div class="btrack"><div class="bfill" style="width:{Math.min(100, ((t.v ?? 0) / maxTom) * 100)}%;background:{t.color}"></div></div>
          <span class="bv">{fmt(t.v)}<span class="bu"> kWh</span></span>
        </div>
      {/each}
    </div>
    {#if cloudTom != null}<div class="note">Cloud cover tomorrow ~{n(cloudTom)}%{irradiance != null ? ` · today's irradiance ${n(irradiance)}` : ""}.</div>{/if}
  </div>

  <!-- accuracy tracker -->
  <div class="card pad">
    <div class="rh"><span class="lb">Forecast accuracy</span><span class="sub">forecast vs Victron actual</span></div>
    {#if hasAccuracy}
      <div class="acc">
        {#each accuracy as a}
          {#if a.v != null}<div class="arow"><span class="al">{a.label}</span><span class="av2">{n(a.v)}{a.unit || "%"}</span></div>{/if}
        {/each}
      </div>
    {:else}
      <div class="learn">📈 Learning — needs ~a week of forecast-vs-actual data to show how each model tracks your real output.</div>
    {/if}
  </div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; max-width: 1180px; margin: 0 auto; }
  .head h1 { margin: 0; font-size: 27px; font-weight: 800; letter-spacing: -0.7px; background: var(--title-grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .head p { margin: 5px 0 0; color: var(--dim); font-size: 13px; }
  .pad { padding: 20px 22px; }
  .rh { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 14px; }
  .lb { font-size: 11px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: var(--muted); }
  .sub { font-size: 12px; color: var(--dim); }
  .cons { font-size: 12.5px; color: var(--dim); } .cons b { color: var(--solar); font-size: 14px; }
  .note { font-size: 11.5px; color: var(--muted-2); margin-top: 12px; }

  .todayrow { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
  .actual { flex-shrink: 0; }
  .av { font-size: 40px; font-weight: 800; letter-spacing: -1.5px; color: var(--solar); }
  .au { font-size: 18px; color: var(--dim); }
  .ak { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .fcs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; flex: 1; min-width: 240px; }
  .fc { display: flex; flex-direction: column; gap: 2px; }
  .fcv { font-size: 19px; font-weight: 800; }
  .fck { font-size: 11px; color: var(--muted); }
  .fcd { font-size: 10.5px; font-weight: 700; }

  .bars { display: flex; flex-direction: column; gap: 11px; }
  .brow { display: grid; grid-template-columns: 110px 1fr auto; align-items: center; gap: 12px; }
  .bl { font-size: 12.5px; font-weight: 600; color: var(--text-2); }
  .btrack { height: 12px; border-radius: 999px; background: rgba(255, 255, 255, 0.06); overflow: hidden; }
  .bfill { height: 100%; border-radius: 999px; transition: width 0.5s; }
  .bv { font-size: 13px; font-weight: 800; min-width: 62px; text-align: right; }
  .bu { font-size: 11px; color: var(--dim); font-weight: 600; }

  .acc { display: flex; flex-direction: column; gap: 8px; }
  .arow { display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; border-radius: 10px; background: rgba(255, 255, 255, 0.04); }
  .al { font-size: 12.5px; color: var(--text-2); }
  .av2 { font-size: 14px; font-weight: 800; }
  .learn { font-size: 12.5px; color: var(--muted); padding: 10px 12px; border-radius: 10px; background: rgba(255, 255, 255, 0.035); }
</style>
