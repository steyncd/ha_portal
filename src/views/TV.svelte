<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E, ROOMS, CAMERAS } from "../lib/entities";
  import { n, greeting, clock as fmtClock, sastHour } from "../lib/format";
  import PowerFlow from "../lib/components/PowerFlow.svelte";

  let { onexit }: { onexit: () => void } = $props();

  let now = $state(new Date());
  let strip = $state(0); // rotating secondary strip index
  let clockTimer: ReturnType<typeof setInterval>;
  let stripTimer: ReturnType<typeof setInterval>;
  let forecast = $state<{ datetime: string; temperature: number; condition: string }[]>([]);

  onMount(() => {
    clockTimer = setInterval(() => (now = new Date()), 20000);
    stripTimer = setInterval(() => (strip = (strip + 1) % 3), 12000);
  });
  onDestroy(() => { clearInterval(clockTimer); clearInterval(stripTimer); });
  onMount(async () => { forecast = (await ha.getForecast(E.weather, "hourly")).slice(0, 7); });

  // ---- header ----
  const clock = $derived(fmtClock(now));
  const dateLabel = $derived(now.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" }));
  const outdoor = $derived(ha.num("sensor.outdoor_temperature"));
  const wxCond = $derived((ha.state(E.weather) ?? "").replace(/-/g, " "));

  // ---- night mode: dim + calm after sundown (burn-in + comfort) ----
  const night = $derived(ha.state("sun.sun") === "below_horizon");

  // ---- consolidated home-health (worst-case, Carbon severity palette) ----
  const armed = $derived((ha.state(E.alarmHome) ?? ha.state(E.alarmMain) ?? "").startsWith("armed"));
  const alarmState = $derived(ha.state(E.alarmHome) ?? ha.state(E.alarmMain) ?? "");
  const camsOnline = $derived(CAMERAS.filter((c) => ha.available(c.id)).length);

  type Alert = { sev: "critical" | "warning"; icon: string; text: string };
  const alerts = $derived.by<Alert[]>(() => {
    const a: Alert[] = [];
    const soc = ha.num(E.batterySoc);
    const water = ha.num(E.tankLevel);
    const days = ha.num(E.tankDays);
    const nobody = ha.isOn("binary_sensor.nobody_home");
    if (alarmState === "triggered") a.push({ sev: "critical", icon: "🚨", text: "Alarm triggered" });
    if (soc != null && soc < 15) a.push({ sev: "critical", icon: "🔋", text: `Battery critical — ${Math.round(soc)}%` });
    else if (soc != null && soc < 30) a.push({ sev: "warning", icon: "🔋", text: `Battery low — ${Math.round(soc)}%` });
    if ((water != null && water < 15) || (days != null && days < 3))
      a.push({ sev: "warning", icon: "💧", text: `Water low${water != null ? " — " + Math.round(water) + "%" : ""}${days != null ? " · " + Math.round(days) + "d left" : ""}` });
    if (camsOnline < CAMERAS.length) a.push({ sev: "warning", icon: "📷", text: `${CAMERAS.length - camsOnline} camera${CAMERAS.length - camsOnline > 1 ? "s" : ""} offline` });
    if (nobody && !armed) a.push({ sev: "warning", icon: "🛡️", text: "Nobody home · alarm off" });
    return a.sort((x, y) => (x.sev === "critical" ? 0 : 1) - (y.sev === "critical" ? 0 : 1));
  });
  const topAlert = $derived(alerts[0] ?? null);
  const health = $derived.by(() => {
    if (topAlert?.sev === "critical") return { c: "var(--error)", icon: topAlert.icon, label: topAlert.text };
    if (topAlert?.sev === "warning") return { c: "var(--warning)", icon: topAlert.icon, label: topAlert.text };
    return { c: "var(--success)", icon: "✓", label: armed ? "All good · armed" : "All good" };
  });

  // ---- tiles ----
  const warm = $derived([...ROOMS].sort((a, b) => (ha.num(b.id) ?? 0) - (ha.num(a.id) ?? 0)));
  const battDir = $derived((ha.num(E.batteryPower) ?? 0) < 0 ? "Discharging" : (ha.num(E.batteryPower) ?? 0) > 0 ? "Charging" : "Idle");

  // ---- rotating secondary strip data ----
  const ICON: Record<string, string> = { sunny: "☀️", "clear-night": "🌙", clear: "🌙", partlycloudy: "⛅", cloudy: "☁️", rainy: "🌧️", pouring: "⛈️", lightning: "⚡", "lightning-rainy": "⛈️", snowy: "❄️", fog: "🌫️", windy: "💨", hail: "🌨️", exceptional: "🌡️" };
  const fc = $derived(forecast.map((f, i) => ({ h: i === 0 ? "Now" : (() => { try { return new Date(f.datetime).getHours() + "h"; } catch { return ""; } })(), ic: ICON[f.condition] ?? "🌡️", t: Math.round(f.temperature) })));
  const brent = $derived(ha.num("sensor.brent_crude_oil"));
  const usdzar = $derived(ha.num("sensor.usd_zar_rate"));
  const petrolCur = $derived(ha.num("input_number.petrol_95_current"));
  const petrolFc = $derived(ha.num("input_number.petrol_95_forecast"));
  const petrolWhen = $derived(ha.state("input_text.petrol_forecast_when") ?? "");
  const petrolChange = $derived(petrolFc != null && petrolCur != null ? petrolFc - petrolCur : null);
  const solarFcToday = $derived(ha.num("sensor.solar_forecast_today"));
</script>

<div class="tv" class:night>
  <button class="exit" onclick={onexit} title="Exit" aria-label="Exit">✕</button>

  {#if topAlert?.sev === "critical"}
    <div class="alert"><span class="ai">{topAlert.icon}</span><span class="at">{topAlert.text}</span></div>
  {/if}

  <header class="head">
    <div>
      <div class="hi">{greeting(sastHour(now))} · 302 Wyoming</div>
      <div class="clock">{clock}</div>
      <div class="date">{dateLabel}</div>
    </div>
    <div class="wx">
      <div class="wtemp">{outdoor != null ? Math.round(outdoor) : "—"}°</div>
      <div class="wcond">{wxCond || "—"}</div>
      <div class="pill" style="--c:{health.c}"><span class="dot"></span>{health.icon} {health.label}</div>
    </div>
  </header>

  <!-- ENERGY FLOW HERO -->
  <section class="hero">
    <div class="cap"><span class="live"></span>Power now · {n(ha.num(E.gridIndepToday))}% self-powered today</div>
    <div class="flow"><PowerFlow big /></div>
    <div class="herostats">
      <div><div class="hl">Solar today</div><div class="hv" style="color:var(--solar)">{n(ha.num(E.solarYieldToday), 1)} kWh</div></div>
      <div><div class="hl">Grid cost today</div><div class="hv">R{n(ha.num(E.energyCostToday))}</div></div>
      <div><div class="hl">Grid-free nights</div><div class="hv" style="color:var(--success)">{ha.state(E.gridFreeStreak) ?? "—"}</div></div>
    </div>
  </section>

  <!-- STATUS TILES -->
  <div class="tiles">
    <div class="tile" style="--pc:var(--acc)">
      <div class="tl">🔋 Battery</div>
      <div class="tv2">{n(ha.num(E.batterySoc))}<span class="tu">%</span></div>
      <div class="ts">{battDir} · {n(ha.num(E.batteryPower))} W</div>
    </div>
    <div class="tile" style="--pc:var(--water)">
      <div class="tl">💧 Water</div>
      <div class="tv2">{n(ha.num(E.tankLevel))}<span class="tu">%</span></div>
      <div class="ts">{n(ha.num(E.tankDays))} days left</div>
    </div>
    <div class="tile" style="--pc:var(--orange)">
      <div class="tl">🌡️ Indoor</div>
      <div class="tv2">{n(ha.num(E.indoorAvg), 1)}<span class="tu">°</span></div>
      <div class="ts">{warm[0]?.label} {n(ha.num(warm[0]?.id ?? ""), 1)}° · {warm[warm.length - 1]?.label} {n(ha.num(warm[warm.length - 1]?.id ?? ""), 1)}°</div>
    </div>
    <div class="tile" style="--pc:{armed ? 'var(--success)' : 'var(--warning)'}">
      <div class="tl">🛡️ Security</div>
      <div class="tv2 sm">{alarmState === "triggered" ? "ALARM" : armed ? "Armed" : "Disarmed"}</div>
      <div class="ts">{camsOnline}/{CAMERAS.length} cameras online</div>
    </div>
  </div>

  <!-- ROTATING SECONDARY STRIP (one at a time — cuts clutter) -->
  <div class="rot">
    {#if strip === 0 && fc.length}
      <div class="rband">
        {#each fc as c, i}<div class="fcc" class:now={i === 0}><span class="h">{c.h}</span><span class="i">{c.ic}</span><b>{c.t}°</b></div>{/each}
      </div>
    {:else if strip === 1}
      <div class="rband mk">
        <span class="mkc"><span class="mkl">Brent</span><b>{brent != null ? "$" + brent.toFixed(1) : "—"}</b></span>
        <span class="mkc"><span class="mkl">USD/ZAR</span><b>{usdzar != null ? "R" + usdzar.toFixed(2) : "—"}</b></span>
        <span class="mkc"><span class="mkl">Petrol 95</span><b>{petrolCur != null ? "R" + petrolCur.toFixed(2) : "—"}</b></span>
        {#if petrolChange != null}<span class="mkc"><span class="mkl">Next {petrolWhen}</span><b class:down={petrolChange < 0} class:up={petrolChange > 0}>{petrolChange < 0 ? "▼" : "▲"} R{Math.abs(petrolChange).toFixed(2)}</b></span>{/if}
      </div>
    {:else}
      <div class="rband mk">
        <span class="mkc"><span class="mkl">Solar today</span><b>{n(ha.num(E.solarYieldToday), 1)} kWh{#if solarFcToday != null} / {n(solarFcToday, 0)}{/if}</b></span>
        <span class="mkc"><span class="mkl">Independent</span><b>{n(ha.num(E.gridIndepToday))}%</b></span>
        <span class="mkc"><span class="mkl">Grid cost</span><b>R{n(ha.num(E.energyCostToday))}</b></span>
        <span class="mkc"><span class="mkl">Water used</span><b>{n(ha.num(E.waterUsedToday))} L</b></span>
      </div>
    {/if}
    <div class="dots">{#each [0, 1, 2] as d}<span class:on={strip === d}></span>{/each}</div>
  </div>
</div>

<style>
  /* Burn-in: very slow whole-frame pixel shift. Night: dim for comfort/longevity. */
  .tv { position: fixed; inset: 0; z-index: 90; overflow: hidden; padding: clamp(20px, 2.6vw, 50px);
    display: flex; flex-direction: column; gap: clamp(12px, 1.5vw, 22px);
    background: radial-gradient(70vw 60vh at 12% -18%, rgba(129, 140, 248, 0.16), transparent 60%), radial-gradient(60vw 62vh at 116% 122%, rgba(84, 120, 255, 0.12), transparent 55%), #06060d;
    animation: burnshift 320s ease-in-out infinite; transition: filter 3s ease; }
  .tv.night { filter: brightness(0.52) saturate(0.92); }
  @keyframes burnshift { 0%,100% { transform: translate(0,0); } 25% { transform: translate(4px,3px); } 50% { transform: translate(-3px,5px); } 75% { transform: translate(5px,-4px); } }
  @media (prefers-reduced-motion: reduce) { .tv { animation: none; } }

  .exit { position: absolute; top: 16px; right: 18px; z-index: 5; width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.1); font-size: 16px; color: var(--text-2); }

  /* critical alert banner — only appears when it warrants focus */
  .alert { display: flex; align-items: center; gap: 14px; padding: clamp(12px,1.3vw,20px) clamp(20px,2vw,32px); border-radius: 16px;
    background: color-mix(in srgb, var(--error) 22%, #06060d); box-shadow: inset 0 0 0 2px var(--error); animation: pulseb 1.6s ease-in-out infinite; }
  .alert .ai { font-size: clamp(26px,3vw,44px); } .alert .at { font-size: clamp(22px,2.6vw,44px); font-weight: 800; color: #fff; }
  @keyframes pulseb { 0%,100% { box-shadow: inset 0 0 0 2px var(--error); } 50% { box-shadow: inset 0 0 0 2px var(--error), 0 0 40px -6px var(--error); } }

  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 2vw; }
  .hi { font-size: clamp(14px,1.5vw,24px); font-weight: 600; color: #c3b9f5; }
  .clock { font-size: clamp(52px,7.4vw,132px); font-weight: 800; letter-spacing: -0.035em; line-height: 0.86; font-variant-numeric: tabular-nums;
    background: linear-gradient(120deg, #fff 42%, #c3b6f8 96%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .date { font-size: clamp(13px,1.2vw,21px); color: var(--text-2); margin-top: 0.5vh; }
  .wx { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.6vh; }
  .wtemp { font-size: clamp(30px,3.6vw,58px); font-weight: 700; letter-spacing: -0.02em; }
  .wcond { font-size: clamp(13px,1.2vw,22px); color: var(--text-2); text-transform: capitalize; }
  .pill { display: inline-flex; align-items: center; gap: 9px; margin-top: 0.6vh; padding: 9px 16px; border-radius: 999px;
    background: color-mix(in srgb, var(--c) 20%, #06060d); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--c) 55%, transparent);
    font-size: clamp(13px,1.2vw,20px); font-weight: 700; color: #fff; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--c); box-shadow: 0 0 10px var(--c); }

  /* hero energy flow — dominant, high contrast */
  .hero { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: clamp(14px,1.6vw,26px) clamp(16px,1.8vw,30px); border-radius: clamp(18px,1.6vw,28px);
    background: rgba(255,255,255,0.055); border: 1px solid rgba(255,255,255,0.12); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08); }
  .cap { display: flex; align-items: center; gap: 9px; font-size: clamp(12px,1.15vw,20px); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #cbd5e1; }
  .cap .live { width: 9px; height: 9px; border-radius: 50%; background: var(--solar); animation: pulse 1.7s infinite; }
  .flow { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 0.6vh 0; }
  .herostats { display: flex; justify-content: center; gap: clamp(28px,5vw,90px); }
  .hl { font-size: clamp(11px,1vw,17px); text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); font-weight: 700; text-align: center; }
  .hv { font-size: clamp(22px,2.6vw,44px); font-weight: 800; letter-spacing: -0.02em; text-align: center; margin-top: 0.3vh; }

  /* status tiles — solid, distinct, large (glanceable) */
  .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: clamp(10px,1.15vw,20px); }
  .tile { padding: clamp(13px,1.5vw,26px); border-radius: clamp(16px,1.5vw,26px);
    background: radial-gradient(130% 120% at 0 0, color-mix(in srgb, var(--pc) 20%, transparent), transparent 60%), rgba(255,255,255,0.06);
    border: 1px solid color-mix(in srgb, var(--pc) 30%, rgba(255,255,255,0.1)); }
  .tl { font-size: clamp(12px,1.1vw,20px); font-weight: 700; color: var(--text-2); }
  .tv2 { font-size: clamp(34px,4.4vw,80px); font-weight: 800; letter-spacing: -0.03em; line-height: 0.95; margin-top: 0.4vh; }
  .tv2.sm { font-size: clamp(26px,3.2vw,58px); }
  .tu { font-size: 0.42em; color: var(--dim); }
  .ts { font-size: clamp(12px,1.1vw,20px); color: var(--text-2); margin-top: 0.5vh; }

  /* rotating secondary strip */
  .rot { position: relative; }
  .rband { display: flex; gap: clamp(8px,1vw,18px); padding: clamp(12px,1.2vw,20px) clamp(18px,1.8vw,30px); border-radius: clamp(14px,1.3vw,22px); background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); animation: fade 0.5s ease; }
  .rband.mk { gap: clamp(18px,3vw,60px); }
  .fcc { flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.7vw; font-size: clamp(14px,1.4vw,26px); color: var(--text); }
  .fcc.now b { color: var(--acc); } .fcc .h { color: var(--dim); } .fcc .i { font-size: 1.25em; }
  .mkc { display: flex; flex-direction: column; gap: 2px; }
  .mkl { font-size: clamp(11px,1vw,17px); text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); font-weight: 700; }
  .mkc b { font-size: clamp(20px,2.3vw,40px); font-weight: 800; }
  .mkc b.down { color: var(--success); } .mkc b.up { color: var(--warning); }
  .dots { position: absolute; right: 16px; bottom: -18px; display: flex; gap: 6px; }
  .dots span { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,0.2); }
  .dots span.on { background: var(--acc); }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
</style>
