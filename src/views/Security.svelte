<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { E, ZONES, ACCESS } from "../lib/entities";
  import { toast } from "../lib/toast.svelte";

  const armTarget = $derived(ha.exists(E.alarmArmTarget) ? E.alarmArmTarget : E.alarmMain);
  const alarmState = $derived(ha.state(E.alarmMain) ?? ha.state(armTarget));
  const armed = $derived(!!alarmState && alarmState.startsWith("armed"));

  const meta = $derived.by(() => {
    switch (alarmState) {
      case "armed_away": return { label: "Armed · Away", icon: "🛡️", color: "var(--success)" };
      case "armed_home": case "armed_night": return { label: "Armed · Home", icon: "🛡️", color: "var(--success)" };
      case "triggered": return { label: "ALARM", icon: "🚨", color: "var(--error)" };
      case "arming": case "pending": return { label: "Arming…", icon: "⏳", color: "var(--warning)" };
      case "disarmed": return { label: "Disarmed", icon: "🔓", color: "var(--warning)" };
      default: return { label: "Unknown", icon: "❔", color: "var(--muted)" };
    }
  });

  let confirm = $state(false);
  let timer: ReturnType<typeof setTimeout>;
  function tap() {
    if (!confirm) { confirm = true; clearTimeout(timer); timer = setTimeout(() => (confirm = false), 3000); return; }
    clearTimeout(timer); confirm = false;
    if (armed) { ha.disarm(armTarget); toast.show("Disarmed"); }
    else { ha.armAway(armTarget); toast.show("Arming away"); }
  }

  const openZones = $derived(ZONES.filter((z) => ha.state(z.id) === "on"));
  const activity = $derived([
    { icon: "🔓", color: "var(--warning)", title: `Alarm ${alarmState ?? "—"}`, sub: "current state", t: "now" },
    { icon: "📷", color: "var(--acc)", title: `Gate · ${ha.state(E.gateDetections) ?? 0} detections`, sub: "today", t: "" },
    { icon: "🚶", color: "var(--water)", title: `${ha.state(E.pedestriansToday) ?? 0} pedestrians`, sub: "sidewalk today", t: "" },
    { icon: "🔌", color: ha.state(E.alarmAcPower) === "on" ? "var(--success)" : "var(--error)", title: `AC power ${ha.state(E.alarmAcPower) === "on" ? "OK" : "lost"}`, sub: "alarm panel", t: "" },
  ]);
</script>

<div class="col">
  <div class="card status">
    <div class="left">
      <span class="orb" style="background:color-mix(in srgb,{meta.color} 15%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,{meta.color} 40%,transparent)">{meta.icon}</span>
      <div><div class="sl" style="color:{meta.color}">{meta.label}</div><div class="ss">{openZones.length} active · {ZONES.length} monitored · AC power {ha.state(E.alarmAcPower) === "on" ? "OK" : "lost"}</div></div>
    </div>
    <button class="armbtn" class:armed onclick={tap}>{confirm ? "Tap to confirm" : armed ? "Disarm" : "Arm Away"}</button>
  </div>

  <div class="card pad">
    <div class="lb" style="margin-bottom:4px">Activity · last 24h</div>
    {#each activity as e}
      <div class="log"><span class="lic" style="background:color-mix(in srgb,{e.color} 16%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,{e.color} 34%,transparent)">{e.icon}</span><div class="lt"><div class="ltt">{e.title}</div><div class="lts">{e.sub}</div></div></div>
    {/each}
  </div>

  <div class="card pad">
    <div class="lb" style="margin-bottom:13px">Access & openings <span class="ro">read-only</span></div>
    <div class="access">
      {#each ACCESS as o}
        {@const open = ha.state(o.id) === "on"}
        <div class="arow"><span class="aic">{o.icon}</span><div class="al"><div class="an">{o.label}</div><div class="ast" style="color:{open ? 'var(--warning)' : 'var(--success)'}">{open ? "Open / active" : "Closed"}</div></div></div>
      {/each}
    </div>
    <div class="note">No smart locks/openers connected — showing live door & beam status. Add cover/lock entities to control them here.</div>
  </div>

  <div class="card pad">
    <div class="lb" style="margin-bottom:13px">Zones · {openZones.length ? `${openZones.length} active` : "all clear"}</div>
    <div class="zgrid">
      {#each ZONES as z}
        {@const active = ha.state(z.id) === "on"}
        <div class="zc"><span class="zd" class:active></span><span class="zn">{z.label}</span></div>
      {/each}
    </div>
  </div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; max-width: 1180px; margin: 0 auto; }
  .status { padding: 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .left { display: flex; align-items: center; gap: 16px; }
  .orb { width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; font-size: 26px; }
  .sl { font-size: 22px; font-weight: 800; letter-spacing: -0.4px; }
  .ss { font-size: 13px; color: var(--dim); }
  .armbtn { padding: 14px 24px; border-radius: 14px; background: var(--grad); color: #0b1017; font-size: 14px; font-weight: 700; }
  .armbtn.armed { background: color-mix(in srgb, var(--error) 22%, transparent); color: #fecdd6; }
  .pad { padding: 20px; }
  .ro { font-size: 10px; color: var(--muted-2); font-weight: 600; margin-left: 6px; }
  .log { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
  .lic { width: 33px; height: 33px; flex-shrink: 0; border-radius: 9px; display: grid; place-items: center; font-size: 15px; }
  .ltt { font-size: 13px; font-weight: 600; }
  .lts { font-size: 11px; color: var(--muted); }
  .access { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
  .arow { display: flex; align-items: center; gap: 12px; padding: 13px 15px; border-radius: 14px; background: rgba(255, 255, 255, 0.045); }
  .aic { width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center; font-size: 17px; background: rgba(255, 255, 255, 0.06); }
  .an { font-size: 13px; font-weight: 600; }
  .ast { font-size: 11.5px; font-weight: 700; }
  .note { font-size: 11.5px; color: var(--muted-2); margin-top: 12px; }
  .zgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 9px; }
  .zc { display: flex; align-items: center; gap: 9px; padding: 11px 13px; border-radius: 12px; background: rgba(255, 255, 255, 0.04); }
  .zd { width: 8px; height: 8px; border-radius: 50%; background: var(--success); box-shadow: 0 0 7px var(--success); flex-shrink: 0; }
  .zd.active { background: var(--warning); box-shadow: 0 0 7px var(--warning); }
  .zn { font-size: 12px; color: var(--text-2); }
</style>
