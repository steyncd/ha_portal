<script lang="ts">
  // Focus / Work (Me → Focus) — desk & meeting time, app usage, movement,
  // presence and storage, from the MacBook + iPhone Companion-app sensors and
  // the derived history_stats sensors (packages/feature_device_analytics.yaml).
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E } from "../lib/entities";
  import { n } from "../lib/format";
  import StatusChip from "../lib/components/StatusChip.svelte";

  // Oura consolidation — recovery + activity from the ring, alongside work/movement.
  const scoreColor = (v: number | null) => (v == null ? "var(--muted)" : v >= 85 ? "var(--success)" : v >= 70 ? "var(--acc)" : v >= 55 ? "var(--warning)" : "var(--error)");
  const ringBg = (v: number | null, c: string) => `conic-gradient(${c} ${v ?? 0}%,rgba(255,255,255,.10) 0)`;
  const ouraScores = $derived([
    { name: "Readiness", v: ha.num(E.ouraReadiness) },
    { name: "Sleep", v: ha.num(E.ouraSleepScore) },
    { name: "Activity", v: ha.num(E.ouraActivityScore) },
  ]);
  const ouraSteps = $derived(ha.num(E.ouraSteps));
  const ouraActiveCal = $derived(ha.num(E.ouraActiveCal));
  const ouraRestingHR = $derived(ha.num(E.ouraRestingHR));
  const ouraRingBatt = $derived(ha.num(E.ouraRingBatt));

  const activeToday = $derived(ha.num("sensor.macbook_active_today"));
  const meetingToday = $derived(ha.num("sensor.macbook_meeting_time_today"));
  const awayToday = $derived(ha.num("sensor.phone_away_today"));
  const steps = $derived(ha.num("sensor.hello_steps"));
  const floors = $derived(ha.num("sensor.hello_floors_ascended"));
  const distance = $derived(ha.num("sensor.hello_distance"));
  const activity = $derived(ha.state("sensor.hello_activity"));
  const curApp = $derived(ha.state("sensor.christos_macbook_frontmost_app"));
  const macActive = $derived(ha.isOn("binary_sensor.christos_macbook_active"));
  const onCall = $derived(ha.isOn("binary_sensor.macbook_in_meeting"));
  const focus = $derived(ha.isOn("binary_sensor.hello_focus"));
  const displays = $derived(ha.num("sensor.christos_macbook_displays"));
  const whereMac = $derived(ha.state("sensor.christos_macbook_geocoded_location"));
  const wherePhone = $derived(ha.state("sensor.hello_geocoded_location"));
  const phoneStorage = $derived(ha.num("sensor.hello_storage"));
  const macStorage = $derived(ha.num("sensor.christos_macbook_storage"));

  const fmtH = (h: number | null) => {
    if (h == null) return "—";
    const hr = Math.floor(h);
    const m = Math.round((h - hr) * 60);
    return hr ? `${hr}h ${m}m` : `${m}m`;
  };
  const actIcon = (a: string | undefined) =>
    ({ walking: "🚶", running: "🏃", automotive: "🚗", cycling: "🚴", stationary: "🧍" } as Record<string, string>)[
      (a ?? "").toLowerCase()
    ] ?? "🧍";

  // App usage today, derived from frontmost-app string history.
  let apps = $state<{ app: string; min: number }[]>([]);
  onMount(async () => {
    const hist = await ha.historyStates("sensor.christos_macbook_frontmost_app", 24);
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    const since = midnight.getTime();
    const now = Date.now();
    const sorted = [...hist].sort((a, b) => a.t - b.t);
    const acc: Record<string, number> = {};
    for (let i = 0; i < sorted.length; i++) {
      const end = i + 1 < sorted.length ? sorted[i + 1].t : now;
      if (end <= since) continue;
      const start = Math.max(sorted[i].t, since);
      const app = sorted[i].s;
      if (!app || /unknown|unavailable|none/i.test(app)) continue;
      acc[app] = (acc[app] ?? 0) + Math.max(0, end - start);
    }
    apps = Object.entries(acc).map(([app, ms]) => ({ app, min: ms / 60000 })).sort((a, b) => b.min - a.min).slice(0, 6);
  });
  const appMax = $derived(Math.max(1, ...apps.map((a) => a.min)));
</script>

