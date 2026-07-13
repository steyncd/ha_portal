<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E } from "../lib/entities";
  import { n, thousands, dailyMax } from "../lib/format";
  import BarChart from "../lib/components/BarChart.svelte";

  const tod = $derived([
    { label: "Morning", value: ha.num(E.trafficMorning), color: "var(--solar)" },
    { label: "Afternoon", value: ha.num(E.trafficAfternoon), color: "var(--warning)" },
    { label: "Evening", value: ha.num(E.trafficEvening), color: "var(--acc)" },
    { label: "Night", value: ha.num(E.trafficNight), color: "#8b5cf6" },
  ]);

  let weekBars = $state<{ label: string; value: number | null }[]>([]);
  onMount(async () => {
    weekBars = dailyMax(await ha.history(E.vehiclesToday, 24 * 7), 7);
  });

  // ---- ANPR: known-vs-unknown + repeat-visitor tracking ----
  const norm = (s: string) => s.toUpperCase().replace(/\s+/g, "");
  const BAD = new Set(["UNKNOWN", "UNAVAILABLE", "NONE", ""]);

  // PLATE=Name pairs from input_text.known_vehicle_plates
  const known = $derived.by(() => {
    const m = new Map<string, string>();
    for (const pair of (ha.state(E.knownPlates) ?? "").split(",")) {
      const [p, name] = pair.split("=");
      if (p && name) m.set(norm(p), name.trim());
    }
    return m;
  });

  // owner of a plate: known-plate match first, then vehicle-description fallback
  const ownerOf = (plate: string, vehicle = "") => {
    const k = norm(plate);
    if (!BAD.has(k) && known.get(k)) return known.get(k)!;
    const v = vehicle.toLowerCase();
    if (v.includes("jetta")) return "Christo";
    if (v.includes("trailblazer")) return "Mandri";
    return "";
  };

  // ---- full detection log (sensor.anpr_log, newest first) ----
  type Det = { i: number; ts: number; plate: string; vehicle: string; camera: string };
  const detections = $derived.by<Det[]>(() => {
    const ev = (ha.attr("sensor.anpr_log", "events") as { i: number; ts: string; plate: string; vehicle: string; camera: string }[]) ?? [];
    return ev.map((e) => ({ i: e.i, ts: Date.parse((e.ts || "").replace(" ", "T")) || 0, plate: e.plate || "", vehicle: e.vehicle || "", camera: e.camera || "" }));
  });

  type Visitor = { plate: string; count: number; last: number; owner: string };
  const visitors = $derived.by(() => {
    const m = new Map<string, Visitor>();
    for (const d of detections) {
      const k = norm(d.plate);
      if (BAD.has(k)) continue;
      const e = m.get(k) ?? { plate: d.plate, count: 0, last: 0, owner: ownerOf(d.plate, d.vehicle) };
      e.count++; if (d.ts > e.last) e.last = d.ts; e.owner = ownerOf(d.plate, d.vehicle);
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.count - a.count || b.last - a.last);
  });

  const anpr = $derived.by(() => {
    const total = visitors.reduce((s, v) => s + v.count, 0);
    const knownDet = visitors.filter((v) => v.owner).reduce((s, v) => s + v.count, 0);
    return { total, unique: visitors.length, knownPlates: visitors.filter((v) => v.owner).length, unknownPlates: visitors.filter((v) => !v.owner).length, knownDet, unknownDet: total - knownDet };
  });
  const configured = $derived(known.size > 0);

  // ---- known-plate management (edits input_text.known_vehicle_plates) ----
  const knownRaw = $derived.by(() =>
    (ha.state(E.knownPlates) ?? "").split(",").map((p) => { const [pl, nm] = p.split("="); return { plate: (pl || "").trim(), name: (nm || "").trim() }; }).filter((x) => x.plate),
  );
  function saveKnown(pairs: { plate: string; name: string }[]) {
    ha.setText(E.knownPlates, pairs.filter((p) => p.plate).map((p) => `${p.plate}=${p.name}`).join(","));
  }
  let kpNew = $state({ plate: "", name: "" });
  function addKnown() {
    const plate = kpNew.plate.trim().toUpperCase(); if (!plate) return;
    saveKnown([...knownRaw.filter((p) => norm(p.plate) !== norm(plate)), { plate, name: kpNew.name.trim() }]);
    kpNew = { plate: "", name: "" };
  }
  const removeKnown = (plate: string) => saveKnown(knownRaw.filter((p) => p.plate !== plate));
  const tagDetection = (plate: string, name: string) => {
    const p = plate.trim().toUpperCase(); if (!p || !name.trim()) return;
    saveKnown([...knownRaw.filter((x) => norm(x.plate) !== norm(p)), { plate: p, name: name.trim() }]);
  };

  // ---- correct a misread plate ----
  let editIdx = $state<number | null>(null);
  let editVal = $state("");
  const startEdit = (d: Det) => { editIdx = d.i; editVal = d.plate; };
  function saveEdit() { if (editIdx != null && editVal.trim()) ha.anprCorrect(editIdx, editVal.trim().toUpperCase()); editIdx = null; }
  let tagIdx = $state<number | null>(null);
  let tagName = $state("");
  const startTag = (d: Det) => { tagIdx = d.i; tagName = ownerOf(d.plate, d.vehicle); };
  function saveTag(d: Det) { if (tagName.trim()) tagDetection(d.plate, tagName); tagIdx = null; }

  function hhmm(ts: number) { const d = new Date(ts); return isNaN(+d) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
  function dayLabel(ts: number) { const d = new Date(ts); const t = new Date(); const y = new Date(Date.now() - 864e5); if (d.toDateString() === t.toDateString()) return "Today"; if (d.toDateString() === y.toDateString()) return "Yesterday"; return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }); }

  // peak callouts
  const peakSlot = $derived([...tod].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0]);
  const weekend = ["Sat", "Sun"];
  const wkStats = $derived.by(() => {
    const wd = weekBars.filter((b) => !weekend.includes(b.label) && b.value != null);
    const we = weekBars.filter((b) => weekend.includes(b.label) && b.value != null);
    const avg = (a: typeof wd) => (a.length ? a.reduce((s, b) => s + (b.value ?? 0), 0) / a.length : 0);
    const busiest = [...weekBars].filter((b) => b.value != null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
    return { weekday: Math.round(avg(wd)), weekendv: Math.round(avg(we)), busiest };
  });
</script>

<div class="col">
  <div class="kpis">
    <div class="card k"><div class="lb">🚗 Vehicles</div><div class="big">{thousands(ha.num(E.vehiclesToday))}<span class="u"> today</span></div><div class="sub">{thousands(ha.num(E.vehiclesWeek))} week · {thousands(ha.num(E.vehiclesMonth))} month</div></div>
    <div class="card k"><div class="lb">🚶 Pedestrians</div><div class="big">{thousands(ha.num(E.pedestriansToday))}<span class="u"> today</span></div><div class="sub">{thousands(ha.num(E.pedestriansWeek))} week · {thousands(ha.num(E.pedestriansMonth))} month</div></div>
  </div>

  <div class="card pad">
    <div class="rh"><span class="lb">Sidewalk traffic by time of day</span><span class="int">{ha.state(E.trafficIntensity) ?? "—"}</span></div>
    <div class="tod">
      {#each tod as b}
        {@const max = Math.max(1, ...tod.map((x) => x.value ?? 0))}
        <div class="col2">
          <span class="tv">{n(b.value)}</span>
          <div class="bar" style="height:{((b.value ?? 0) / max) * 100}%;background:{b.color}"></div>
          <span class="tl">{b.label}</span>
        </div>
      {/each}
    </div>
  </div>

  <!-- peak callout -->
  <div class="callout">
    <div class="co"><span class="cov">{peakSlot?.label ?? "—"}</span><span class="cok">busiest time of day</span></div>
    <div class="co"><span class="cov">{wkStats.busiest?.label ?? "—"}</span><span class="cok">busiest day this week</span></div>
    <div class="co"><span class="cov">{thousands(wkStats.weekday)} <span class="vs">vs</span> {thousands(wkStats.weekendv)}</span><span class="cok">weekday vs weekend / day</span></div>
  </div>

  <div class="card pad">
    <div class="rh"><span class="lb">Vehicles past gate · 7 days</span><span class="sub">{thousands(ha.num(E.vehiclesWeek))} total</span></div>
    <BarChart bars={weekBars} height={150} />
  </div>

  <!-- ANPR summary -->
  <div class="split2">
    <div class="card sk"><div class="lb">Recognitions</div><div class="big">{anpr.total}</div><div class="sub">{anpr.unique} unique plates</div></div>
    <div class="card sk"><div class="lb">Known</div><div class="big" style="color:var(--success)">{anpr.knownDet}</div><div class="sub">{anpr.knownPlates} tagged vehicles</div></div>
    <div class="card sk"><div class="lb">Unknown</div><div class="big" style="color:var(--warning)">{anpr.unknownDet}</div><div class="sub">{anpr.unknownPlates} untagged</div></div>
  </div>

  <!-- Known vehicles manager -->
  <div class="card pad">
    <div class="rh"><span class="lb">Known vehicles</span><span class="sub">tag a plate → labelled everywhere</span></div>
    {#if knownRaw.length}
      <div class="kplist">
        {#each knownRaw as p}
          <div class="kprow"><span class="plate">{p.plate}</span><span class="who">{p.name || "—"}</span><button class="xbtn" title="Remove" onclick={() => removeKnown(p.plate)}>✕</button></div>
        {/each}
      </div>
    {:else}<div class="sub" style="margin-bottom:12px">No vehicles tagged yet — add one below or tag a detection.</div>{/if}
    <div class="kpadd">
      <input class="in plate-in" placeholder="PLATE" bind:value={kpNew.plate} />
      <input class="in" placeholder="Owner / name" bind:value={kpNew.name} onkeydown={(e) => e.key === "Enter" && addKnown()} />
      <button class="addbtn" onclick={addKnown} disabled={!kpNew.plate.trim()}>Add</button>
    </div>
  </div>

  <!-- Full detection log -->
  <div class="card pad">
    <div class="rh"><span class="lb">Detections · gate + driveway</span><span class="sub">{detections.length} logged{ha.num("sensor.anpr_log") ? ` · ${ha.num("sensor.anpr_log")} total` : ""}</span></div>
    {#if detections.length}
      <div class="detlist">
        {#each detections as d}
          {@const owner = ownerOf(d.plate, d.vehicle)}
          <div class="detrow" class:kn={owner}>
            <div class="dt"><span class="dtt">{hhmm(d.ts)}</span><span class="dtd">{dayLabel(d.ts)}</span></div>
            <div class="dmid">
              {#if editIdx === d.i}
                <input class="in plate-in" bind:value={editVal} onkeydown={(e) => e.key === "Enter" && saveEdit()} />
              {:else}
                <span class="plate">{d.plate || "—"}</span>
              {/if}
              <span class="dveh">{d.vehicle || "vehicle"}{d.camera ? ` · ${d.camera}` : ""}</span>
            </div>
            <span class="downer">{owner || ""}</span>
            <div class="dacts">
              {#if editIdx === d.i}
                <button class="mini ok" onclick={saveEdit}>Save</button><button class="mini" onclick={() => (editIdx = null)}>✕</button>
              {:else if tagIdx === d.i}
                <input class="in tag-in" placeholder="name" bind:value={tagName} onkeydown={(e) => e.key === "Enter" && saveTag(d)} />
                <button class="mini ok" onclick={() => saveTag(d)}>Tag</button><button class="mini" onclick={() => (tagIdx = null)}>✕</button>
              {:else}
                <button class="mini" title="Fix a misread plate" onclick={() => startEdit(d)}>✎</button>
                <button class="mini" title="Tag owner" onclick={() => startTag(d)}>🏷️</button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {:else}<div class="sub">No plates detected yet. A car at the gate or driveway will appear here.</div>{/if}
  </div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }
  .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 640px) { .kpis { grid-template-columns: 1fr; } }
  .k { padding: 18px; }
  .big { font-size: 30px; font-weight: 800; margin-top: 6px; }
  .u { font-size: 14px; color: var(--dim); }
  .sub { font-size: 12px; color: var(--dim); margin-top: 3px; }
  .pad { padding: 20px; }
  .rh { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px; }
  .int { font-size: 12px; font-weight: 700; color: var(--acc); }
  .tod { display: flex; align-items: flex-end; gap: 16px; height: 130px; }
  .col2 { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%; justify-content: flex-end; }
  .tv { font-size: 13px; font-weight: 700; }
  .bar { width: 100%; border-radius: 8px 8px 0 0; min-height: 4px; transition: height 0.5s; }
  .tl { font-size: 11px; color: var(--dim); }
  .callout { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  @media (max-width: 640px) { .callout { grid-template-columns: 1fr; } }
  .co { padding: 15px 18px; border-radius: 16px; background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.025)); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08); }
  .cov { font-size: 20px; font-weight: 800; }
  .cov .vs { font-size: 12px; color: var(--muted); font-weight: 600; }
  .cok { display: block; font-size: 11px; color: var(--muted); margin-top: 3px; }
  .plate { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; }
  .who { font-size: 12.5px; color: var(--text-2); }
  /* ANPR summary tiles */
  .split2 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  @media (max-width: 560px) { .split2 { grid-template-columns: 1fr; } }
  .sk { padding: 15px 18px; }
  .sk .big { font-size: 26px; font-weight: 800; margin-top: 4px; }
  /* known vehicles manager */
  .kplist { display: flex; flex-direction: column; gap: 7px; margin-bottom: 14px; max-height: 220px; overflow-y: auto; }
  .kprow { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 10px; background: color-mix(in srgb, var(--success) 9%, transparent); }
  .xbtn { width: 24px; height: 24px; border-radius: 7px; background: rgba(255, 255, 255, 0.06); color: var(--muted-2); font-size: 12px; }
  .xbtn:hover { color: var(--error); background: color-mix(in srgb, var(--error) 16%, transparent); }
  .kpadd { display: flex; gap: 8px; }
  .in { background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 9px; padding: 8px 11px; color: var(--text); font-size: 13px; min-width: 0; }
  .in:focus { outline: none; border-color: var(--acc); }
  .plate-in { width: 120px; font-family: ui-monospace, Menlo, monospace; font-weight: 700; text-transform: uppercase; }
  .kpadd .in:not(.plate-in) { flex: 1; }
  .addbtn { padding: 8px 16px; border-radius: 9px; background: color-mix(in srgb, var(--acc) 20%, transparent); color: var(--acc); font-weight: 700; font-size: 13px; }
  .addbtn:disabled { opacity: 0.4; }
  /* detection log */
  .detlist { display: flex; flex-direction: column; gap: 6px; max-height: 460px; overflow-y: auto; }
  .detrow { display: grid; grid-template-columns: 60px 1fr auto auto; align-items: center; gap: 12px; padding: 9px 12px; border-radius: 10px; background: rgba(255, 255, 255, 0.04); }
  .detrow.kn { background: color-mix(in srgb, var(--success) 10%, transparent); }
  .dt { display: flex; flex-direction: column; line-height: 1.15; }
  .dtt { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .dtd { font-size: 10px; color: var(--muted-2); }
  .dmid { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .dveh { font-size: 11px; color: var(--muted); text-transform: capitalize; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .downer { font-size: 12.5px; font-weight: 700; color: var(--success); white-space: nowrap; }
  .dacts { display: flex; align-items: center; gap: 5px; }
  .mini { padding: 5px 9px; border-radius: 8px; background: rgba(255, 255, 255, 0.07); color: var(--text-2); font-size: 12px; }
  .mini.ok { background: color-mix(in srgb, var(--acc) 22%, transparent); color: var(--acc); font-weight: 700; }
  .tag-in { width: 96px; }
</style>
