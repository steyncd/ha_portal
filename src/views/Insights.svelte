<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E, APPLIANCES } from "../lib/entities";
  import { n, sastHour } from "../lib/format";
  import TrendCard from "../lib/components/TrendCard.svelte";
  import { analyze, analyzeScalars, toSeries, rank, type MetricDef, type Trend, type StatPoint } from "../lib/trends";

  const DAYS = 7;
  const HRS = 24 * DAYS;

  // Long-term trend metrics — pulled from LTS (months), with a 30-day history fallback.
  const METRICS: MetricDef[] = [
    { key: "standby", label: "Phantom (standby) load", stat: "sensor.all_standby_power", unit: " W", goodUp: false, domain: "energy" },
    { key: "baseline", label: "Baseline house load", stat: "sensor.estimated_baseline_load", unit: " W", goodUp: false, domain: "energy" },
    { key: "bhruntime", label: "Borehole run-time", stat: E.boreholeRunToday, unit: " h", goodUp: false, domain: "water" },
    { key: "wateravg", label: "Daily water use", stat: "sensor.water_used_yesterday", unit: " L", goodUp: false, domain: "water" },
  ];

  // bucket raw {t,v} history into one point per day (fallback when LTS is thin)
  function dailyFromHistory(raw: { t: number; v: number }[]): StatPoint[] {
    const m = new Map<number, { s: number; c: number; mn: number; mx: number }>();
    for (const p of raw) {
      const d = new Date(p.t); d.setHours(0, 0, 0, 0);
      const k = d.getTime();
      const e = m.get(k) ?? { s: 0, c: 0, mn: p.v, mx: p.v };
      e.s += p.v; e.c++; e.mn = Math.min(e.mn, p.v); e.mx = Math.max(e.mx, p.v);
      m.set(k, e);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([t, e]) => ({ t, mean: e.s / e.c, min: e.mn, max: e.mx, sum: e.s, change: null }));
  }

  // server-side InfluxQL baselines (months of real InfluxDB history) — [90d baseline, 7d recent]
  const INFLUX: Record<string, [string, string]> = {
    standby: ["sensor.standby_power_90d_baseline", "sensor.standby_power_7d_recent"],
    baseline: ["sensor.baseline_load_90d_baseline", "sensor.baseline_load_7d_recent"],
    bhruntime: ["sensor.borehole_runtime_90d_baseline", "sensor.borehole_runtime_7d_recent"],
    wateravg: ["sensor.water_use_90d_baseline", "sensor.water_use_7d_recent"],
  };

  async function buildTrends(): Promise<Trend[]> {
    const results = await Promise.all(
      METRICS.map(async (def) => {
        // sparkline series (short, cheap) for the visual
        let pts = await ha.statistics(def.stat, { period: "day", days: def.days ?? 90 });
        if (pts.length < 6) pts = dailyFromHistory(await ha.history(def.stat, 24 * 30));
        // prefer the server-side months-deep baseline where available
        const inf = INFLUX[def.key];
        if (inf) {
          const base = ha.num(inf[0]);
          const recent = ha.num(inf[1]);
          if (base != null && recent != null && base > 0) {
            const t = analyzeScalars(def, base, recent, toSeries(pts));
            if (t) return t;
          }
        }
        return analyze(def, pts); // fallback: derive from the client series
      }),
    );
    return rank(results.filter((t): t is Trend => t != null));
  }

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
  const whenAgo = (t: number) => { const m = Math.round((Date.now() - t) / 60000); if (m < 60) return `${m}m ago`; const h = Math.round(m / 60); return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`; };
  function sumOn(hist: { t: number; s: string }[]) {
    const h = asc(hist); let tot = 0, on: number | null = null;
    for (const e of h) { if (e.s === "on" && on == null) on = e.t; else if (e.s !== "on" && on != null) { tot += e.t - on; on = null; } }
    if (on != null) tot += Date.now() - on;
    return tot;
  }
  // on→off intervals with duration (for gate dwell / loitering)
  function intervalsOn(hist: { t: number; s: string }[]) {
    const h = asc(hist); const out: { s: number; e: number; dur: number }[] = []; let on: number | null = null;
    for (const e of h) { if (e.s === "on" && on == null) on = e.t; else if (e.s !== "on" && on != null) { out.push({ s: on, e: e.t, dur: e.t - on }); on = null; } }
    if (on != null) out.push({ s: on, e: Date.now(), dur: Date.now() - on });
    return out;
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
  let vsTypical = $state<{ label: string; today: string; pct: number | null; good: boolean; months?: boolean }[]>([]);
  let headlines = $state<{ icon: string; text: string }[]>([]);
  let trends = $state<Trend[]>([]);
  let armVsTypical = $state<{ week: number; pct: number | null } | null>(null);
  let loiter = $state<{ total: number; week: number; longestMin: number; recent: { t: number; min: number }[] } | null>(null);
  let refreshing = $state(false);

  // Cache the computed analysis so repeat visits paint instantly, then refresh in the background.
  const CACHE_KEY = "ha_portal_insights_v1";
  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), d: { heat, heatMax, busiest, appUsage, standby, armByHour, armMax, typicalArm, forgot, unarmedNow, vsTypical, headlines, trends, armVsTypical, loiter } }));
    } catch { /* quota / private mode — skip */ }
  }
  function restoreCache(): boolean {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return false;
      const { d } = JSON.parse(raw);
      heat = d.heat; heatMax = d.heatMax; busiest = d.busiest; appUsage = d.appUsage; standby = d.standby;
      armByHour = d.armByHour; armMax = d.armMax; typicalArm = d.typicalArm; forgot = d.forgot; unarmedNow = d.unarmedNow;
      vsTypical = d.vsTypical; headlines = d.headlines; trends = d.trends; armVsTypical = d.armVsTypical; loiter = d.loiter;
      return true;
    } catch { return false; }
  }

  const armedNow = $derived((ha.state(E.alarmHome) ?? ha.state(E.alarmMain) ?? "").startsWith("armed"));

  // learned alert baselines (from the trend_watch HA package; null until it's loaded)
  const baselines = $derived.by(() => ({
    wb: ha.num("input_number.water_use_baseline"),
    gb: ha.num("input_number.grid_import_baseline"),
    days: ha.num("input_number.trend_watch_days"),
  }));

  onMount(async () => {
    if (restoreCache()) { ready = true; refreshing = true; } // instant paint from last visit
    try {
    const trendsP = buildTrends().catch(() => [] as Trend[]);
    const [roomHists, applHists, loadHist, alarmHist, nobodyHist, waterHist, gridHist, vehHist, plateHist, alarmHist30, gateOcc] = await Promise.all([
      Promise.all(ROOMS.map((r) => ha.historyStates(r.id, HRS))),
      Promise.all(APPLIANCES.map((a) => ha.historyStates(a.sw, HRS))),
      ha.history(E.loads, HRS),
      ha.historyStates(E.alarmHome, HRS),
      ha.historyStates(E.nobodyHome, HRS),
      ha.history(E.waterUsedToday, HRS),
      ha.history(E.gridImportToday, HRS),
      ha.history(E.vehiclesToday, HRS),
      ha.historyStates(E.lastPlate, 24 * 30),
      ha.historyStates(E.alarmHome, 24 * 30),
      ha.historyStates("binary_sensor.main_gate_ai_person_occupancy", 24 * 30),
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

    // ---- arms this week vs typical (over 30 days) ----
    const armEvents: number[] = [];
    prevArmed = false;
    for (const e of asc(alarmHist30)) { const a = e.s.startsWith("armed"); if (a && !prevArmed) armEvents.push(e.t); prevArmed = a; }
    const wkAgo = Date.now() - 7 * 86_400_000;
    const thisWk = armEvents.filter((t) => t >= wkAgo).length;
    const priorWks = armEvents.filter((t) => t < wkAgo).length / (23 / 7);
    armVsTypical = { week: thisWk, pct: priorWks > 0 ? Math.round(((thisWk - priorWks) / priorWks) * 100) : null };

    // ---- gate dwell / loitering (person present ≥3 min at the gate) ----
    const iv = intervalsOn(gateOcc);
    const loiters = iv.filter((x) => x.dur >= 3 * 60_000);
    loiter = {
      total: loiters.length,
      week: loiters.filter((x) => x.e >= wkAgo).length,
      longestMin: iv.length ? Math.round(Math.max(...iv.map((x) => x.dur)) / 60_000) : 0,
      recent: [...loiters].sort((a, b) => b.e - a.e).slice(0, 4).map((x) => ({ t: x.e, min: Math.round(x.dur / 60_000) })),
    };

    // ---- this week vs typical ----
    const peaks = (h: { t: number; v: number }[]) => {
      const m = new Map<number, number>();
      for (const p of h) { const d = new Date(p.t); d.setHours(0, 0, 0, 0); m.set(d.getTime(), Math.max(m.get(d.getTime()) ?? 0, p.v)); }
      return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
    };
    // baseline90d (optional): a months-deep InfluxDB baseline. When present it
    // replaces the shallow client-side "prior days" average → genuinely months-deep.
    const cmp = (label: string, hist: { t: number; v: number }[], todayId: string, lowerBetter: boolean, baseline90d: number | null = null) => {
      const today = ha.num(todayId);
      let avg = baseline90d != null && baseline90d > 0 ? baseline90d : null;
      let months = avg != null;
      if (avg == null) { const prior = peaks(hist).slice(0, -1); avg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : null; months = false; }
      const pct = avg != null && avg > 0 && today != null ? Math.round(((today - avg) / avg) * 100) : null;
      return { label, today: today != null ? n(today) : "—", pct, good: pct == null ? true : lowerBetter ? pct <= 0 : pct >= 0, months };
    };
    vsTypical = [
      cmp("Water used", waterHist, E.waterUsedToday, true, ha.num("sensor.water_use_90d_baseline")),
      cmp("Grid import", gridHist, E.gridImportToday, true),
      cmp("Vehicles past gate", vehHist, E.vehiclesToday, false),
    ];

    // ---- headline insights ----
    trends = await trendsP;
    const hl: { icon: string; text: string }[] = [];
    if (unarmedNow) hl.push({ icon: "🚨", text: "Nobody home and the alarm is disarmed right now." });
    // most significant long-term trend, phrased for the feed
    const topBad = trends.find((t) => t.good === false && Math.abs(t.deltaPct) >= 10);
    if (topBad) hl.push({ icon: topBad.def.domain === "water" ? "💧" : "🔌", text: `${topBad.headline} — ${topBad.detail.replace(/\.$/, "")}.` });
    if (busiest !== "—") hl.push({ icon: "🚶", text: `${busiest} is your most-used room this week.` });
    if (typicalArm !== "—") hl.push({ icon: "🛡️", text: `You usually arm around ${typicalArm}${forgot ? ` · left home un-armed ${forgot}× this week` : ""}.` });
    if (standby != null) hl.push({ icon: "🔌", text: `Overnight base load averages ${Math.round(standby)} W (01:00–04:00).` });
    const w = vsTypical[0];
    if (w?.pct != null && Math.abs(w.pct) >= 25) hl.push({ icon: "💧", text: `Water use is ${Math.abs(w.pct)}% ${w.pct > 0 ? "above" : "below"} your weekly norm.` });

    // gate ANPR security insight (known-vehicle share + unknown plates this month)
    const knownMap = new Map<string, string>();
    for (const pair of (ha.state(E.knownPlates) ?? "").split(",")) { const [p, name] = pair.split("="); if (p && name) knownMap.set(p.toUpperCase().replace(/\s+/g, ""), name.trim()); }
    const badPlate = new Set(["UNKNOWN", "UNAVAILABLE", "NONE", ""]);
    let kn = 0, unk = 0; const unkSet = new Set<string>();
    for (const p of plateHist) { const k = p.s.trim().toUpperCase().replace(/\s+/g, ""); if (badPlate.has(k)) continue; if (knownMap.get(k)) kn++; else { unk++; unkSet.add(k); } }
    if (kn + unk > 0) hl.push({ icon: "🚗", text: `Gate ANPR: ${Math.round((kn / (kn + unk)) * 100)}% of recognitions are known vehicles${unkSet.size ? ` · ${unkSet.size} unknown plate${unkSet.size > 1 ? "s" : ""} this month` : ""}.` });
    if (loiter && loiter.week > 0) hl.push({ icon: "🚷", text: `Someone dwelled at the gate 3 min+ ${loiter.week}× this week.` });
    if (armVsTypical?.pct != null && Math.abs(armVsTypical.pct) >= 30) hl.push({ icon: "🛡️", text: `You've armed ${Math.abs(armVsTypical.pct)}% ${armVsTypical.pct > 0 ? "more" : "less"} than usual this week.` });

    headlines = hl.slice(0, 6);
    } catch (e) {
      console.error("[Insights] analysis failed", e);
    } finally {
      ready = true;
      refreshing = false;
      saveCache();
    }
  });

  const hourTicks = [0, 6, 12, 18];
  const cellBg = (v: number) => (v === 0 ? "rgba(255,255,255,.04)" : `color-mix(in srgb, var(--acc) ${12 + Math.round((v / heatMax) * 78)}%, transparent)`);
