<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { prefs } from "../lib/prefs.svelte";
  import { lightSheet } from "../lib/lightSheet.svelte";
  import { toast } from "../lib/toast.svelte";
  import { ui } from "../lib/ui.svelte";
  import { E, ROOMS, INDOOR_LIGHTS, ALL_LIGHTS, SCENES } from "../lib/entities";
  import { n, power, greeting, tempColor, dateMedium, sastHour } from "../lib/format";
  import PowerFlow from "../lib/components/PowerFlow.svelte";
  import Spark from "../lib/components/Spark.svelte";
  import Toggle from "../lib/components/Toggle.svelte";
  import StatusChip from "../lib/components/StatusChip.svelte";
  import Icon from "../lib/components/Icon.svelte";

  // Customize state lives in the shared ui store so the global top-bar action can toggle it too.
  let { onnav }: { onnav: (id: string) => void } = $props();

  let battHist = $state<{ t: number; v: number }[]>([]);
  let solarHist = $state<{ t: number; v: number }[]>([]);
  onMount(async () => {
    battHist = await ha.history(E.batterySoc, 24);
    solarHist = await ha.history(E.pvPower, 24);
  });

  const now = new Date();
  const dateStr = dateMedium(now);

  const soc = $derived(ha.num(E.batterySoc));
  // live one-line summary of where power is flowing right now
  const flowLine = $derived.by(() => {
    const pv = ha.num(E.pvPower) ?? 0, batt = ha.num(E.batteryPower) ?? 0, grid = ha.num(E.gridPower) ?? 0;
    const parts: string[] = [];
    if (pv > 40) parts.push("☀️ solar");
    if (batt < -20) parts.push("🔋 battery → home");
    else if (batt > 20) parts.push("🔋 charging");
    if (grid > 20) parts.push("🔌 grid import");
    else if (grid < -20) parts.push("🔌 exporting");
    else parts.push("grid idle");
    return parts.join(" · ");
  });
  const litCount = $derived(ALL_LIGHTS.filter((id) => ha.isOn(id)).length);

  const quick = [
    { id: E.poolPump, ic: "waves", name: "Pool Pump" },
    { id: E.boreholePump, ic: "well", name: "Borehole" },
    { id: E.heater, ic: "flame", name: "Heater" },
    { id: E.waterPump, ic: "droplet", name: "Water Pump" },
  ];

  const WIDGETS = [
    { key: "scenes", name: "Scenes", icon: "✨" },
    { key: "lights", name: "Lights", icon: "💡" },
    { key: "energyToday", name: "Today's energy", icon: "⚡" },
    { key: "security", name: "Security & presence", icon: "🛡️" },
    { key: "activity", name: "Recent activity", icon: "📋" },
    { key: "forecast", name: "Next hours", icon: "🌙" },
  ];
  function toggleWidget(k: string) {
    prefs.widgets = { ...prefs.widgets, [k]: !prefs.widgets[k] };
    prefs.save();
  }

  // relative time from an ISO timestamp
  function ago(iso: string | undefined): string {
    if (!iso) return "";
    const ms = Date.now() - Date.parse(iso);
    if (!Number.isFinite(ms)) return "";
    const m = Math.round(ms / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  }
  const lc = (id: string) => ha.entities[id]?.last_changed;

  // real timestamped logbook, built from meaningful entities' last state change
  const LOG_SRC: { id: string; icon: string; color: string; title: (s: string) => string; sub: string }[] = [
    { id: E.alarmMain, icon: "🛡️", color: "var(--success)", title: (s) => `Alarm ${s}`, sub: "security" },
    { id: "binary_sensor.helloliam_alarm_zone_013_front_door", icon: "🚪", color: "var(--warning)", title: (s) => `Front door ${s === "on" ? "opened" : "closed"}`, sub: "access" },
    { id: E.boreholePump, icon: "🕳️", color: "var(--water)", title: (s) => `Borehole pump ${s === "on" ? "started" : "stopped"}`, sub: "water" },
    { id: E.waterPump, icon: "💧", color: "var(--water)", title: (s) => `Water pump ${s === "on" ? "started" : "stopped"}`, sub: "water" },
    { id: E.poolPump, icon: "🏊", color: "var(--water)", title: (s) => `Pool pump ${s === "on" ? "started" : "stopped"}`, sub: "water" },
    { id: E.occupancy, icon: "🏠", color: "var(--acc)", title: (s) => `Home ${s.toLowerCase()}`, sub: "presence" },
    { id: "switch.kitchen_lights", icon: "🍳", color: "var(--warning)", title: (s) => `Kitchen lights ${s}`, sub: "lighting" },
  ];
  const activity = $derived(
    LOG_SRC
      .filter((e) => ha.exists(e.id) && lc(e.id))
      .map((e) => ({ icon: e.icon, color: e.color, title: e.title(ha.state(e.id) ?? "—"), sub: e.sub, t: lc(e.id)! }))
      .sort((a, b) => Date.parse(b.t) - Date.parse(a.t))
      .slice(0, 5),
  );

  const armed = $derived((ha.state(E.alarmMain) ?? "").startsWith("armed"));

  // attention items — only shown when something needs attention; some carry a
  // one-tap contextual fix (Aurora recc 5d/5e).
  type Attn = { text: string; action?: { label: string; run: () => void } };
  const attention = $derived.by(() => {
    const items: Attn[] = [];
    if (ha.state(E.alarmMain) === "triggered") items.push({ text: "Alarm triggered" });
    if (ha.state(E.tankLowAlert) === "on")
      items.push({ text: "Water tank low", action: { label: "Start borehole", run: () => { ha.turnOn(E.boreholePump); toast.show("Starting borehole"); } } });
    const lb = ha.num(E.lowBatteryDevices) ?? 0;
    if (lb > 0) items.push({ text: `${lb} device${lb === 1 ? "" : "s"} low on battery` });
    if ((ha.num(E.pvPower) ?? 999) < 40) items.push({ text: "PV asleep — hold heavy appliances" });
    if (ha.state(E.alarmAcPower) === "off") items.push({ text: "Alarm on backup power" });
    return items;
  });

  const FC = [["Now", "🌙", 16], ["21h", "🌫️", 12], ["23h", "🌫️", 11], ["01h", "🌫️", 10], ["03h", "❄️", 8], ["06h", "❄️", 7]];
</script>

<div class="head">
  <div>
    <h1>{greeting(sastHour(now))}, Christo</h1>
    <p>{dateStr} · everything calm · running on your own power</p>
  </div>
  <div class="actions">
    <button class="btn" onclick={() => onnav("__palette")}><span>⌘</span> Search</button>
    <button class="btn" class:active={ui.overviewCustomize} onclick={() => (ui.overviewCustomize = !ui.overviewCustomize)}>✨ {ui.overviewCustomize ? "Done" : "Customize"}</button>
    {#if ui.overviewCustomize}
      <div class="custom">
        <div class="ch"><span class="lb">Show on overview</span><button class="reset" onclick={() => prefs.resetWidgets()}>Reset</button></div>
        {#each WIDGETS as w}
          <button class="crow" onclick={() => toggleWidget(w.key)}>
            <span class="ci">{w.icon}</span><span class="cn">{w.name}</span>
            <Toggle on={prefs.widgets[w.key]} />
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

{#if attention.length}
  <div class="attnstrip">
    {#each attention as a}
      <div class="attn attn--warn">
        <span class="attn__badge">!</span>
        <div class="attn__text">{a.text}</div>
        {#if a.action}<button class="btn-primary" onclick={a.action.run}>{a.action.label}</button>{/if}
      </div>
    {/each}
  </div>
{:else}
  <div class="attn calm">
    <StatusChip state="ok" label="All clear" />
    <div class="attn__text">Everything's running smoothly · {ha.state(E.gridFreeStreak) ?? "—"}-night grid-free streak</div>
  </div>
{/if}

<div class="masonry">
  <!-- power flow -->
  <div class="w card tap" role="button" tabindex="0" onclick={() => onnav("energy")} onkeydown={(e) => e.key === "Enter" && onnav("energy")}>
    <div class="wh"><span class="lb">Power flow</span><span class="ok">{n(ha.num(E.gridIndepToday))}% independent →</span></div>
    <PowerFlow big />
    <div class="center-sub">{flowLine}</div>
  </div>

  <!-- battery -->
  <div class="w card card--hero">
    <span class="glow" style="--gc:var(--battery)"></span>
    <div class="brow">
      <div class="ring" style="background:conic-gradient(var(--acc) {soc ?? 0}%,rgba(255,255,255,.10) 0)"><div class="ringc">{n(soc)}%</div></div>
      <div><div class="lb">Battery</div><div class="sub2">{n(ha.num(E.batteryPower))} W · {ha.state(E.batteryState) ?? ""}<br>{n(ha.num(E.batteryVoltage), 1)} V · {n(ha.num(E.batteryTemp))}°C</div></div>
    </div>
    <div style="margin-top:14px"><Spark data={battHist} color="var(--acc)" forceMax={100} height={54} /></div>
  </div>

  <!-- comfort -->
  <div class="w card">
    <div class="lb" style="margin-bottom:12px">Comfort · {n(ha.num(E.indoorAvg), 1)}° avg</div>
    <div class="clist">
      {#each ROOMS.slice(0, 5) as r}
        <div class="crow2"><span>{r.label}</span><span style="color:{tempColor(ha.num(r.id))};font-weight:700">{n(ha.num(r.id), 1)}°</span></div>
      {/each}
    </div>
  </div>

  <!-- tank -->
  <div class="w card tankw tap" role="button" tabindex="0" onclick={() => onnav("water")} onkeydown={(e) => e.key === "Enter" && onnav("water")}>
    <div class="tank"><div class="fill" style="height:{ha.num(E.tankLevel) ?? 0}%"></div></div>
    <div><div class="lb">Water tank</div><div class="big2">{n(ha.num(E.tankLevel))}%</div><div class="sub2">{n(ha.num(E.tankDays))} days · {n(ha.num(E.tankVolume))} L</div></div>
  </div>

  <!-- scenes -->
  {#if prefs.widgets.scenes}
    <div class="w card">
      <div class="lb" style="margin-bottom:12px">Scenes</div>
      <div class="grid2">
        {#each SCENES as s}
          <button class="mini-btn" onclick={() => { ha.script(s.id); toast.show(`${s.label} scene`); }}>
            <span class="mi">{s.icon}</span><span class="mn">{s.label}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- solar -->
  <div class="w card card--hero tap" role="button" tabindex="0" onclick={() => onnav("energy")} onkeydown={(e) => e.key === "Enter" && onnav("energy")}>
    <span class="glow" style="--gc:var(--solar)"></span>
    <div class="row-top">
      <span class="micro" style="color:var(--solar)">Solar</span>
      <StatusChip state={(ha.num(E.pvPower) ?? 0) > 40 ? "ok" : "idle"} label={(ha.num(E.pvPower) ?? 0) > 40 ? "Generating" : "Asleep"} />
    </div>
    <div class="big3">{power(ha.num(E.pvPower)).val}<span class="u"> {power(ha.num(E.pvPower)).unit}</span></div>
    <div class="sub2">{n(ha.num(E.pvYieldToday), 1)} kWh today</div>
    <div style="margin-top:12px"><Spark data={solarHist} color="var(--solar)" height={54} /></div>
    <span class="drill">Open Energy →</span>
  </div>

  <!-- pumps & heater -->
  <div class="w card">
    <div class="lb" style="margin-bottom:12px">Pumps & heater</div>
    <div class="grid2">
      {#each quick as q}
        <button class="qtile" class:on={ha.isOn(q.id)} onclick={() => ha.toggle(q.id)}>
          <span class="mi"><Icon name={q.ic} size={16} /></span><span class="mn">{q.name}</span><StatusChip state={ha.isOn(q.id) ? "ok" : "off"} label={ha.isOn(q.id) ? "On" : "Off"} />
        </button>
      {/each}
    </div>
  </div>

  <!-- lights -->
  {#if prefs.widgets.lights}
    <div class="w card">
      <div class="wh"><span class="lb">Lights</span><button class="seeall" onclick={() => onnav("lights")}>{litCount} on · all →</button></div>
      <div class="grid2" style="margin-top:12px">
        {#each INDOOR_LIGHTS.slice(0, 6) as l}
          <div class="ltile" class:on={ha.isOn(l.id)}>
            <div class="ltap" onclick={() => ha.toggle(l.id)} role="button" tabindex="0" onkeydown={() => {}}>
              <span class="mi">{l.icon}</span><span class="mn">{l.label}</span><span class="qs">{ha.isOn(l.id) ? "On" : "Off"}</span>
            </div>
            <button class="tune" onclick={() => lightSheet.open(l.id, l.label)} aria-label="brightness">⋯</button>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- today's energy -->
  {#if prefs.widgets.energyToday}
    <div class="w card">
      <div class="lb" style="margin-bottom:12px">Today's energy</div>
      <div class="clist">
        <div class="crow2"><span>Solar generated</span><span style="color:var(--solar);font-weight:700">{n(ha.num(E.solarYieldToday), 1)} kWh</span></div>
        <div class="crow2"><span>Grid imported</span><span style="font-weight:700">{n(ha.num(E.gridImportToday), 1)} kWh</span></div>
        <div class="crow2"><span>Cost today</span><span style="font-weight:700">R{n(ha.num(E.energyCostToday))}</span></div>
        <div class="crow2"><span>Report grade</span><span style="color:var(--water);font-weight:700">{ha.state(E.energyGrade) ?? "—"} · {n(ha.num(E.gridIndepToday))}%</span></div>
      </div>
    </div>
  {/if}

  <!-- security & presence -->
  {#if prefs.widgets.security}
    <div class="w card tap" role="button" tabindex="0" onclick={() => onnav("security")} onkeydown={(e) => e.key === "Enter" && onnav("security")}>
      <div class="lb" style="margin-bottom:12px">Security & presence →</div>
      <div class="clist">
        <div class="sprow"><StatusChip state={ha.state(E.alarmMain) === "triggered" ? "warn" : armed ? "ok" : "idle"} label={ha.state(E.alarmMain) ?? "—"} /><span class="spx">· zones clear</span></div>
        <div class="sprow"><StatusChip state={/(home|occupied)/i.test(ha.state(E.occupancy) ?? "home") ? "ok" : "off"} label={ha.state(E.occupancy) ?? "Home"} /></div>
        <div class="sprow"><span class="spd" style="background:var(--security)"></span>Gate · {n(ha.num(E.gateDetections))} detections</div>
        <div class="sprow"><span class="spd" style="background:var(--acc)"></span>{n(ha.num(E.routerDevices))} devices online</div>
      </div>
    </div>
  {/if}

  <!-- recent activity -->
  {#if prefs.widgets.activity}
    <div class="w card">
      <div class="lb" style="margin-bottom:6px">Recent activity</div>
      {#each activity as e}
        <div class="log">
          <span class="lic" style="background:color-mix(in srgb,{e.color} 17%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,{e.color} 36%,transparent)">{e.icon}</span>
          <div class="lt"><div class="ltt">{e.title}</div><div class="lts">{e.sub}</div></div>
          <span class="lta">{ago(e.t)}</span>
        </div>
      {/each}
      {#if activity.length === 0}<div class="lts" style="padding:10px 0">No recent changes.</div>{/if}
    </div>
  {/if}

  <!-- next hours -->
  {#if prefs.widgets.forecast}
    <div class="w card">
      <div class="wh"><span class="lb">Next hours</span><span class="sub2">🌙 Clear · 16°</span></div>
      <div class="fc">
        {#each FC as [h, ic, tp], i}
          <div class="fcc" style="background:{i === 0 ? 'var(--soft)' : 'rgba(255,255,255,.03)'}">
            <span class="fch">{h}</span><span class="fci">{ic}</span><span class="fct">{tp}°</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; margin-bottom: 16px; }
  h1 { margin: 0; font-size: 27px; font-weight: 800; letter-spacing: -0.7px; background: var(--title-grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .head p { margin: 5px 0 0; color: var(--dim); font-size: 13px; }
  .actions { position: relative; display: flex; gap: 9px; flex-shrink: 0; }
  .btn { display: inline-flex; align-items: center; gap: 8px; padding: 9px 13px; border-radius: 11px; background: rgba(255, 255, 255, 0.05); color: var(--text-2); font-size: 12.5px; font-weight: 600; }
  .btn:hover { background: rgba(255, 255, 255, 0.09); color: var(--text); }
  .btn.active { background: var(--soft); color: var(--acc); }
  .custom { position: absolute; top: calc(100% + 8px); right: 0; z-index: 30; width: 258px; padding: 12px; border-radius: 15px; background: rgba(16, 22, 31, 0.98); box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.08); animation: ppop 0.18s cubic-bezier(0.2, 0.8, 0.2, 1); }
  .ch { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 0 2px; }
  .ch .lb { font-size: 10.5px; }
  .reset { color: var(--acc2); font-size: 11px; font-weight: 600; }
  .crow { display: flex; align-items: center; gap: 10px; padding: 9px 8px; border-radius: 10px; width: 100%; text-align: left; }
  .crow:hover { background: rgba(255, 255, 255, 0.05); }
  .ci { font-size: 15px; width: 20px; text-align: center; }
  .cn { flex: 1; font-size: 12.5px; }
  .attnstrip { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
  .attn.calm { margin-bottom: 16px; background: color-mix(in srgb, var(--ok) 9%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ok) 22%, transparent); }
  .ok { color: var(--ok); font-weight: 600; font-size: 12px; }
  .spx { color: var(--muted); font-size: 12px; }
  .spd { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .row-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }

  .masonry { column-count: 3; column-gap: 14px; }
  @media (max-width: 1000px) { .masonry { column-count: 2; } }
  @media (max-width: 640px) { .masonry { column-count: 1; } }
  .w { break-inside: avoid; margin: 0 0 14px; padding: 18px; }
  .tap { cursor: pointer; transition: box-shadow 0.15s, transform 0.15s; }
  .tap:hover { box-shadow: inset 0 0 0 1px var(--line); transform: translateY(-1px); }
  .tap:focus-visible { box-shadow: 0 0 0 2px var(--acc); outline: none; }
  .lta { font-size: 10.5px; color: var(--muted-2); white-space: nowrap; align-self: center; }
  .wh { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
  .center-sub { font-size: 12px; color: var(--dim); text-align: center; margin-top: 4px; }
  .sub2 { font-size: 12px; color: var(--dim); }
  .seeall { font-size: 12px; color: var(--acc2); font-weight: 600; }
  .seeall:hover { color: var(--acc); }
  .brow { display: flex; align-items: center; gap: 15px; }
  .ring { width: 60px; height: 60px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; }
  .ringc { width: 46px; height: 46px; border-radius: 50%; background: #0b1017; display: grid; place-items: center; font-size: 13px; font-weight: 700; }
  .clist { display: flex; flex-direction: column; gap: 10px; }
  .crow2 { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--text-2); }
  .tankw { display: flex; align-items: center; gap: 15px; }
  .tank { width: 26px; height: 58px; border-radius: 8px; flex-shrink: 0; background: rgba(255, 255, 255, 0.06); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14); overflow: hidden; position: relative; }
  .tank .fill { position: absolute; left: 0; right: 0; bottom: 0; background: var(--water); opacity: 0.85; }
  .big2 { font-size: 26px; font-weight: 800; letter-spacing: -1px; margin-top: 2px; }
  .big3 { font-size: 30px; font-weight: 800; letter-spacing: -1.2px; margin-top: 6px; }
  .u { font-size: 15px; color: var(--dim); }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
  .mini-btn, .qtile { position: relative; display: flex; flex-direction: column; gap: 5px; padding: 12px; border-radius: 13px; background: rgba(255, 255, 255, 0.045); text-align: left; }
  .mini-btn { flex-direction: row; align-items: center; gap: 9px; }
  .mini-btn:hover, .qtile:hover { background: rgba(255, 255, 255, 0.08); }
  .qtile.on { background: var(--soft); box-shadow: inset 0 0 0 1.5px var(--line); }
  .mi { font-size: 16px; }
  .mn { font-size: 11.5px; font-weight: 600; color: #f2f7fc; }
  .qs { font-size: 10.5px; color: var(--text-2); }
  .ltile { position: relative; display: flex; flex-direction: column; gap: 5px; padding: 12px; border-radius: 13px; background: rgba(255, 255, 255, 0.05); }
  .ltile.on { background: color-mix(in srgb, var(--warning) 15%, transparent); box-shadow: inset 0 0 0 1.5px var(--warning); }
  .ltap { display: flex; flex-direction: column; gap: 5px; cursor: pointer; }
  .tune { position: absolute; top: 9px; right: 9px; width: 26px; height: 26px; border-radius: 8px; background: rgba(255, 255, 255, 0.09); color: #dbe6f0; font-size: 14px; }
  .tune:hover { background: rgba(255, 255, 255, 0.18); }
  .sprow { display: flex; align-items: center; gap: 11px; font-size: 12.5px; color: #e6eef7; }
  .log { display: flex; align-items: flex-start; gap: 11px; padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
  .lic { width: 31px; height: 31px; flex-shrink: 0; border-radius: 9px; display: grid; place-items: center; font-size: 14px; }
  .ltt { font-size: 12.5px; font-weight: 600; color: #eef4fc; }
  .lts { font-size: 11px; color: var(--muted); }
  .fc { display: flex; gap: 5px; }
  .fcc { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 2px; border-radius: 12px; }
  .fch { font-size: 10px; color: var(--muted); }
  .fci { font-size: 16px; }
  .fct { font-size: 12.5px; font-weight: 700; }
</style>
