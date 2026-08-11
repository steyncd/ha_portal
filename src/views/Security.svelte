<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E, ACCESS } from "../lib/entities";
  import { deriveZones, type Zone } from "../lib/zones";
  import { toast } from "../lib/toast.svelte";
  import { clock } from "../lib/format";
  import StatusChip from "../lib/components/StatusChip.svelte";
  import { alarmHero, alarmLog, PROV_ENTITIES, type LogEntry } from "../lib/provenance.svelte";

  // This IS the Security screen now — the nav used to land on SecurityHub, which
  // was a read-only board with no arm/disarm and no zone controls, and the page
  // that could actually do those things sat behind a second click. onnav is here
  // so the spokes the hub used to own are still reachable from one place.
  let { onnav }: { onnav?: (id: string) => void } = $props();

  // Shared with SecurityHub via src/lib/provenance.svelte.ts. A bare "Armed" is
  // the state that hid the 2026-08-09 incident: it was true, and it was true
  // because a config reload had done it. So the line always carries since-when
  // and who.
  const hero = $derived(alarmHero());

  // The audit trail, a week deep. This is the "who disarmed at 04:00" answer, and
  // it is on THIS page rather than a separate board because the page you use to
  // change the alarm is the page you check when you doubt it.
  let provLog = $state<{ t: number; s: string }[]>([]);
  let machineLog = $state<{ t: number; s: string }[]>([]);
  onMount(async () => {
    // historyStates, not history: both are TEXT entities — a JSON blob and an ISO
    // timestamp — and history coerces to numbers.
    if (ha.exists(PROV_ENTITIES.prov)) provLog = await ha.historyStates(PROV_ENTITIES.prov, 168);
    if (ha.exists(PROV_ENTITIES.machine)) machineLog = await ha.historyStates(PROV_ENTITIES.machine, 168);
  });
  const auditLog = $derived<LogEntry[]>(alarmLog(provLog, machineLog));

  // ---- areas ----
  const homeState = $derived(ha.state(E.alarmHome));
  const beamsState = $derived(ha.state(E.alarmBeamsArea));

  const homeMode = (s: string | undefined) =>
    s === "armed_home" ? "home" : s === "armed_away" ? "away" : s === "armed_night" ? "night"
    : s === "triggered" ? "triggered" : s === "arming" || s === "pending" ? "arming" : "off";
  const beamsMode = (s: string | undefined) => (s?.startsWith("armed") ? "arm" : s === "triggered" ? "triggered" : "off");

  const HOME_MODES = [
    { mode: "off", label: "Off", icon: "🔓" },
    { mode: "home", label: "Home", icon: "🏠" },
    { mode: "away", label: "Away", icon: "🛡️" },
    { mode: "night", label: "Night", icon: "🌙" },
  ];
  const BEAMS_MODES = [
    { mode: "off", label: "Off", icon: "🔓" },
    { mode: "arm", label: "Arm", icon: "📡" },
  ];

  // two-tap confirm: first tap arms `pending`, second tap on the same control fires.
  let pending = $state<string | null>(null);
  let timer: ReturnType<typeof setTimeout>;
  function fire(area: string, mode: string) {
    if (mode === "off") { ha.disarm(area); return "Disarmed"; }
    if (mode === "home") { ha.armHome(area); return "Arming · Home"; }
    if (mode === "night") { ha.armNight(area); return "Arming · Night"; }
    ha.armAway(area); return "Arming"; // away / beams-arm
  }
  function tap(area: string, mode: string, current: string) {
    if (mode === current) return; // already in this mode
    const key = `${area}:${mode}`;
    clearTimeout(timer);
    if (pending === key) {
      pending = null;
      const label = fire(area, mode);
      toast.show(`${area === E.alarmHome ? "Home" : "Beams"} · ${label}`);
    } else {
      pending = key;
      timer = setTimeout(() => (pending = null), 3000);
    }
  }

  // ---- zones ----
  // Derived from Home Assistant, so all 32 the panel exposes appear. The old
  // hand-typed list had 25, which hid seven zones including 030 (Beam · Garage).
  const ZONES = $derived(deriveZones(Object.keys(ha.entities)));
  const activeZones = $derived(ZONES.filter((z) => ha.isOn(z.id)));
  const bypassedZones = $derived(ZONES.filter((z) => ha.isOn(z.bypass)));

  // A pressed bypass button does not show up in the bypass sensor instantly, so
  // a press is recorded here as an intention, the row says it is waiting, and
  // NOTHING IS RE-SENT — re-sending is what flapped this panel historically.
  //
  // FIVE minutes, and the number is measured, twice, because the first
  // measurement was misleading:
  //
  //   zone 022  press 17:08:28 -> sensor 'on' 17:08:42      14 seconds
  //   zone 032  press 18:23:12 -> sensor 'on' 18:26:31   3m 19 seconds
  //
  // I set this to 60s on the first figure alone, watched zone 032 for a minute,
  // saw nothing, and concluded the zone was not configured on the panel. It was:
  // the bypass landed two minutes after I stopped looking. The fast case is a
  // press that happens while the integration is already polling; the slow case is
  // the honest worst case to design for.
  //
  // So the timeout is generous, and running out of it means "the panel has not
  // said yes" — NOT "it failed". Nothing is re-sent either way.
  const PANEL_WAIT = 300_000;
  type Waiting = { want: boolean; at: number };
  let waiting = $state<Record<string, Waiting>>({});
  let now = $state(Date.now());
  $effect(() => {
    const t = setInterval(() => (now = Date.now()), 2_000);
    return () => clearInterval(t);
  });

  /** Elapsed time on a pending press. A button disabled for up to five minutes
   *  with a static label reads as broken; a counter reads as waiting. */
  function waited(z: Zone): string {
    const w = waiting[z.n];
    if (!w) return "";
    const secs = Math.max(0, Math.round((now - w.at) / 1000));
    return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m${String(secs % 60).padStart(2, "0")}`;
  }

  /** "pending" while the panel has not caught up, "stale" once it has given up. */
  function pendingState(z: Zone): "none" | "pending" | "stale" {
    const w = waiting[z.n];
    if (!w) return "none";
    if (ha.isOn(z.bypass) === w.want) return "none";   // panel agreed; nothing to say
    return now - w.at > PANEL_WAIT ? "stale" : "pending";
  }
  // Clearing a settled intention has to happen outside the derivation above —
  // writing to `waiting` from inside it would re-trigger it.
  $effect(() => {
    for (const [n, w] of Object.entries(waiting)) {
      const z = ZONES.find((x) => x.n === n);
      if (z && ha.isOn(z.bypass) === w.want) {
        const { [n]: _drop, ...rest } = waiting;
        waiting = rest;
      }
    }
  });

  // zones grid: search + filter + sort
  let zoneFilter = $state<"all" | "open" | "bypassed" | "clear">("all");
  let zoneSort = $state<"number" | "status" | "name">("number");
  let zoneQ = $state("");
  const zonesView = $derived.by(() => {
    const rank = (z: Zone) => (ha.isOn(z.id) ? 0 : ha.isOn(z.bypass) ? 1 : 2);
    const q = zoneQ.trim().toLowerCase();
    const f = ZONES.filter((z) => {
      if (q && !z.label.toLowerCase().includes(q) && !z.n.includes(q)) return false;
      const a = ha.isOn(z.id), b = ha.isOn(z.bypass);
      return zoneFilter === "all" ? true : zoneFilter === "open" ? a : zoneFilter === "bypassed" ? b : !a && !b;
    });
    return [...f].sort((x, y) =>
      zoneSort === "name" ? x.label.localeCompare(y.label)
      : zoneSort === "status" ? (rank(x) - rank(y)) || x.n.localeCompare(y.n)
      : x.n.localeCompare(y.n),
    );
  });

  // Both areas disarmed is the condition the auto-restore automation checks
  // (Alarm - Auto-Restore Bypassed Zones), so the note below has to test the same
  // thing rather than just the house.
  const fullyDisarmed = $derived(homeState === "disarmed" && beamsState === "disarmed");

  // Bypassing REMOVES protection, so it asks twice. Restoring puts protection
  // back, so it does not — the confirm step belongs on the direction that can
  // leave a door unwatched, not on the one that fixes it.
  let confirmZone = $state<string | null>(null);
  let confirmTimer: ReturnType<typeof setTimeout>;

  function setBypass(z: Zone, want: boolean) {
    const btn = want ? z.bypassBtn : z.unbypassBtn;
    if (!btn) { toast.show(`${z.label}: the panel exposes no ${want ? "bypass" : "restore"} control`); return; }
    // Already there, or already asked — pressing again is what flapped this panel
    // historically, so both cases are a no-op rather than a second command.
    if (ha.isOn(z.bypass) === want) return;
    if (pendingState(z) === "pending") return;
    waiting = { ...waiting, [z.n]: { want, at: Date.now() } };
    ha.mockSet(z.bypass, want ? "on" : "off");           // dev mode only
    ha.pressButton(btn);                                  // live
    toast.show(`${z.label} · ${want ? "bypassing" : "restoring"} — waiting for the panel`);
  }

  function tapZone(z: Zone) {
    const bypassed = ha.isOn(z.bypass);
    if (bypassed) { setBypass(z, false); return; }        // restoring needs no confirm
    if (confirmZone === z.n) {
      clearTimeout(confirmTimer);
      confirmZone = null;
      setBypass(z, true);
      return;
    }
    confirmZone = z.n;
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => (confirmZone = null), 4000);
  }

  /** Restore every bypassed zone, one command at a time. */
  async function restoreAll() {
    const list = [...bypassedZones];
    for (const z of list) {
      setBypass(z, false);
      // Spaced deliberately. Firing 30 button presses into this panel in one tick
      // is the same mistake as the old retry loops.
      await new Promise((r) => setTimeout(r, 700));
    }
  }

  // ---- hero status (driven by the Home area) ----
  const meta = $derived.by(() => {
    switch (homeState) {
      case "armed_away": return { label: "Armed · Away", icon: "🛡️", color: "var(--success)" };
      case "armed_home": return { label: "Armed · Home", icon: "🏠", color: "var(--success)" };
      case "armed_night": return { label: "Armed · Night", icon: "🌙", color: "var(--success)" };
      case "triggered": return { label: "ALARM", icon: "🚨", color: "var(--error)" };
      case "arming": case "pending": return { label: "Arming…", icon: "⏳", color: "var(--warning)" };
      case "disarmed": return { label: "Disarmed", icon: "🔓", color: "var(--warning)" };
      default: return { label: "Unknown", icon: "❔", color: "var(--muted)" };
    }
  });
  const acOk = $derived(ha.state(E.alarmAcPower) === "on");

  function testSiren() {
    if (confirm("Sound the alarm siren for 5 seconds?")) {
      ha.script("script.test_siren");
      toast.show("Testing siren…");
    }
  }

  // ---- 24h event timeline (from real state-change history) ----
  type Ev = { t: number; label: string; color: string; icon: string };
  let events = $state<Ev[]>([]);
  const winStart = Date.now() - 24 * 3600_000;
  onMount(async () => {
    const doors = ACCESS.slice(0, 5);
    const [al, ...zs] = await Promise.all([
      ha.historyStates(E.alarmHome, 24),
      ...doors.map((d) => ha.historyStates(d.id, 24)),
    ]);
    const evs: Ev[] = [];
    for (const e of al)
      evs.push({
        t: e.t,
        icon: "🛡️",
        label: `Alarm ${e.s.replace(/_/g, " ")}`,
        color: e.s.startsWith("armed") ? "var(--success)" : e.s === "triggered" ? "var(--error)" : "var(--warning)",
      });
    zs.forEach((hist, i) => {
      for (const e of hist) if (e.s === "on") evs.push({ t: e.t, icon: doors[i].icon, label: doors[i].label, color: "var(--water)" });
    });
    events = evs.filter((e) => e.t >= winStart).sort((a, b) => b.t - a.t);
  });
  const pos = (t: number) => Math.max(0, Math.min(100, ((t - winStart) / (24 * 3600_000)) * 100));
</script>

<div class="col">
  <!-- status hero -->
  <div class="card card--hero status">
    <span class="glow" style="--gc:var(--security)"></span>
    <div class="left">
      <span class="orb" style="background:color-mix(in srgb,{meta.color} 15%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,{meta.color} 40%,transparent)">{meta.icon}</span>
      <div>
        <div class="sl" style="color:{meta.color}">{meta.label}</div>
        <div class="ss">{activeZones.length} active · {bypassedZones.length} bypassed · AC {acOk ? "OK" : "lost"}</div>
      </div>
    </div>
    <div class="rgt">
      <div class="beamschip" class:on={beamsMode(beamsState) === "arm"}>📡 Beams {beamsMode(beamsState) === "arm" ? "armed" : "off"}</div>
      <button class="testsiren" onclick={testSiren}>🚨 Test siren</button>
    </div>
  </div>

  <!-- who changed it, and when. Amber ONLY for the unexplained case. -->
  <div class="card prov" class:warn={hero.warn}>
    <span class="pl">{hero.line}</span>
    <span class="ps">{hero.sub}</span>
    {#if hero.limit}<span class="plim">{hero.limit}</span>{/if}
  </div>

  <!-- active-zones indicator -->
  <div class="card ind" class:alert={activeZones.length > 0}>
    <span class="idot" class:live={activeZones.length > 0}></span>
    {#if activeZones.length}
      <span class="itxt"><strong>{activeZones.length} zone{activeZones.length > 1 ? "s" : ""} active now</strong> · {activeZones.map((z) => z.label).join(", ")}</span>
    {:else}
      <span class="itxt">All zones clear</span>
    {/if}
  </div>

  <!-- 24h activity timeline -->
  <div class="card pad">
    <div class="rh"><span class="lb">Activity · last 24h</span><span class="sub">{events.length} event{events.length === 1 ? "" : "s"}</span></div>
    <div class="tl">
      <div class="tlaxis"><span>24h ago</span><span>18h</span><span>12h</span><span>6h</span><span>now</span></div>
      <div class="tltrack">
        {#each events as e}
          <span class="tlmark" style="left:{pos(e.t)}%;color:{e.color};background:{e.color}" title="{e.label} · {clock(e.t)}"></span>
        {/each}
      </div>
    </div>
    {#if events.length}
      <div class="tllist">
        {#each events.slice(0, 5) as e}
          <div class="tle"><span class="tli">{e.icon}</span><span class="tll">{e.label}</span><span class="tlt num">{clock(e.t)}</span></div>
        {/each}
      </div>
    {:else}
      <div class="note">No security events in the last 24 hours.</div>
    {/if}
  </div>

  <!-- area controls -->
  <div class="areas">
    <div class="card pad">
      <div class="ah"><span class="an">🏠 Home area</span><span class="asub">Huis · {meta.label}</span></div>
      <div class="seg">
        {#each HOME_MODES as m}
          {@const cur = homeMode(homeState)}
          {@const key = `${E.alarmHome}:${m.mode}`}
          <button class="segbtn" class:active={cur === m.mode} class:confirm={pending === key} onclick={() => tap(E.alarmHome, m.mode, cur)}>
            <span class="si">{m.icon}</span><span class="slbl">{pending === key ? "Confirm?" : m.label}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="card pad">
      <div class="ah"><span class="an">📡 Beams area</span><span class="asub">Perimeter · {beamsMode(beamsState) === "arm" ? "Armed" : "Off"}</span></div>
      <div class="seg">
        {#each BEAMS_MODES as m}
          {@const cur = beamsMode(beamsState)}
          {@const key = `${E.alarmBeamsArea}:${m.mode}`}
          <button class="segbtn" class:active={cur === m.mode} class:confirm={pending === key} onclick={() => tap(E.alarmBeamsArea, m.mode, cur)}>
            <span class="si">{m.icon}</span><span class="slbl">{pending === key ? "Confirm?" : m.label}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- zones: status of all of them, and bypass / restore -->
  <div class="card pad">
    <div class="rh">
      <span class="lb">Zones · {zonesView.length} of {ZONES.length}</span>
      {#if bypassedZones.length}
        <button class="restoreall" onclick={restoreAll}>Restore all {bypassedZones.length}</button>
      {/if}
    </div>

    <div class="zctl">
      <input class="zq" type="search" placeholder="Search {ZONES.length} zones" bind:value={zoneQ} autocomplete="off" />
      <div class="zseg">
        {#each [["all", "All"], ["open", "Open"], ["bypassed", "Bypassed"], ["clear", "Clear"]] as [k, l]}
          <button class:on={zoneFilter === k} onclick={() => (zoneFilter = k as typeof zoneFilter)}>
            {l}{#if k === "bypassed" && bypassedZones.length} {bypassedZones.length}{/if}{#if k === "open" && activeZones.length} {activeZones.length}{/if}
          </button>
        {/each}
      </div>
      <div class="zseg">
        {#each [["number", "No."], ["status", "Status"], ["name", "A–Z"]] as [k, l]}
          <button class:on={zoneSort === k} onclick={() => (zoneSort = k as typeof zoneSort)}>{l}</button>
        {/each}
      </div>
    </div>

    <div class="zgrid">
      {#if zonesView.length}
        {#each zonesView as z (z.n)}
          {@const open = ha.isOn(z.id)}
          {@const bypassed = ha.isOn(z.bypass)}
          {@const gone = !ha.available(z.id)}
          {@const pend = pendingState(z)}
          <div class="zrow" class:bypassed class:open>
            <span class="zno">{z.n}</span>
            <span class="zn">{z.label}</span>
            <!-- Three states, not two: a bypassed zone is neither open nor clear,
                 and showing it as "Clear" would be the most misleading thing on
                 this screen. -->
            <StatusChip
              state={gone ? "off" : bypassed ? "warn" : open ? "warn" : "ok"}
              label={gone ? "No data" : bypassed ? "Bypassed" : open ? "Open" : "Clear"}
            />
            <button
              class="byp"
              class:on={bypassed}
              class:confirm={confirmZone === z.n}
              disabled={pend === "pending" || !(bypassed ? z.unbypassBtn : z.bypassBtn)}
              onclick={() => tapZone(z)}
            >
              {#if pend === "pending"}Waiting {waited(z)}
              {:else if bypassed}Restore
              {:else if confirmZone === z.n}Confirm bypass
              {:else}Bypass{/if}
            </button>
            {#if pend === "stale"}
              <span class="zwarn">
                The panel has not confirmed this after five minutes. The command
                was sent and has not been re-sent; check the keypad for the real
                state rather than pressing again.
              </span>
            {/if}
          </div>
        {/each}
      {:else}<div class="note">No zones match{zoneQ ? ` “${zoneQ}”` : " this filter"}.</div>{/if}
    </div>

    <div class="note">
      A bypassed zone is excluded while the alarm is armed — it will not report and
      will not trigger. Bypass asks twice; restoring does not. Both press the
      panel's own per-zone controls, which confirm in anything from fifteen
      seconds to about three minutes — measured on this panel, not estimated.
      <!-- The auto-restore rule is not optional information. Without it you
           bypass a zone, come back, and find it un-bypassed with no explanation
           on this screen. The behaviour differs by armed state, so the sentence
           does too. -->
      {#if fullyDisarmed}
        <strong>The alarm is fully disarmed, so anything left bypassed for an hour
        is restored automatically</strong> and you get a notification — the next
        arming starts clean.
      {:else}
        <strong>The alarm is armed, so a bypass you set now stays for this whole
        armed session.</strong> It is only auto-restored once both the house and
        the beams are disarmed, and then only after an hour.
      {/if}
    </div>
  </div>

  <!-- the audit trail -->
  <div class="card pad">
    <div class="rh">
      <span class="lb">Every arm and disarm · last 7 days</span>
      <span class="sub">{auditLog.length} event{auditLog.length === 1 ? "" : "s"}</span>
    </div>
    {#if auditLog.length}
      <div class="alog">
        {#each auditLog as e (e.t + e.text)}
          <div class="arow" class:warn={e.warn} class:machine={e.kind === "machine"}>
            <span class="awhen">{clock(e.t)}</span>
            <span class="awhat">{e.text}</span>
          </div>
        {/each}
      </div>
      <div class="note">
        Reloads and restarts sit in the same list deliberately — a reload one second
        before a disarm with no actor is the diagnosis, and it should be one glance.
      </div>
    {:else}
      <div class="note">
        Nothing recorded yet. feature_alarm_provenance.yaml writes its first entry
        on the next arm or disarm.
      </div>
    {/if}
  </div>

  <!-- the spokes the hub used to own -->
  {#if onnav}
    <div class="card pad">
      <div class="lb" style="margin-bottom:11px">Elsewhere</div>
      <div class="spokes">
        <button onclick={() => onnav?.("cameras")}>📷 Cameras<span>six cameras, events and snapshots</span></button>
        <button onclick={() => onnav?.("traffic")}>🚗 The road outside<span>vehicles and people counted at the sidewalk</span></button>
        <button onclick={() => onnav?.("timeline")}>🕒 Timeline<span>who was where, and when</span></button>
      </div>
    </div>
  {/if}

  <!-- access & openings -->
  <div class="card pad">
    <div class="lb" style="margin-bottom:13px">Access &amp; openings <span class="ro">read-only</span></div>
    <div class="access">
      {#each ACCESS as o}
        {@const open = ha.state(o.id) === "on"}
        <div class="arow"><span class="aic">{o.icon}</span><div class="al"><div class="anm">{o.label}</div><div class="ast"><StatusChip state={open ? "warn" : "ok"} label={open ? "Open" : "Closed"} /></div></div></div>
      {/each}
    </div>
  </div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }
  .status { padding: 22px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .left { display: flex; align-items: center; gap: 16px; }
  .orb { width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; font-size: 26px; flex-shrink: 0; }
  .sl { font-size: 22px; font-weight: 800; letter-spacing: -0.4px; }
  .ss { font-size: 13px; color: var(--dim); }
  .beamschip { padding: 9px 14px; border-radius: 999px; background: rgba(255, 255, 255, 0.05); font-size: 12.5px; font-weight: 600; color: var(--text-2); }
  .rgt { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
  .testsiren { padding: 8px 13px; border-radius: 999px; font-size: 12px; font-weight: 700; color: var(--error); background: color-mix(in srgb, var(--error) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--error) 30%, transparent); }
  .testsiren:hover { background: color-mix(in srgb, var(--error) 20%, transparent); }
  .beamschip.on { background: color-mix(in srgb, var(--success) 16%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--success) 40%, transparent); color: var(--text); }

  .ind { display: flex; align-items: center; gap: 12px; padding: 14px 18px; font-size: 13px; color: var(--text-2); }
  .ind.alert { background: linear-gradient(180deg, color-mix(in srgb, var(--warning) 12%, transparent), rgba(255, 255, 255, 0.02)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 30%, transparent); }
  .ind.alert .itxt { color: var(--text); }
  .idot { width: 9px; height: 9px; border-radius: 50%; background: var(--success); box-shadow: 0 0 8px var(--success); flex-shrink: 0; }
  .idot.live { background: var(--warning); box-shadow: 0 0 8px var(--warning); animation: pulse 1.6s ease-in-out infinite; }

  .tl { margin-bottom: 4px; }
  .tlaxis { display: flex; justify-content: space-between; font-size: 10px; color: var(--muted-2); margin-bottom: 5px; }
  .tltrack { position: relative; height: 20px; border-radius: 999px; background: rgba(255, 255, 255, 0.05); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06); }
  .tlmark { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 9px; height: 9px; border-radius: 50%; box-shadow: 0 0 6px currentColor; }
  .tllist { margin-top: 12px; display: flex; flex-direction: column; gap: 2px; }
  .tle { display: flex; align-items: center; gap: 11px; padding: 7px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
  .tle:last-child { border-bottom: none; }
  .tli { font-size: 14px; width: 20px; text-align: center; }
  .tll { flex: 1; font-size: 12.5px; color: var(--text-2); }
  .tlt { font-size: 11.5px; color: var(--muted-2); }
  .areas { display: grid; grid-template-columns: 1.6fr 1fr; gap: 14px; }
  @media (max-width: 720px) { .areas { grid-template-columns: 1fr; } }
  .pad { padding: 20px; }
  .ah { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
  .an { font-size: 15px; font-weight: 700; }
  .asub { font-size: 12px; color: var(--dim); }
  .seg { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 7px; }
  .segbtn { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 13px 6px; border-radius: 13px; background: rgba(255, 255, 255, 0.05); color: var(--text-2); transition: background 0.15s, box-shadow 0.15s; }
  .segbtn:hover { background: rgba(255, 255, 255, 0.09); }
  .segbtn.active { background: var(--grad); color: #0b1017; box-shadow: 0 6px 18px -8px var(--glow); }
  .segbtn.confirm { background: color-mix(in srgb, var(--warning) 22%, transparent); box-shadow: inset 0 0 0 1.5px var(--warning); color: var(--text); animation: pulse 1.1s ease-in-out infinite; }
  .si { font-size: 17px; }
  .slbl { font-size: 12px; font-weight: 700; }

  .rh { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 13px; }
  .restoreall { font-size: 11.5px; font-weight: 600; color: var(--acc2); padding: 6px 12px; border-radius: 9px; background: rgba(255, 255, 255, 0.05); }
  .restoreall:hover { background: rgba(255, 255, 255, 0.1); }
  /* Search on its own row, then the two segmented controls side by side —
     four filter chips plus three sort chips plus a search box does not fit on a
     phone in one line. */
  .zctl { display: grid; gap: 8px; margin-bottom: 12px; }
  .zctl > .zseg { justify-self: start; }
  .zseg { display: flex; gap: 2px; padding: 3px; border-radius: 10px; background: rgba(255, 255, 255, 0.05); }
  .zseg button { padding: 6px 11px; border-radius: 7px; font-size: 11.5px; font-weight: 600; color: var(--muted); }
  .zseg button.on { background: var(--grad); color: #07131c; }
  .alog { display: grid; gap: 1px; margin-top: 9px; max-height: 340px; overflow-y: auto; }
  .arow { display: flex; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--line, rgba(255,255,255,0.06)); font-size: 12.5px; }
  .arow:last-child { border-bottom: 0; }
  .awhen { flex: none; width: 52px; color: var(--text-3); font-variant-numeric: tabular-nums; }
  .awhat { color: var(--text); }
  .arow.machine .awhat { color: var(--text-3); }
  .arow.warn .awhat { color: var(--warning); font-weight: 700; }
  .prov { padding: 13px 16px; display: grid; gap: 3px; }
  .prov.warn { background: color-mix(in srgb, var(--warning) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 34%, transparent); }
  .pl { font-size: 14px; font-weight: 700; color: var(--text); }
  .prov.warn .pl { color: var(--warning); }
  .ps { font-size: 12px; color: var(--text-2); }
  .plim { font-size: 11px; color: var(--text-3); }
  .spokes { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px; }
  .spokes button {
    text-align: left; padding: 11px 13px; border-radius: 10px;
    background: rgba(255, 255, 255, 0.05); font-size: 13px; font-weight: 700;
    color: var(--text); min-height: 44px; display: grid; gap: 2px;
  }
  .spokes button:hover { background: rgba(255, 255, 255, 0.1); }
  .spokes button span { font-size: 11.5px; font-weight: 500; color: var(--text-3); }
  .zgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(268px, 1fr)); gap: 8px; }
  .zq {
    width: 100%; padding: 9px 11px; border-radius: 9px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--text); font-size: 13px; min-height: 40px;
  }
  .zno {
    flex: none; font-size: 10.5px; font-weight: 700; color: var(--text-3);
    font-variant-numeric: tabular-nums; min-width: 24px;
  }
  .zrow.open { background: color-mix(in srgb, var(--warning) 13%, transparent); }
  .zwarn {
    flex-basis: 100%; font-size: 11px; line-height: 1.45;
    color: var(--warning); margin-top: 4px; text-wrap: pretty;
  }
  .byp.confirm { background: color-mix(in srgb, var(--warning) 40%, transparent); color: #fff; }
  .byp:disabled { opacity: 0.5; }
  .zrow { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.04); }
  .zrow.bypassed { opacity: 0.55; background: color-mix(in srgb, var(--warning) 9%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 26%, transparent); }
  .zn { font-size: 12.5px; color: var(--text); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .zrow :global(.status) { flex-shrink: 0; }
  .byp { flex-shrink: 0; padding: 6px 11px; border-radius: 8px; background: rgba(255, 255, 255, 0.08); font-size: 11px; font-weight: 700; color: var(--text-2); }
  @media (max-width: 640px) { .byp { min-height: 40px; padding: 8px 14px; } }
  .byp:hover { background: rgba(255, 255, 255, 0.15); color: var(--text); }
  .byp.on { background: color-mix(in srgb, var(--warning) 26%, transparent); color: #fff; }
  .note { font-size: 11.5px; color: var(--muted-2); margin-top: 12px; }

  .ro { font-size: 10px; color: var(--muted-2); font-weight: 600; margin-left: 6px; }
  .access { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
  .arow { display: flex; align-items: center; gap: 12px; padding: 13px 15px; border-radius: 14px; background: rgba(255, 255, 255, 0.045); }
  .aic { width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center; font-size: 17px; background: rgba(255, 255, 255, 0.06); flex-shrink: 0; }
  .anm { font-size: 13px; font-weight: 600; }
  .ast { font-size: 11.5px; font-weight: 700; }
</style>
