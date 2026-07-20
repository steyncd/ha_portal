<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E, INK } from "../lib/entities";
  import { n } from "../lib/format";
  import Spark from "../lib/components/Spark.svelte";

  const cpu = $derived(ha.num(E.routerCpu) ?? 0);
  const mem = $derived(ha.num(E.routerMem) ?? 0);

  let netHist = $state<{ t: number; v: number }[]>([]);
  onMount(async () => { netHist = await ha.history(E.routerDown, 24); });

  function uptime(sec: number | null) {
    if (sec == null) return "—";
    const d = Math.floor(sec / 86400); const h = Math.floor((sec % 86400) / 3600);
    return `${d}d ${h}h`;
  }

  // device-category counts derived from the live entity map (not hardcoded)
  const DOMAINS = [
    { icon: "💡", name: "Lights", pfx: ["light."] },
    { icon: "🔌", name: "Switches & plugs", pfx: ["switch."] },
    { icon: "📷", name: "Cameras", pfx: ["camera."] },
    { icon: "🌡️", name: "Sensors", pfx: ["sensor.", "binary_sensor."] },
    { icon: "📱", name: "Trackers", pfx: ["device_tracker."] },
    { icon: "🎵", name: "Media players", pfx: ["media_player."] },
  ];
  const cats = $derived(
    DOMAINS.map((d) => ({ ...d, count: Object.keys(ha.entities).filter((id) => d.pfx.some((p) => id.startsWith(p))).length })).filter((d) => d.count > 0),
  );

  // problems: offline devices + low-battery
  const PROBLEM_DOMAINS = ["light", "switch", "sensor", "binary_sensor", "camera", "climate", "cover", "lock", "media_player", "device_tracker", "fan"];
  const offline = $derived(
    Object.entries(ha.entities).filter(([id, e]) => PROBLEM_DOMAINS.includes(id.split(".")[0]) && (e.state === "unavailable" || e.state === "unknown")).length,
  );
  const lowBatt = $derived(ha.num(E.lowBatteryDevices) ?? 0);
  // energy/analysis health count + Frigate detection watchdog (energy_insights_plus / frigate_watchdog)
  const healthIssues = $derived(ha.num(E.systemHealthIssues) ?? 0);
  const frigateStalled = $derived(ha.isOn(E.frigateStalled));
  const problems = $derived(
    [
      offline > 0 ? `${offline} device${offline === 1 ? "" : "s"} offline` : null,
      lowBatt > 0 ? `${n(lowBatt)} low battery` : null,
      frigateStalled ? "Frigate detection stalled" : null,
      healthIssues > 0 ? `${healthIssues} health issue${healthIssues === 1 ? "" : "s"}` : null,
    ].filter(Boolean),
  );
  const problemCount = $derived(offline + lowBatt + healthIssues + (frigateStalled ? 1 : 0));
  const healthy = $derived(problemCount === 0);
</script>

