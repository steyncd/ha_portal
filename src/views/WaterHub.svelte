<script lang="ts">
  // Water — the hub board. Phase 3.2.
  //
  // Water and Irrigation were one system pretending to be two: the same tank,
  // the same borehole, the same pump hours. The split meant you checked the tank
  // on one screen and the thing that fills it on another.
  //
  // The stat that matters most is the one nobody thinks to build: a tank falling
  // WITH THE BOREHOLE IDLE. Normal daytime use masks a leak completely, so the
  // only time you can see one is when nothing should be moving.
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

  const tank = $derived(ha.readingNum(E.tankLevel));
  const tankVol = $derived(ha.num(E.tankVolume));
  const tankMin = $derived(ha.num("sensor.tank_level_min_today"));
  const tankMax = $derived(ha.num("sensor.tank_level_max_today"));
  const usedToday = $derived(ha.readingNum(E.waterUsedToday));
  const usedAvg = $derived(ha.num(E.waterAvg7d));
  const boreholeToday = $derived(ha.num(E.boreholeToday));
  const boreholeOn = $derived(ha.isOn(E.boreholePump));
  const boreholeRun = $derived(ha.num(E.boreholeRunToday));
  const boreholeCost = $derived(ha.num(E.boreholeCostToday));
  const pumpRun = $derived(ha.num("sensor.water_pump_runtime_today"));
  const days = $derived(ha.num(E.tankDays));

  // The leak signal. A drop with the borehole idle is the one water fault
  // daytime use cannot hide.
  const silentDrop = $derived(
    tankMin != null && tankMax != null && (boreholeToday ?? 0) < 50 ? tankMax - tankMin : null,
  );
  const leaking = $derived(silentDrop != null && silentDrop >= 6);

  let sheet = $state<{ title: string; sub: string; kind: string } | null>(null);
  const open = (title: string, sub: string, kind: string) => (sheet = { title, sub, kind });

  const stats = $derived<Stat[]>([
    {
      key: "Tank",
      reading: tank,
      unit: "%",
      digits: 0,
      units: tankVol != null ? `${n(tankVol)} ℓ` : undefined,
      note: leaking
        ? `fell ${Math.round(silentDrop!)}% with the borehole idle`
        : days != null
          ? `about ${n(days, 1)} days at this rate`
          : undefined,
      warn: leaking,
      open: () => open("Tank", "level, and what moved it", "tank"),
    },
    {
      key: "Used today",
      reading: usedToday,
      unit: "ℓ",
      digits: 0,
      units: usedAvg != null ? `norm ${n(usedAvg)} ℓ` : undefined,
      note: usedToday.value != null && usedAvg != null && (usedToday.value as number) > usedAvg * 1.4 ? "well above the norm" : "in the usual range",
      warn: usedToday.value != null && usedAvg != null && (usedToday.value as number) > usedAvg * 1.4,
      open: () => open("Used today", "against the 90-day norm", "used"),
    },
    {
      key: "Borehole",
      value: boreholeOn ? "Running" : "Idle",
      units: boreholeToday != null ? `${n(boreholeToday)} ℓ today` : undefined,
      note: boreholeRun != null ? `${n(boreholeRun, 1)} h run time` : undefined,
      open: () => open("Borehole", "runs, litres and what it cost", "borehole"),
    },
    {
      key: "Pumping cost",
      value: rand(boreholeCost),
      units: boreholeRun != null ? `${n(boreholeRun, 1)} h` : undefined,
      note: "electricity to move the water",
      open: () => open("Pumping cost", "today and this month", "cost"),
    },
  ]);

  const rows = $derived<Row[]>([
    { key: "Irrigation zones", sub: "start, stop and the rain-skip rules", value: "Open", tint: "var(--water)", open: () => onnav("irrigation") },
    { key: "Pressure pump", sub: pumpRun != null ? `${n(pumpRun)} min today` : "no runtime sensor", value: ha.isOn(E.waterPump) ? "On" : "Off", tint: "var(--water)" },
    { key: "Tank status", sub: ha.state(E.tankStatus) ?? "—", value: ha.isOn(E.tankLowAlert) ? "Low" : "OK", tint: "var(--water)", warn: ha.isOn(E.tankLowAlert) },
    { key: "Cost per 1 000 ℓ", sub: "borehole electricity, not municipal", value: rand(ha.num(E.boreholeCostPerL)), tint: "var(--mut)" },
  ]);

  // Same shared-axis strip as Energy: midnight to now.
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const from = midnight.getTime();
  const to = Date.now();
  const HOURS = Math.max(1, Math.ceil((to - from) / 3_600_000));
  let panels = $state<Panel[]>([]);

  const SERIES = [
    { key: "tank", label: "Tank", id: E.tankLevel, tint: "var(--water)", fmt: (v: number | null) => (v == null ? "—" : `${n(v)}%`), note: "A fall with no borehole run is a leak or a still-night draw." },
    { key: "used", label: "Used", id: E.waterUsedToday, tint: "var(--load)", fmt: (v: number | null) => (v == null ? "—" : `${n(v)} ℓ`), note: "Cumulative, so the slope is the use." },
    { key: "bh", label: "Borehole", id: E.boreholePower, tint: "var(--heat-2)", fmt: (v: number | null) => (v == null ? "—" : `${power(v).val} ${power(v).unit}`), note: "Blocks are runs. Long flat blocks mean it is struggling to fill." },
    { key: "flow", label: "Flow", id: E.boreholeFlow, tint: "var(--heat-1)", fmt: (v: number | null) => (v == null ? "—" : `${n(v, 1)}`), note: "Falling flow at the same power is a clogging filter." },
  ];

  onMount(async () => {
    const res = await Promise.all(
      SERIES.map(async (s) => (ha.exists(s.id) ? { s, h: await ha.history(s.id, HOURS) } : null)),
    );
    const SLOTS = 48;
    panels = res.filter(Boolean).map((r) => {
      const { s, h } = r!;
      const slots: (number | null)[] = Array.from({ length: SLOTS }, () => null);
      for (const p of h) {
        const i = Math.floor(((p.t - from) / (to - from)) * SLOTS);
        if (i >= 0 && i < SLOTS) slots[i] = p.v;
      }
      const last = [...h].reverse().find((p) => p.v != null)?.v ?? null;
      return { key: s.key, label: s.label, value: s.fmt(last), points: slots, tint: s.tint, note: s.note };
    });
  });
