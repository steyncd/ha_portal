<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E, ROOMS, ALARM_ZONES, CAMERAS } from "../lib/entities";
  import { n, power, greeting, clock as fmtClock, sastHour } from "../lib/format";
  import Overlay from "../lib/components/Overlay.svelte";

  let { onexit }: { onexit: () => void } = $props();

  let now = $state(new Date());
  let timer: ReturnType<typeof setInterval>;
  onMount(() => { timer = setInterval(() => (now = new Date()), 20000); });
  onDestroy(() => clearInterval(timer));

  let pvHist = $state<{ t: number; v: number }[]>([]);
  let loadHist = $state<{ t: number; v: number }[]>([]);
  let forecast = $state<{ datetime: string; temperature: number; condition: string }[]>([]);
  onMount(async () => {
    pvHist = await ha.history(E.pvPower, 24);
    loadHist = await ha.history(E.loads, 24);
    forecast = (await ha.getForecast(E.weather, "hourly")).slice(0, 7);
  });

  const clock = $derived(fmtClock(now));
  const dateLabel = $derived(now.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" }));
  const warm = $derived([...ROOMS].sort((a, b) => (ha.num(b.id) ?? 0) - (ha.num(a.id) ?? 0)));
  const outdoor = $derived(ha.num("sensor.outdoor_temperature"));
  const wxCond = $derived((ha.state(E.weather) ?? "").replace(/-/g, " "));
  const activeZones = $derived(ALARM_ZONES.filter((z) => ha.isOn(z.id)).length);
  const camsOnline = $derived(CAMERAS.filter((c) => ha.available(c.id)).length);
  const armed = $derived((ha.state(E.alarmHome) ?? ha.state(E.alarmMain) ?? "").startsWith("armed"));
  const occupancy = $derived(ha.state(E.occupancy) ?? "Home");
  const solarFcToday = $derived(ha.num("sensor.solar_forecast_today"));
  // HQ money bridge (populated by the syncMoneyToHA function)
  const nw = $derived(ha.num("input_number.hq_net_worth"));
  const safe = $derived(ha.num("input_number.hq_available"));
  const bank = $derived(ha.num("input_number.hq_total_balance"));
  const moneyOn = $derived((ha.state("input_text.hq_updated") ?? "unknown") !== "unknown");
  const zar = (v: number | null) => (v == null ? "—" : "R " + Math.round(v).toLocaleString("en-ZA"));

  const ICON: Record<string, string> = {
    "sunny": "☀️", "clear-night": "🌙", "clear": "🌙", "partlycloudy": "⛅", "cloudy": "☁️",
    "rainy": "🌧️", "pouring": "⛈️", "lightning": "⚡", "lightning-rainy": "⛈️",
    "snowy": "❄️", "snowy-rainy": "🌨️", "fog": "🌫️", "windy": "💨", "hail": "🌨️", "exceptional": "🌡️",
  };
  const icon = (c: string) => ICON[c] ?? "🌡️";
  const fcHour = (iso: string) => { try { return new Date(iso).getHours() + "h"; } catch { return ""; } };
  const fc = $derived(forecast.map((f, i) => ({ h: i === 0 ? "Now" : fcHour(f.datetime), ic: icon(f.condition), t: Math.round(f.temperature), now: i === 0 })));
</script>

<div class="tv">
  <button class="exit" onclick={onexit} title="Exit" aria-label="Exit">✕</button>

  <header class="head">
    <div>
      <div class="hi">{greeting(sastHour(now))} · 302 Wyoming</div>
      <div class="clock">{clock}</div>
      <div class="date">{dateLabel}</div>
    </div>
    <div class="wx">
      <div class="wtemp">{outdoor != null ? Math.round(outdoor) : "—"}°</div>
      <div class="wcond">{wxCond || "—"}</div>
      <div class="pill" style="--c:{armed ? 'var(--warning)' : 'var(--success)'}">
        <span class="dot"></span>{occupancy} · {armed ? "Armed" : "Disarmed"} · {camsOnline}/{CAMERAS.length} cams
      </div>
    </div>
  </header>

  <div class="bento">
    <!-- Power hero -->
    <section class="panel hero" style="--pc:var(--solar)">
      <div class="cap" style="color:var(--solar)"><span class="live"></span>Power now</div>
      <div class="heroval">
        <div class="big">{power(ha.num(E.loads)).val}<span class="unit"> {power(ha.num(E.loads)).unit}</span></div>
        <div class="note">on <b>{(ha.num(E.batteryPower) ?? 0) < 0 ? "battery" : "grid"}</b><br>{n(ha.num(E.gridIndepToday))}% self-powered today</div>
      </div>
      <div class="trip">
        <div><div class="l">☀️ Solar</div><div class="v" style="color:var(--solar)">{power(ha.num(E.pvPower)).val} {power(ha.num(E.pvPower)).unit}</div></div>
        <div><div class="l">🔋 Battery</div><div class="v" style="color:var(--success)">{n(ha.num(E.batteryPower))} W</div></div>
        <div><div class="l">🔌 Grid</div><div class="v">{power(ha.num(E.gridPower)).val} {power(ha.num(E.gridPower)).unit}</div></div>
      </div>
      <div class="flow"><Overlay height={120} series={[
        { data: pvHist, color: "var(--solar)", label: "Solar", fill: true },
        { data: loadHist, color: "var(--success)", label: "Home use" },
      ]} /></div>
    </section>

    <!-- Battery -->
    <section class="panel" style="--pc:var(--acc)">
      <div class="cap" style="color:var(--acc)">🔋 Battery</div>
      <div class="tileval">{n(ha.num(E.batterySoc))}<span class="tu">%</span></div>
      <div class="tsub">{(ha.num(E.batteryPower) ?? 0) < 0 ? "Discharging" : "Charging"} · {n(ha.num(E.batteryPower))} W</div>
    </section>

    <!-- Water -->
    <section class="panel" style="--pc:var(--water)">
      <div class="cap" style="color:var(--water)">💧 Water tank</div>
      <div class="tileval">{n(ha.num(E.tankLevel))}<span class="tu">%</span></div>
      <div class="tsub">{n(ha.num(E.tankVolume))} L · {n(ha.num(E.tankDays))} days left</div>
    </section>

    <!-- Climate -->
    <section class="panel" style="--pc:var(--orange)">
      <div class="cap" style="color:var(--orange)">🌡️ Climate</div>
      <div class="tileval">{n(ha.num(E.indoorAvg), 1)}<span class="tu">°</span></div>
      <div class="rows">
        <div><span>{warm[0]?.label} · warmest</span><b>{n(ha.num(warm[0]?.id ?? ""), 1)}°</b></div>
        <div><span>{warm[warm.length - 1]?.label} · coolest</span><b>{n(ha.num(warm[warm.length - 1]?.id ?? ""), 1)}°</b></div>
      </div>
    </section>

    <!-- Security -->
    <section class="panel" style="--pc:{activeZones ? 'var(--warning)' : 'var(--success)'}">
      <div class="cap" style="color:{activeZones ? 'var(--warning)' : 'var(--success)'}">🛡️ Security</div>
      <div class="secbig">{activeZones ? `${activeZones} active` : armed ? "Armed" : "All clear"}</div>
      <div class="rows">
        <div><span>Home {armed ? "armed" : "disarmed"} · {activeZones} zones</span></div>
        <div><span>{camsOnline} / {CAMERAS.length} cameras online</span></div>
      </div>
    </section>
  </div>

  {#if fc.length}
    <div class="fcstrip">
      {#each fc as c}
        <div class="fcc" class:now={c.now}><span class="h">{c.h}</span><span class="i">{c.ic}</span><b>{c.t}°</b></div>
      {/each}
    </div>
  {/if}

  {#if moneyOn}
    <div class="money">
      <span class="mitem"><span class="ml">💰 Net worth</span><b>{zar(nw)}</b></span>
      <span class="mitem"><span class="ml">Safe to spend</span><b>{zar(safe)}</b></span>
      <span class="mitem"><span class="ml">In the bank</span><b>{zar(bank)}</b></span>
    </div>
  {/if}

  <footer class="foot">
    <span class="fdot"></span><span>Today</span>
    <b>{n(ha.num(E.solarYieldToday), 1)} kWh</b><span>solar</span>
    {#if solarFcToday != null}<span class="sep">·</span><span>of ~{n(solarFcToday, 0)} forecast</span>{/if}
    <span class="sep">·</span><b>{n(ha.num(E.gridIndepToday))}%</b><span>independent</span>
    <span class="sep">·</span><b>R{n(ha.num(E.energyCostToday))}</b><span>grid</span>
    <span class="sep">·</span><b>{n(ha.num(E.waterUsedToday))} L</b><span>water</span>
    <span class="sep">·</span><b class="streak">{ha.state(E.gridFreeStreak) ?? "—"}</b><span>night grid-free streak</span>
  </footer>
</div>

<style>
  .tv { position: fixed; inset: 0; z-index: 90; overflow: hidden; padding: clamp(20px, 2.6vw, 50px);
    display: flex; flex-direction: column; gap: clamp(12px, 1.5vw, 24px);
    background:
      radial-gradient(70vw 60vh at 10% -18%, rgba(129, 140, 248, 0.20), transparent 60%),
      radial-gradient(60vw 62vh at 118% 122%, rgba(168, 85, 247, 0.15), transparent 55%),
      #07060f; }
  .exit { position: absolute; top: 16px; right: 18px; z-index: 5; width: 38px; height: 38px; border-radius: 50%; background: rgba(255, 255, 255, 0.08); font-size: 16px; color: var(--muted); }
  .exit:hover { background: rgba(255, 255, 255, 0.16); }

  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 2vw; }
  .hi { font-size: clamp(14px, 1.5vw, 24px); font-weight: 500; color: #b6acec; }
  .clock { font-size: clamp(54px, 7.8vw, 138px); font-weight: 800; letter-spacing: -0.035em; line-height: 0.86; font-variant-numeric: tabular-nums;
    background: linear-gradient(120deg, #fff 38%, #b3a6f5 96%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .date { font-size: clamp(13px, 1.2vw, 21px); color: var(--text-2); margin-top: 0.5vh; }
  .wx { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.6vh; }
  .wtemp { font-size: clamp(30px, 3.6vw, 60px); font-weight: 700; letter-spacing: -0.02em; }
  .wcond { font-size: clamp(13px, 1.2vw, 22px); color: var(--text-2); text-transform: capitalize; }
  .pill { display: inline-flex; align-items: center; gap: 8px; margin-top: 0.6vh; padding: 8px 15px; border-radius: 999px;
    background: color-mix(in srgb, var(--c) 13%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 36%, transparent);
    font-size: clamp(12px, 1.1vw, 19px); font-weight: 700; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--c); box-shadow: 0 0 10px var(--c); }

  .bento { display: grid; flex: 1; min-height: 0; gap: clamp(10px, 1.15vw, 20px); grid-template-columns: 1.6fr 1fr 1fr; grid-template-rows: 1fr 1fr; }
  .panel { min-height: 0; display: flex; flex-direction: column; border-radius: clamp(16px, 1.5vw, 28px); padding: clamp(15px, 1.7vw, 30px);
    background: radial-gradient(135% 125% at 0% 0%, color-mix(in srgb, var(--pc, var(--acc)) 17%, transparent), transparent 58%), rgba(255, 255, 255, 0.045);
    border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 26px 60px -40px rgba(0, 0, 0, 0.9); }
  .hero { grid-column: 1; grid-row: 1 / span 2; }
  .cap { display: flex; align-items: center; gap: 8px; font-size: clamp(11px, 1vw, 18px); font-weight: 700; letter-spacing: 0.13em; text-transform: uppercase; color: var(--pc, #b6acec); }
  .live { width: 8px; height: 8px; border-radius: 50%; background: currentColor; animation: pulse 1.7s infinite; }
  .heroval { display: flex; align-items: flex-end; gap: 1.4vw; margin-top: 1.1vh; flex-wrap: wrap; }
  .big { font-size: clamp(52px, 8vw, 146px); font-weight: 800; letter-spacing: -0.04em; line-height: 0.8; }
  .unit { font-size: 0.3em; color: var(--dim); font-weight: 700; }
  .note { padding-bottom: 1vh; font-size: clamp(14px, 1.45vw, 26px); color: var(--text-2); line-height: 1.35; }
  .note b { color: var(--solar); }
  .trip { display: flex; gap: 2.2vw; margin-top: 1.7vh; flex-wrap: wrap; }
  .trip .l { font-size: clamp(11px, 1vw, 17px); text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); font-weight: 700; }
  .trip .v { font-size: clamp(20px, 2.3vw, 40px); font-weight: 800; margin-top: 0.4vh; }
  .flow { flex: 1; min-height: 0; display: flex; align-items: flex-end; margin-top: 1.4vh; }

  .tileval { font-size: clamp(38px, 4.8vw, 90px); font-weight: 800; letter-spacing: -0.03em; line-height: 0.9; margin-top: 0.6vh; }
  .tu { font-size: 0.42em; color: var(--dim); }
  .tsub { font-size: clamp(12px, 1.15vw, 21px); color: var(--text-2); margin-top: 0.5vh; }
  .secbig { font-size: clamp(30px, 4vw, 68px); font-weight: 800; line-height: 0.92; margin-top: 0.6vh; }
  .rows { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: flex-end; gap: 0.5vh; margin-top: 0.6vh; font-size: clamp(13px, 1.2vw, 22px); color: var(--text-2); }
  .rows div { display: flex; justify-content: space-between; gap: 10px; }
  .rows b { color: var(--text); }

  .fcstrip { display: flex; gap: clamp(7px, 0.8vw, 15px); }
  .fcc { flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.7vw; padding: clamp(9px, 1vw, 17px); border-radius: clamp(12px, 1.1vw, 20px);
    background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.07); font-size: clamp(13px, 1.35vw, 24px); }
  .fcc.now { background: color-mix(in srgb, var(--acc) 16%, transparent); border-color: color-mix(in srgb, var(--acc) 34%, transparent); }
  .fcc .h { color: var(--dim); } .fcc .i { font-size: 1.25em; } .fcc b { color: var(--text); }

  .foot { display: flex; align-items: center; gap: 1.1vw; flex-wrap: wrap; padding: clamp(13px, 1.3vw, 22px) clamp(18px, 1.8vw, 30px);
    border-radius: clamp(14px, 1.3vw, 22px); background: rgba(255, 255, 255, 0.045); border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: clamp(13px, 1.25vw, 22px); color: var(--text-2); }
  .money { display: flex; gap: clamp(16px, 2.4vw, 48px); padding: clamp(13px, 1.3vw, 22px) clamp(18px, 1.8vw, 30px); border-radius: clamp(14px, 1.3vw, 22px); background: radial-gradient(120% 140% at 0 0, color-mix(in srgb, var(--success) 12%, transparent), transparent 60%), rgba(255, 255, 255, 0.045); border: 1px solid rgba(255, 255, 255, 0.08); }
  .mitem { display: flex; flex-direction: column; gap: 2px; }
  .mitem .ml { font-size: clamp(11px, 1vw, 17px); text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); font-weight: 700; }
  .mitem b { font-size: clamp(22px, 2.4vw, 42px); font-weight: 800; letter-spacing: -0.02em; }
  .foot .fdot { width: 8px; height: 8px; border-radius: 50%; background: var(--solar); box-shadow: 0 0 8px var(--solar); }
  .foot b { color: var(--text); } .foot .sep { color: var(--dim); } .streak { color: var(--success) !important; }

  @media (max-width: 820px) { .bento { grid-template-columns: 1fr 1fr; grid-template-rows: auto; } .hero { grid-column: 1 / span 2; grid-row: auto; } }
</style>
