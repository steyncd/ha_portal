<script lang="ts">
  import { ha } from "../lib/store.svelte";
  import { E, POWER_DEVICES } from "../lib/entities";
  import { n, power, rand, dateShort } from "../lib/format";
  import AreaChart from "../lib/components/AreaChart.svelte";
  import BarChart from "../lib/components/BarChart.svelte";

  type Stat = { t: number; mean: number | null; min: number | null; max: number | null };

  // ---- device selection ----
  const GROUPS = [...new Set(POWER_DEVICES.map((d) => d.group))];
  let selected = $state(POWER_DEVICES[0].power);
  const dev = $derived(POWER_DEVICES.find((d) => d.power === selected) ?? POWER_DEVICES[0]);
  const liveW = $derived(dev.live ? ha.num(dev.power) : ha.num(dev.power));

  // ---- date range ----
  const PRESETS = [
    { id: "1h", label: "1h", days: 1 / 24 },
    { id: "2h", label: "2h", days: 2 / 24 },
    { id: "3h", label: "3h", days: 3 / 24 },
    { id: "6h", label: "6h", days: 0.25 },
    { id: "12h", label: "12h", days: 0.5 },
    { id: "24h", label: "24h", days: 1 },
    { id: "3d", label: "3d", days: 3 },
    { id: "7d", label: "7d", days: 7 },
    { id: "30d", label: "30d", days: 30 },
    { id: "90d", label: "90d", days: 90 },
  ];
  let rangeId = $state("30d");
  let customStart = $state("");
  let customEnd = $state("");
  const isCustom = $derived(rangeId === "custom");

  const range = $derived.by(() => {
    if (isCustom && customStart && customEnd) {
      const s = new Date(customStart + "T00:00:00");
      const e = new Date(customEnd + "T23:59:59");
      if (+e > +s) return { start: s, end: e, days: Math.max(1, Math.round((+e - +s) / 86_400_000)) };
    }
    const days = PRESETS.find((p) => p.id === rangeId)?.days ?? 30;
    const e = new Date();
    return { start: new Date(+e - days * 86_400_000), end: e, days };
  });
  // hourly buckets for ≤3-day ranges, daily otherwise
  const period = $derived<"hour" | "day">(range.days <= 3 ? "hour" : "day");
  const bucketH = $derived(period === "hour" ? 1 : 24);

  const tariff = $derived(ha.num(E.tariff) ?? 3.5);

  // "6 hours" / "3 days" for headings & prose (range.days can be fractional now)
  const spanTxt = $derived(
    range.days < 1
      ? `${Math.round(range.days * 24)} hour${Math.round(range.days * 24) === 1 ? "" : "s"}`
      : `${Math.round(range.days)} day${range.days >= 1.5 ? "s" : ""}`,
  );

  // Tooltip label formatters (daily buckets sit at midnight, so a time-only label
  // would read 00:00 for every point — show the date instead).
  const fmtDay = (t: number) => new Date(t).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  const fmtDayTime = (t: number) => new Date(t).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  // ---- data load ----
  let primary = $state<Stat[]>([]);
  let hourly = $state<Stat[]>([]);
  let fine = $state<{ t: number; v: number }[]>([]); // raw high-res trace, short ranges only
  let loading = $state(true);
  let reqId = 0;

  $effect(() => {
    const p = dev.power;
    const r = range;
    const per = period;
    // For short preset ranges (≤2 days, ending now) hourly buckets are too coarse
    // for the timeline line — pull raw state history instead. ha.history() works in
    // hours-back-from-now, so only use it for presets (not a past custom window).
    const useRaw = r.days <= 2 && !isCustom;
    const my = ++reqId;
    loading = true;
    Promise.all([
      ha.statistics(p, { period: per, start: r.start, end: r.end }),
      ha.statistics(p, { period: "hour", start: r.start, end: r.end }),
      useRaw ? ha.history(p, Math.ceil(r.days * 24)) : Promise.resolve([]),
    ]).then(([d, h, raw]) => {
      if (my !== reqId) return;
      primary = d as Stat[];
      hourly = h as Stat[];
      fine = raw as { t: number; v: number }[];
      loading = false;
    });
  });

  // ---- derived analysis ----
  const pts = $derived(primary.filter((d) => d.mean != null));
  const means = $derived(pts.map((d) => d.mean as number));
  const hasData = $derived(pts.length >= 2);

  const chartMean = $derived(pts.map((d) => ({ t: d.t, v: d.mean as number })));
  // Power-over-time line: raw state history for short ranges, else hourly mean W.
  const chartHourly = $derived(
    fine.length >= 2 ? fine : hourly.filter((d) => d.mean != null).map((d) => ({ t: d.t, v: d.mean as number })),
  );
  const hasHourly = $derived(chartHourly.length >= 2);
  // Intraday ranges read better with a time-only tooltip; longer ranges show the date.
  const lineFmt = $derived(range.days <= 1 ? (t: number) => new Date(t).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }) : fmtDayTime);

  const avgW = $derived(means.length ? means.reduce((a, b) => a + b, 0) / means.length : 0);
  const peak = $derived.by(() => {
    let best = { t: 0, w: -1 };
    for (const d of pts) { const w = d.max ?? d.mean ?? 0; if (w > best.w) best = { t: d.t, w }; }
    return best;
  });
  const baseW = $derived(pts.length ? Math.min(...pts.map((d) => d.min ?? d.mean ?? 0)) : 0);

  // energy per bucket (kWh) = mean W × bucket hours / 1000
  const energyBars = $derived(
    pts.map((d) => ({
      label: period === "hour" ? new Date(d.t).getHours() + "h" : dateShort(d.t),
      value: ((d.mean as number) * bucketH) / 1000,
      color: "var(--solar)",
    })),
  );
  const totalKwh = $derived(energyBars.reduce((s, b) => s + b.value, 0));
  const cost = $derived(totalKwh * tariff);
  const avgDailyKwh = $derived(range.days > 0 ? totalKwh / range.days : 0);
  const projMonthlyCost = $derived(avgDailyKwh * 30 * tariff);

  // trend: mean of 2nd half vs 1st half
  const trendPct = $derived.by(() => {
    if (means.length < 4) return null;
    const mid = Math.floor(means.length / 2);
    const a = means.slice(0, mid);
    const b = means.slice(mid);
    const avgA = a.reduce((x, y) => x + y, 0) / a.length;
    const avgB = b.reduce((x, y) => x + y, 0) / b.length;
    if (avgA < 0.5) return null;
    return ((avgB - avgA) / avgA) * 100;
  });

  const busiest = $derived.by(() => {
    if (!hasData) return null;
    let best = pts[0];
    for (const d of pts) if ((d.mean ?? 0) > (best.mean ?? 0)) best = d;
    return best;
  });
  const quietest = $derived.by(() => {
    if (!hasData) return null;
    let best = pts[0];
    for (const d of pts) if ((d.mean ?? 0) < (best.mean ?? 0)) best = d;
    return best;
  });

  // hour-of-day profile: average mean by local hour
  const hourProfile = $derived.by(() => {
    const sum = new Array(24).fill(0);
    const cnt = new Array(24).fill(0);
    for (const d of hourly) {
      if (d.mean == null) continue;
      const h = new Date(d.t).getHours();
      sum[h] += d.mean; cnt[h] += 1;
    }
    return sum.map((s, h) => ({
      label: `${String(h).padStart(2, "0")}:00`,
      value: cnt[h] ? s / cnt[h] : 0,
      color: "var(--brand)",
    }));
  });
  const peakHour = $derived.by(() => {
    const hp = hourProfile;
    let bi = 0;
    for (let i = 1; i < 24; i++) if (hp[i].value > hp[bi].value) bi = i;
    return hp[bi].value > 0 ? bi : null;
  });

  const dfmt = (t: number) => new Date(t).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });

  // natural-language summary
  const summary = $derived.by(() => {
    if (!hasData) return "";
    const parts: string[] = [];
    parts.push(`${dev.label} used about ${n(totalKwh, 1)} kWh over the last ${spanTxt} (~${rand(cost)}).`);
    if (trendPct != null && Math.abs(trendPct) >= 8)
      parts.push(`Usage is ${trendPct > 0 ? "rising" : "falling"} — ${n(Math.abs(trendPct))}% ${trendPct > 0 ? "higher" : "lower"} than the start of the period.`);
    else parts.push("Usage has been broadly steady across the period.");
    if (busiest) parts.push(`Heaviest day was ${dfmt(busiest.t)} (${power(busiest.mean).val} ${power(busiest.mean).unit} avg).`);
    if (peakHour != null) parts.push(`It typically draws most around ${peakHour}:00.`);
    if (baseW > 2) parts.push(`Standby/base load is ~${power(baseW).val} ${power(baseW).unit}.`);
    parts.push(`At this rate that's ~${rand(projMonthlyCost)}/month.`);
    return parts.join(" ");
  });

  const trendColor = $derived(trendPct == null ? "var(--muted)" : trendPct > 0 ? "var(--warning)" : "var(--success)");
