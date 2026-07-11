<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E, ROOMS } from "../lib/entities";
  import { n, power, greeting } from "../lib/format";
  import Spark from "../lib/components/Spark.svelte";

  let { onexit }: { onexit: () => void } = $props();

  let now = $state(new Date());
  let timer: ReturnType<typeof setInterval>;
  onMount(() => { timer = setInterval(() => (now = new Date()), 20000); });
  onDestroy(() => clearInterval(timer));

  let battHist = $state<{ t: number; v: number }[]>([]);
  onMount(async () => { battHist = await ha.history(E.batterySoc, 24); });

  const clock = $derived(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
  const warm = $derived([...ROOMS].sort((a, b) => (ha.num(b.id) ?? 0) - (ha.num(a.id) ?? 0)));
  const FC = [["Now", "🌙", 16], ["21h", "🌫️", 12], ["23h", "🌫️", 11], ["01h", "🌫️", 10], ["03h", "❄️", 8], ["06h", "❄️", 7], ["09h", "☀️", 15]];
</script>

<div class="tv">
  <button class="exit" onclick={onexit} title="Exit">✕</button>
  <div class="head">
    <div>
      <div class="hi">{greeting(now.getHours())} · 302 Wyoming</div>
      <div class="clock">{clock}</div>
    </div>
    <div class="wx">
      <div class="wt">🌙 16°</div>
      <div class="wd">Clear night</div>
      <div class="occ"><span class="od"></span>{ha.state(E.occupancy) ?? "Home"} · {ha.state(E.alarmMain) ?? "—"}</div>
    </div>
  </div>

  <div class="bento">
    <div class="panel energy">
      <div class="pl" style="color:var(--solar)"><span class="live"></span>Power now</div>
      <div class="prow"><div class="pbig">{power(ha.num(E.loads)).val}<span class="pu"> {power(ha.num(E.loads)).unit}</span></div><div class="pnote">on <b style="color:var(--solar)">battery</b><br>{n(ha.num(E.gridIndepToday))}% self-powered</div></div>
      <div class="stats3">
        <div><div class="sl">☀️ Solar</div><div class="sv">{power(ha.num(E.pvPower)).val} {power(ha.num(E.pvPower)).unit}</div></div>
        <div><div class="sl">🔋 Battery</div><div class="sv">{n(ha.num(E.batteryPower))} W</div></div>
        <div><div class="sl">🔌 Grid</div><div class="sv">{power(ha.num(E.gridPower)).val} {power(ha.num(E.gridPower)).unit}</div></div>
      </div>
      <div class="espark"><Spark data={battHist} color="var(--solar)" forceMax={100} height={90} /></div>
    </div>

    <div class="panel" style="--pc:var(--acc)">
      <div class="pl" style="color:var(--acc)">🔋 Battery</div>
      <div class="mbig">{n(ha.num(E.batterySoc))}<span class="mu">%</span></div>
      <div class="msub">{n(ha.num(E.batteryPower))} W</div>
    </div>
    <div class="panel" style="--pc:var(--water)">
      <div class="pl" style="color:var(--water)">💧 Water tank</div>
      <div class="mbig">{n(ha.num(E.tankLevel))}<span class="mu">%</span></div>
      <div class="msub">{n(ha.num(E.tankVolume))} L · {n(ha.num(E.tankDays))} days</div>
    </div>
    <div class="panel" style="--pc:var(--orange)">
      <div class="pl" style="color:var(--orange)">🌡️ Climate</div>
      <div class="mbig">{n(ha.num(E.indoorAvg), 1)}<span class="mu">°</span></div>
      <div class="crows">
        <div><span>{warm[0]?.label} · warmest</span><b>{n(ha.num(warm[0]?.id ?? ""), 1)}°</b></div>
        <div><span>{warm[warm.length - 1]?.label} · coolest</span><b>{n(ha.num(warm[warm.length - 1]?.id ?? ""), 1)}°</b></div>
      </div>
    </div>
    <div class="panel" style="--pc:var(--success)">
      <div class="pl" style="color:var(--success)">🛡️ Security</div>
      <div class="secbig">All clear</div>
      <div class="crows"><div><span>{ha.state(E.alarmMain) ?? "—"} · zones ready</span></div><div><span>Gate clear · 8 cameras</span></div></div>
    </div>
  </div>

  <div class="fc">
    {#each FC as [h, ic, tp], i}
      <div class="fcc" style="background:{i === 0 ? 'var(--soft)' : 'rgba(255,255,255,.03)'}"><span>{h}</span><span class="fi">{ic}</span><b>{tp}°</b></div>
    {/each}
  </div>

  <div class="foot">
    <div class="fl"><span class="fdot"></span>Today · <b>{n(ha.num(E.solarYieldToday), 1)} kWh</b> solar · <b>{n(ha.num(E.gridIndepToday))}%</b> independent · <b>R{n(ha.num(E.energyCostToday))}</b> · <b>{n(ha.num(E.waterUsedToday))} L</b> · <b style="color:var(--success)">{ha.state(E.gridFreeStreak) ?? "—"}</b>-night streak</div>
  </div>
</div>

<style>
  .tv { position: fixed; inset: 0; z-index: 90; overflow: hidden; background: radial-gradient(72vw 62vh at 12% -16%, rgba(129, 140, 248, 0.18), transparent 60%), radial-gradient(58vw 60vh at 116% 120%, rgba(168, 85, 247, 0.15), transparent 55%), #08070f; padding: clamp(20px, 3vw, 54px); display: flex; flex-direction: column; gap: clamp(12px, 1.5vw, 26px); }
  .exit { position: absolute; top: 16px; right: 18px; z-index: 5; width: 38px; height: 38px; border-radius: 50%; background: rgba(255, 255, 255, 0.08); font-size: 16px; color: var(--muted); }
  .exit:hover { background: rgba(255, 255, 255, 0.16); }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 2vw; }
  .hi { font-size: clamp(14px, 1.5vw, 25px); font-weight: 600; color: #b6acec; }
  .clock { font-size: clamp(52px, 7.6vw, 132px); font-weight: 800; letter-spacing: -0.03em; line-height: 0.88; background: linear-gradient(120deg, #fff 34%, #b3a6f5 96%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .wx { text-align: right; }
  .wt { font-size: clamp(30px, 3.6vw, 60px); font-weight: 700; }
  .wd { font-size: clamp(12px, 1.15vw, 20px); color: var(--muted); }
  .occ { display: inline-flex; align-items: center; gap: 8px; margin-top: 1vh; padding: 7px 14px; border-radius: 999px; background: color-mix(in srgb, var(--success) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--success) 34%, transparent); font-size: clamp(12px, 1.15vw, 20px); font-weight: 700; }
  .od { width: 9px; height: 9px; border-radius: 50%; background: var(--success); box-shadow: 0 0 10px var(--success); }
  .bento { display: grid; flex: 1; min-height: 0; gap: clamp(10px, 1.15vw, 22px); grid-template-columns: 1.55fr 1fr 1fr; grid-template-rows: 1fr 1fr; }
  .panel { min-height: 0; display: flex; flex-direction: column; border-radius: clamp(16px, 1.6vw, 30px); padding: clamp(15px, 1.7vw, 30px); background: radial-gradient(135% 125% at 0% 0%, color-mix(in srgb, var(--pc, var(--acc)) 20%, transparent), transparent 60%), linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09), 0 26px 60px -34px rgba(0, 0, 0, 0.92); }
  .energy { grid-column: 1; grid-row: 1 / span 2; --pc: var(--solar); }
  .pl { display: flex; align-items: center; gap: 8px; font-size: clamp(11px, 1.05vw, 19px); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
  .live { width: 8px; height: 8px; border-radius: 50%; background: var(--solar); animation: pulse 1.7s infinite; }
  .prow { display: flex; align-items: flex-end; gap: 1.6vw; flex-wrap: wrap; margin-top: 1vh; }
  .pbig { font-size: clamp(52px, 8vw, 140px); font-weight: 800; letter-spacing: -0.04em; line-height: 0.82; }
  .pu { font-size: 0.32em; color: var(--dim); }
  .pnote { padding-bottom: 1vh; font-size: clamp(14px, 1.5vw, 26px); color: var(--text-2); line-height: 1.35; }
  .stats3 { display: flex; gap: 2.4vw; flex-wrap: wrap; margin-top: 1.6vh; }
  .sl { font-size: clamp(10px, 1vw, 17px); font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--muted); }
  .sv { font-size: clamp(20px, 2.4vw, 40px); font-weight: 800; margin-top: 0.4vh; }
  .espark { flex: 1; min-height: 0; display: flex; align-items: flex-end; margin-top: 1.4vh; }
  .mbig { font-size: clamp(38px, 5vw, 92px); font-weight: 800; letter-spacing: -0.03em; line-height: 0.9; margin-top: 0.6vh; }
  .mu { font-size: 0.42em; color: var(--dim); }
  .msub { font-size: clamp(12px, 1.15vw, 21px); color: var(--text-2); margin-top: 0.4vh; }
  .secbig { font-size: clamp(30px, 4vw, 72px); font-weight: 800; line-height: 0.92; margin-top: 0.6vh; }
  .crows { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: flex-end; gap: 0.5vh; margin-top: 0.6vh; font-size: clamp(12px, 1.1vw, 20px); color: var(--text-2); }
  .crows div { display: flex; justify-content: space-between; gap: 10px; }
  .fc { display: flex; gap: clamp(6px, 0.8vw, 16px); }
  .fcc { flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.7vw; padding: clamp(9px, 1vw, 18px) clamp(6px, 0.6vw, 14px); border-radius: clamp(12px, 1.2vw, 22px); font-size: clamp(13px, 1.4vw, 25px); }
  .fcc span { color: var(--muted); }
  .fcc .fi { font-size: 1.3em; }
  .fcc b { color: var(--text); }
  .foot { display: flex; align-items: center; gap: 2vw; font-size: clamp(11px, 1.05vw, 19px); color: var(--muted); }
  .fl { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .fl b { color: var(--text); }
  .fdot { width: 7px; height: 7px; border-radius: 50%; background: var(--solar); animation: pulse 1.7s infinite; }
  @media (max-width: 820px) { .bento { grid-template-columns: 1fr 1fr; grid-template-rows: auto; } .energy { grid-column: 1 / span 2; grid-row: auto; } }
</style>
