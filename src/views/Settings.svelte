<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { prefs, PALETTE, type AccentId } from "../lib/prefs.svelte";
  import { NAV } from "../lib/nav";
  import { toast } from "../lib/toast.svelte";
  import { HASS_URL } from "../lib/config";
  import Toggle from "../lib/components/Toggle.svelte";

  let { ontv }: { ontv: () => void } = $props();

  const haHost = (() => { try { return new URL(HASS_URL).host; } catch { return HASS_URL; } })();
  function signOut() {
    localStorage.removeItem("ha_portal_tokens");
    toast.show("Signing out…");
    setTimeout(() => location.reload(), 400);
  }

  // Health goals (input_number helpers). min/max/step read from the entity, with fallbacks.
  const healthGoals = [
    { id: "input_number.oura_steps_goal", icon: "👟", name: "Daily steps goal", min: 1000, max: 20000, step: 500, unit: "" },
    { id: "input_number.oura_readiness_low_threshold", icon: "🔋", name: "Low-readiness alert below", min: 50, max: 90, step: 1, unit: "" },
    { id: "input_number.oura_temp_deviation_threshold", icon: "🌡️", name: "Illness temp deviation", min: 0.1, max: 1.5, step: 0.1, unit: "°C" },
  ].filter((g) => ha.exists(g.id));
  function goalBound(id: string, attr: string, fallback: number) {
    const v = ha.attr(id, attr); return typeof v === "number" ? v : fallback;
  }

  function setAccent(id: AccentId) { prefs.accent = id; prefs.apply(); prefs.save(); }
  function setHue(e: Event) { prefs.hue = Number((e.target as HTMLInputElement).value); prefs.accent = "custom"; prefs.apply(); prefs.save(); }
  function setDensity(d: "comfortable" | "compact") { prefs.density = d; prefs.save(); }
  function toggleMotion() { prefs.motion = !prefs.motion; prefs.apply(); prefs.save(); }
  function toggleView(id: string) { prefs.viewsOn = { ...prefs.viewsOn, [id]: !prefs.viewsOn[id] }; prefs.save(); }

  const people = [
    { id: "person.christo_steyn", name: "Christo", role: "ADMIN", initial: "C", color: "var(--acc)" },
    { id: "person.mandri_steyn", name: "Mandri", role: "ADULT", initial: "M", color: "#f472b6" },
    { id: "person.hello_liam_en_eben", name: "Liam & Eben", role: "KIDS", initial: "L", color: "var(--water)" },
  ];

  const autoArm = [
    { id: "input_boolean.alarm_auto_arm_away", name: "Auto-arm · Away", sub: "when everyone leaves" },
    { id: "input_boolean.alarm_auto_arm_stay", name: "Auto-arm · Stay", sub: "at night" },
    { id: "input_boolean.alarm_auto_arm_beams", name: "Auto-arm · Beams", sub: "perimeter beams" },
    { id: "input_boolean.alarm_auto_disarm", name: "Auto-disarm", sub: "on arrival / morning" },
    { id: "input_boolean.alarm_auto_disarm_beams", name: "Auto-disarm · Beams", sub: "morning" },
  ];
  const schedule = [
    { id: "input_datetime.alarm_auto_arm_away_time", name: "Arm away" },
    { id: "input_datetime.alarm_auto_arm_stay_time", name: "Arm stay" },
    { id: "input_datetime.alarm_auto_arm_time_beams", name: "Arm beams" },
    { id: "input_datetime.alarm_auto_disarm_time", name: "Disarm" },
    { id: "input_datetime.alarm_auto_disarm_time_beams", name: "Disarm beams" },
  ];
  const notifs = [
    { id: "input_boolean.frigate_person_detection_enabled", icon: "🚶", name: "Person detection" },
    { id: "input_boolean.frigate_vehicle_detection_enabled", icon: "🚗", name: "Vehicle detection" },
    { id: "input_boolean.door_open_alerts_enabled", icon: "🚪", name: "Door-open alerts" },
    { id: "input_boolean.printer_ink_notifications", icon: "🖨️", name: "Printer ink low" },
    { id: "input_boolean.irrigation_intelligence_enabled", icon: "🌿", name: "Smart irrigation" },
  ];
  const automations = [
    { id: "input_boolean.borehole_night_guard_enabled", icon: "🕳️", name: "Borehole night guard" },
    { id: "input_boolean.frigate_watchdog_enabled", icon: "📷", name: "Frigate self-heal" },
    { id: "input_boolean.light_watchdog_enabled", icon: "💡", name: "Light watchdog" },
    { id: "input_boolean.appliance_finish_alerts_enabled", icon: "🔔", name: "Appliance-done alerts" },
    { id: "input_boolean.window_advisor_enabled", icon: "🪟", name: "Window advisor" },
    { id: "input_boolean.fridge_open_alert_enabled", icon: "🧊", name: "Fridge-open alert" },
    { id: "input_boolean.desk_comfort_enabled", icon: "🪑", name: "Desk comfort" },
    { id: "input_boolean.evening_lights_enabled", icon: "🌆", name: "Evening lights" },
    { id: "input_boolean.night_kitchen_light_enabled", icon: "🌙", name: "Night kitchen light" },
    { id: "input_boolean.holiday_mode", icon: "🏖️", name: "Holiday mode" },
  ];
  const bypassOpts = $derived((ha.attr("input_select.zone_bypass_selector", "options") as string[]) ?? []);
  const bypassVal = $derived(ha.state("input_select.zone_bypass_selector") ?? "");

  const msgPresets = ["Dinner's ready! 🍽️", "Time to leave 🚗", "Goodnight all 🌙", "I'm home 🏠", "Load-shedding soon ⚡", "Movie starting 🎬"];
  let msgText = $state("");
  function send(text: string) { if (!text.trim()) return; ha.notify(text); toast.show(`"${text}" sent`); msgText = ""; }

  const configurableViews = NAV.filter((v) => !["overview", "security", "settings"].includes(v.id));
  function timeVal(id: string) { return (ha.state(id) ?? "").slice(0, 5); }
