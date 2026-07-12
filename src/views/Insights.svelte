<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E, APPLIANCES } from "../lib/entities";
  import { n, sastHour } from "../lib/format";

  const DAYS = 7;
  const HRS = 24 * DAYS;

  const ROOMS = [
    { label: "Main", id: "binary_sensor.main_room_pir", color: "#a78bfa" },
    { label: "Kids", id: "binary_sensor.helloliam_alarm_zone_003_pir_kids_room", color: "#f472b6" },
    { label: "TV Room", id: "binary_sensor.helloliam_alarm_zone_007_pir_tv_room", color: "#38bdf8" },
    { label: "Lounge", id: "binary_sensor.lounge_pir", color: "#34d399" },
    { label: "Kitchen", id: "binary_sensor.kitchen_pir", color: "#fbbf24" },
    { label: "Garage", id: "binary_sensor.garage_pir", color: "#fb923c" },
    { label: "Passage", id: "binary_sensor.passage_pir", color: "#22d3ee" },
    { label: "Guest", id: "binary_sensor.guest_room_pir", color: "#c084fc" },
  ];

  const asc = (h: { t: number; s: string }[]) => [...h].sort((a, b) => a.t - b.t);
  const fmtHrs = (ms: number) => { const h = ms / 3_600_000; return h < 1 ? `${Math.round(h * 60)}m` : `${h.toFixed(1)}h`; };
  function sumOn(hist: { t: number; s: string }[]) {
    const h = asc(hist); let tot = 0, on: number | null = null;
    for (const e of h) { if (e.s === "on" && on == null) on = e.t; else if (e.s !== "on" && on != null) { tot += e.t - on; on = null; } }
    if (on != null) tot += Date.now() - on;
    return tot;
  }

  let ready = $state(false);
  let heat = $state<{ room: string; color: string; cells: number[]; total: number }[]>([]);
  let heatMax = $state(1);
  let busiest = $state("—");
  let appUsage = $state<{ name: string; icon: string; hours: number; perDay: string; now: number | null; w: number }[]>([]);
  let standby = $state<number | null>(null);
  let armByHour = $state<number[]>(Array(24).fill(0));
  let armMax = $state(1);
  let typicalArm = $state("—");
  let forgot = $state(0);
  let unarmedNow = $state(false);
  let vsTypical = $state<{ label: string; today: string; pct: number | null; good: boolean }[]>([]);
  let headlines = $state<{ icon: string; text: string }[]>([]);

  const armedNow = $derived((ha.state(E.alarmHome) ?? ha.state(E.alarmMain) ?? "").startsWith("armed"));

  onMount(async () => {
    const [roomHists, applHists, loadHist, alarmHist, nobodyHist, waterHist, gridHist, vehHist] = await Promise.all([
      Promise.all(ROOMS.map((r) => ha.historyStates(r.id, HRS))),
      Promise.all(APPLIANCES.map((a) => ha.historyStates(a.sw, HRS))),
      ha.history(E.loads, HRS),
      ha.historyStates(E.alarmHome, HRS),
      ha.historyStates(E.nobodyHome, HRS),
      ha.history(E.waterUsedToday, HRS),
      ha.history(E.gridImportToday, HRS),
      ha.history(E.vehiclesToday, HRS),
    ]);

    // ---- movement heatmap (room × hour of day) ----
    const grid = ROOMS.map((r, i) => {
      const cells = Array(24).fill(0);
      for (const e of roomHists[i]) if (e.s === "on") cells[sastHour(new Date(e.t))]++;
      return { room: r.label, color: r.color, cells, total: cells.reduce((a, b) => a + b, 0) };
    });
    heatMax = Math.max(1, ...grid.flatMap((g) => g.cells));
    heat = grid;
    busiest = [...grid].sort((a, b) => b.total - a.total)[0]?.total ? [...grid].sort((a, b) => b.total - a.total)[0].room : "—";

    // ---- appliance usage (run-time over the week) ----
    appUsage = APPLIANCES.map((a, i) => {
      const ms = sumOn(applHists[i]);
      return { name: a.label, icon: a.icon, hours: ms / 3_600_000, perDay: fmtHrs(ms / DAYS), now: ha.num(a.power), w: ha.num(a.power) ?? 0 };
    }).filter((x) => x.hours > 0.05).sort((a, b) => b.hours - a.hours).slice(0, 8);

    // ---- standby load (avg house load 01:00–04:00) ----
    const night = loadHist.filter((p) => { const h = sastHour(new Date(p.t)); return h >= 1 && h < 4; });
    standby = night.length ? night.reduce((s, p) => s + p.v, 0) / night.length : null;

    // ---- security rhythm ----
    const buckets = Array(24).fill(0);
    let prevArmed = false;
    for (const e of asc(alarmHist)) { const a = e.s.startsWith("armed"); if (a && !prevArmed) buckets[sastHour(new Date(e.t))]++; prevArmed = a; }
    armByHour = buckets; armMax = Math.max(1, ...buckets);
    const topHour = buckets.indexOf(Math.max(...buckets));
    typicalArm = buckets[topHour] > 0 ? `${String(topHour).padStart(2, "0")}:00` : "—";

    // forgot-to-arm: away periods (nobody home) with no overlapping armed interval
    const armedIv: { s: number; e: number }[] = [];
    let aS: number | null = null; prevArmed = false;
    for (const e of asc(alarmHist)) { const a = e.s.startsWith("armed"); if (a && !prevArmed) aS = e.t; else if (!a && prevArmed && aS != null) { armedIv.push({ s: aS, e: e.t }); aS = null; } prevArmed = a; }
    if (aS != null) armedIv.push({ s: aS, e: Date.now() });
    let away: number | null = null, f = 0;
    for (const e of asc(nobodyHist)) {
      if (e.s === "on" && away == null) away = e.t;
      else if (e.s !== "on" && away != null) {
        if (e.t - away > 20 * 60_000 && !armedIv.some((iv) => iv.s < e.t && iv.e > away!)) f++;
        away = null;
      }
    }
    forgot = f;
    unarmedNow = ha.isOn(E.nobodyHome) && !armedNow;

    // ---- this week vs typical ----
    const peaks = (h: { t: number; v: number }[]) => {
      const m = new Map<number, number>();
      for (const p of h) { const d = new Date(p.t); d.setHours(0, 0, 0, 0); m.set(d.getTime(), Math.max(m.get(d.getTime()) ?? 0, p.v)); }
      return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
    };
    const cmp = (label: string, hist: { t: number; v: number }[], todayId: string, lowerBetter: boolean) => {
      const days = peaks(hist); const today = ha.num(todayId);
      const prior = days.slice(0, -1); const avg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : null;
      const pct = avg != null && avg > 0 && today != null ? Math.round(((today - avg) / avg) * 100) : null;
      return { label, today: today != null ? n(today) : "—", pct, good: pct == null ? true : lowerBetter ? pct <= 0 : pct >= 0 };
    };
    vsTypical = [
      cmp("Water used", waterHist, E.waterUsedToday, true),
      cmp("Grid import", gridHist, E.gridImportToday, true),
      cmp("Vehicles past gate", vehHist, E.vehiclesToday, false),
    ];

    // ---- headline insights ----
    const hl: { icon: string; text: string }[] = [];
    if (unarmedNow) hl.push({ icon: "🚨", text: "Nobody home and the alarm is disarmed right now." });
    if (busiest !== "—") hl.push({ icon: "🚶", text: `${busiest} is your most-used room this week.` });
    if (typicalArm !== "—") hl.push({ icon: "🛡️", text: `You usually arm around ${typicalArm}${forgot ? ` · left home un-armed ${forgot}× this week` : ""}.` });
    if (standby != null) hl.push({ icon: "🔌", text: `Overnight standby load averages ${Math.round(standby)} W.` });
    const w = vsTypical[0];
    if (w?.pct != null && Math.abs(w.pct) >= 25) hl.push({ icon: "💧", text: `Water use is ${Math.abs(w.pct)}% ${w.pct > 0 ? "above" : "below"} your weekly norm.` });
    headlines = hl.slice(0, 5);

    ready = true;
  });

  const hourTicks = [0, 6, 12, 18];
  const cellBg = (v: number) => (v === 0 ? "rgba(255,255,255,.04)" : `color-mix(in srgb, var(--acc) ${12 + Math.round((v / heatMax) * 78)}%, transparent)`);
