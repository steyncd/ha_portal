<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E, CAMERAS } from "../lib/entities";
  import { HASS_URL } from "../lib/config";
  import { n } from "../lib/format";

  const events = $derived([
    { icon: "🚗", cam: "Main Gate", txt: `${n(ha.num(E.vehicleDetections))} vehicles detected`, t: "today" },
    { icon: "🚶", cam: "Sidewalk", txt: `${n(ha.num(E.pedestriansToday))} pedestrians`, t: "today" },
    { icon: "🚙", cam: "ANPR", txt: `Last plate: ${ha.state(E.lastPlate) ?? "None"}${ha.attr(E.lastPlate, "camera") ? ` · ${ha.attr(E.lastPlate, "camera")}` : ""}`, t: "" },
    { icon: "👤", cam: "Frigate", txt: `${n(ha.num(E.personDetections))} person events`, t: "today" },
  ]);
  const online = $derived(CAMERAS.filter((c) => ha.available(c.id)).length);
  // Some cameras (raw RTSP) 500 on the snapshot proxy — track which failed so we
  // show a clean "no snapshot" placeholder instead of a broken image.
  let failed = $state<Record<string, boolean>>({});

  // refresh snapshot stills periodically (cache-bust)
  let tick = $state(0);
  onMount(() => { const i = setInterval(() => (tick += 1), 10000); return () => clearInterval(i); });
  function snap(id: string): string | null {
    const ep = ha.attr(id, "entity_picture") as string | undefined;
    if (!ep) return null;
    return `${HASS_URL}${ep}${ep.includes("?") ? "&" : "?"}_=${tick}`;
  }
</script>

<div class="col">
  <div class="kpis">
    <div class="card k"><div class="lb">Gate detections</div><div class="big">{n(ha.num(E.gateDetections))}</div><div class="sub">{n(ha.num(E.vehicleDetections))} vehicles · {n(ha.num(E.personDetections))} person</div></div>
    <div class="card k"><div class="lb">Last plate (ANPR)</div><div class="big pl">{ha.state(E.lastPlate) ?? "None"}</div><div class="sub">{ha.attr(E.lastPlate, "camera") ?? "gate + driveway"} · LLM Vision</div></div>
    <div class="card k"><div class="lb">Cameras online</div><div class="big">{online}<span class="sub" style="font-size:14px"> / {CAMERAS.length}</span></div><div class="sub" style="color:var(--success)">live snapshots</div></div>
  </div>

  <div class="card pad">
    <div class="lb" style="margin-bottom:4px">Recent detections</div>
    {#each events as e}
      <div class="ev"><span class="ei">{e.icon}</span><span class="ec">{e.cam}</span><span class="et">{e.txt}</span><span class="etime">{e.t}</span></div>
    {/each}
  </div>

  <div class="grid">
    {#each CAMERAS as c}
      {@const src = snap(c.id)}
      {@const up = ha.available(c.id)}
      <div class="cam card">
        <div class="feed">
          {#if src && !failed[c.id]}
            <img {src} alt="" loading="lazy" onerror={() => (failed = { ...failed, [c.id]: true })} />
          {:else}
            <div class="ph"><span class="phic">📷</span><span class="fl">{up ? "snapshot · pending" : "offline"}</span></div>
          {/if}
          <span class="rec" class:off={!up} class:live={up && ha.state(c.id) !== "recording"}><span class="rd"></span>{up ? (ha.state(c.id) === "recording" ? "REC" : "LIVE") : "OFFLINE"}</span>
        </div>
        <div class="cf"><span class="cn">{c.label}</span><span class="cs">{c.sub}</span></div>
      </div>
    {/each}
  </div>
  <div class="note">Snapshots refresh every 10s from the HA camera proxy. Tap-through to full HLS/WebRTC streams is a future step.</div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
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
  .feed { aspect-ratio: 16/9; background: radial-gradient(120% 120% at 50% 28%, rgba(129, 140, 248, 0.12), rgba(8, 12, 19, 0.92)); display: flex; align-items: center; justify-content: center; position: relative; }
  .feed img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .ph { display: flex; flex-direction: column; align-items: center; gap: 7px; }
  .phic { font-size: 32px; opacity: 0.45; }
  .fl { font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: var(--muted-2); }
  .rec { position: absolute; top: 9px; left: 9px; z-index: 1; display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; border-radius: 999px; background: rgba(0, 0, 0, 0.5); font-size: 10px; font-weight: 700; color: var(--error); }
  .rec.off { color: var(--muted-2); }
  .rec.live { color: var(--success); }
  .rd { width: 6px; height: 6px; border-radius: 50%; background: var(--error); animation: pulse 1.5s infinite; }
  .rec.live .rd { background: var(--success); }
  .rec.off .rd { background: var(--muted-2); animation: none; }
  .cf { padding: 11px 13px; display: flex; justify-content: space-between; align-items: center; }
  .cn { font-size: 12.5px; font-weight: 600; }
  .cs { font-size: 10.5px; color: var(--muted-2); }
  .note { font-size: 11.5px; color: var(--muted-2); }
</style>