<div class="col">
  <!-- now -->
  <div class="card status">
    <StatusChip state={macActive ? "ok" : "off"} label={macActive ? "At the Mac" : "Mac idle"} />
    {#if onCall}<StatusChip state="warn" label="On a call" />{/if}
    {#if focus}<StatusChip state="idle" label="Focus on" />{/if}
    {#if (displays ?? 0) > 1}<StatusChip state="ok" label="Docked" />{/if}
    {#if curApp && !/unknown|unavailable/i.test(curApp)}<span class="curapp">▸ {curApp}</span>{/if}
  </div>

  <!-- today -->
  <div class="tiles">
    <div class="t"><div class="tv">{fmtH(activeToday)}</div><div class="tk">💻 Active today</div></div>
    <div class="t"><div class="tv">{fmtH(meetingToday)}</div><div class="tk">🎥 On calls</div></div>
    <div class="t"><div class="tv">{n(ouraSteps ?? steps)}</div><div class="tk">👟 Steps</div></div>
    <div class="t"><div class="tv">{fmtH(awayToday)}</div><div class="tk">🚗 Away today</div></div>
  </div>

  <!-- Oura consolidation -->
  <div class="card pad">
    <div class="rh"><span class="lb">Oura · today</span><span class="sub">💍 {ouraRingBatt != null ? `${n(ouraRingBatt)}%` : "—"}</span></div>
    <div class="oura">
      <div class="oscores">
        {#each ouraScores as s}
          <div class="osc">
            <div class="oring" style="background:{ringBg(s.v, scoreColor(s.v))}"><div class="oringc" style="color:{scoreColor(s.v)}">{n(s.v)}</div></div>
            <div class="osl">{s.name}</div>
          </div>
        {/each}
      </div>
      <div class="ostats">
        <div class="ost"><div class="osv">{n(ouraSteps)}</div><div class="osk">Oura steps</div></div>
        <div class="ost"><div class="osv">{n(ouraActiveCal)}</div><div class="osk">active kcal</div></div>
        <div class="ost"><div class="osv">{ouraRestingHR != null ? `${n(ouraRestingHR)}` : "—"}</div><div class="osk">resting HR</div></div>
      </div>
    </div>
  </div>

  <!-- app usage -->
  <div class="card pad">
    <div class="rh"><span class="lb">App usage · today</span><span class="sub">MacBook foreground time</span></div>
    {#if apps.length}
      <div class="apps">
        {#each apps as a}
          <div class="approw">
            <span class="an">{a.app}</span>
            <div class="atrack"><div class="afill" style="width:{(a.min / appMax) * 100}%"></div></div>
            <span class="av">{fmtH(a.min / 60)}</span>
          </div>
        {/each}
      </div>
    {:else}
      <div class="sub">No foreground-app history yet today.</div>
    {/if}
  </div>

  <div class="two">
    <!-- movement -->
    <div class="card pad">
      <div class="rh"><span class="lb">Phone motion</span><span class="sub">{actIcon(activity)} {activity ?? "—"}</span></div>
      <div class="mv">
        <div class="m"><div class="mv2">{n(floors)}</div><div class="mk">floors ↑</div></div>
        <div class="m"><div class="mv2">{distance != null ? `${n(distance, 1)}` : "—"}</div><div class="mk">km</div></div>
      </div>
    </div>

    <!-- presence & storage -->
    <div class="card pad">
      <div class="rh"><span class="lb">Presence &amp; storage</span></div>
      <div class="pl">
        <div class="pr"><span class="pk">📱 Phone</span><span class="pv">{wherePhone ?? "—"}</span></div>
        <div class="pr"><span class="pk">💻 Mac</span><span class="pv">{whereMac ?? "—"}</span></div>
        <div class="pr"><span class="pk">💾 Phone free</span><span class="pv">{phoneStorage != null ? `${n(phoneStorage, 1)} GB` : "—"}</span></div>
        <div class="pr"><span class="pk">💾 Mac free</span><span class="pv">{macStorage != null ? `${n(macStorage, 1)} GB` : "—"}</span></div>
      </div>
    </div>
  </div>

  <p class="foot">Meeting detection (camera/mic) and low-storage alerts run in Home Assistant. Announcements will honour Focus / on-a-call once gating is enabled.</p>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }
  .card { background: var(--card, rgba(255, 255, 255, 0.04)); border: 1px solid var(--line, rgba(255, 255, 255, 0.08)); border-radius: 18px; }
  .status { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 16px 18px; }
  .curapp { font-size: 13px; font-weight: 600; color: var(--text-2, var(--muted)); }
  .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  @media (max-width: 620px) { .tiles { grid-template-columns: repeat(2, 1fr); } }
  .t { padding: 16px 18px; border-radius: 16px; background: var(--card, rgba(255, 255, 255, 0.04)); border: 1px solid var(--line, rgba(255, 255, 255, 0.08)); }
  .tv { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .tk { font-size: 11px; color: var(--muted); margin-top: 4px; }
  .pad { padding: 20px; }
  .rh { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; }
  .lb { font-size: 13px; font-weight: 700; }
  .sub { font-size: 12px; color: var(--muted); }
  .apps { display: flex; flex-direction: column; gap: 9px; }
  .approw { display: grid; grid-template-columns: 130px 1fr auto; align-items: center; gap: 12px; }
  .an { font-size: 12.5px; color: var(--text-2, var(--text)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .atrack { height: 8px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
  .afill { height: 100%; border-radius: 999px; background: var(--grad, var(--acc)); }
  .av { font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; min-width: 48px; text-align: right; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 720px) { .two { grid-template-columns: 1fr; } }
  .oura { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
  .oscores { display: flex; gap: 16px; }
  .osc { text-align: center; }
  .oring { width: 60px; height: 60px; border-radius: 50%; display: grid; place-items: center; }
  .oringc { width: 46px; height: 46px; border-radius: 50%; background: var(--bg, #0b1017); display: grid; place-items: center; font-size: 16px; font-weight: 800; }
  .osl { font-size: 10.5px; color: var(--muted); margin-top: 5px; }
  .ostats { display: flex; gap: 20px; flex: 1; justify-content: flex-end; }
  .ost { text-align: center; }
  .osv { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .osk { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; margin-top: 3px; }
  @media (max-width: 620px) { .oura { justify-content: center; } .ostats { justify-content: center; } }
  .mv { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .m { text-align: center; padding: 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.035); }
  .mv2 { font-size: 20px; font-weight: 800; }
  .mk { font-size: 10.5px; color: var(--muted); margin-top: 3px; text-transform: uppercase; letter-spacing: 0.03em; }
  .pl { display: flex; flex-direction: column; gap: 10px; }
  .pr { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
  .pk { font-size: 12.5px; color: var(--muted); flex: none; }
  .pv { font-size: 12.5px; font-weight: 600; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .foot { font-size: 11.5px; color: var(--muted); margin: 0; }
</style>
