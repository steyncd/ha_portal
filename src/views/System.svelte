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
  const cats = [
    { icon: "💡", name: "Lighting & switches", count: 21 },
    { icon: "📷", name: "Cameras", count: 8 },
    { icon: "🌡️", name: "Sensors", count: 40 },
    { icon: "🔌", name: "Smart plugs", count: 12 },
    { icon: "📱", name: "Phones & tablets", count: 6 },
  ];
</script>

<div class="col">
  <div class="kpis">
    <div class="card k"><div class="lb">↓ Download</div><div class="big">{n(ha.num(E.routerDown), 1)}<span class="u"> Mbps</span></div></div>
    <div class="card k"><div class="lb">↑ Upload</div><div class="big">{n(ha.num(E.routerUp), 1)}<span class="u"> Mbps</span></div></div>
    <div class="card k"><div class="lb">Devices</div><div class="big">{n(ha.num(E.routerDevices))}</div><div class="sub" style="color:var(--success)">online</div></div>
    <div class="card k"><div class="lb">Battery health</div><div class="big">{n(ha.num(E.batteryHealth))}<span class="u">%</span></div><div class="sub">grade {ha.state(E.energyGrade) ?? "—"}</div></div>
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
  .col { display: flex; flex-direction: column; gap: 14px; max-width: 1180px; margin: 0 auto; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
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