</script>

<div class="col">
  <!-- controls -->
  <div class="card pad ctrls">
    <div class="crow">
      <label class="fld">
        <span class="flb">Device</span>
        <select bind:value={selected}>
          {#each GROUPS as g}
            <optgroup label={g}>
              {#each POWER_DEVICES.filter((d) => d.group === g) as d}
                <option value={d.power}>{d.icon} {d.label}</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      </label>
      <div class="fld">
        <span class="flb">Range</span>
        <div class="seg">
          {#each PRESETS as p}
            <button class:on={!isCustom && rangeId === p.id} onclick={() => (rangeId = p.id)}>{p.label}</button>
          {/each}
          <button class:on={isCustom} onclick={() => (rangeId = "custom")}>Custom</button>
        </div>
      </div>
    </div>
    {#if isCustom}
      <div class="crow dates">
        <label class="fld"><span class="flb">From</span><input type="date" bind:value={customStart} max={customEnd || undefined} /></label>
        <label class="fld"><span class="flb">To</span><input type="date" bind:value={customEnd} min={customStart || undefined} /></label>
        {#if !(customStart && customEnd)}<span class="hint">Pick both dates to apply.</span>{/if}
      </div>
    {/if}
  </div>

  <!-- headline KPIs -->
  <div class="kpis">
    <div class="card k"><div class="lb">Energy used</div><div class="big">{n(totalKwh, totalKwh < 10 ? 2 : 1)}<span class="u"> kWh</span></div><div class="sub">over {spanTxt}</div></div>
    <div class="card k"><div class="lb">Est. cost</div><div class="big">{rand(cost)}</div><div class="sub">@ {rand(tariff)}/kWh</div></div>
    <div class="card k"><div class="lb">Average draw</div><div class="big">{power(avgW).val}<span class="u"> {power(avgW).unit}</span></div><div class="sub">live {liveW != null ? `${power(liveW).val} ${power(liveW).unit}` : "—"}</div></div>
    <div class="card k"><div class="lb">Peak draw</div><div class="big" style="color:var(--warning)">{power(peak.w < 0 ? 0 : peak.w).val}<span class="u"> {power(peak.w < 0 ? 0 : peak.w).unit}</span></div><div class="sub">{peak.t ? dfmt(peak.t) : "—"}</div></div>
  </div>

  <!-- power over time (hourly W line) — the fine-grained trace -->
  <div class="card pad">
    <div class="rh"><span class="lb">{dev.icon} {dev.label} — power over time</span><span class="sub">W · {fine.length >= 2 ? "live" : "hourly"} · peak {power(peak.w < 0 ? 0 : peak.w).val} {power(peak.w < 0 ? 0 : peak.w).unit}</span></div>
    {#if loading}
      <div class="empty">Loading history…</div>
    {:else if hasHourly}
      <AreaChart data={chartHourly} color="var(--acc)" height={220} unit=" W" digits={0} labelFmt={lineFmt} step />
    {:else}
      <div class="empty">No recorded history for this device in the selected range.</div>
    {/if}
  </div>

  <!-- daily average power (only when it adds info beyond the hourly trace above) -->
  {#if hasData && period === "day"}
    <div class="card pad">
      <div class="rh"><span class="lb">Average power (daily)</span><span class="sub">avg {power(avgW).val} {power(avgW).unit}</span></div>
      <AreaChart data={chartMean} color="var(--brand)" height={170} unit=" W" digits={0} labelFmt={fmtDay} />
    </div>
  {/if}

  <!-- energy per day -->
  {#if hasData}
    <div class="card pad">
      <div class="rh"><span class="lb">Energy per {period === "hour" ? "hour" : "day"}</span><span class="sub">kWh</span></div>
      <BarChart bars={energyBars} height={150} unit="" digits={totalKwh < 10 ? 2 : 1} />
    </div>

    <!-- intelligence -->
    <div class="card pad">
      <div class="rh"><span class="lb">📊 Usage intelligence</span></div>
      <div class="ig">
        <div class="ic"><span class="il">Trend</span><span class="iv" style="color:{trendColor}">{trendPct == null ? "—" : `${trendPct > 0 ? "▲" : "▼"} ${n(Math.abs(trendPct))}%`}</span><span class="is">vs start of period</span></div>
        <div class="ic"><span class="il">Busiest</span><span class="iv">{busiest ? dfmt(busiest.t) : "—"}</span><span class="is">{busiest ? `${power(busiest.mean).val} ${power(busiest.mean).unit} avg` : ""}</span></div>
        <div class="ic"><span class="il">Quietest</span><span class="iv">{quietest ? dfmt(quietest.t) : "—"}</span><span class="is">{quietest ? `${power(quietest.mean).val} ${power(quietest.mean).unit} avg` : ""}</span></div>
        <div class="ic"><span class="il">Base load</span><span class="iv">{power(baseW).val} {power(baseW).unit}</span><span class="is">standby minimum</span></div>
        <div class="ic"><span class="il">Daily avg</span><span class="iv">{n(avgDailyKwh, 2)} kWh</span><span class="is">{rand(avgDailyKwh * tariff)}/day</span></div>
        <div class="ic"><span class="il">Projected</span><span class="iv">{rand(projMonthlyCost)}</span><span class="is">per month at this rate</span></div>
      </div>
      {#if summary}<p class="sum">{summary}</p>{/if}
    </div>

    <!-- typical daily pattern -->
    <div class="card pad">
      <div class="rh"><span class="lb">🕒 Typical daily pattern</span><span class="sub">{peakHour != null ? `peaks ~${peakHour}:00` : "avg W by hour"}</span></div>
      <BarChart bars={hourProfile} height={140} unit=" W" digits={0} />
    </div>
  {/if}
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }

  .ctrls { padding: 16px 18px; }
  .crow { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end; }
  .crow.dates { margin-top: 12px; }
  .fld { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .flb { font-size: 11px; font-weight: 700; color: var(--dim); text-transform: uppercase; letter-spacing: 0.4px; }
  select, input[type="date"] {
    background: var(--soft); color: var(--text); border: 1px solid var(--line);
    border-radius: 10px; padding: 9px 12px; font-size: 14px; font-weight: 600; min-width: 220px;
    color-scheme: dark;   /* render the native popup / date picker on a dark palette */
  }
  input[type="date"] { min-width: 150px; }
  /* Native dropdown list renders on the OS background — force solid dark + light
     text so the options are readable (was light-on-light). */
  select option { background-color: #0e1522; color: var(--text); }
  select optgroup { background-color: #0e1522; color: var(--muted); font-weight: 700; }
  .hint { font-size: 12px; color: var(--warning); align-self: center; }

  .seg { display: inline-flex; flex-wrap: wrap; background: var(--soft); border: 1px solid var(--line); border-radius: 10px; padding: 3px; gap: 2px; }
  .seg button { padding: 7px 13px; border-radius: 8px; font-size: 13px; font-weight: 700; color: var(--muted); }
  .seg button.on { background: color-mix(in srgb, var(--brand) 26%, transparent); color: var(--text); }

  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .k { padding: 16px; }
  .lb { font-size: 13px; font-weight: 700; color: var(--text-2); }
  .big { font-size: 26px; font-weight: 800; letter-spacing: -1px; margin-top: 6px; }
  .u { font-size: 14px; color: var(--dim); }
  .sub { font-size: 11.5px; color: var(--dim); margin-top: 3px; }

  .pad { padding: 18px 20px; }
  .rh { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
  .empty { padding: 40px 0; text-align: center; color: var(--dim); font-size: 13px; }

  .ig { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .ic { display: flex; flex-direction: column; gap: 3px; padding: 12px 14px; border-radius: 12px; background: rgba(255,255,255,0.05); }
  .il { font-size: 11px; font-weight: 700; color: var(--dim); text-transform: uppercase; letter-spacing: 0.4px; }
  .iv { font-size: 18px; font-weight: 800; letter-spacing: -0.4px; }
  .is { font-size: 11.5px; color: var(--dim); }
  .sum { margin: 16px 0 0; font-size: 13.5px; line-height: 1.55; color: var(--text-2); }

  @media (max-width: 860px) { .kpis { grid-template-columns: repeat(2, 1fr); } .ig { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 560px) { .kpis { grid-template-columns: 1fr; } .ig { grid-template-columns: 1fr; } select { min-width: 0; width: 100%; } }
</style>
