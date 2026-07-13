<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { E, IRR_ZONES, irrZoneSensor } from "../lib/entities";
  import { n, dateTime } from "../lib/format";
  import { toast } from "../lib/toast.svelte";
  import Toggle from "../lib/components/Toggle.svelte";

  const runtime = $derived(ha.num(E.irrRuntime) ?? 10);
  const smart = $derived(ha.isOn(E.irrIntelligence));

  function startZone(z: (typeof IRR_ZONES)[number]) {
    ha.setSelect(E.irrZoneSelect, z.select);
    ha.script(E.irrStartZone);
    toast.show(`Starting ${z.label} · ${runtime} min`);
  }
  function stopAll() { ha.script(E.irrStopAll); toast.show("Stopping all zones"); }
  function setRuntime(e: Event) { ha.setNumber(E.irrRuntime, Number((e.target as HTMLInputElement).value)); }

  const remaining = (slug: string) => ha.num(irrZoneSensor(slug, "remaining_time")) ?? 0;
  const soil = (slug: string) => ha.num(irrZoneSensor(slug, "soil_moisture"));
  const running = $derived(IRR_ZONES.filter((z) => remaining(z.slug) > 0));

  function ago(iso: string | undefined) {
    if (!iso) return "never";
    const h = Math.round((Date.now() - Date.parse(iso)) / 3600000);
    if (!Number.isFinite(h)) return "—";
    if (h < 1) return "just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  }
  function nextRun() {
    const s = ha.state(E.irrNextRun);
    if (!s) return "—";
    const d = Date.parse(s);
    if (!Number.isFinite(d)) return s;
    const mins = Math.round((d - Date.now()) / 60000);
    if (mins < 0) return "due";
    if (mins < 60) return `in ${mins}m`;
    const h = Math.floor(mins / 60);
    return h < 24 ? `in ${h}h ${mins % 60}m` : dateTime(d);
  }

  // weather-aware skip banner
  const wet = ["rainy", "pouring", "lightning-rainy", "snowy-rainy", "hail"];
  const rainy = $derived(wet.includes(ha.state(E.weather) ?? ""));
  const soilColor = (v: number | null) => (v == null ? "var(--muted)" : v < 15 ? "var(--warning)" : v < 40 ? "var(--water)" : "var(--success)");
</script>

<div class="col">
  <div class="card header">
    <div><div class="ttl">🌿 Wyze Irrigation · {IRR_ZONES.length} zones</div><div class="sub">Fed from borehole & tank · watered {n(ha.num(E.irrTimeToday))} min today · {n(ha.num(E.irrActiveSchedules))} schedules</div></div>
    <button class="stopall" onclick={stopAll}>Stop all</button>
  </div>

  <!-- weather-aware skip banner -->
  <div class="banner" class:rain={rainy} class:manual={!smart}>
    {#if rainy}
      🌧️ <strong>Rain now</strong> — smart irrigation is skipping scheduled runs to save water.
    {:else if smart}
      ☀️ <strong>No rain forecast</strong> — running as scheduled. Next run {nextRun()}.
    {:else}
      🗓️ <strong>Manual mode</strong> — runs exactly as programmed. Next run {nextRun()}.
    {/if}
  </div>

  <div class="two">
    <div class="card pad">
      <div class="rh"><span class="lb">Smart irrigation</span><Toggle on={smart} onchange={() => ha.toggleBoolean(E.irrIntelligence)} /></div>
      <div class="sub">{smart ? "Auto-skips runs when rain is forecast and adapts to soil moisture." : "Manual scheduling — runs as programmed."}</div>
      <div class="rt">
        <div class="rtrow"><span class="lb">Run time per zone</span><span class="rtv">{n(runtime)} min</span></div>
        <input type="range" min="1" max="30" value={runtime} oninput={setRuntime} />
      </div>
    </div>
    <div class="card pad">
      <div class="lb" style="margin-bottom:12px">Schedule</div>
      <div class="sched">
        <div class="scv">{nextRun()}</div>
        <div class="sub">next scheduled run · {n(ha.num(E.irrActiveSchedules))} active schedules</div>
      </div>
      {#if running.length}
        <div class="runbanner">💦 {running.map((z) => `${z.label} · ${n(remaining(z.slug))}m left`).join(" · ")}</div>
      {:else}
        <div class="mo2">This month: <strong>{n(ha.num(E.irrTimeMonth))} min</strong> total watering</div>
      {/if}
    </div>
  </div>

  <div class="zones">
    {#each IRR_ZONES as z}
      {@const rem = remaining(z.slug)}
      {@const isRunning = rem > 0}
      {@const sm = soil(z.slug)}
      <div class="zone card" class:on={isRunning}>
        <div class="zh"><span class="zn">{z.label}</span><span class="zst" style="color:{isRunning ? 'var(--success)' : 'var(--muted)'}">{isRunning ? `${n(rem)}m left` : "Idle"}</span></div>
        <div class="soilrow">
          <span class="sl">Soil</span>
          <div class="soiltrack"><div class="soilfill" style="width:{Math.min(100, sm ?? 0)}%;background:{soilColor(sm)}"></div></div>
          <span class="sv">{sm != null ? `${n(sm)}%` : "—"}</span>
        </div>
        <div class="zb">
          <span class="sub">watered {ago(ha.state(irrZoneSensor(z.slug, "last_watered")))}</span>
          {#if isRunning}
            <button class="zbtn stop" onclick={stopAll}>Stop</button>
          {:else}
            <button class="zbtn" onclick={() => startZone(z)}>Start</button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }
  .header { padding: 18px 20px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
  .ttl { font-size: 16px; font-weight: 700; }
  .sub { font-size: 12px; color: var(--dim); margin-top: 3px; }
  .stopall { padding: 10px 16px; border-radius: 12px; background: rgba(255, 255, 255, 0.06); color: var(--text); font-size: 12.5px; font-weight: 600; }
  .stopall:hover { background: rgba(255, 255, 255, 0.1); }
  .banner { padding: 14px 18px; border-radius: 16px; font-size: 13px; color: var(--text); background: linear-gradient(180deg, color-mix(in srgb, var(--success) 10%, transparent), rgba(255, 255, 255, 0.02)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--success) 22%, transparent); }
  .banner.rain { background: linear-gradient(180deg, color-mix(in srgb, var(--water) 14%, transparent), rgba(255, 255, 255, 0.02)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--water) 30%, transparent); }
  .banner.manual { background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 760px) { .two { grid-template-columns: 1fr; } }
  .pad { padding: 20px; }
  .rh { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .rt { margin-top: 16px; }
  .rtrow { display: flex; justify-content: space-between; margin-bottom: 9px; }
  .rtv { font-size: 13px; font-weight: 800; color: var(--acc); }
  input[type="range"] { width: 100%; height: 6px; cursor: pointer; accent-color: var(--acc); }
  .sched { margin-bottom: 14px; }
  .scv { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
  .runbanner { font-size: 12px; color: var(--success); padding: 12px 14px; border-radius: 12px; background: color-mix(in srgb, var(--success) 12%, transparent); }
  .mo2 { font-size: 12.5px; color: var(--text-2); padding: 12px 14px; border-radius: 12px; background: rgba(255, 255, 255, 0.03); }
  .zones { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
  .zone { padding: 17px; }
  .zone.on { box-shadow: inset 0 0 0 1.5px var(--line), inset 0 1px 0 rgba(255, 255, 255, 0.1); background: linear-gradient(180deg, var(--soft), rgba(255, 255, 255, 0.028)); }
  .zh { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .zn { font-size: 13.5px; font-weight: 600; }
  .zst { font-size: 11px; font-weight: 700; }
  .soilrow { display: flex; align-items: center; gap: 9px; margin-bottom: 13px; }
  .sl { font-size: 11px; color: var(--muted); width: 30px; }
  .soiltrack { flex: 1; height: 7px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
  .soilfill { height: 100%; border-radius: 999px; transition: width 0.5s; }
  .sv { font-size: 11.5px; font-weight: 700; width: 38px; text-align: right; }
  .zb { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .zbtn { padding: 8px 15px; border-radius: 10px; background: var(--grad); color: #0b1017; font-size: 12px; font-weight: 700; flex-shrink: 0; }
  .zbtn.stop { background: color-mix(in srgb, var(--error) 22%, transparent); color: #fecdd6; }
</style>