</script>

<div class="col">
  <div class="head">
    <div><h1>Insights</h1><p>Patterns from the last {DAYS} days · computed live from history</p></div>
  </div>

  {#if !ready}
    <div class="card pad note">Crunching {DAYS} days of history…</div>
  {:else}
    <!-- headline insights -->
    {#if headlines.length}
      <div class="card pad hl">
        {#each headlines as h}<div class="hlrow"><span class="hli">{h.icon}</span><span>{h.text}</span></div>{/each}
      </div>
    {/if}

    <!-- this week vs typical -->
    <div class="vs">
      {#each vsTypical as v}
        <div class="card vscard">
          <div class="vslbl">{v.label}</div>
          <div class="vsval">{v.today}</div>
          {#if v.pct != null && v.pct !== 0}
            <div class="vspct" style="color:{v.good ? 'var(--success)' : 'var(--warning)'}">{v.pct > 0 ? "▲" : "▼"} {Math.abs(v.pct)}% vs typical</div>
          {:else}<div class="vspct dim">≈ on your average</div>{/if}
        </div>
      {/each}
    </div>

    <!-- movement heatmap -->
    <div class="card pad">
      <div class="rh"><span class="lb">Movement by room & hour · {DAYS}-day pattern</span><span class="sub">from PIR sensors</span></div>
      <div class="heatscroll">
        <div class="heat">
          <div class="hrow hhead"><span class="hlbl"></span><div class="hcells">{#each Array(24) as _, hr}<span class="htick">{hourTicks.includes(hr) ? hr + "h" : ""}</span>{/each}</div></div>
          {#each heat as row}
            <div class="hrow"><span class="hlbl">{row.room}</span><div class="hcells">{#each row.cells as c, hr}<span class="hcell" style="background:{cellBg(c)}" title="{row.room} · {String(hr).padStart(2,'0')}:00 · {c} events"></span>{/each}</div></div>
          {/each}
        </div>
      </div>
      <div class="heatkey"><span>Quiet</span><span class="hk0"></span><span class="hk1"></span><span class="hk2"></span><span class="hk3"></span><span>Busy</span></div>
    </div>

    <div class="two">
      <!-- appliance usage -->
      <div class="card pad">
        <div class="rh"><span class="lb">Appliance run-time · {DAYS} days</span><span class="sub">hrs / day avg</span></div>
        {#if appUsage.length}
          <div class="applist">
            {#each appUsage as a}
              {@const max = appUsage[0].hours}
              <div class="approw"><span class="appic">{a.icon}</span><span class="appn">{a.name}</span><div class="apptrack"><div class="appfill" style="width:{(a.hours / max) * 100}%"></div></div><span class="appd">{a.perDay}</span></div>
            {/each}
          </div>
        {:else}<div class="note">No appliance activity in the window.</div>{/if}
      </div>

      <!-- security rhythm -->
      <div class="card pad">
        <div class="rh"><span class="lb">Security rhythm</span><span class="sub">arms by hour · {DAYS} days</span></div>
        <div class="armbars">
          {#each armByHour as v, hr}<div class="armcol"><div class="armbar" style="height:{Math.max(3, (v / armMax) * 100)}%;opacity:{v ? 1 : 0.25}"></div>{#if hourTicks.includes(hr)}<span class="armtick">{hr}h</span>{/if}</div>{/each}
        </div>
        <div class="secstats">
          <div class="ss2"><span class="ssv">{typicalArm}</span><span class="ssk">usual arm time</span></div>
          <div class="ss2"><span class="ssv" style="color:{forgot ? 'var(--warning)' : 'var(--success)'}">{forgot}</span><span class="ssk">left home un-armed</span></div>
          <div class="ss2"><span class="ssv" style="color:{unarmedNow ? 'var(--error)' : 'var(--success)'}">{unarmedNow ? "Yes" : "No"}</span><span class="ssk">unarmed while away now</span></div>
        </div>
      </div>
    </div>

    <!-- standby -->
    <div class="card pad standby">
      <div><div class="lb">Overnight standby load</div><div class="sub">average house draw 01:00–04:00 over {DAYS} days — your always-on baseline</div></div>
      <div class="stbv">{standby != null ? Math.round(standby) : "—"}<span class="stbu"> W</span></div>
    </div>
  {/if}
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; max-width: 1180px; margin: 0 auto; }
  .head h1 { margin: 0; font-size: 27px; font-weight: 800; letter-spacing: -0.7px; background: var(--title-grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .head p { margin: 5px 0 0; color: var(--dim); font-size: 13px; }
  .pad { padding: 20px 22px; }
  .rh { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 14px; }
  .sub { font-size: 12px; color: var(--dim); }
  .note { font-size: 12.5px; color: var(--muted-2); }
  .lb { font-size: 11px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: var(--muted); }

  .hl { display: flex; flex-direction: column; gap: 10px; background: linear-gradient(180deg, color-mix(in srgb, var(--acc) 10%, transparent), rgba(255, 255, 255, 0.028)); }
  .hlrow { display: flex; align-items: center; gap: 12px; font-size: 13.5px; color: var(--text); }
  .hli { font-size: 17px; width: 22px; text-align: center; flex-shrink: 0; }

  .vs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  @media (max-width: 640px) { .vs { grid-template-columns: 1fr; } }
  .vscard { padding: 16px 18px; }
  .vslbl { font-size: 11.5px; color: var(--muted); }
  .vsval { font-size: 26px; font-weight: 800; margin-top: 4px; }
  .vspct { font-size: 12px; font-weight: 700; margin-top: 3px; }
  .vspct.dim { color: var(--muted-2); font-weight: 500; }

  .heatscroll { overflow-x: auto; }
  .heat { min-width: 520px; display: flex; flex-direction: column; gap: 4px; }
  .hrow { display: flex; align-items: center; gap: 10px; }
  .hlbl { width: 66px; flex-shrink: 0; font-size: 11.5px; color: var(--text-2); }
  .hcells { flex: 1; display: grid; grid-template-columns: repeat(24, 1fr); gap: 2px; }
  .hcell { height: 16px; border-radius: 3px; }
  .hhead .hcell { display: none; }
  .htick { font-size: 9px; color: var(--muted-2); grid-column: span 1; }
  .hhead .hcells { display: flex; }
  .hhead .htick { flex: 1; }
  .heatkey { display: flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 10.5px; color: var(--muted-2); }
  .heatkey span[class^="hk"] { width: 18px; height: 12px; border-radius: 3px; }
  .hk0 { background: color-mix(in srgb, var(--acc) 18%, transparent); }
  .hk1 { background: color-mix(in srgb, var(--acc) 40%, transparent); }
  .hk2 { background: color-mix(in srgb, var(--acc) 64%, transparent); }
  .hk3 { background: color-mix(in srgb, var(--acc) 90%, transparent); }

  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 820px) { .two { grid-template-columns: 1fr; } }
  .applist { display: flex; flex-direction: column; gap: 11px; }
  .approw { display: flex; align-items: center; gap: 10px; }
  .appic { font-size: 15px; width: 20px; text-align: center; }
  .appn { width: 92px; flex-shrink: 0; font-size: 12.5px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .apptrack { flex: 1; height: 9px; border-radius: 999px; background: rgba(255, 255, 255, 0.07); overflow: hidden; }
  .appfill { height: 100%; border-radius: 999px; background: var(--grad); }
  .appd { width: 52px; text-align: right; font-size: 11.5px; font-weight: 700; }

  .armbars { display: flex; align-items: flex-end; gap: 2px; height: 90px; }
  .armcol { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; position: relative; }
  .armbar { width: 100%; border-radius: 3px 3px 0 0; background: var(--acc); min-height: 3px; }
  .armtick { position: absolute; bottom: -16px; font-size: 9px; color: var(--muted-2); }
  .secstats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 26px; }
  .ss2 { display: flex; flex-direction: column; gap: 2px; }
  .ssv { font-size: 18px; font-weight: 800; }
  .ssk { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }

  .standby { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .stbv { font-size: 34px; font-weight: 800; letter-spacing: -1px; flex-shrink: 0; }
  .stbu { font-size: 16px; color: var(--dim); }
</style>
