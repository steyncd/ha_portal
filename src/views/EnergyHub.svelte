<script lang="ts">
  // Energy — the hub board. Phase 3.2.
  //
  // Was three tabs wrapping three whole views. The tabs were the problem: they
  // made Energy, Trends and Solar look like three answers when they are three
  // renderings of one question, and you had to visit all three to learn anything.
  // Now it is one board — four stats, one shared time axis, one list of where the
  // money went — and the originals are spokes you can still open.
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E } from "../lib/entities";
  import { n, power } from "../lib/format";
  import HubBoard, { type Stat, type Row } from "../lib/components/HubBoard.svelte";
  import SmallMultiples, { type Panel } from "../lib/components/SmallMultiples.svelte";
  import Sheet from "../lib/components/Sheet.svelte";

  let { onnav }: { onnav: (id: string) => void } = $props();

  const rand = (v: number | null | undefined, dp = 2) =>
    v == null ? "—" : `R${new Intl.NumberFormat("af-ZA", { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(v)}`;

  const costToday = $derived(ha.num("sensor.energy_cost_today"));
  const costMonth = $derived(ha.num("sensor.energy_cost_this_month"));
  const solarNow = $derived(ha.num(E.pvPower));
  const solarToday = $derived(ha.num("sensor.victron_total_pv_yield_today"));
  const gridToday = $derived(ha.num("sensor.victron_grid_import_daily"));
  const soc = $derived(ha.readingNum(E.batterySoc));
  const socMin = $derived(ha.num("sensor.battery_soc_min_today"));
  const independence = $derived(ha.num("sensor.grid_independence_today"));
  const loadNow = $derived(ha.num("sensor.victron_ac_consumption_l1"));

  // Both units on every energy figure, and the split named — "R38,20 · 18.4 kWh ·
  // 62% sun, 38% grid". Money for Mandri, units and the split for Christo.
  const kwhToday = $derived(
    solarToday != null && gridToday != null ? solarToday + gridToday : null,
  );
  const sunPct = $derived(
    solarToday != null && gridToday != null && solarToday + gridToday > 0
      ? Math.round((solarToday / (solarToday + gridToday)) * 100)
      : null,
  );
  const bothUnits = $derived(
    kwhToday == null || sunPct == null
      ? undefined
      : `${n(kwhToday, 1)} kWh · ${sunPct}% sun, ${100 - sunPct}% grid`,
  );

  let sheet = $state<{ title: string; sub: string; kind: string } | null>(null);
  const open = (title: string, sub: string, kind: string) => (sheet = { title, sub, kind });

  const stats = $derived<Stat[]>([
    {
      key: "Today",
      value: rand(costToday),
      units: bothUnits,
      note: sunPct != null ? `${rand(costToday != null && sunPct != null ? (costToday * sunPct) / 100 : null)} of it was free` : undefined,
      open: () => open("Today", "cost, sun and grid", "today"),
    },
    {
      key: "Solar now",
      value: solarNow != null ? `${power(solarNow).val} ${power(solarNow).unit}` : "—",
      units: solarToday != null ? `${n(solarToday, 1)} kWh today` : undefined,
      note: loadNow != null && solarNow != null
        ? solarNow > loadNow ? `surplus ${power(solarNow - loadNow).val} ${power(solarNow - loadNow).unit}` : "load above solar"
        : undefined,
      warn: loadNow != null && solarNow != null && solarNow < loadNow,
      open: () => open("Solar", "today against the forecast", "solar"),
    },
    {
      key: "Battery",
      reading: soc,
      unit: "%",
      units: socMin != null ? `low ${n(socMin)}% today` : undefined,
      note: "reserve holds overnight",
      open: () => open("Battery", "state of charge and reserve", "battery"),
    },
    {
      key: "Month",
      value: rand(costMonth, 0),
      units: independence != null ? `${n(independence)}% off-grid` : undefined,
      note: "to date",
      open: () => open("Month", "against last month", "month"),
    },
  ]);

  // ── Small multiples ────────────────────────────────────────────────────────
  // Eight panels over one time axis. Loaded once on mount rather than reactively:
  // eight history queries per live frame would hammer the socket for a strip you
  // read at a glance.
  // Midnight today, not "24 hours ago": the design's axis is "00:00 -> 19:04",
  // and a rolling 24h window labelled with clock times reads as "13:27 -> 13:27"
  // because 24 hours earlier is the same time of day.
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const from = midnight.getTime();
  const to = Date.now();
  const HOURS = Math.max(1, Math.ceil((to - from) / 3_600_000));
  let panels = $state<Panel[]>([]);

  const SERIES: { key: string; label: string; id: string; tint: string; fmt: (v: number | null) => string; note: string }[] = [
    { key: "solar", label: "Solar", id: E.pvPower, tint: "var(--energy)", fmt: (v) => (v == null ? "—" : `${power(v).val} ${power(v).unit}`), note: "PV output. The shape should be a smooth arc; a notch means cloud or a tripped MPPT." },
    { key: "load", label: "Load", id: "sensor.victron_ac_consumption_l1", tint: "var(--load)", fmt: (v) => (v == null ? "—" : `${power(v).val} ${power(v).unit}`), note: "Everything the house drew. Steps are appliances starting, not noise." },
    { key: "soc", label: "Battery", id: E.batterySoc, tint: "var(--battery)", fmt: (v) => (v == null ? "—" : `${n(v)}%`), note: "State of charge. A flat top means it filled and the surplus went somewhere else." },
    { key: "cost", label: "Cost today", id: "sensor.energy_cost_today", tint: "var(--acc)", fmt: (v) => rand(v), note: "Cumulative, so it only ever rises. The slope is what matters." },
    { key: "tank", label: "Tank", id: E.tankLevel, tint: "var(--water)", fmt: (v) => (v == null ? "—" : `${n(v)}%`), note: "Level. A fall with no borehole run is a leak or a still-night draw." },
    { key: "borehole", label: "Borehole", id: "sensor.borehole_pump_water_pumped_today", tint: "var(--water)", fmt: (v) => (v == null ? "—" : `${n(v)} ℓ`), note: "Pumped today. Flat means it has not run." },
    { key: "freeze", label: "Deep freeze", id: "sensor.deep_freeze_current_consumption", tint: "var(--climate)", fmt: (v) => (v == null ? "—" : `${power(v).val} ${power(v).unit}`), note: "Duty cycle. A rising floor is the compressor working harder than it used to." },
    { key: "pool", label: "Pool pump", id: "sensor.pool_pump_power", tint: "var(--load)", fmt: (v) => (v == null ? "—" : `${power(v).val} ${power(v).unit}`), note: "On/off blocks. These should sit inside the solar arc." },
  ];

  onMount(async () => {
    const results = await Promise.all(
      SERIES.map(async (s) => {
        if (!ha.exists(s.id)) return null;
        const h = await ha.history(s.id, HOURS);
        return { s, h };
      }),
    );
    panels = results.filter(Boolean).map((r) => {
      const { s, h } = r!;
      // Bucket to 48 half-hour slots so every panel shares the same x positions
      // — the shared axis only means anything if the samples line up.
      const SLOTS = 48;
      const slots: (number | null)[] = Array.from({ length: SLOTS }, () => null);
      for (const p of h) {
        const i = Math.floor(((p.t - from) / (to - from)) * SLOTS);
        if (i >= 0 && i < SLOTS) slots[i] = p.v;
      }
      const last = [...h].reverse().find((p) => p.v != null)?.v ?? null;
      return { key: s.key, label: s.label, value: s.fmt(last), points: slots, tint: s.tint, note: s.note };
    });
  });

  // ── Where the money went ───────────────────────────────────────────────────
  const APP = [
    { key: "Pool pump", id: "sensor.pool_pump_power", tint: "var(--load)" },
    { key: "Deep freeze", id: "sensor.deep_freeze_current_consumption", tint: "var(--climate)" },
    { key: "Tumble dryer", id: "sensor.tumble_dryer_current_consumption", tint: "var(--load)" },
    { key: "Dishwasher", id: "sensor.dishwasher_current_consumption", tint: "var(--load)" },
    { key: "Borehole", id: "sensor.borehole_pump_power", tint: "var(--water)" },
  ];
  const rows = $derived<Row[]>(
    APP.filter((a) => ha.exists(a.id)).map((a) => {
      const w = ha.num(a.id);
      return {
        key: a.key,
        sub: ha.isOn(a.id.replace(/^sensor\./, "switch.").replace(/_power$|_current_consumption$/, "")) ? "running now" : "idle",
        value: w != null ? `${power(w).val} ${power(w).unit}` : "—",
        tint: a.tint,
        open: () => onnav("appliances"),
      };
    }),
  );
