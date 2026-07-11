<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { E, CAMERAS } from "../lib/entities";
  import { n } from "../lib/format";

  const events = $derived([
    { icon: "🚗", cam: "Main Gate", txt: `${n(ha.num(E.vehicleDetections))} vehicles detected`, t: "today" },
    { icon: "🚶", cam: "Sidewalk", txt: `${n(ha.num(E.pedestriansToday))} pedestrians`, t: "today" },
    { icon: "🚙", cam: "Gate ANPR", txt: `Last plate: ${ha.state(E.lastPlate) ?? "None"}`, t: "" },
    { icon: "👤", cam: "Frigate", txt: `${n(ha.num(E.personDetections))} person events`, t: "today" },
  ]);
  const online = $derived(CAMERAS.filter((c) => ha.exists(c.id)).length);
</script>

<div class="col">
  <div class="kpis">
    <div class="card k"><div class="lb">Gate detections</div><div class="big">{n(ha.num(E.gateDetections))}</div><div class="sub">{n(ha.num(E.vehicleDetections))} vehicles · {n(ha.num(E.personDetections))} person</div></div>
    <div class="card k"><div class="lb">Last plate (ANPR)</div><div class="big pl">{ha.state(E.lastPlate) ?? "None"}</div><div class="sub">gate camera</div></div>
    <div class="card k"><div class="lb">Cameras online</div><div class="big">{online}</div><div class="sub" style="color:var(--success)">all recording</div></div>
  </div>

  <div class="card pad">
    <div class="lb" style="margin-bottom:4px">Recent detections</div>
    {#each events as e}
      <div class="ev"><span class="ei">{e.icon}</span><span class="ec">{e.cam}</span><span class="et">{e.txt}</span><span class="etime">{e.t}</span></div>
    {/each}
  </div>

  <div class="grid">
    {#each CAMERAS as c}
      <div class="cam card">
        <div class="feed">
          <span class="fl">{c.label} feed</span>
          <span class="rec"><span class="rd"></span>REC</span>
        </div>
        <div class="cf"><span class="cn">{c.label}</span><span class="cs">{c.sub}</span></div>
      </div>
    {/each}
  </div>
  <div class="note">Live streams show as labelled tiles — wire HLS/WebRTC or the HA camera-proxy snapshot to make them play here.</div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; max-width: 1180px; margin: 0 auto; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  @media (max-width: 640px) { .kpis { grid-template-columns: 1fr; } }
  .k { padding: 15px; }
  .big { font-size: 26px; font-weight: 800; margin-top: 5px; }
  .big.pl { font-size: 22px; color: var(--muted); }
  .sub { font-size: 11px; color: var(--dim); margin-top: 2px; }
  .pad { padding: 18px 20px; }
  .ev { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
  .ei { font-size: 16px; width: 24px; text-align: center; }
  .ec { font-size: 12.5px; font-weight: 600; width: 104px; }
  .et { flex: 1; font-size: 12px; color: var(--text-2); }
  .etime { font-size: 11.5px; color: var(--muted-2); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
  .cam { overflow: hidden; }
  .feed { aspect-ratio: 16/9; background: repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.035) 0 12px, rgba(255, 255, 255, 0.06) 12px 24px); display: flex; align-items: center; justify-content: center; position: relative; }
  .fl { font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: var(--muted-2); }
  .rec { position: absolute; top: 9px; left: 9px; display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; border-radius: 999px; background: rgba(0, 0, 0, 0.5); font-size: 10px; font-weight: 700; color: var(--error); }
  .rd { width: 6px; height: 6px; border-radius: 50%; background: var(--error); animation: pulse 1.5s infinite; }
  .cf { padding: 11px 13px; display: flex; justify-content: space-between; align-items: center; }
  .cn { font-size: 12.5px; font-weight: 600; }
  .cs { font-size: 10.5px; color: var(--muted-2); }
  .note { font-size: 11.5px; color: var(--muted-2); }
</style>
