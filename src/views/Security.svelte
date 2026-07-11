<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { E, ALARM_ZONES, ACCESS, type AlarmZone } from "../lib/entities";
  import { toast } from "../lib/toast.svelte";

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
  const activeZones = $derived(ALARM_ZONES.filter((z) => ha.isOn(z.id)));
  const bypassedZones = $derived(ALARM_ZONES.filter((z) => ha.isOn(z.bypass)));

  function toggleBypass(z: AlarmZone) {
    const bypassed = ha.isOn(z.bypass);
    const next = !bypassed;
    ha.mockSet(z.bypass, next ? "on" : "off"); // reflect in mock
    ha.pressButton(next ? z.bypassBtn : z.unbypassBtn); // live
    toast.show(`${z.label} ${next ? "bypassed" : "restored"}`);
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
</script>

<div class="col">
  <!-- status hero -->
  <div class="card status">
    <div class="left">
      <span class="orb" style="background:color-mix(in srgb,{meta.color} 15%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,{meta.color} 40%,transparent)">{meta.icon}</span>
      <div>
        <div class="sl" style="color:{meta.color}">{meta.label}</div>
        <div class="ss">{activeZones.length} active · {bypassedZones.length} bypassed · AC {acOk ? "OK" : "lost"}</div>
      </div>
    </div>
    <div class="beamschip" class:on={beamsMode(beamsState) === "arm"}>📡 Beams {beamsMode(beamsState) === "arm" ? "armed" : "off"}</div>
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

  <!-- zones + per-zone bypass -->
  <div class="card pad">
    <div class="rh">
      <span class="lb">Zones · {activeZones.length} active · {bypassedZones.length} bypassed</span>
      {#if bypassedZones.length}<button class="restoreall" onclick={() => { bypassedZones.forEach((z) => toggleBypass(z)); }}>Restore all</button>{/if}
    </div>
    <div class="zgrid">
      {#each ALARM_ZONES as z}
        {@const active = ha.isOn(z.id)}
        {@const bypassed = ha.isOn(z.bypass)}
        <div class="zrow" class:bypassed>
          <span class="zd" class:active></span>
          <span class="zn">{z.label}</span>
          <span class="zstate">{active ? "Active" : "Clear"}</span>
          <button class="byp" class:on={bypassed} onclick={() => toggleBypass(z)}>{bypassed ? "Restore" : "Bypass"}</button>
        </div>
      {/each}
    </div>
    <div class="note">Bypassed zones are excluded from arming until restored. Changes press the alarm's per-zone bypass / unbypass controls.</div>
  </div>

  <!-- access & openings -->
  <div class="card pad">
    <div class="lb" style="margin-bottom:13px">Access &amp; openings <span class="ro">read-only</span></div>
    <div class="access">
      {#each ACCESS as o}
        {@const open = ha.state(o.id) === "on"}
        <div class="arow"><span class="aic">{o.icon}</span><div class="al"><div class="anm">{o.label}</div><div class="ast" style="color:{open ? 'var(--warning)' : 'var(--success)'}">{open ? "Open / active" : "Closed"}</div></div></div>
      {/each}
    </div>
  </div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; max-width: 1180px; margin: 0 auto; }
  .status { padding: 22px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .left { display: flex; align-items: center; gap: 16px; }
  .orb { width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; font-size: 26px; flex-shrink: 0; }
  .sl { font-size: 22px; font-weight: 800; letter-spacing: -0.4px; }
  .ss { font-size: 13px; color: var(--dim); }
  .beamschip { padding: 9px 14px; border-radius: 999px; background: rgba(255, 255, 255, 0.05); font-size: 12.5px; font-weight: 600; color: var(--text-2); }
  .beamschip.on { background: color-mix(in srgb, var(--success) 16%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--success) 40%, transparent); color: var(--text); }

  .ind { display: flex; align-items: center; gap: 12px; padding: 14px 18px; font-size: 13px; color: var(--text-2); }
  .ind.alert { background: linear-gradient(180deg, color-mix(in srgb, var(--warning) 12%, transparent), rgba(255, 255, 255, 0.02)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 30%, transparent); }
  .ind.alert .itxt { color: var(--text); }
  .idot { width: 9px; height: 9px; border-radius: 50%; background: var(--success); box-shadow: 0 0 8px var(--success); flex-shrink: 0; }
  .idot.live { background: var(--warning); box-shadow: 0 0 8px var(--warning); animation: pulse 1.6s ease-in-out infinite; }

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
  .zgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; }
  .zrow { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.04); }
  .zrow.bypassed { opacity: 0.55; background: color-mix(in srgb, var(--warning) 9%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 26%, transparent); }
  .zd { width: 8px; height: 8px; border-radius: 50%; background: var(--success); box-shadow: 0 0 7px var(--success); flex-shrink: 0; }
  .zd.active { background: var(--warning); box-shadow: 0 0 7px var(--warning); }
  .zn { font-size: 12.5px; color: var(--text); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .zstate { font-size: 10.5px; color: var(--muted-2); flex-shrink: 0; }
  .byp { flex-shrink: 0; padding: 6px 11px; border-radius: 8px; background: rgba(255, 255, 255, 0.08); font-size: 11px; font-weight: 700; color: var(--text-2); }
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
