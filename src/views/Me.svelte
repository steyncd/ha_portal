<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E, SCENES } from "../lib/entities";
  import { n, dur } from "../lib/format";
  import { toast } from "../lib/toast.svelte";
  import Spark from "../lib/components/Spark.svelte";

  const scoreColor = (v: number | null) => (v == null ? "var(--muted)" : v >= 85 ? "var(--success)" : v >= 70 ? "var(--acc)" : v >= 55 ? "var(--warning)" : "var(--error)");
  const ringBg = (v: number | null, c: string) => `conic-gradient(${c} ${v ?? 0}%,rgba(255,255,255,.10) 0)`;

  const scores = $derived([
    { name: "Sleep", val: ha.num(E.ouraSleepScore), sub: "last night" },
    { name: "Readiness", val: ha.num(E.ouraReadiness), sub: "balanced" },
    { name: "Activity", val: ha.num(E.ouraActivityScore), sub: "today" },
  ]);

  const stages = $derived.by(() => {
    const deep = ha.num(E.ouraDeep) ?? 0, rem = ha.num(E.ouraRem) ?? 0, light = ha.num(E.ouraLightSleep) ?? 0, awake = ha.num(E.ouraAwake) ?? 0;
    const tot = deep + rem + light + awake || 1;
    return [
      { name: "Deep", v: deep, color: "#6366f1" },
      { name: "REM", v: rem, color: "#38bdf8" },
      { name: "Light", v: light, color: "#818cf8" },
      { name: "Awake", v: awake, color: "rgba(255,255,255,.25)" },
    ].map((s) => ({ ...s, w: (s.v / tot) * 100, dur: dur(s.v) }));
  });

  const vitals = $derived([
    { k: "Resting HR", v: `${n(ha.num(E.ouraRestingHR))} bpm` },
    { k: "Sleep HR", v: `${n(ha.num(E.ouraSleepHR))} bpm` },
    { k: "Current HR", v: `${n(ha.num(E.ouraCurrentHR))} bpm` },
    { k: "HRV", v: `${n(ha.num(E.ouraSleepHRV))} ms` },
    { k: "Efficiency", v: `${n(ha.num(E.ouraEfficiency))}%` },
    { k: "Restful", v: `${n(ha.num(E.ouraRestful))}%` },
    { k: "Temp dev.", v: `${n(ha.num(E.ouraTempDev), 1)}°` },
    { k: "Latency", v: dur(ha.num(E.ouraLatency)) },
  ]);

  const steps = $derived(ha.num(E.ouraSteps));
  const stepsGoal = 8000;

  let sleepTrend = $state<{ t: number; v: number }[]>([]);
  let stepsTrend = $state<{ t: number; v: number }[]>([]);
  onMount(async () => {
    sleepTrend = await ha.history(E.ouraSleepScore, 24 * 7);
    stepsTrend = await ha.history(E.ouraSteps, 24 * 7);
  });

  const favs = [
    { id: "switch.main_bedroom_lamp", icon: "🛏️", name: "Bedroom" },
    { id: "light.study_lamp", icon: "📖", name: "Study" },
    { id: SCENES[0].id, icon: "🌙", name: "Goodnight", scene: true },
    { id: SCENES[3].id, icon: "☀️", name: "Morning", scene: true },
  ];
</script>