</script>

<HubBoard
  hub="energy"
  scopes={rows.map((r) => r.key).slice(0, 4)}
  sub="five views collapsed · one board, one time axis"
  {stats}
  listTitle="Where the money is going"
  {rows}
  noteTitle="Why one view"
  note="Energy, Solar, Power trends, Batteries and Appliances answered the same question with different chrome. One board, one shared axis, and the detail expands where you clicked instead of somewhere else."
  {onnav}
>
  {#snippet multiples()}
    {#if panels.length}<SmallMultiples {panels} {from} {to} />{/if}
  {/snippet}
</HubBoard>

<Sheet open={!!sheet} title={sheet?.title ?? ""} subtitle={sheet?.sub ?? ""} onclose={() => (sheet = null)}>
  {#if sheet}
    <div class="rows">
      {#if sheet.kind === "today"}
        <div class="r"><span>Cost</span><span>{rand(costToday)}</span></div>
        <div class="r"><span>Solar</span><span>{solarToday != null ? `${n(solarToday, 1)} kWh` : "—"}</span></div>
        <div class="r"><span>Grid</span><span>{gridToday != null ? `${n(gridToday, 1)} kWh` : "—"}</span></div>
        <div class="r"><span>Off-grid share</span><span>{independence != null ? `${n(independence)}%` : "—"}</span></div>
      {:else if sheet.kind === "solar"}
        <div class="r"><span>Now</span><span>{solarNow != null ? `${power(solarNow).val} ${power(solarNow).unit}` : "—"}</span></div>
        <div class="r"><span>Today</span><span>{solarToday != null ? `${n(solarToday, 1)} kWh` : "—"}</span></div>
        <div class="r"><span>Expected today</span><span>{ha.num("sensor.expected_solar_yield_today") != null ? `${n(ha.num("sensor.expected_solar_yield_today"), 1)} kWh` : "—"}</span></div>
      {:else if sheet.kind === "battery"}
        <div class="r"><span>Now</span><span>{soc.value != null ? `${n(soc.value as number)}%` : "—"}</span></div>
        <div class="r"><span>Lowest today</span><span>{socMin != null ? `${n(socMin)}%` : "—"}</span></div>
        <div class="r"><span>Off-grid hours today</span><span>{ha.num("sensor.battery_runtime_off_grid_today") ?? "—"}</span></div>
      {:else}
        <div class="r"><span>Month to date</span><span>{rand(costMonth, 0)}</span></div>
        <div class="r"><span>Off-grid share</span><span>{independence != null ? `${n(independence)}%` : "—"}</span></div>
      {/if}
    </div>
    <button class="spoke" onclick={() => { sheet = null; onnav("energydetail"); }}>
      Open the full Energy view
    </button>
  {/if}
</Sheet>

<style>
  .rows { display: grid; gap: 2px; }
  .r { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 13px; color: var(--tx); }
  .r span:first-child { color: var(--mut); }
  .spoke {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: var(--r-control);
    background: var(--fill);
    color: var(--tx2);
    font-size: 12.5px;
    font-weight: 700;
    min-height: 44px;
  }
</style>