<div class="col">
  <!-- problems-first hero -->
  <div class="card phero" class:ok={healthy}>
    <span class="picon">{healthy ? "✅" : "⚠️"}</span>
    <div class="pinfo">
      <div class="pt">{healthy ? "All systems healthy" : problems.join(" · ")}</div>
      <div class="psub">{n(ha.num(E.routerDevices))} devices online · internet up {uptime(ha.num(E.routerUptime))}</div>
    </div>
    {#if !healthy}<span class="pcount">{problemCount}</span>{/if}
  </div>

  <div class="kpis">
    <div class="card k"><div class="lb">↓ Download</div><div class="big">{n(ha.num(E.routerDown), 1)}<span class="u"> Mbps</span></div></div>
    <div class="card k"><div class="lb">↑ Upload</div><div class="big">{n(ha.num(E.routerUp), 1)}<span class="u"> Mbps</span></div></div>
    <div class="card k"><div class="lb">Devices</div><div class="big">{n(ha.num(E.routerDevices))}</div><div class="sub" style="color:var(--success)">online</div></div>
    <div class="card k"><div class="lb">Battery health</div><div class="big">{n(ha.num(E.batteryHealth))}<span class="u">%</span></div><div class="sub">grade {ha.state(E.energyGrade) ?? "—"}{ha.num(E.batteryCellSpread) != null ? ` · Δ${n(ha.num(E.batteryCellSpread), 1)}°C cells` : ""}</div></div>
  </div>

  <div class="two">
    <div class="card pad rings">
      <div class="ringwrap">
        <div class="ring" style="background:conic-gradient(var(--warning) {cpu}%,rgba(255,255,255,.10) 0)"><div class="rc">{n(cpu)}%</div></div>
        <div class="rl">Router CPU</div>
      </div>
      <div class="ringwrap">
        <div class="ring" style="background:conic-gradient(var(--error) {mem}%,rgba(255,255,255,.10) 0)"><div class="rc">{n(mem)}%</div></div>
        <div class="rl">Router memory</div>
      </div>
    </div>
    <div class="card pad">
      <div class="lb" style="margin-bottom:14px">Printer ink · Brother DCP-T720DW</div>
      {#each INK as ink}
        {@const v = ha.num(ink.id)}
        <div class="ink"><span class="ikn">{ink.label}</span><div class="ibg"><div class="ifl" style="width:{v ?? 0}%;background:{ink.color}"></div></div><span class="ivv">{n(v)}%</span></div>
      {/each}
    </div>
  </div>

  <div class="two">
    <div class="card pad">
      <div class="rh"><span class="lb">Internet · 24h</span><span class="sub">uptime {uptime(ha.num(E.routerUptime))}</span></div>
      <Spark data={netHist} color="var(--water)" height={90} />
    </div>
    <div class="card pad">
      <div class="lb" style="margin-bottom:12px">Devices · {n(ha.num(E.routerDevices))} online</div>
      {#each cats as c}
        <div class="cat"><span class="cic">{c.icon}</span><span class="cn">{c.name}</span><span class="cc">{c.count}</span></div>
      {/each}
    </div>
  </div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }
  .phero { display: flex; align-items: center; gap: 15px; padding: 18px 22px; background: linear-gradient(180deg, color-mix(in srgb, var(--warning) 12%, transparent), rgba(255, 255, 255, 0.02)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 28%, transparent); }
  .phero.ok { background: linear-gradient(180deg, color-mix(in srgb, var(--success) 10%, transparent), rgba(255, 255, 255, 0.02)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--success) 24%, transparent); }
  .picon { font-size: 24px; }
  .pinfo { flex: 1; min-width: 0; }
  .pt { font-size: 16px; font-weight: 800; }
  .psub { font-size: 12px; color: var(--dim); margin-top: 2px; }
  .pcount { font-size: 20px; font-weight: 800; color: var(--warning); }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  @media (max-width: 760px) { .kpis { grid-template-columns: 1fr 1fr; } }
  .k { padding: 16px; }
  .big { font-size: 26px; font-weight: 800; margin-top: 5px; }
  .u { font-size: 12px; color: var(--dim); }
  .sub { font-size: 11px; color: var(--dim); margin-top: 3px; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 760px) { .two { grid-template-columns: 1fr; } }
  .pad { padding: 20px; }
  .rings { display: flex; gap: 22px; align-items: center; justify-content: center; }
  .ringwrap { text-align: center; }
  .ring { width: 78px; height: 78px; border-radius: 50%; display: grid; place-items: center; margin: 0 auto; }
  .rc { width: 60px; height: 60px; border-radius: 50%; background: #0b1017; display: grid; place-items: center; font-size: 14px; font-weight: 700; }
  .rl { font-size: 11.5px; color: var(--dim); margin-top: 8px; }
  .ink { display: flex; align-items: center; gap: 11px; margin-bottom: 11px; }
  .ikn { width: 52px; font-size: 11.5px; color: var(--dim); }
  .ibg { flex: 1; height: 9px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
  .ifl { height: 100%; border-radius: 999px; }
  .ivv { font-size: 11.5px; font-weight: 700; width: 34px; text-align: right; }
  .rh { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
  .cat { display: flex; align-items: center; gap: 11px; padding: 6px 0; }
  .cic { font-size: 15px; width: 22px; text-align: center; }
  .cn { flex: 1; font-size: 12.5px; color: var(--text-2); }
  .cc { font-size: 13px; font-weight: 700; }
</style>