<div class="col">
  <div class="card profile">
    <span class="av">C</span>
    <div class="pi"><div class="pn">Christo</div><div class="ps">Admin · <span style="color:var(--success)">Home now</span> · Readiness {n(ha.num(E.ouraReadiness))}</div></div>
    <div class="ring-batt"><span>💍</span> Oura <span class="rb">{n(ha.num(E.ouraRingBatt))}%</span></div>
  </div>

  <div class="scores">
    {#each scores as s}
      <div class="card sc">
        <div class="ring" style="background:{ringBg(s.val, scoreColor(s.val))}"><div class="rc" style="color:{scoreColor(s.val)}">{n(s.val)}</div></div>
        <div><div class="scn">{s.name}</div><div class="scs">{s.sub}</div></div>
      </div>
    {/each}
  </div>

  <div class="two">
    <div class="card pad">
      <div class="rh"><span class="lb">Last night's sleep</span><span class="sub">{ha.state(E.ouraBedStart) ? "tracked" : "—"}</span></div>
      <div class="sd"><div class="sdur">{dur(ha.num(E.ouraTotalSleep))}</div><div class="sib">asleep · {dur(ha.num(E.ouraTimeInBed))} in bed</div></div>
      <div class="stagebar">{#each stages as st}<div style="width:{st.w}%;background:{st.color}"></div>{/each}</div>
      <div class="stagekey">
        {#each stages as st}<div class="sk"><span class="skd" style="background:{st.color}"></span><span class="skn">{st.name}</span><span class="skv">{st.dur}</span></div>{/each}
      </div>
    </div>
    <div class="card pad">
      <div class="lb" style="margin-bottom:17px">Heart & vitals</div>
      <div class="vgrid">
        {#each vitals as v}<div><div class="vv">{v.v}</div><div class="vk">{v.k}</div></div>{/each}
      </div>
    </div>
  </div>

  <div class="two">
    <div class="card pad">
      <div class="lb" style="margin-bottom:16px">Activity today</div>
      <div class="act">
        <div class="ring2" style="background:{ringBg(steps != null ? Math.min(100, (steps / stepsGoal) * 100) : 0, 'var(--success)')}"><div class="rc2"><span class="stv">{n(steps)}</span><span class="stg">/ {stepsGoal / 1000}k</span></div></div>
        <div class="acl">
          <div class="acr"><span>Active energy</span><span class="acv">{n(ha.num(E.ouraActiveCal))} / {n(ha.num(E.ouraTargetCal))} kcal</span></div>
          <div class="acr"><span>Total burned</span><span class="acv">{n(ha.num(E.ouraTotalCal))} kcal</span></div>
          <div class="acr"><span>Low activity</span><span class="acv">{dur(ha.num(E.ouraLowActivity))}</span></div>
        </div>
      </div>
    </div>
    <div class="card pad">
      <div class="lb" style="margin-bottom:13px">My favourites</div>
      <div class="favs">
        {#each favs as f}
          <button class="fav" class:on={!f.scene && ha.isOn(f.id)} onclick={() => f.scene ? (ha.script(f.id), toast.show(f.name)) : ha.toggle(f.id)}>
            <span class="fi">{f.icon}</span><span class="fn">{f.name}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <div class="two">
    <div class="card pad"><div class="rh"><span class="lb">Sleep score · 7 days</span></div><Spark data={sleepTrend} color="var(--acc2)" forceMax={100} height={80} /></div>
    <div class="card pad"><div class="rh"><span class="lb">Steps · 7 days</span><span class="sub">goal 8k</span></div><Spark data={stepsTrend} color="var(--orange)" height={80} /></div>
  </div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; max-width: 1180px; margin: 0 auto; }
  .profile { padding: 22px 24px; display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
  .av { width: 64px; height: 64px; flex-shrink: 0; border-radius: 50%; background: var(--grad); display: grid; place-items: center; font-size: 24px; font-weight: 800; color: #07131c; }
  .pn { font-size: 22px; font-weight: 800; }
  .ps { font-size: 13px; color: var(--text-2); margin-top: 3px; }
  .pi { flex: 1; min-width: 0; }
  .ring-batt { display: flex; align-items: center; gap: 9px; padding: 9px 14px; border-radius: 999px; background: rgba(255, 255, 255, 0.05); font-size: 12.5px; color: var(--text-2); }
  .rb { font-weight: 700; color: var(--success); }
  .scores { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  @media (max-width: 760px) { .scores { grid-template-columns: 1fr; } }
  .sc { padding: 20px 22px; display: flex; align-items: center; gap: 17px; }
  .ring { width: 82px; height: 82px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; }
  .rc { width: 63px; height: 63px; border-radius: 50%; background: #0b1017; display: grid; place-items: center; font-size: 23px; font-weight: 800; }
  .scn { font-size: 15px; font-weight: 700; }
  .scs { font-size: 12px; color: var(--muted); margin-top: 3px; }
  .two { display: grid; grid-template-columns: 1.25fr 1fr; gap: 14px; }
  @media (max-width: 820px) { .two { grid-template-columns: 1fr; } }
  .pad { padding: 22px; }
  .rh { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .sub { font-size: 12px; color: var(--dim); }
  .sd { display: flex; align-items: flex-end; gap: 13px; margin-bottom: 15px; }
  .sdur { font-size: 40px; font-weight: 800; letter-spacing: -1.5px; line-height: 0.9; }
  .sib { font-size: 12px; color: var(--muted); padding-bottom: 6px; }
  .stagebar { display: flex; gap: 2px; height: 14px; border-radius: 7px; overflow: hidden; margin-bottom: 13px; }
  .stagekey { display: grid; grid-template-columns: 1fr 1fr; gap: 9px 18px; }
  .sk { display: flex; align-items: center; gap: 8px; }
  .skd { width: 9px; height: 9px; flex-shrink: 0; border-radius: 3px; }
  .skn { font-size: 12px; color: var(--text-2); flex: 1; }
  .skv { font-size: 12px; font-weight: 700; }
  .vgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 17px 14px; }
  .vv { font-size: 20px; font-weight: 800; }
  .vk { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
  .act { display: flex; align-items: center; gap: 18px; }
  .ring2 { width: 88px; height: 88px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; }
  .rc2 { width: 66px; height: 66px; border-radius: 50%; background: #0b1017; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .stv { font-size: 17px; font-weight: 800; }
  .stg { font-size: 9px; color: var(--muted); }
  .acl { flex: 1; display: flex; flex-direction: column; gap: 11px; }
  .acr { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; color: var(--text-2); }
  .acv { font-weight: 700; color: var(--text); }
  .favs { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
  .fav { display: flex; align-items: center; gap: 9px; padding: 13px; border-radius: 13px; background: rgba(255, 255, 255, 0.045); text-align: left; }
  .fav.on { background: var(--soft); box-shadow: inset 0 0 0 1.5px var(--line); }
  .fi { font-size: 16px; }
  .fn { font-size: 12px; font-weight: 600; }
</style>