</script>

<HubBoard
  hub="water"
  scopes={["Borehole", "Irrigation", "Pump", "Tank"].filter((s) => rows.some((r) => `${r.key} ${r.sub ?? ""}`.toLowerCase().includes(s.toLowerCase())))}
  sub="tank, borehole and irrigation on one axis"
  {stats}
  listTitle="The system"
  {rows}
  noteTitle="Why one view"
  note="Water and Irrigation were one system pretending to be two — the same tank, the same borehole, the same pump hours. You were checking the tank on one screen and the thing that fills it on another."
  {onnav}
>
  {#snippet multiples()}
    {#if panels.length}<SmallMultiples {panels} {from} {to} />{/if}
  {/snippet}
</HubBoard>

<Sheet open={!!sheet} title={sheet?.title ?? ""} subtitle={sheet?.sub ?? ""} onclose={() => (sheet = null)}>
  {#if sheet}
    <div class="rows">
      {#if sheet.kind === "tank"}
        <div class="r"><span>Now</span><span>{tank.value != null ? `${n(tank.value as number)}%` : "—"}</span></div>
        <div class="r"><span>Lowest today</span><span>{tankMin != null ? `${n(tankMin)}%` : "—"}</span></div>
        <div class="r"><span>Highest today</span><span>{tankMax != null ? `${n(tankMax)}%` : "—"}</span></div>
        <div class="r"><span>Borehole added today</span><span>{boreholeToday != null ? `${n(boreholeToday)} ℓ` : "—"}</span></div>
        {#if leaking}
          <p class="warn">
            The tank dropped {Math.round(silentDrop!)}% while the borehole was
            idle. Daytime use hides a leak; a still-night drop is the one time it
            shows.
          </p>
        {/if}
      {:else if sheet.kind === "used"}
        <div class="r"><span>Today</span><span>{usedToday.value != null ? `${n(usedToday.value as number)} ℓ` : "—"}</span></div>
        <div class="r"><span>Yesterday</span><span>{ha.num(E.waterUsedYesterday) != null ? `${n(ha.num(E.waterUsedYesterday))} ℓ` : "—"}</span></div>
        <div class="r"><span>90-day norm</span><span>{usedAvg != null ? `${n(usedAvg)} ℓ` : "—"}</span></div>
      {:else if sheet.kind === "borehole"}
        <div class="r"><span>State</span><span>{boreholeOn ? "Running" : "Idle"}</span></div>
        <div class="r"><span>Litres today</span><span>{boreholeToday != null ? `${n(boreholeToday)} ℓ` : "—"}</span></div>
        <div class="r"><span>Run time today</span><span>{boreholeRun != null ? `${n(boreholeRun, 1)} h` : "—"}</span></div>
        <div class="r"><span>Average power pumping</span><span>{ha.num(E.boreholeAvgPower) != null ? `${power(ha.num(E.boreholeAvgPower)!).val} W` : "—"}</span></div>
        <div class="r"><span>Efficiency</span><span>{ha.state(E.boreholeEfficiency) ?? "—"}</span></div>
      {:else}
        <div class="r"><span>Today</span><span>{rand(boreholeCost)}</span></div>
        <div class="r"><span>This month</span><span>{rand(ha.num(E.boreholeCostMonth))}</span></div>
        <div class="r"><span>Tariff</span><span>{rand(ha.num(E.tariff))} / kWh</span></div>
      {/if}
    </div>
  {/if}
</Sheet>

<style>
  .rows { display: grid; gap: 2px; }
  .r { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 13px; color: var(--tx); }
  .r span:first-child { color: var(--mut); }
  .warn { font-size: 12.5px; color: var(--warn); line-height: 1.55; margin: 12px 0 0; text-wrap: pretty; }
</style>