</script>

<div class="col">
  <!-- account -->
  <h2 class="section">Account</h2>
  <div class="card pad acct">
    <span class="aav">C</span>
    <div class="ainfo">
      <div class="anm2">Christo Steyn</div>
      <div class="asub2">Home Assistant · {haHost}</div>
    </div>
    <button class="signout" onclick={signOut}>Sign out</button>
  </div>

  <!-- appearance -->
  <h2 class="section">Appearance</h2>
  <div class="card pad">
    <div class="lb" style="margin-bottom:14px">Accent colour</div>
    <div class="swatches">
      {#each PALETTE as p}
        <button class="sw" style="background:linear-gradient(135deg,{p.a2},{p.a})" class:active={prefs.accent === p.id} onclick={() => setAccent(p.id)} title={p.name}></button>
      {/each}
      <div class="hue">
        <span class="hl">Custom hue</span>
        <input type="range" min="0" max="360" value={prefs.hue} oninput={setHue} class:active={prefs.accent === "custom"} />
      </div>
    </div>
  </div>
  <div class="two">
    <div class="card pad">
      <div class="lb" style="margin-bottom:12px">Density</div>
      <div class="seg">
        <button class:active={prefs.density === "comfortable"} onclick={() => setDensity("comfortable")}>Comfortable</button>
        <button class:active={prefs.density === "compact"} onclick={() => setDensity("compact")}>Compact</button>
      </div>
    </div>
    <div class="card pad row"><div><div class="rn">Motion & aurora</div><div class="rs">Drifting glow + flows</div></div><Toggle on={prefs.motion} onchange={toggleMotion} /></div>
  </div>

  <!-- people -->
  <h2 class="section">Household</h2>
  <div class="card pad">
    <div class="lb" style="margin-bottom:12px">People & profiles</div>
    {#each people as p}
      {@const home = ha.state(p.id) === "home"}
      <div class="prow">
        <span class="pav" style="background:{p.color}">{p.initial}</span>
        <div class="pl"><div class="pn">{p.name}</div><div class="pst" style="color:{home ? 'var(--success)' : 'var(--muted)'}">{home ? "Home" : ha.exists(p.id) ? "Away" : "—"}</div></div>
        <span class="role">{p.role}</span>
      </div>
    {/each}
  </div>

  <!-- alarm automations + schedule -->
  <h2 class="section">Security &amp; alarm</h2>
  <div class="two">
    <div class="card pad">
      <div class="lb" style="margin-bottom:6px">Alarm automations</div>
      {#each autoArm as r}
        <div class="arow"><div class="al"><div class="an">{r.name}</div><div class="as">{r.sub}</div></div><Toggle on={ha.isOn(r.id)} onchange={() => ha.toggleBoolean(r.id)} /></div>
      {/each}
    </div>
    <div class="card pad">
      <div class="lb" style="margin-bottom:8px">Schedule</div>
      {#each schedule as r}
        <div class="srow"><span class="sn">{r.name}</span><input type="time" value={timeVal(r.id)} onchange={(e) => ha.setDatetime(r.id, (e.target as HTMLInputElement).value + ":00")} /></div>
      {/each}
    </div>
  </div>

  <!-- notifications + zone bypass -->
  <div class="two">
    <div class="card pad">
      <div class="lb" style="margin-bottom:6px">Notifications</div>
      {#each notifs as r}
        <div class="arow"><span class="ni">{r.icon}</span><span class="nn">{r.name}</span><Toggle on={ha.isOn(r.id)} onchange={() => ha.toggleBoolean(r.id)} /></div>
      {/each}
    </div>
    <div class="card pad">
      <div class="lb" style="margin-bottom:12px">Security · zone bypass</div>
      <select value={bypassVal} onchange={(e) => ha.setSelect("input_select.zone_bypass_selector", (e.target as HTMLSelectElement).value)}>
        {#each bypassOpts as o}<option value={o}>{o}</option>{/each}
        {#if bypassOpts.length === 0}<option>None available</option>{/if}
      </select>
      <div class="note">Temporarily excludes a zone from arming. Confirm on the Security screen.</div>
    </div>
  </div>

  <h2 class="section">Automations</h2>
  <div class="card pad">
    <div class="agrid">
      {#each automations as r}
        <div class="arow"><span class="ni">{r.icon}</span><span class="nn">{r.name}</span><Toggle on={ha.isOn(r.id)} onchange={() => ha.toggleBoolean(r.id)} /></div>
      {/each}
    </div>
  </div>

  <!-- health goals -->
  {#if healthGoals.length}
    <h2 class="section">Health &amp; goals</h2>
    <div class="card pad">
      {#each healthGoals as g}
        {@const val = ha.num(g.id) ?? g.min}
        {@const min = goalBound(g.id, "min", g.min)}
        {@const max = goalBound(g.id, "max", g.max)}
        {@const step = goalBound(g.id, "step", g.step)}
        <div class="goal">
          <div class="grow"><span class="gname">{g.icon} {g.name}</span><span class="gval">{val.toLocaleString()}{g.unit}</span></div>
          <input type="range" {min} {max} {step} value={val} onchange={(e) => ha.setNumber(g.id, Number((e.target as HTMLInputElement).value))} />
        </div>
      {/each}
      <div class="note">Feeds the Oura automations (steps nudge, low-readiness morning, illness warning).</div>
    </div>
  {/if}

  <!-- broadcast -->
  <h2 class="section">Messages</h2>
  <div class="card pad">
    <div class="lb" style="margin-bottom:14px">Broadcast & messages</div>
    <div class="presets">
      {#each msgPresets as m}<button class="preset" onclick={() => send(m)}>{m}</button>{/each}
    </div>
    <div class="composer">
      <input bind:value={msgText} placeholder="Type a custom message or announcement…" onkeydown={(e) => e.key === "Enter" && send(msgText)} />
      <button class="send" onclick={() => send(msgText)}>Send</button>
    </div>
  </div>

  <!-- enabled views -->
  <h2 class="section">Views</h2>
  <div class="card pad">
    <div class="lb" style="margin-bottom:12px">Enabled views · tap to toggle</div>
    <div class="views">
      {#each configurableViews as v}
        <button class="vchip" class:on={prefs.viewsOn[v.id]} onclick={() => toggleView(v.id)}><span>{v.icon}</span>{v.name}</button>
      {/each}
    </div>
  </div>

  <div class="card tvlink">Casting to a wall display? Open the standalone <button class="tvbtn" onclick={ontv}>TV Overview →</button></div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }
  .section { font-size: 12px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; color: var(--muted-2); margin: 8px 2px -4px; }
  .section:first-child { margin-top: 0; }
  .agrid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
  @media (max-width: 640px) { .agrid { grid-template-columns: 1fr; } }
  .pad { padding: 22px; }
  .acct { display: flex; align-items: center; gap: 15px; }
  .aav { width: 46px; height: 46px; flex-shrink: 0; border-radius: 50%; background: var(--grad); display: grid; place-items: center; font-size: 18px; font-weight: 800; color: #0b1017; }
  .ainfo { flex: 1; min-width: 0; }
  .anm2 { font-size: 15px; font-weight: 700; }
  .asub2 { font-size: 11.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .signout { padding: 10px 16px; border-radius: 11px; background: color-mix(in srgb, var(--error) 16%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--error) 34%, transparent); color: #fecdd6; font-size: 12.5px; font-weight: 700; }
  .goal { padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
  .goal:last-of-type { border-bottom: none; }
  .grow { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 9px; }
  .gname { font-size: 13px; font-weight: 600; }
  .gval { font-size: 13px; font-weight: 800; color: var(--acc); }
  .goal input[type="range"] { width: 100%; accent-color: var(--acc); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 760px) { .two { grid-template-columns: 1fr; } }
  .swatches { display: flex; gap: 11px; flex-wrap: wrap; align-items: center; }
  .sw { width: 36px; height: 36px; border-radius: 50%; }
  .sw.active { box-shadow: 0 0 0 2px #fff; }
  .hue { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 180px; }
  .hl { font-size: 12px; color: var(--dim); }
  .hue input { flex: 1; height: 6px; accent-color: hsl(var(--h, 265) 80% 68%); }
  .row { display: flex; align-items: center; justify-content: space-between; }
  .rn { font-size: 13px; font-weight: 600; }
  .rs { font-size: 11px; color: var(--muted); }
  .seg { display: flex; gap: 6px; background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 4px; }
  .seg button { flex: 1; padding: 10px; border-radius: 9px; font-size: 12.5px; font-weight: 600; color: var(--text); }
  .seg button.active { background: var(--grad); color: #0b1017; }
  .prow { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
  .pav { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; font-size: 14px; font-weight: 800; color: #0b1017; }
  .pl { flex: 1; }
  .pn { font-size: 13.5px; font-weight: 600; }
  .pst { font-size: 11px; }
  .role { font-size: 10px; font-weight: 800; letter-spacing: 0.05em; padding: 4px 9px; border-radius: 999px; background: rgba(255, 255, 255, 0.06); color: var(--muted); }
  .arow { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
  .al { flex: 1; }
  .an { font-size: 13px; font-weight: 600; }
  .as { font-size: 11px; color: var(--muted); }
  .ni { font-size: 16px; width: 22px; text-align: center; }
  .nn { flex: 1; font-size: 13px; }
  .srow { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; }
  .sn { font-size: 12.5px; color: var(--text-2); }
  input[type="time"] { background: rgba(255, 255, 255, 0.06); border: none; border-radius: 9px; color: var(--text); font-size: 12.5px; padding: 7px 10px; color-scheme: dark; }
  select { width: 100%; background: rgba(255, 255, 255, 0.06); border: none; border-radius: 11px; color: var(--text); font-size: 13px; padding: 12px; color-scheme: dark; }
  .note { font-size: 11.5px; color: var(--muted); margin-top: 10px; }
  .presets { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 9px; margin-bottom: 14px; }
  .preset { padding: 12px 14px; border-radius: 13px; background: rgba(255, 255, 255, 0.045); text-align: left; font-size: 12.5px; font-weight: 600; }
  .preset:hover { background: rgba(255, 255, 255, 0.09); }
  .composer { display: flex; gap: 9px; }
  .composer input { flex: 1; background: rgba(255, 255, 255, 0.06); border: none; border-radius: 12px; color: var(--text); font-size: 13px; padding: 12px 14px; outline: none; }
  .send { padding: 12px 22px; border-radius: 12px; background: var(--grad); color: #0b1017; font-size: 13px; font-weight: 800; }
  .views { display: flex; gap: 9px; flex-wrap: wrap; }
  .vchip { display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 12px; background: rgba(255, 255, 255, 0.045); font-size: 12px; font-weight: 600; }
  .vchip.on { background: var(--soft); box-shadow: inset 0 0 0 1.5px var(--line); }
  .tvlink { padding: 16px 20px; font-size: 12.5px; color: var(--text-2); }
  .tvbtn { color: var(--water); font-weight: 600; }
</style>
