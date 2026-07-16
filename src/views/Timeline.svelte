<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { APPLIANCES } from "../lib/entities";
  import { n, clock, sastHour } from "../lib/format";

  type Tab = "me" | "kids";
  type Range = "today" | "yesterday" | "history";
  let tab = $state<Tab>("me");
  let meRange = $state<Range>("today");
  let kidRange = $state<Range>("today");

  const PERSON = "person.christo_steyn";
  const MY_GEO = "sensor.hello_geocoded_location";
  const KID = "person.hello_liam_en_eben";
  const KID_GEO = "sensor.kid_s_phone_geocoded_location";
  const KID_BATT = "sensor.kid_s_phone_battery_level";

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
  const QUIET = "rgba(255,255,255,.06)";
  const AWAY = "rgba(255,255,255,.13)";
  const DAY = 86_400_000;

  const clk = (t: number) => clock(t);
  const fmtDur = (ms: number) => { const m = Math.round(ms / 60000); if (m < 1) return "<1m"; if (m < 60) return `${m}m`; const h = Math.floor(m / 60); return `${h}h ${m % 60}m`; };
  const asc = (h: { t: number; s: string }[]) => [...h].sort((a, b) => a.t - b.t);

  function windowFor(r: Range) {
    const now = Date.now();
    const mid = new Date(); mid.setHours(0, 0, 0, 0);
    if (r === "today") return { start: mid.getTime(), end: now, dayStart: mid.getTime(), label: "today", ctx: "today so far" };
    if (r === "yesterday") return { start: mid.getTime() - DAY, end: mid.getTime(), dayStart: mid.getTime() - DAY, label: "yesterday", ctx: "yesterday" };
    return { start: now - 7 * DAY, end: now, dayStart: mid.getTime(), label: "· last 7 days", ctx: "typical day · 7-day avg" };
  }

  // total "on" duration within [ws,we]
  function sumOn(hist: { t: number; s: string }[], ws: number, we: number) {
    const h = asc(hist); let total = 0, lastOn: number | null = null;
    for (const e of h) {
      if (e.s === "on" && lastOn == null) lastOn = Math.max(e.t, ws);
      else if (e.s !== "on" && lastOn != null) { total += Math.min(e.t, we) - lastOn; lastOn = null; }
    }
    if (lastOn != null) total += we - lastOn;
    return Math.max(0, total);
  }

  // ---------- Me data ----------
  let segs = $state<{ color: string; w: number; title: string }[]>([]);
  let legend = $state<{ label: string; color: string }[]>([]);
  let roomTime = $state<{ label: string; color: string; w: number; dur: string }[]>([]);
  type ALog = { icon: string; name: string; detail: string; t: string; start: number; durMs: number; running: boolean };
  let applog = $state<ALog[]>([]);
  let appFilter = $state<"all" | "running">("all");
  let appSort = $state<"recent" | "long" | "name">("recent");
  const appView = $derived.by(() => {
    const f = applog.filter((e) => (appFilter === "running" ? e.running : true));
    const cmp: (a: ALog, b: ALog) => number =
      appSort === "long" ? (a, b) => b.durMs - a.durMs
      : appSort === "name" ? (a, b) => a.name.localeCompare(b.name)
      : (a, b) => b.start - a.start;
    return [...f].sort(cmp).slice(0, 12);
  });
  type Place = { icon: string; name: string; tag: string; zone: boolean; sub: string; window: string; dur: string; start: number; durMs: number; count: number };
  // ---- places-list ordering + filtering ----
  type PFilter = "all" | "zone" | "geo";
  type PSort = "recent" | "long" | "name";
  let meFilter = $state<PFilter>("all");
  let meSort = $state<PSort>("recent");
  let kidFilter = $state<PFilter>("all");
  let kidSort = $state<PSort>("recent");
  function applyPF(list: Place[], filter: PFilter, sort: PSort) {
    const f = list.filter((p) => (filter === "all" ? true : filter === "zone" ? p.zone : !p.zone));
    const cmp =
      sort === "long" ? (a: Place, b: Place) => b.durMs - a.durMs
      : sort === "name" ? (a: Place, b: Place) => a.name.localeCompare(b.name)
      : (a: Place, b: Place) => b.start - a.start;
    return [...f].sort(cmp).slice(0, 20);
  }
  let places = $state<Place[]>([]);
  let hero = $state({ summary: "—", sub: "", atHome: "—", places: 0, appl: 0, ctx: "today so far", label: "today" });

  function placeName(s: string) {
    if (s === "home") return "Home";
    if (s === "not_home") return "Out & about";
    return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  // person state segments within window
  function personSegs(hist: { t: number; s: string }[], ws: number, we: number) {
    const h = asc(hist).filter((e) => e.s && e.s !== "unknown" && e.s !== "unavailable");
    const out: { s: string; start: number; end: number }[] = [];
    let cur: { s: string; start: number } | null = null;
    for (const e of h) {
      if (!cur) { cur = { s: e.s, start: e.t }; continue; }
      if (e.s !== cur.s) { out.push({ s: cur.s, start: cur.start, end: e.t }); cur = { s: e.s, start: e.t }; }
    }
    if (cur) out.push({ s: cur.s, start: cur.start, end: we });
    return out.map((p) => ({ ...p, start: Math.max(p.start, ws), end: Math.min(p.end, we) })).filter((p) => p.end > p.start);
  }

  async function loadMe(r: Range) {
    const { start, end, dayStart, ctx, label } = windowFor(r);
    const hrs = Math.ceil((Date.now() - start) / 3_600_000) + 1;
    const [roomHists, personHist, applHists, geoHist] = await Promise.all([
      Promise.all(ROOMS.map((rm) => ha.historyStates(rm.id, hrs))),
      ha.historyStates(PERSON, hrs),
      Promise.all(APPLIANCES.map((a) => ha.historyStates(a.sw, hrs))),
      ha.historyStates(MY_GEO, hrs),
    ]);

    // ----- movement bar -----
    if (r === "history") {
      // typical day: 24 hourly buckets, coloured by the most-active room that hour
      const buckets = Array.from({ length: 24 }, () => ({}) as Record<number, number>);
      roomHists.forEach((h, i) => h.forEach((e) => { if (e.s === "on") { const hr = sastHour(new Date(e.t)); buckets[hr][i] = (buckets[hr][i] ?? 0) + 1; } }));
      segs = buckets.map((b, hr) => {
        const top = Object.entries(b).sort((a, c) => c[1] - a[1])[0];
        const rm = top ? ROOMS[+top[0]] : null;
        return { color: rm ? rm.color : QUIET, w: 100 / 24, title: `${String(hr).padStart(2, "0")}:00 · ${rm ? rm.label : "quiet"}` };
      });
    } else {
      type CP = { t: number; color: string; label: string };
      const cps: CP[] = [];
      roomHists.forEach((h, i) => h.forEach((e) => { if (e.s === "on" && e.t >= start && e.t <= end) cps.push({ t: e.t, color: ROOMS[i].color, label: ROOMS[i].label }); }));
      for (const p of personSegs(personHist, start, end)) if (p.s !== "home") cps.push({ t: p.start, color: AWAY, label: "Away" });
      // re-home points bring it back to quiet
      for (const p of personSegs(personHist, start, end)) if (p.s === "home") cps.push({ t: p.start, color: QUIET, label: "Home · quiet" });
      cps.sort((a, b) => a.t - b.t);
      const built: { color: string; w: number; title: string }[] = [];
      const dayEnd = dayStart + DAY;
      let prev = { t: dayStart, color: QUIET, label: "Home · quiet" };
      const push = (from: number, to: number, c: string, lbl: string) => {
        const w = ((Math.min(to, dayEnd) - Math.max(from, dayStart)) / DAY) * 100;
        if (w > 0.05) built.push({ color: c, w, title: `${lbl} · ${clk(from)}–${clk(to)}` });
      };
      for (const cp of cps) { push(prev.t, cp.t, prev.color, prev.label); prev = cp; }
      push(prev.t, end, prev.color, prev.label);
      segs = built;
    }
    legend = ROOMS.map((r2) => ({ label: r2.label, color: r2.color })).concat([{ label: "Away", color: AWAY }]);

    // ----- time by room -----
    const div = r === "history" ? 7 : 1;
    const times = ROOMS.map((rm, i) => ({ ...rm, ms: sumOn(roomHists[i], start, end) / div })).filter((x) => x.ms > 30_000).sort((a, b) => b.ms - a.ms);
    const maxMs = Math.max(1, ...times.map((x) => x.ms));
    roomTime = times.map((x) => ({ label: x.label, color: x.color, w: (x.ms / maxMs) * 100, dur: fmtDur(x.ms) }));

    // ----- appliance activity -----
    const runs: ALog[] = [];
    applHists.forEach((h, i) => {
      const a = APPLIANCES[i]; const hh = asc(h); let onAt: number | null = null;
      for (const e of hh) {
        if (e.s === "on" && onAt == null) onAt = e.t;
        else if (e.s !== "on" && onAt != null) {
          if (e.t >= start) runs.push({ icon: a.icon, name: a.label, detail: `ran ${fmtDur(e.t - onAt)}`, t: clk(onAt), start: onAt, durMs: e.t - onAt, running: false });
          onAt = null;
        }
      }
      if (onAt != null) runs.push({ icon: a.icon, name: a.label, detail: "running now", t: clk(onAt), start: onAt, durMs: Date.now() - onAt, running: true });
    });
    if (r === "history") {
      const byName = new Map<string, { icon: string; name: string; count: number; durMs: number }>();
      for (const x of runs) { const e = byName.get(x.name) ?? { icon: x.icon, name: x.name, count: 0, durMs: 0 }; e.count++; e.durMs += x.durMs; byName.set(x.name, e); }
      applog = [...byName.values()].sort((a, b) => b.count - a.count).map((e) => ({ icon: e.icon, name: e.name, detail: `${e.count} run${e.count === 1 ? "" : "s"} · ${fmtDur(e.durMs)}`, t: "", start: 0, durMs: e.durMs, running: false }));
    } else {
      applog = runs;
    }

    // ----- places -----
    const ps = personSegs(personHist, start, end);
    places = r === "history" ? dedupePlaces(ps, geoHist) : ps.map((p) => placeRow(p, geoHist));

    // ----- hero -----
    const homeMs = ps.filter((p) => p.s === "home").reduce((s, p) => s + (p.end - p.start), 0);
    const trackedMs = ps.reduce((s, p) => s + (p.end - p.start), 0) || 1;
    hero = {
      summary: homeMs / trackedMs > 0.7 ? "Home for most of the day" : homeMs / trackedMs > 0.3 ? "In and out today" : "Out and about",
      sub: `Busiest room: ${roomTime[0]?.label ?? "—"} · ${applog.length} appliance event${applog.length === 1 ? "" : "s"}`,
      atHome: fmtDur(homeMs / div),
      places: ps.filter((p) => p.s !== "home").length,
      appl: runs.length,
      ctx, label,
    };
  }

  // reverse-geocoded address that was current at time t (last reading ≤ t, else earliest).
  function geoAt(geoHist: { t: number; s: string }[], t: number): string | null {
    if (!geoHist.length) return null;
    const asc2 = asc(geoHist);
    let val: string | null = null;
    for (const e of asc2) { if (e.t <= t) val = e.s; else break; }
    return val ?? asc2[0].s;
  }
  // name for a not_home ("away") segment: the address at that time, else generic.
  function awayName(geoHist: { t: number; s: string }[], t: number): string {
    return geoAt(geoHist, t) ?? "Out & about";
  }
  function placeRow(p: { s: string; start: number; end: number }, geoHist: { t: number; s: string }[]) {
    const zone = p.s !== "not_home";
    return {
      icon: p.s === "home" ? "🏠" : zone ? "📍" : "🗺️",
      name: zone ? placeName(p.s) : awayName(geoHist, p.start),
      tag: zone ? "Zone" : "Geocoded", zone,
      sub: `${clk(p.start)} – ${clk(p.end)}`,
      window: clk(p.start), dur: fmtDur(p.end - p.start),
      start: p.start, durMs: p.end - p.start, count: 1,
    };
  }
  function dedupePlaces(ps: { s: string; start: number; end: number }[], geoHist: { t: number; s: string }[]) {
    const m = new Map<string, { name: string; zone: boolean; ms: number; count: number }>();
    for (const p of ps) {
      const zone = p.s !== "not_home";
      const name = zone ? placeName(p.s) : awayName(geoHist, p.start);
      const e = m.get(name) ?? { name, zone, ms: 0, count: 0 };
      e.ms += p.end - p.start; e.count++; m.set(name, e);
    }
    return [...m.values()].sort((a, b) => b.ms - a.ms).map((e) => ({
      icon: e.name === "Home" ? "🏠" : e.zone ? "📍" : "🗺️", name: e.name,
      tag: e.zone ? "Zone" : "Geocoded", zone: e.zone,
      sub: `${e.count} visit${e.count === 1 ? "" : "s"} · 7 days`, window: `${e.count}×`, dur: fmtDur(e.ms),
      start: 0, durMs: e.ms, count: e.count,
    }));
  }

  // ---------- Kids data ----------
  let kidPlaces = $state<Place[]>([]);
  let kidEvents = $state<{ icon: string; txt: string; sub: string; t: string }[]>([]);
  const placesView = $derived(applyPF(places, meFilter, meSort));
  const kidPlacesView = $derived(applyPF(kidPlaces, kidFilter, kidSort));
  const kidState = $derived(ha.state(KID));
  const kidBattN = $derived(ha.num(KID_BATT));
  const kidNow = $derived({
    icon: kidState === "home" ? "🏠" : kidState === "not_home" ? "🗺️" : "📍",
    loc: kidState === "home" ? "Home" : kidState === "not_home" ? (ha.state(KID_GEO) ?? "Out") : placeName(kidState ?? "—"),
    battery: kidBattN != null ? n(kidBattN) : "—",
  });
  const kidBattColor = $derived(kidBattN == null ? "var(--muted)" : kidBattN < 20 ? "var(--error)" : kidBattN < 40 ? "var(--warning)" : "var(--success)");

  async function loadKids(r: Range) {
    const { start, end } = windowFor(r);
    const hrs = Math.ceil((Date.now() - start) / 3_600_000) + 1;
    const [hist, geoHist] = await Promise.all([ha.historyStates(KID, hrs), ha.historyStates(KID_GEO, hrs)]);
    const ps = personSegs(hist, start, end);
    kidPlaces = r === "history" ? dedupePlaces(ps, geoHist) : ps.map((p) => placeRow(p, geoHist));
    // phone-activity feed from zone transitions + battery
    const evs: { icon: string; txt: string; sub: string; t: string }[] = [];
    for (let i = 1; i < ps.length; i++) {
      const to = ps[i];
      evs.push(to.s === "home"
        ? { icon: "🏡", txt: "Arrived home", sub: "geofence", t: clk(to.start) }
        : to.s === "not_home"
          ? { icon: "🚶", txt: `Left ${placeName(ps[i - 1].s)}`, sub: "geofence", t: clk(to.start) }
          : { icon: "📍", txt: `Arrived ${placeName(to.s)}`, sub: "geofence", t: clk(to.start) });
    }
    if (kidBattN != null) evs.unshift({ icon: kidBattN < 20 ? "🪫" : "🔋", txt: `Phone battery ${n(kidBattN)}%`, sub: kidBattN < 20 ? "low" : "ok", t: "now" });
    kidEvents = evs.slice(0, 6);
  }

  $effect(() => { if (tab === "me") loadMe(meRange); });
  $effect(() => { if (tab === "kids") loadKids(kidRange); });

  // ---------- phone / device details ----------
  const MEP = {
    batt: "sensor.hello_battery_level", state: "sensor.hello_battery_state",
    ssid: "sensor.hello_ssid", conn: "sensor.hello_connection_type",
    steps: "sensor.hello_steps", dist: "sensor.hello_distance",
    floors: "sensor.hello_floors_ascended", activity: "sensor.hello_activity",
    storage: "sensor.hello_storage",
  };
  const KDP = {
    batt: "sensor.kid_s_phone_battery_level", state: "sensor.kid_s_phone_battery_state",
    health: "sensor.kid_s_phone_battery_health", temp: "sensor.kid_s_phone_battery_temperature",
    charge: "sensor.kid_s_phone_remaining_charge_time", charger: "sensor.kid_s_phone_charger_type",
    ssid: "sensor.kid_s_phone_wi_fi_connection", signal: "sensor.kid_s_phone_wi_fi_signal_strength", net: "sensor.kid_s_phone_network_type",
    steps: "sensor.kid_s_phone_daily_steps", dist: "sensor.kid_s_phone_daily_distance", floors: "sensor.kid_s_phone_daily_floors",
    activity: "sensor.kid_s_phone_detected_activity", ringer: "sensor.kid_s_phone_ringer_mode", dnd: "sensor.kid_s_phone_do_not_disturb_sensor",
    lastApp: "sensor.kid_s_phone_last_used_app", alarm: "sensor.kid_s_phone_next_alarm", hr: "sensor.kid_s_phone_heart_rate",
  };
  const bad = (v: string | undefined) => !v || /^(unknown|unavailable|<not connected>|not connected)$/i.test(v);
  function stat(id: string, label: string, digits = 0) {
    const num = ha.num(id);
    if (num != null) { const u = ha.unit(id); return { k: label, v: `${n(num, digits)}${u ? " " + u : ""}` }; }
    const s = ha.state(id);
    return { k: label, v: bad(s) ? "—" : (s as string) };
  }
  function netLabel(m: { ssid: string; signal: string; net: string }) {
    const ssid = ha.state(m.ssid);
    if (!bad(ssid)) return { k: "Wi-Fi", v: ssid as string };
    return { k: "Network", v: bad(ha.state(m.net)) ? "—" : (ha.state(m.net) as string) };
  }
  const chargeState = (s: string | undefined) => s === "Charging" || s === "charging" ? "⚡ charging" : s === "Full" || s === "full" ? "fully charged" : "on battery";

  const mePhone = $derived([
    stat(MEP.steps, "Steps"), stat(MEP.dist, "Distance", 1), stat(MEP.floors, "Floors"),
    { k: "Activity", v: bad(ha.state(MEP.activity)) ? "—" : (ha.state(MEP.activity) as string) },
    ha.state(MEP.ssid) && !bad(ha.state(MEP.ssid)) ? { k: "Wi-Fi", v: ha.state(MEP.ssid) as string } : { k: "Connection", v: bad(ha.state(MEP.conn)) ? "—" : (ha.state(MEP.conn) as string) },
    stat(MEP.storage, "Storage free"),
  ].filter((c) => c.v !== "—"));
  const meBatt = $derived(ha.num(MEP.batt));
  const meBattState = $derived(ha.state(MEP.state));

  const kidStats = $derived([
    stat(KDP.steps, "Steps"), stat(KDP.dist, "Distance", 1), stat(KDP.floors, "Floors"),
    { k: "Activity", v: bad(ha.state(KDP.activity)) ? "—" : (ha.state(KDP.activity) as string) },
    netLabel(KDP),
    stat(KDP.hr, "Heart rate"),
    { k: "Ringer", v: bad(ha.state(KDP.ringer)) ? "—" : (ha.state(KDP.ringer) as string) },
    { k: "Last app", v: bad(ha.state(KDP.lastApp)) ? "—" : (ha.state(KDP.lastApp) as string) },
    stat(KDP.temp, "Battery temp"),
    stat(KDP.health, "Battery health"),
  ].filter((c) => c.v !== "—"));
  const kidCharging = $derived(/charg/i.test(ha.state(KDP.state) ?? ""));

  const RANGES: { id: Range; label: string }[] = [
    { id: "today", label: "Today" }, { id: "yesterday", label: "Yesterday" }, { id: "history", label: "History" },
  ];
</script>

{#snippet pctl(filter: PFilter, setFilter: (v: PFilter) => void, sort: PSort, setSort: (v: PSort) => void)}
  <div class="pctl">
    <div class="pseg">
      {#each [["all", "All"], ["zone", "Zones"], ["geo", "Geocoded"]] as [k, l]}
        <button class:on={filter === k} onclick={() => setFilter(k as PFilter)}>{l}</button>
      {/each}
    </div>
    <div class="pseg">
      {#each [["recent", "Recent"], ["long", "Longest"], ["name", "A–Z"]] as [k, l]}
        <button class:on={sort === k} onclick={() => setSort(k as PSort)}>{l}</button>
      {/each}
    </div>
  </div>
{/snippet}

<div class="col">
  <!-- tab switch -->
  <div class="tabs big">
    <button class:active={tab === "me"} onclick={() => (tab = "me")}>Me</button>
    <button class:active={tab === "kids"} onclick={() => (tab = "kids")}>Liam & Eben</button>
  </div>

  {#if tab === "me"}
    <div class="tabs">
      {#each RANGES as r}<button class:active={meRange === r.id} onclick={() => (meRange = r.id)}>{r.label}</button>{/each}
    </div>

    <!-- your day hero -->
    <div class="card hero">
      <div class="hleft"><div class="lb" style="color:var(--acc)">Your day</div><div class="hsum">{hero.summary}</div><div class="hsub">{hero.sub}</div></div>
      <div class="hstats">
        <div><div class="hv">{hero.atHome}</div><div class="hk">At home</div></div>
        <div><div class="hv" style="color:var(--acc)">{hero.places}</div><div class="hk">Places</div></div>
        <div><div class="hv" style="color:var(--warning)">{hero.appl}</div><div class="hk">Appliance runs</div></div>
      </div>
    </div>

    <!-- movement bar -->
    <div class="card pad">
      <div class="rh"><span class="lb">Movement through the house · {hero.ctx}</span><span class="sub">from room sensors</span></div>
      <div class="movebar">
        {#each segs as s}<div class="mseg" style="width:{s.w}%;background:{s.color}" title={s.title}></div>{/each}
      </div>
      <div class="axis"><span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>24h</span></div>
      <div class="legend">
        {#each legend as r}<span class="lg"><span class="lgd" style="background:{r.color}"></span>{r.label}</span>{/each}
      </div>
    </div>

    <div class="two">
      <div class="card pad">
        <div class="lb" style="margin-bottom:14px">Time by room</div>
        {#if roomTime.length}
          <div class="rtlist scrollbox">
            {#each roomTime as r}
              <div class="rtrow"><span class="rtl">{r.label}</span><div class="rttrack"><div class="rtfill" style="width:{r.w}%;background:{r.color}"></div></div><span class="rtd">{r.dur}</span></div>
            {/each}
          </div>
        {:else}<div class="note">No room activity recorded {hero.label}.</div>{/if}
      </div>
      <div class="card pad">
        <div class="rh"><span class="lb">Appliance activity</span><span class="sub">{appView.length} of {applog.length}</span></div>
        <div class="pctl">
          <div class="pseg">
            {#each [["all", "All"], ["running", "Running"]] as [k, l]}
              <button class:on={appFilter === k} onclick={() => (appFilter = k as typeof appFilter)}>{l}</button>
            {/each}
          </div>
          <div class="pseg">
            {#each [["recent", "Recent"], ["long", "Longest"], ["name", "A–Z"]] as [k, l]}
              <button class:on={appSort === k} onclick={() => (appSort = k as typeof appSort)}>{l}</button>
            {/each}
          </div>
        </div>
        {#if appView.length}
          <div class="scrollbox">
            {#each appView as e}
              <div class="row2"><span class="ri">{e.icon}</span><div class="rt2"><div class="rn">{e.name}</div><div class="rd">{e.detail}</div></div><span class="rtm num">{e.t}</span></div>
            {/each}
          </div>
        {:else}<div class="note">{applog.length ? "No appliances match this filter." : `No appliance runs ${hero.label}.`}</div>{/if}
      </div>
    </div>

    <!-- places -->
    <div class="card pad">
      <div class="rh"><span class="lb">Places visited {hero.label}</span><span class="sub">{placesView.length} of {places.length}</span></div>
      {@render pctl(meFilter, (v) => (meFilter = v), meSort, (v) => (meSort = v))}
      {#if placesView.length}
        {#each placesView as p}
          <div class="place">
            <span class="pic" style="background:{p.zone ? 'color-mix(in srgb,var(--success) 16%,transparent)' : 'color-mix(in srgb,var(--water) 16%,transparent)'}">{p.icon}</span>
            <div class="pinfo"><div class="ptop"><span class="pn">{p.name}</span><span class="ptag" class:geo={!p.zone}>{p.tag}</span></div><div class="psub">{p.sub}</div></div>
            <div class="pright"><div class="pwin num">{p.window}</div><div class="pdur">{p.dur}</div></div>
          </div>
        {/each}
      {:else}<div class="note">{places.length ? "No places match this filter." : `No location history ${hero.label}.`}</div>{/if}
    </div>

    <!-- phone -->
    <div class="card pad">
      <div class="rh"><span class="lb">Christo's phone</span><span class="sub">iPhone · live</span></div>
      <div class="phone">
        <div class="pbatt"><div class="pbv" style="color:{meBatt != null && meBatt < 20 ? 'var(--error)' : 'var(--success)'}">{meBatt != null ? n(meBatt) : "—"}%</div><div class="pbk">{chargeState(meBattState)}</div></div>
        <div class="chips">
          {#each mePhone as c}<div class="chip"><span class="ck">{c.k}</span><span class="cv">{c.v}</span></div>{/each}
        </div>
      </div>
    </div>
  {:else}
    <!-- kids -->
    <div class="card pad kidhead">
      <span class="kav">L·E</span>
      <div class="kinfo"><div class="kn">Liam & Eben</div><div class="kloc">{kidNow.icon} {kidNow.loc}</div></div>
      <div class="kbatt"><div class="kbv" style="color:{kidBattColor}">{kidNow.battery}%</div><div class="kbk">shared phone</div></div>
    </div>
    <div class="tabs">
      {#each RANGES as r}<button class:active={kidRange === r.id} onclick={() => (kidRange = r.id)}>{r.label}</button>{/each}
    </div>
    <div class="two">
      <div class="card pad">
        <div class="rh"><span class="lb">Places</span><span class="sub">{kidPlacesView.length} of {kidPlaces.length}</span></div>
        {@render pctl(kidFilter, (v) => (kidFilter = v), kidSort, (v) => (kidSort = v))}
        {#if kidPlacesView.length}
          {#each kidPlacesView as p}
            <div class="place">
              <span class="pic" style="background:{p.zone ? 'color-mix(in srgb,var(--success) 16%,transparent)' : 'color-mix(in srgb,var(--water) 16%,transparent)'}">{p.icon}</span>
              <div class="pinfo"><div class="ptop"><span class="pn">{p.name}</span><span class="ptag" class:geo={!p.zone}>{p.tag}</span></div><div class="psub">{p.sub}</div></div>
              <div class="pright"><div class="pwin num">{p.window}</div><div class="pdur">{p.dur}</div></div>
            </div>
          {/each}
        {:else}<div class="note">{kidPlaces.length ? "No places match this filter." : "No location history for this range."}</div>{/if}
      </div>
      <div class="card pad">
        <div class="lb" style="margin-bottom:6px">Phone activity</div>
        {#if kidEvents.length}
          {#each kidEvents as e}
            <div class="row2"><span class="ri">{e.icon}</span><div class="rt2"><span class="rn">{e.txt}</span><span class="rd"> · {e.sub}</span></div><span class="rtm num">{e.t}</span></div>
          {/each}
        {:else}<div class="note">No phone activity for this range.</div>{/if}
      </div>
    </div>
    <!-- device details -->
    <div class="card pad">
      <div class="rh"><span class="lb">Device details</span><span class="sub">{kidCharging ? "⚡ charging" : "on battery"}</span></div>
      <div class="phone">
        <div class="pbatt"><div class="pbv" style="color:{kidBattColor}">{kidNow.battery}%</div><div class="pbk">{kidCharging && !bad(ha.state(KDP.charge)) ? `${ha.state(KDP.charge)} left` : chargeState(ha.state(KDP.state))}</div></div>
        <div class="chips">
          {#each kidStats as c}<div class="chip"><span class="ck">{c.k}</span><span class="cv">{c.v}</span></div>{/each}
        </div>
      </div>
    </div>
    <div class="foot">One shared phone for Liam &amp; Eben. Location from its <b>device_tracker</b> (GPS) — HA zone name inside a known zone, otherwise the reverse-geocoded address. Phone events from battery &amp; geofence sensors.</div>
  {/if}
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }
  .tabs { display: flex; gap: 6px; padding: 5px; border-radius: 12px; background: rgba(255, 255, 255, 0.05); align-self: flex-start; }
  .tabs.big { border-radius: 14px; }
  .tabs button { padding: 8px 16px; border-radius: 9px; font-size: 12.5px; font-weight: 700; color: var(--text-2); }
  .tabs.big button { padding: 9px 20px; border-radius: 10px; font-size: 13px; }
  .tabs button.active { background: var(--grad); color: #07131c; }
  .pad { padding: 20px 22px; }
  .rh { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 14px; }
  .sub { font-size: 12px; color: var(--dim); }
  .note { font-size: 12.5px; color: var(--muted-2); padding: 8px 0; }
  .two { display: grid; grid-template-columns: 1.1fr 1fr; gap: 14px; }
  @media (max-width: 820px) { .two { grid-template-columns: 1fr; } }

  .hero { padding: 20px 22px; display: flex; align-items: center; gap: 18px; flex-wrap: wrap; position: relative; overflow: hidden; }
  .hero::before { content: ""; position: absolute; inset: 0; background: radial-gradient(120% 150% at 0% 0%, color-mix(in srgb, var(--acc) 15%, transparent), transparent 60%); pointer-events: none; }
  .hleft { position: relative; flex: 1; min-width: 200px; }
  .hsum { font-size: 22px; font-weight: 800; letter-spacing: -0.4px; margin-top: 4px; }
  .hsub { font-size: 12.5px; color: var(--dim); margin-top: 4px; }
  .hstats { position: relative; display: flex; gap: 20px; flex-shrink: 0; }
  .hstats > div { text-align: center; }
  .hv { font-size: 22px; font-weight: 800; }
  .hk { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }

  .movebar { display: flex; height: 30px; border-radius: 9px; overflow: hidden; gap: 1px; background: rgba(255, 255, 255, 0.03); }
  .mseg { min-width: 1px; }
  .axis { display: flex; justify-content: space-between; font-size: 10px; color: var(--muted-2); margin-top: 6px; }
  .legend { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 14px; }
  .lg { display: inline-flex; align-items: center; gap: 7px; font-size: 11.5px; color: var(--text-2); }
  .lgd { width: 10px; height: 10px; border-radius: 3px; }

  .rtlist { display: flex; flex-direction: column; gap: 9px; }
  .rtrow { display: flex; align-items: center; gap: 11px; }
  /* keep the room + appliance lists compact; scroll past ~7 rows */
  .scrollbox { max-height: 300px; overflow-y: auto; overflow-x: hidden; margin-right: -6px; padding-right: 6px; }
  .scrollbox::-webkit-scrollbar { width: 7px; }
  .scrollbox::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.14); border-radius: 4px; }
  .rtl { width: 90px; flex-shrink: 0; font-size: 12.5px; color: var(--text-2); }
  .rttrack { flex: 1; height: 9px; border-radius: 999px; background: rgba(255, 255, 255, 0.07); overflow: hidden; }
  .rtfill { height: 100%; border-radius: 999px; }
  .rtd { width: 58px; flex-shrink: 0; text-align: right; font-size: 11.5px; font-weight: 700; }

  .row2 { display: flex; align-items: center; gap: 12px; padding: 7px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
  .row2:last-child { border-bottom: none; }
  .ri { width: 33px; height: 33px; flex-shrink: 0; border-radius: 9px; display: grid; place-items: center; font-size: 15px; background: rgba(255, 255, 255, 0.05); }
  .rt2 { flex: 1; min-width: 0; }
  .rn { font-size: 13px; font-weight: 600; }
  .rd { font-size: 11px; color: var(--muted); }
  .rtm { font-size: 11.5px; color: var(--muted-2); flex-shrink: 0; }

  .pctl { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
  .pseg { display: flex; gap: 2px; padding: 3px; border-radius: 10px; background: rgba(255, 255, 255, 0.05); }
  .pseg button { padding: 6px 11px; border-radius: 7px; font-size: 11.5px; font-weight: 600; color: var(--muted); }
  .pseg button.on { background: var(--grad); color: #07131c; }
  .place { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
  .place:last-child { border-bottom: none; }
  .pic { width: 38px; height: 38px; flex-shrink: 0; border-radius: 11px; display: grid; place-items: center; font-size: 17px; }
  .pinfo { flex: 1; min-width: 0; }
  .ptop { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .pn { font-size: 13.5px; font-weight: 600; }
  .ptag { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--success); background: color-mix(in srgb, var(--success) 16%, transparent); padding: 2px 7px; border-radius: 999px; }
  .ptag.geo { color: var(--water); background: color-mix(in srgb, var(--water) 16%, transparent); }
  .psub { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
  .pright { text-align: right; flex-shrink: 0; }
  .pwin { font-size: 12px; font-weight: 700; }
  .pdur { font-size: 11px; color: var(--muted-2); }

  .kidhead { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .kav { width: 46px; height: 46px; flex-shrink: 0; border-radius: 14px; background: linear-gradient(135deg, var(--water), var(--success)); display: grid; place-items: center; font-size: 14px; font-weight: 800; color: #0b1017; }
  .kinfo { flex: 1; min-width: 160px; }
  .kn { font-size: 16px; font-weight: 800; }
  .kloc { font-size: 12px; color: var(--success); margin-top: 2px; }
  .kbatt { text-align: right; flex-shrink: 0; }
  .kbv { font-size: 13px; font-weight: 700; }
  .kbk { font-size: 10px; color: var(--muted-2); }
  .foot { font-size: 11.5px; color: var(--muted-2); }
  .foot b { color: var(--text-2); }

  .phone { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
  .pbatt { flex-shrink: 0; }
  .pbv { font-size: 30px; font-weight: 800; letter-spacing: -1px; }
  .pbk { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .chips { flex: 1; min-width: 220px; display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { display: flex; flex-direction: column; gap: 1px; padding: 8px 12px; border-radius: 11px; background: rgba(255, 255, 255, 0.045); }
  .ck { font-size: 9.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .cv { font-size: 13px; font-weight: 700; }
</style>