</script>

<div class="col">
  <div class="head">
    <div><h1>Insights</h1><p>Long-term trends + {DAYS}-day patterns · computed from your history{#if refreshing} · <span class="refreshing">updating…</span>{/if}</p></div>
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

    <!-- long-term trends (retrospective, from LTS/history) -->
    {#if trends.length}
      <div class="card pad">
        <div class="rh"><span class="lb">Long-term trends · months of history</span><span class="sub">each metric vs its own baseline</span></div>
        <div class="tgrid">
          {#each trends as t (t.def.key)}<TrendCard trend={t} />{/each}
        </div>
      </div>
    {/if}

    <!-- learned alert baselines (from the trend_watch HA package) -->
    {#if baselines.wb != null || baselines.gb != null || baselines.days != null}
      <div class="card pad">
        <div class="rh"><span class="lb">Learned alert baselines</span><span class="sub">{baselines.days != null ? `${Math.round(baselines.days)} days learned${baselines.days < 14 ? " · maturing" : " · active"}` : "from trend_watch"}</span></div>
        <div class="blines">
          <div class="bl"><span class="blk">💧 Water / day</span><span class="blv">{baselines.wb ? `${n(baselines.wb)} L` : "learning…"}</span><span class="blt">{baselines.wb ? `pushes alert above ${n(baselines.wb * 1.3)} L` : "seeds at 23:55 · matures ~14 days"}</span></div>
          <div class="bl"><span class="blk">🔌 Grid import / day</span><span class="blv">{baselines.gb ? `${n(baselines.gb, 1)} kWh` : "learning…"}</span><span class="blt">{baselines.gb ? `pushes alert above ${n(baselines.gb * 1.4, 1)} kWh` : "seeds at 23:55 · matures ~14 days"}</span></div>
        </div>
      </div>
    {/if}

    <!-- this week vs typical -->
    <div class="vs">
      {#each vsTypical as v}
        <div class="card vscard">
          <div class="vslbl">{v.label}{#if v.months}<span class="vs90" title="Compared against a 90-day InfluxDB baseline">90d</span>{/if}</div>
          <div class="vsval">{v.today}</div>
          {#if v.pct != null && v.pct !== 0}
            <div class="vspct" style="color:{v.good ? 'var(--success)' : 'var(--warning)'}">{v.pct > 0 ? "▲" : "▼"} {Math.abs(v.pct)}% vs {v.months ? "90-day norm" : "typical"}</div>
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
          <div class="ss2"><span class="ssv" style="color:{unarmedNow ? 'var(--error)' : 'var(--success)'}">{unarmedNow ? "Yes" : "No"}</span><span class="ssk">unarmed away now</span></div>
          {#if armVsTypical}
            <div class="ss2"><span class="ssv" style="color:{armVsTypical.pct == null ? 'var(--text)' : armVsTypical.pct >= 0 ? 'var(--success)' : 'var(--warning)'}">{armVsTypical.week}{#if armVsTypical.pct != null}<span class="sspct"> {armVsTypical.pct > 0 ? "+" : ""}{armVsTypical.pct}%</span>{/if}</span><span class="ssk">arms this wk · vs usual</span></div>
          {/if}
          {#if loiter}
            <div class="ss2"><span class="ssv" style="color:{loiter.week ? 'var(--warning)' : 'var(--success)'}">{loiter.total}</span><span class="ssk">gate dwells 3m+ · {loiter.week} this wk</span></div>
          {/if}
        </div>
        {#if loiter && loiter.recent.length}
          <div class="loiterrow">
            <span class="lrk">Recent dwells</span>
            {#each loiter.recent as d}<span class="lrpill">{d.min}m · {whenAgo(d.t)}</span>{/each}
          </div>
        {/if}
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
  .refreshing { color: var(--acc); font-weight: 600; }
  .pad { padding: 20px 22px; }
  .rh { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 14px; }
  .sub { font-size: 12px; color: var(--dim); }
  .note { font-size: 12.5px; color: var(--muted-2); }
  .lb { font-size: 11px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: var(--muted); }

  .hl { display: flex; flex-direction: column; gap: 10px; background: linear-gradient(180deg, color-mix(in srgb, var(--acc) 10%, transparent), rgba(255, 255, 255, 0.028)); }
  .hlrow { display: flex; align-items: center; gap: 12px; font-size: 13.5px; color: var(--text); }
  .hli { font-size: 17px; width: 22px; text-align: center; flex-shrink: 0; }

  .tgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; }
  .vs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  @media (max-width: 640px) { .vs { grid-template-columns: 1fr; } }
  .vscard { padding: 16px 18px; }
  .vslbl { font-size: 11.5px; color: var(--muted); }
  .vs90 { margin-left: 6px; font-size: 9px; font-weight: 800; letter-spacing: .5px; color: var(--acc); background: color-mix(in srgb, var(--acc) 16%, transparent); padding: 1px 5px; border-radius: 6px; vertical-align: middle; }
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
  .secstats { display: grid; grid-template-columns: repeat(auto-fit, minmax(84px, 1fr)); gap: 10px 12px; margin-top: 26px; }
  .ss2 { display: flex; flex-direction: column; gap: 2px; }
  .ssv { font-size: 18px; font-weight: 800; }
  .sspct { font-size: 11px; font-weight: 700; }
  .ssk { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .loiterrow { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); }
  .lrk { font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-right: 2px; }
  .lrpill { font-size: 11px; font-weight: 600; color: var(--text-2); background: color-mix(in srgb, var(--warning) 12%, transparent); padding: 3px 9px; border-radius: 999px; }

  .blines { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 560px) { .blines { grid-template-columns: 1fr; } }
  .bl { display: flex; flex-direction: column; gap: 3px; padding: 14px 16px; border-radius: 13px; background: rgba(255, 255, 255, 0.035); }
  .blk { font-size: 11.5px; color: var(--text-2); }
  .blv { font-size: 22px; font-weight: 800; }
  .blt { font-size: 11px; color: var(--muted-2); }

  .standby { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .stbv { font-size: 34px; font-weight: 800; letter-spacing: -1px; flex-shrink: 0; }
  .stbu { font-size: 16px; color: var(--dim); }
</style>
