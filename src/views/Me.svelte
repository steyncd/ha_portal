<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E, SCENES } from "../lib/entities";
  import { n, dur } from "../lib/format";
  import { toast } from "../lib/toast.svelte";
  import Spark from "../lib/components/Spark.svelte";

  const scoreColor = (v: number | null) => (v == null ? "var(--muted)" : v >= 85 ? "var(--success)" : v >= 70 ? "var(--acc)" : v >= 55 ? "var(--warning)" : "var(--error)");
  const ringBg = (v: number | null, c: string) => `conic-gradient(${c} ${v ?? 0}%,rgba(255,255,255,.10) 0)`;

  const readiness = $derived(ha.num(E.ouraReadiness));
  const sleepScore = $derived(ha.num(E.ouraSleepScore));
  const activityScore = $derived(ha.num(E.ouraActivityScore));
  const tempDev = $derived(ha.num(E.ouraTempDev));

  // trend deltas vs 7-day average
  let hist = $state<Record<string, { t: number; v: number }[]>>({});
  const avg = (a: { t: number; v: number }[]) => (a.length ? a.reduce((s, d) => s + d.v, 0) / a.length : null);
  function delta(id: string, cur: number | null) {
    const a = avg(hist[id] ?? []);
    if (a == null || cur == null) return null;
    return Math.round(cur - a);
  }
  const scores = $derived([
    { id: E.ouraSleepScore, name: "Sleep", val: sleepScore, sub: "last night" },
    { id: E.ouraReadiness, name: "Readiness", val: readiness, sub: "balanced" },
    { id: E.ouraActivityScore, name: "Activity", val: activityScore, sub: "today" },
  ]);

  // plain-language headline insight
  const insight = $derived.by(() => {
    if (tempDev != null && Math.abs(tempDev) >= 0.5) return { icon: "🌡️", text: "Body temperature is elevated — an easy day is wise; watch for illness." };
    if (readiness != null && readiness >= 85 && (sleepScore ?? 0) >= 80) return { icon: "⚡", text: "Fully recovered and well-slept — a great day to push harder." };
    if ((sleepScore ?? 100) < 70) return { icon: "😴", text: "Sleep came up short last night — keep today light and get to bed early." };
    if ((readiness ?? 100) < 70) return { icon: "🌿", text: "Readiness is below your norm — prioritise recovery and hydration." };
    return { icon: "🙂", text: "Balanced recovery across the board — steady as she goes." };
  });

  const band = (norm: number) => (norm >= 0.8 ? "var(--success)" : norm >= 0.55 ? "var(--acc)" : "var(--warning)");
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const signals = $derived.by(() => {
    const hr = ha.num(E.ouraRestingHR), hrv = ha.num(E.ouraSleepHRV), eff = ha.num(E.ouraEfficiency),
      spo2 = ha.num(E.ouraSpo2), dev = tempDev, sl = sleepScore, act = activityScore;
    return [
      { k: "Resting HR", v: hr != null ? `${n(hr)} bpm` : "—", norm: hr != null ? clamp((70 - hr) / 25) : 0 },
      { k: "HRV", v: hrv != null ? `${n(hrv)} ms` : "—", norm: hrv != null ? clamp(hrv / 70) : 0 },
      { k: "Sleep efficiency", v: eff != null ? `${n(eff)}%` : "—", norm: eff != null ? clamp(eff / 100) : 0 },
      { k: "Blood oxygen", v: spo2 != null ? `${n(spo2)}%` : "—", norm: spo2 != null ? clamp((spo2 - 90) / 10) : 0 },
      { k: "Body temp", v: dev != null ? `${n(dev, 1)}°` : "—", norm: dev != null ? clamp(1 - Math.abs(dev) / 1) : 0 },
      { k: "Sleep balance", v: sl != null ? `${n(sl)}` : "—", norm: sl != null ? clamp(sl / 100) : 0 },
      { k: "Activity balance", v: act != null ? `${n(act)}` : "—", norm: act != null ? clamp(act / 100) : 0 },
    ];
  });

  // Apple-style Move / Exercise / Steps rings
  const steps = $derived(ha.num(E.ouraSteps));
  const stepsGoal = $derived(ha.num("input_number.oura_steps_goal") ?? 8000);
  const moveP = $derived(clamp((ha.num(E.ouraActiveCal) ?? 0) / Math.max(1, ha.num(E.ouraTargetCal) ?? 500)) * 100);
  // ---- today so far + coffee ----
  const hm = (hours: number | null) => { if (hours == null) return "—"; const h = Math.floor(hours); const m = Math.round((hours - h) * 60); return `${h}:${String(m).padStart(2, "0")}`; };
  const hhmm = (iso: string) => { const d = new Date(iso.replace(" ", "T")); return isNaN(+d) ? iso : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  const coffeesMine = $derived(ha.num(E.coffeeLog) ?? 0);
  const coffeeEvents = $derived(((ha.attr(E.coffeeLog, "events") as { i: number; ts: string; who: string }[] | undefined) ?? []).slice().reverse());
  const coffeeTotal = $derived((ha.attr(E.coffeeLog, "total") as number | undefined) ?? coffeeEvents.length);
  const roomsToday = $derived([
    { name: "Study", h: ha.num(E.meStudyTime) },
    { name: "Kitchen", h: ha.num(E.meKitchenTime) },
    { name: "Lounge", h: ha.num(E.meLoungeTime) },
  ]);
  const roomMax = $derived(Math.max(1, ...roomsToday.map((r) => r.h ?? 0)));
  const WHO = [{ k: "me", label: "Mine" }, { k: "mandri", label: "Mandri" }, { k: "guest", label: "Guest" }] as const;
  function flagCoffee(i: number, who: "me" | "mandri" | "guest") { ha.coffeeFlag(i, who); toast.show(who === "me" ? "Marked as yours" : who === "mandri" ? "Marked as Mandri's" : "Marked as guest"); }

  const exMin = $derived((ha.num(E.ouraMedActivityMin) ?? 0) + (ha.num(E.ouraHighActivityMin) ?? 0));
  const exP = $derived(clamp(exMin / 30) * 100);
  const stepP = $derived(steps != null ? clamp(steps / stepsGoal) * 100 : 0);
  // Apple-activity ring palette (kept local — not part of the Aurora token set).
  const RINGS = $derived([
    { p: moveP, color: "#fb2d55", r: 42, label: "Move" },
    { p: exP, color: "#a3f335", r: 32, label: "Exercise" },
    { p: stepP, color: "#2fe6de", r: 22, label: "Steps" },
  ]);
  const dash = (p: number, r: number) => { const c = 2 * Math.PI * r; return `${(p / 100) * c} ${c}`; };

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

  // Sleep hypnogram — stage-over-time. Oura only exposes per-stage totals (no
  // per-epoch data), so lay them out in a canonical cycle order (deep early,
  // REM later) with each occurrence weighted so the totals match the real night.
  const HYP = $derived.by(() => {
    const real: Record<string, number> = {
      Deep: ha.num(E.ouraDeep) ?? 0, REM: ha.num(E.ouraRem) ?? 0,
      Light: ha.num(E.ouraLightSleep) ?? 0, Awake: ha.num(E.ouraAwake) ?? 0,
    };
    const tot = real.Deep + real.REM + real.Light + real.Awake || 1;
    const seq: [string, number][] = [
      ["Light", 1], ["Deep", 2], ["Light", 1], ["REM", 1], ["Light", 1], ["Deep", 1.4],
      ["Light", 1], ["Awake", 0.4], ["REM", 1.3], ["Light", 1.2], ["Deep", 0.6], ["Light", 1],
      ["REM", 1.4], ["Light", 1], ["Awake", 0.5], ["REM", 1.1],
    ];
    const wsum: Record<string, number> = { Deep: 0, REM: 0, Light: 0, Awake: 0 };
    seq.forEach(([nm, w]) => (wsum[nm] += w));
    const laneIdx: Record<string, number> = { Awake: 0, REM: 1, Light: 2, Deep: 3 };
    const col: Record<string, string> = { Awake: "rgba(255,255,255,.28)", REM: "#22d3ee", Light: "#7dd3fc", Deep: "#6366f1" };
    let x = 0;
    const segs: { x: number; w: number; lane: number; col: string }[] = [];
    for (const [nm, w] of seq) {
      const frac = wsum[nm] ? (w / wsum[nm]) * (real[nm] / tot) : 0;
      if (frac > 0.001) segs.push({ x, w: frac, lane: laneIdx[nm], col: col[nm] });
      x += frac;
    }
    return { segs, lanes: ["Awake", "REM", "Light", "Deep"] };
  });

  // last workout
  const workout = $derived.by(() => {
    const type = ha.state(E.ouraWorkoutType);
    if (!type || type === "unknown" || type === "unavailable") return null;
    return {
      type: type.charAt(0).toUpperCase() + type.slice(1),
      intensity: ha.state(E.ouraWorkoutIntensity) ?? "—",
      duration: dur((ha.num(E.ouraWorkoutDuration) ?? 0) * 60),
      distance: ha.num(E.ouraWorkoutDistance),
      calories: ha.num(E.ouraWorkoutCalories),
    };
  });
  const wIcon = (t: string) => ({ walking: "🚶", running: "🏃", cycling: "🚴", swimming: "🏊", workout: "🏋️" } as Record<string, string>)[t.toLowerCase()] ?? "🏅";

  const notifs = $derived([
    { id: "input_boolean.oura_readiness_actions_enabled", icon: "🌅", name: "Readiness-aware morning" },
    { id: "input_boolean.oura_activity_nudge_enabled", icon: "🚶", name: "Evening activity nudge" },
    { id: "input_boolean.door_open_alerts_enabled", icon: "🚪", name: "Door-open alerts" },
    { id: "input_boolean.printer_ink_notifications", icon: "🖨️", name: "Printer ink low" },
  ].filter((x) => ha.exists(x.id)));

  let sleepTrend = $state<{ t: number; v: number }[]>([]);
  let stepsTrend = $state<{ t: number; v: number }[]>([]);
  onMount(async () => {
    sleepTrend = await ha.history(E.ouraSleepScore, 24 * 7);
    stepsTrend = await ha.history(E.ouraSteps, 24 * 7);
    const [rd, ac] = await Promise.all([ha.history(E.ouraReadiness, 24 * 7), ha.history(E.ouraActivityScore, 24 * 7)]);
    hist = { [E.ouraSleepScore]: sleepTrend, [E.ouraReadiness]: rd, [E.ouraActivityScore]: ac };
  });

  const favs = [
    { id: "switch.main_bedroom_lamp", icon: "🛏️", name: "Bedroom" },
    { id: "light.study_lamp", icon: "📖", name: "Study" },
    { id: SCENES[0].id, icon: "🌙", name: "Goodnight", scene: true },
    { id: SCENES[3].id, icon: "☀️", name: "Morning", scene: true },
  ];
</script>

<div class="col">
  <div class="card card--hero profile">
    <span class="glow" style="--gc:var(--health)"></span>
    <span class="av">C</span>
    <div class="pi"><div class="pn">Christo</div><div class="ps">Admin · <span style="color:var(--success)">Home now</span> · Readiness {n(readiness)}</div></div>
    <div class="ring-batt"><span>💍</span> Oura <span class="rb">{n(ha.num(E.ouraRingBatt))}%</span></div>
  </div>

  <!-- headline insight -->
  <div class="card insight"><span class="ii">{insight.icon}</span><span class="it">{insight.text}</span></div>

  <!-- today so far -->
  <div class="card pad">
    <div class="rh"><span class="lb">Today so far</span><span class="sub">since wake</span></div>
    <div class="tsf">
      <div class="tstat"><div class="tsv">{coffeesMine}</div><div class="tsk">☕ Coffees</div></div>
      <div class="tstat"><div class="tsv">{hm(ha.num(E.meDeskTime))}</div><div class="tsk">💻 Desk time</div></div>
      <div class="tstat"><div class="tsv">{n(steps)}</div><div class="tsk">👟 Steps</div></div>
      <div class="tstat"><div class="tsv">{hm(ha.num(E.meTimeAway))}</div><div class="tsk">🚗 Time away</div></div>
    </div>
    <div class="rooms">
      <div class="roomshd">Rooms today</div>
      {#each roomsToday as r}
        <div class="roomrow"><span class="roomn">{r.name}</span><div class="roombar"><div class="roomfill" style="width:{((r.h ?? 0) / roomMax) * 100}%"></div></div><span class="roomv">{hm(r.h)}</span></div>
      {/each}
    </div>
  </div>

  <!-- coffee today (tap to reassign so it doesn't count as yours) -->
  <div class="card pad">
    <div class="rh"><span class="lb">☕ Coffee · today</span><span class="sub">{coffeesMine} yours · {coffeeTotal} made · tap to flag</span></div>
    {#if coffeeEvents.length}
      <div class="cflist">
        {#each coffeeEvents as c}
          <div class="cfrow">
            <span class="cft">{hhmm(c.ts)}</span>
            <div class="cfwho">
              {#each WHO as w}
                <button class="cfbtn" class:on={c.who === w.k} onclick={() => flagCoffee(c.i, w.k)}>{w.label}</button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {:else}<div class="sub">No coffees logged today yet.</div>{/if}
  </div>

  <div class="scores">
    {#each scores as s}
      {@const d = delta(s.id, s.val)}
      <div class="card sc">
        <div class="ring" style="background:{ringBg(s.val, scoreColor(s.val))}"><div class="rc" style="color:{scoreColor(s.val)}">{n(s.val)}</div></div>
        <div>
          <div class="scn">{s.name}{#if s.val != null && s.val >= 85}<span class="crown">👑</span>{/if}</div>
          <div class="scs">{s.sub}</div>
          {#if d != null && d !== 0}<div class="scd" style="color:{d > 0 ? 'var(--success)' : 'var(--warning)'}">{d > 0 ? "▲" : "▼"} {Math.abs(d)} vs 7-day avg</div>{:else}<div class="scd dim">– on your average</div>{/if}
        </div>
      </div>
    {/each}
  </div>

  <div class="two">
    <div class="card pad">
      <div class="rh"><span class="lb">Last night's sleep</span><span class="sub">{ha.state(E.ouraBedStart) ? "tracked" : "—"}</span></div>
      <div class="sd"><div class="sdur">{dur(ha.num(E.ouraTotalSleep))}</div><div class="sib">asleep · {dur(ha.num(E.ouraTimeInBed))} in bed</div></div>
      <svg class="hypno" viewBox="0 0 340 120" preserveAspectRatio="none">
        {#each HYP.lanes as name, i}
          <text x="0" y={8 + i * 28 + 12} class="hlbl">{name}</text>
          <line x1="46" x2="338" y1={8 + i * 28 + 8} y2={8 + i * 28 + 8} class="hguide" />
        {/each}
        {#each HYP.segs as s}
          <rect x={46 + s.x * 292} y={8 + s.lane * 28} width={Math.max(2, s.w * 292)} height="16" rx="4" fill={s.col} />
        {/each}
      </svg>
      <div class="stagekey">
        {#each stages as st}<div class="sk"><span class="skd" style="background:{st.color}"></span><span class="skn">{st.name}</span><span class="skv">{st.dur}</span></div>{/each}
      </div>
    </div>
    <div class="card pad">
      <div class="lb" style="margin-bottom:14px">Readiness contributors</div>
      <div class="sig">
        {#each signals as s}
          <div class="sigrow">
            <span class="sigk">{s.k}</span>
            <div class="sigtrack"><div class="sigfill" style="width:{s.norm * 100}%;background:{band(s.norm)}"></div></div>
            <span class="sigv">{s.v}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <div class="two">
    <div class="card pad">
      <div class="lb" style="margin-bottom:16px">Activity today</div>
      <div class="act">
        <svg class="rings" viewBox="0 0 100 100">
          {#each RINGS as r}
            <circle cx="50" cy="50" r={r.r} fill="none" stroke="rgba(255,255,255,.08)" stroke-width="7" />
            <circle cx="50" cy="50" r={r.r} fill="none" stroke={r.color} stroke-width="7" stroke-linecap="round"
              stroke-dasharray={dash(r.p, r.r)} transform="rotate(-90 50 50)" />
          {/each}
        </svg>
        <div class="acl">
          <div class="acr"><span style="color:#fb2d55">● Move</span><span class="acv">{n(ha.num(E.ouraActiveCal))} / {n(ha.num(E.ouraTargetCal))} kcal</span></div>
          <div class="acr"><span style="color:#a3f335">● Exercise</span><span class="acv">{n(exMin)} / 30 min</span></div>
          <div class="acr"><span style="color:#2fe6de">● Steps</span><span class="acv">{n(steps)} / {n(stepsGoal)}</span></div>
          <div class="acr"><span>Total burned</span><span class="acv">{n(ha.num(E.ouraTotalCal))} kcal</span></div>
        </div>
      </div>
    </div>

    {#if workout}
      <div class="card pad">
        <div class="rh"><span class="lb">Last workout</span><span class="sub">{n(ha.num(E.ouraWorkoutsToday))} today</span></div>
        <div class="wk">
          <span class="wkic">{wIcon(workout.type)}</span>
          <div><div class="wkt">{workout.type}</div><div class="wki">{workout.intensity} intensity</div></div>
        </div>
        <div class="wkgrid">
          <div><div class="wkv">{workout.duration}</div><div class="wkk">Duration</div></div>
          <div><div class="wkv">{workout.distance != null ? `${n(workout.distance / 1000, 2)} km` : "—"}</div><div class="wkk">Distance</div></div>
          <div><div class="wkv">{n(workout.calories)} kcal</div><div class="wkk">Energy</div></div>
        </div>
      </div>
    {:else}
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
    {/if}
  </div>

  <div class="two">
    <div class="card pad"><div class="rh"><span class="lb">Sleep score · 7 days</span></div><Spark data={sleepTrend} color="var(--acc2)" forceMax={100} height={80} /></div>
    <div class="card pad"><div class="rh"><span class="lb">Steps · 7 days</span><span class="sub">goal {n(stepsGoal)}</span></div><Spark data={stepsTrend} color="var(--orange)" height={80} /></div>
  </div>

  {#if notifs.length}
    <div class="card pad">
      <div class="lb" style="margin-bottom:6px">My notifications</div>
      {#each notifs as r}
        <div class="nrow"><span class="ni">{r.icon}</span><span class="nn">{r.name}</span><span class="nstate" class:on={ha.isOn(r.id)}>{ha.isOn(r.id) ? "On" : "Off"}</span></div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }
  .profile { padding: 22px 24px; display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
  .av { width: 64px; height: 64px; flex-shrink: 0; border-radius: 50%; background: var(--grad); display: grid; place-items: center; font-size: 24px; font-weight: 800; color: #07131c; }
  .pn { font-size: 22px; font-weight: 800; }
  .ps { font-size: 13px; color: var(--text-2); margin-top: 3px; }
  .pi { flex: 1; min-width: 0; }
  .ring-batt { display: flex; align-items: center; gap: 9px; padding: 9px 14px; border-radius: 999px; background: rgba(255, 255, 255, 0.05); font-size: 12.5px; color: var(--text-2); }
  .rb { font-weight: 700; color: var(--success); }
  .insight { display: flex; align-items: center; gap: 13px; padding: 15px 20px; }
  .ii { font-size: 22px; }
  .it { font-size: 13.5px; color: var(--text); font-weight: 500; }
  .scores { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  @media (max-width: 760px) { .scores { grid-template-columns: 1fr; } }
  .sc { padding: 20px 22px; display: flex; align-items: center; gap: 17px; }
  .ring { width: 82px; height: 82px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; }
  .rc { width: 63px; height: 63px; border-radius: 50%; background: #0b1017; display: grid; place-items: center; font-size: 23px; font-weight: 800; }
  .scn { font-size: 15px; font-weight: 700; }
  .scs { font-size: 12px; color: var(--muted); margin-top: 3px; }
  .scd { font-size: 11px; font-weight: 700; margin-top: 5px; }
  .scd.dim { color: var(--muted-2); font-weight: 500; }
  .two { display: grid; grid-template-columns: 1.25fr 1fr; gap: 14px; }
  @media (max-width: 820px) { .two { grid-template-columns: 1fr; } }
  .pad { padding: 22px; }
  .rh { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .sub { font-size: 12px; color: var(--dim); }
  /* today so far */
  .tsf { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  @media (max-width: 560px) { .tsf { grid-template-columns: repeat(2, 1fr); } }
  .tstat { padding: 13px 15px; border-radius: 14px; background: rgba(255, 255, 255, 0.04); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06); }
  .tsv { font-size: 22px; font-weight: 800; }
  .tsk { font-size: 11px; color: var(--muted); margin-top: 3px; }
  .rooms { margin-top: 16px; }
  .roomshd { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
  .roomrow { display: grid; grid-template-columns: 70px 1fr auto; align-items: center; gap: 12px; padding: 5px 0; }
  .roomn { font-size: 12.5px; color: var(--text-2); }
  .roombar { height: 8px; border-radius: 5px; background: rgba(255, 255, 255, 0.06); overflow: hidden; }
  .roomfill { height: 100%; border-radius: 5px; background: var(--orange, #fbbf24); }
  .roomv { font-size: 12px; font-weight: 700; color: var(--text-2); font-variant-numeric: tabular-nums; }
  /* coffee today */
  .cflist { display: flex; flex-direction: column; gap: 8px; }
  .cfrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 13px; border-radius: 12px; background: rgba(255, 255, 255, 0.04); }
  .cft { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .cfwho { display: flex; gap: 6px; }
  .cfbtn { padding: 6px 12px; border-radius: 9px; font-size: 12px; font-weight: 700; color: var(--muted); background: rgba(255, 255, 255, 0.05); }
  .cfbtn.on { color: var(--acc); background: color-mix(in srgb, var(--acc) 20%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--acc) 45%, transparent); }
  .sd { display: flex; align-items: flex-end; gap: 13px; margin-bottom: 15px; }
  .sdur { font-size: 40px; font-weight: 800; letter-spacing: -1.5px; line-height: 0.9; }
  .sib { font-size: 12px; color: var(--muted); padding-bottom: 6px; }
  .crown { margin-left: 5px; font-size: 13px; }
  .hypno { width: 100%; height: 104px; display: block; margin: 4px 0 12px; }
  .hlbl { fill: var(--muted); font-size: 9px; font-weight: 700; letter-spacing: 0.04em; }
  .hguide { stroke: rgba(255, 255, 255, 0.06); stroke-width: 1; }
  .stagekey { display: grid; grid-template-columns: 1fr 1fr; gap: 9px 18px; }
  .sk { display: flex; align-items: center; gap: 8px; }
  .skd { width: 9px; height: 9px; flex-shrink: 0; border-radius: 3px; }
  .skn { font-size: 12px; color: var(--text-2); flex: 1; }
  .skv { font-size: 12px; font-weight: 700; }
  .sig { display: flex; flex-direction: column; gap: 11px; }
  .sigrow { display: flex; align-items: center; gap: 11px; }
  .sigk { font-size: 12px; color: var(--text-2); width: 108px; flex-shrink: 0; }
  .sigtrack { flex: 1; height: 7px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
  .sigfill { height: 100%; border-radius: 999px; transition: width 0.5s ease; }
  .sigv { font-size: 12px; font-weight: 700; width: 62px; text-align: right; flex-shrink: 0; }
  .act { display: flex; align-items: center; gap: 20px; }
  .rings { width: 108px; height: 108px; flex-shrink: 0; }
  .acl { flex: 1; display: flex; flex-direction: column; gap: 10px; }
  .acr { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; color: var(--text-2); }
  .acv { font-weight: 700; color: var(--text); }
  .wk { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
  .wkic { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; font-size: 24px; background: var(--soft); box-shadow: inset 0 0 0 1px var(--line); }
  .wkt { font-size: 17px; font-weight: 800; }
  .wki { font-size: 12px; color: var(--muted); text-transform: capitalize; }
  .wkgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  @media (max-width: 430px) { .wkgrid { grid-template-columns: 1fr; } }
  .wkgrid > div { padding: 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.04); }
  .wkv { font-size: 15px; font-weight: 800; }
  .wkk { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
  .favs { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
  .fav { display: flex; align-items: center; gap: 9px; padding: 13px; border-radius: 13px; background: rgba(255, 255, 255, 0.045); text-align: left; }
  .fav.on { background: var(--soft); box-shadow: inset 0 0 0 1.5px var(--line); }
  .fi { font-size: 16px; }
  .fn { font-size: 12px; font-weight: 600; }
  .nrow { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
  .nrow:last-child { border-bottom: none; }
  .ni { font-size: 16px; width: 22px; text-align: center; }
  .nn { flex: 1; font-size: 13px; }
  .nstate { font-size: 11px; font-weight: 700; color: var(--muted); padding: 4px 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.06); }
  .nstate.on { color: var(--success); background: color-mix(in srgb, var(--success) 15%, transparent); }
</style>
