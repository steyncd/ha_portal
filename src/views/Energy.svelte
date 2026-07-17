<script lang="ts">
  import { onMount } from "svelte";
  import { ha } from "../lib/store.svelte";
  import { E, APPLIANCES, PUMPS, type Appliance } from "../lib/entities";
  import { n, power, rand, dailyMax } from "../lib/format";
  import PowerFlow from "../lib/components/PowerFlow.svelte";
  import AreaChart from "../lib/components/AreaChart.svelte";
  import BarChart from "../lib/components/BarChart.svelte";
  import Overlay from "../lib/components/Overlay.svelte";
  import Sankey from "../lib/components/Sankey.svelte";

  let { onnav }: { onnav?: (id: string) => void } = $props();

  type Range = "day" | "week" | "month";
  let range = $state<Range>("day");

  let socHist = $state<{ t: number; v: number }[]>([]);
  let pvHist = $state<{ t: number; v: number }[]>([]);
  let loadHist = $state<{ t: number; v: number }[]>([]);
  let gridHist = $state<{ t: number; v: number }[]>([]);
  let solarWeek = $state<{ label: string; value: number | null }[]>([]);
  let solarMonth = $state<{ t: number; v: number }[]>([]);
  onMount(async () => {
    socHist = await ha.history(E.batterySoc, 24);
    pvHist = await ha.history(E.pvPower, 24);
    loadHist = await ha.history(E.loads, 24);
    gridHist = await ha.history(E.gridPower, 24);
    solarWeek = dailyMax(await ha.history(E.solarYieldToday, 24 * 7), 7);
    const m = dailyMax(await ha.history(E.solarYieldToday, 24 * 30), 30);
    solarMonth = m.map((d, i) => ({ t: i, v: d.value ?? 0 }));
  });

  const indep = $derived(ha.num(E.gridIndepToday));

  // Energy insights (packages/energy_insights*.yaml)
  const banner = $derived(ha.state(E.energyBanner));
  const bannerLevel = $derived((ha.attr(E.energyBanner, "level") as string) ?? "neutral");
  const bannerColor = $derived(
    (({ good: "var(--success)", info: "var(--water)", neutral: "var(--muted)", warn: "var(--warning)", high: "var(--warning)", critical: "var(--error)" }) as Record<string, string>)[bannerLevel] ?? "var(--muted)",
  );
  const surplusOpen = $derived(ha.isOn(E.solarSurplusWindow));
  const vsExpected = $derived(ha.num(E.consumptionVsExpected));
  const mppt = $derived(ha.state(E.mpptHealth));
  // Metering plugs (meter:true) have unreliable switch state — derive on/off from power.
  const appOn = (a: Appliance) => (a.meter ? (ha.num(a.power) ?? 0) > (a.threshold ?? 5) : ha.isOn(a.sw));

  // Power reconciliation — computed HA-side (sensor.power_reconciliation), portal just reads it
  type Budget = { total_w: number; accounted_w: number; unknown_w: number; pct: number; devices: { name: string; w: number }[]; warnings: string[] };
  const budget = $derived(ha.attr(E.powerReconciliation, "data") as Budget | null | undefined);
  // Robust totals: victron_total_home_consumption can be unavailable → fall back to the
  // live load sensor so "unidentified" and % are always correct.
  const pbAccounted = $derived(budget?.devices?.reduce((s, d) => s + d.w, 0) ?? 0);
  const pbTotal = $derived(Math.max(budget?.total_w ?? 0, ha.num(E.loads) ?? 0, pbAccounted));
  const pbUnknown = $derived(Math.max(0, pbTotal - pbAccounted));
  const pbPct = $derived(pbTotal > 0 ? Math.round((pbAccounted / pbTotal) * 100) : 0);

  // per-device energy + cost today (sensor.energy_cost_attribution), HA-computed
  type Cost = { tariff: number; total_kwh: number; total_cost: number; devices: { name: string; kwh: number; cost: number }[]; warnings: string[] };
  const cost = $derived(ha.attr(E.costAttribution, "data") as Cost | null | undefined);

  // Victron charge state (Bulk → Absorption → Float)
  const CHARGE = ["Bulk", "Absorption", "Float"];
  const chargeState = $derived((ha.state(E.inverterState) ?? "").trim());
  const chargeIdx = $derived(CHARGE.findIndex((c) => c.toLowerCase() === chargeState.toLowerCase()));

  // Sankey flows (live W)
  const sources = $derived([
    { label: "Solar", value: ha.num(E.pvPower) ?? 0, color: "var(--solar)" },
    { label: "Grid", value: Math.max(0, ha.num(E.gridPower) ?? 0), color: "var(--water)" },
    { label: "Battery", value: Math.max(0, -(ha.num(E.batteryPower) ?? 0)), color: "var(--acc)" },
  ]);
  const SINK_PALETTE = ["#a78bfa", "#34d399", "#38bdf8", "#fbbf24", "#fb7185", "#22d3ee", "#c084fc", "#fb923c"];
  // Where the incoming power actually GOES: house loads + battery charging + grid
  // export. Without the last two the sources (esp. solar) dwarf the device sinks
  // and the flow looks broken — those are usually the biggest live destinations.
  const sinks = $derived.by(() => {
    const out: { label: string; value: number; color: string }[] = [];
    if (budget && budget.devices?.length) {
      const shown = budget.devices.filter((d) => d.w >= 5).slice(0, 8);
      const restW = budget.devices.filter((d) => !shown.includes(d)).reduce((s, d) => s + d.w, 0);
      shown.forEach((d, i) => out.push({ label: d.name, value: d.w, color: SINK_PALETTE[i % SINK_PALETTE.length] }));
      if (restW > 0) out.push({ label: "Other devices", value: restW, color: "#64748b" });
      if (pbUnknown > 0) out.push({ label: "Unidentified", value: pbUnknown, color: "var(--muted)" });
    } else {
      out.push({ label: "Monitored", value: ha.num(E.monitoredLoads) ?? 0, color: "var(--success)" });
      out.push({ label: "Other", value: ha.num(E.unmonitoredLoads) ?? 0, color: "var(--muted)" });
    }
    // battery charging (batteryPower > 0 = charging) + grid export (gridPower < 0)
    const charge = Math.max(0, ha.num(E.batteryPower) ?? 0);
    const exportW = Math.max(0, -(ha.num(E.gridPower) ?? 0));
    if (charge > 5) out.push({ label: "Battery charging", value: charge, color: "var(--acc)" });
    if (exportW > 5) out.push({ label: "Grid export", value: exportW, color: "var(--warning)" });
    return out;
  });

  const victron = $derived([
    { icon: "🔌", color: "var(--water)", name: "Inverter / VE.Bus", rows: [
      { k: "State", v: ha.state(E.inverterState) ?? "—" },
      { k: "AC load", v: `${power(ha.num(E.loads)).val} ${power(ha.num(E.loads)).unit}` },
      { k: "Essential", v: `${power(ha.num(E.essentialLoads)).val} ${power(ha.num(E.essentialLoads)).unit}` },
      { k: "Grid", v: `${power(ha.num(E.gridPower)).val} ${power(ha.num(E.gridPower)).unit}` },
    ] },
    { icon: "☀️", color: "var(--solar)", name: "Solar / MPPT", rows: [
      { k: "PV now", v: `${power(ha.num(E.pvPower)).val} ${power(ha.num(E.pvPower)).unit}` },
      { k: "MPPT 1", v: `${n(ha.num("sensor.victron_mppt1_pv_power"))} W` },
      { k: "MPPT 2", v: `${n(ha.num("sensor.victron_mppt2_pv_power"))} W` },
      { k: "Yield", v: `${n(ha.num(E.pvYieldToday), 1)} kWh` },
    ] },
    { icon: "🔋", color: "var(--acc)", name: "Battery bank", rows: [
      { k: "SoC", v: `${n(ha.num(E.batterySoc))}%` },
      { k: "Power", v: `${power(ha.num(E.batteryPower)).val} ${power(ha.num(E.batteryPower)).unit}` },
      { k: "Voltage", v: `${n(ha.num(E.batteryVoltage), 1)} V` },
      { k: "Temp", v: `${n(ha.num(E.batteryTemp))}°C` },
    ] },
  ]);
</script>

<div class="col">
  <!-- self-powered hero -->
  <div class="card hero">
    <div class="heroglow"></div>
    <div class="hmain">
      <div class="hbig">{n(indep)}<span class="hpct">%</span></div>
      <div class="hlbl">self-powered today</div>
    </div>
    <div class="hstats">
      <div class="hs"><span class="hv" style="color:var(--solar)">{power(ha.num(E.pvPower)).val} {power(ha.num(E.pvPower)).unit}</span><span class="hk">☀️ Solar now</span></div>
      <div class="hs"><span class="hv" style="color:var(--acc)">{n(ha.num(E.batterySoc))}%</span><span class="hk">🔋 Battery</span></div>
      <div class="hs"><span class="hv">{power(ha.num(E.loads)).val} {power(ha.num(E.loads)).unit}</span><span class="hk">🏠 Home load</span></div>
      <div class="hs"><span class="hv" style="color:{(ha.num(E.gridPower) ?? 0) > 5 ? 'var(--warning)' : 'var(--success)'}">{power(ha.num(E.gridPower)).val} {power(ha.num(E.gridPower)).unit}</span><span class="hk">🔌 Grid</span></div>
    </div>
  </div>

  {#if banner}
    <div class="card pad" style="border-left:3px solid {bannerColor}">
      <div class="rh"><span class="lb">📣 Energy advisor</span>{#if surplusOpen}<span class="sub" style="color:var(--success)">☀️ surplus window open — good for heavy loads</span>{/if}</div>
      <div style="font-size:15px;font-weight:650;color:{bannerColor}">{banner}</div>
    </div>
  {/if}

  <div class="kpis">
    <div class="card k"><div class="lb">Battery</div><div class="big">{n(ha.num(E.batterySoc))}<span class="u">%</span></div><div class="sub" style="color:var(--water)">{n(ha.num(E.batteryPower))} W → home</div></div>
    <div class="card k"><div class="lb">Solar today</div><div class="big">{n(ha.num(E.solarYieldToday), 1)}<span class="u"> kWh</span></div><div class="sub" style="color:var(--solar)">live {power(ha.num(E.pvPower)).val} {power(ha.num(E.pvPower)).unit}</div></div>
    <div class="card k"><div class="lb">Grid import</div><div class="big">{n(ha.num(E.gridImportToday), 1)}<span class="u"> kWh</span></div><div class="sub">{rand(ha.num(E.energyCostToday))} today</div></div>
    <div class="card k"><div class="lb">Grade</div><div class="big" style="color:var(--success)">{ha.state(E.energyGrade) ?? "—"}</div><div class="sub">{n(indep)}% independent</div></div>
  </div>

  <div class="kpis">
    <div class="card k"><div class="lb">Self-sufficient</div><div class="big">{n(ha.num(E.selfSufficiency))}<span class="u">%</span></div><div class="sub">today</div></div>
    <div class="card k"><div class="lb">Solar saved</div><div class="big" style="color:var(--solar)">{rand(ha.num(E.solarSaved))}</div><div class="sub">today vs grid</div></div>
    <div class="card k"><div class="lb">Vs expected</div><div class="big" style="color:{(vsExpected ?? 0) <= 0 ? 'var(--success)' : 'var(--warning)'}">{vsExpected != null ? `${vsExpected > 0 ? '+' : ''}${n(vsExpected, 1)}` : '—'}<span class="u"> kWh</span></div><div class="sub">{n(ha.num(E.consumptionExpected), 1)} kWh expected</div></div>
    <div class="card k"><div class="lb">Solar strings</div><div class="big" style="color:{mppt === 'ok' ? 'var(--success)' : 'var(--warning)'};font-size:22px;text-transform:capitalize">{mppt ?? '—'}</div><div class="sub">battery {rand(ha.num(E.batteryValueNow))}/h · {ha.state(E.batteryTou) ?? '—'}</div></div>
  </div>

  <div class="card pad">
    <div class="rh">
      <span class="lb">Production &amp; use</span>
      <div class="tabs">
        {#each ["day", "week", "month"] as r}
          <button class="tab" class:active={range === r} onclick={() => (range = r as Range)}>{r[0].toUpperCase() + r.slice(1)}</button>
        {/each}
      </div>
    </div>

    {#if range === "day"}
      <div class="ch2"><span class="lb">Solar vs use · 24h</span><span class="sub">live {power(ha.num(E.pvPower)).val} {power(ha.num(E.pvPower)).unit}</span></div>
      <Overlay height={160} series={[
        { data: pvHist, color: "var(--solar)", label: "Solar", fill: true },
        { data: loadHist, color: "var(--success)", label: "Home load" },
        { data: gridHist, color: "var(--water)", label: "Grid", dash: "4 3" },
      ]} />
      <div class="ch2" style="margin-top:16px"><span class="lb">Battery state of charge · 24h</span><span class="sub">Now {n(ha.num(E.batterySoc))}%</span></div>
      <AreaChart data={socHist} color="var(--acc)" unit="%" fixedMin={0} fixedMax={100} height={120} />
      <div class="stats3">
        <div class="st"><div class="sv" style="color:var(--solar)">{n(ha.num(E.solarYieldToday), 1)} kWh</div><div class="sk">Solar generated</div></div>
        <div class="st"><div class="sv">{n(ha.num(E.gridImportToday), 1)} kWh</div><div class="sk">Grid imported</div></div>
        <div class="st"><div class="sv" style="color:var(--success)">{rand(ha.num(E.energyCostToday))}</div><div class="sk">Cost today</div></div>
      </div>
    {:else if range === "week"}
      <div class="ch2"><span class="lb">Solar yield · 7 days</span><span class="sub">kWh</span></div>
      <BarChart bars={solarWeek} digits={1} height={170} />
      <div class="stats3">
        <div class="st"><div class="sv" style="color:var(--solar)">{n(ha.num(E.solarYieldWeek), 1)} kWh</div><div class="sk">Solar this week</div></div>
        <div class="st"><div class="sv">{n((ha.num(E.solarYieldWeek) ?? 0) / 7, 1)} kWh</div><div class="sk">Avg / day</div></div>
        <div class="st"><div class="sv" style="color:var(--success)">{n(Math.max(0, ...solarWeek.map((b) => b.value ?? 0)), 1)} kWh</div><div class="sk">Best day</div></div>
      </div>
    {:else}
      <div class="ch2"><span class="lb">Solar yield · 30 days</span><span class="sub">kWh / day</span></div>
      <AreaChart data={solarMonth} color="var(--solar)" unit="" digits={1} fixedMin={0} height={160} />
      <div class="stats3">
        <div class="st"><div class="sv" style="color:var(--solar)">{n(ha.num(E.solarYieldMonth), 0)} kWh</div><div class="sk">Solar this month</div></div>
        <div class="st"><div class="sv">{n(ha.num(E.gridIndepMonth))}%</div><div class="sk">Independent</div></div>
        <div class="st"><div class="sv" style="color:var(--success)">{rand(ha.num(E.solarSavings))}</div><div class="sk">Total saved</div></div>
      </div>
    {/if}
  </div>

  <div class="card pad">
    <div class="lb" style="margin-bottom:6px">Live power flow</div>
    <PowerFlow big />
    <div class="flowlegend">
      <span>☀️ Solar {power(ha.num(E.pvPower)).val} {power(ha.num(E.pvPower)).unit}</span>
      <span>🔋 Battery {n(ha.num(E.batteryPower))} W</span>
      <span>🔌 Grid {power(ha.num(E.gridPower)).val} {power(ha.num(E.gridPower)).unit}</span>
      <span>🏠 Load {power(ha.num(E.loads)).val} {power(ha.num(E.loads)).unit}</span>
    </div>
  </div>

  <!-- where energy flowed -->
  <div class="card pad">
    <div class="rh"><span class="lb">Where energy flows now</span><span class="sub">live · estimated split</span></div>
    <Sankey {sources} {sinks} height={240} />
    <div class="note">Live snapshot: power sources (left) → home → each metered device (right), with any unidentified load. Device split from the HA-side reconciliation, refreshed every 5 min.</div>
  </div>

  <!-- power budget · reconciliation (device sum vs inverter total) -->
  {#if budget && pbTotal > 0}
    <div class="card pad">
      <div class="rh"><span class="lb">Power budget · reconciliation</span><span class="sub">device meters vs live load · HA-computed, 5-min</span></div>
      <div class="pbtop">
        <div class="pbm"><div class="pbv">{power(pbTotal).val} {power(pbTotal).unit}</div><div class="pbk">Home load</div></div>
        <div class="pbm"><div class="pbv" style="color:{pbPct >= 80 ? 'var(--success)' : pbPct >= 55 ? 'var(--warning)' : 'var(--error)'}">{pbPct}%</div><div class="pbk">Accounted for</div></div>
        <div class="pbm"><div class="pbv" style="color:{pbUnknown > pbTotal * 0.35 ? 'var(--warning)' : 'var(--muted)'}">{power(pbUnknown).val} {power(pbUnknown).unit}</div><div class="pbk">Unidentified</div></div>
      </div>
      <div class="pbbar"><div class="pbfill" style="width:{Math.min(100, pbPct)}%"></div></div>
      <div class="devlist">
        {#each budget.devices.slice(0, 10) as d}
          <div class="drow"><span class="dn">{d.name}</span><div class="dtrack"><div class="dfill" style="width:{Math.min(100, (d.w / pbTotal) * 100)}%"></div></div><span class="dw">{power(d.w).val} {power(d.w).unit}</span></div>
        {/each}
        {#if pbUnknown > 0}
          <div class="drow"><span class="dn dim">Unidentified load</span><div class="dtrack"><div class="dfill mut" style="width:{Math.min(100, (pbUnknown / pbTotal) * 100)}%"></div></div><span class="dw">{power(pbUnknown).val} {power(pbUnknown).unit}</span></div>
        {/if}
      </div>
      {#if budget.warnings?.length}
        <div class="warns">{#each budget.warnings as w}<div class="warn">⚠ {w}</div>{/each}</div>
      {/if}
      <div class="note">Sum of every individually-metered device vs the inverter's reported total. A large unidentified slice = loads without their own meter (or a device double-counted inside the aircons/oven group).</div>
    </div>
  {/if}

  <!-- cost attribution today (per-device kWh × tariff) -->
  {#if cost && cost.devices?.length}
    <div class="card pad">
      <div class="rh"><span class="lb">Cost today · by device</span><span class="sub">{cost.total_kwh} kWh · R{cost.total_cost.toFixed(2)} @ R{cost.tariff.toFixed(2)}/kWh</span></div>
      <div class="devlist">
        {#each cost.devices.slice(0, 12) as d}
          {@const max = cost.devices[0].cost || 1}
          <div class="drow"><span class="dn">{d.name}</span><div class="dtrack"><div class="dfill" style="width:{Math.min(100, (d.cost / max) * 100)}%"></div></div><span class="dw">R{d.cost.toFixed(2)}<span class="dkwh"> · {d.kwh} kWh</span></span></div>
        {/each}
      </div>
      {#if cost.warnings?.length}
        <div class="warns">{#each cost.warnings as w}<div class="warn">⚠ {w}</div>{/each}</div>
      {/if}
      <div class="note">Each device's own daily-energy meter × your tariff. Devices without a dedicated energy meter (lights, fans, router) aren't attributed here — they show up in the reconciliation's unidentified slice above.</div>
    </div>
  {/if}

  <div class="card pad">
    <div class="rh"><span class="lb">Victron system · inverter &amp; chargers</span><span class="ok">● {ha.state(E.gridLostAlarm) === "0" ? "VE.Bus OK · grid connected" : "grid lost"}</span></div>
    <!-- charge-state track -->
    <div class="charge">
      {#each CHARGE as c, i}
        <div class="cseg" class:done={chargeIdx >= 0 && i <= chargeIdx} class:cur={i === chargeIdx}>
          <span class="cdot"></span>{c}
        </div>
      {/each}
      <span class="cnow">{chargeIdx >= 0 ? `Charging · ${chargeState}` : ha.state(E.batteryState) ?? "—"}</span>
    </div>
    <div class="vgrid">
      {#each victron as d}
        <div class="vtile">
          <div class="vhead"><span class="vic" style="background:color-mix(in srgb,{d.color} 18%,transparent)">{d.icon}</span><span class="vn">{d.name}</span></div>
          <div class="vrows">
            {#each d.rows as r}<div><div class="vv">{r.v}</div><div class="vk">{r.k}</div></div>{/each}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <div class="card pad">
    <div class="rh"><span class="lb">Appliances &amp; plugs — live draw</span>{#if onnav}<button class="seeall" onclick={() => onnav?.("appliances")}>grouped view →</button>{/if}</div>
    <div class="appgrid">
      {#each APPLIANCES as a}
        {@const p = ha.num(a.power)}
        {@const on = appOn(a)}
        <button class="app" class:on onclick={() => ha.toggle(a.sw)} disabled={!ha.exists(a.sw)}>
          <span class="al"><span class="an">{a.label}</span><span class="aw">{p != null ? `${power(p).val} ${power(p).unit}` : "—"}</span></span>
          <span class="apill" class:apon={on}>{on ? "ON" : "OFF"}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="card pad">
    <div class="rh"><span class="lb">Pumps — live power</span><span class="sub">idle draw vs actually pumping</span></div>
    <div class="appgrid">
      {#each PUMPS as p}
        {@const w = ha.num(p.power)}
        {@const on = ha.isOn(p.sw)}
        {@const pumping = on && (w ?? 0) > p.threshold}
        <button class="app" class:on class:pumping onclick={() => ha.toggle(p.sw)} disabled={!ha.exists(p.sw)}>
          <span class="al"><span class="an">{p.icon} {p.label}</span><span class="aw">{w != null ? `${power(w).val} ${power(w).unit}` : "—"}{p.flow && pumping ? ` · ${n(ha.num(p.flow), 1)} L/min` : ""}</span></span>
          <span class="apill" class:apon={pumping}>{!on ? "OFF" : pumping ? "PUMPING" : "IDLE"}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .col { display: flex; flex-direction: column; gap: 14px; }

  .hero { position: relative; overflow: hidden; padding: 22px 24px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
  .heroglow { position: absolute; inset: 0; background: radial-gradient(420px 200px at 12% 120%, color-mix(in srgb, var(--solar) 20%, transparent), transparent 70%); pointer-events: none; }
  .hmain { position: relative; }
  .hbig { font-size: 52px; font-weight: 800; letter-spacing: -2px; line-height: 0.9; background: var(--title-grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .hpct { font-size: 26px; }
  .hlbl { font-size: 13px; color: var(--dim); margin-top: 4px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; }
  .hstats { position: relative; display: grid; grid-template-columns: repeat(4, auto); gap: 10px 22px; }
  @media (max-width: 640px) { .hstats { grid-template-columns: 1fr 1fr; } }
  .hs { display: flex; flex-direction: column; gap: 2px; }
  .hv { font-size: 17px; font-weight: 800; }
  .hk { font-size: 11px; color: var(--muted); }

  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  @media (max-width: 760px) { .kpis { grid-template-columns: 1fr 1fr; } }
  .k { padding: 16px; }
  .big { font-size: 30px; font-weight: 800; letter-spacing: -1px; margin-top: 6px; }
  .u { font-size: 15px; color: var(--dim); }
  .sub { font-size: 11.5px; color: var(--dim); margin-top: 3px; }
  .pad { padding: 20px 22px; }
  .rh { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
  .ok { font-size: 11.5px; color: var(--success); font-weight: 600; }
  .seeall { font-size: 12px; color: var(--acc2); font-weight: 600; }
  .seeall:hover { color: var(--acc); }
  .tabs { display: flex; gap: 4px; background: rgba(255, 255, 255, 0.05); border-radius: 11px; padding: 4px; }
  .tab { padding: 7px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--text); }
  .tab.active { background: var(--grad); color: #0b1017; }
  .ch2 { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
  .stats3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
  @media (max-width: 430px) { .stats3 { grid-template-columns: 1fr; } }
  .st { padding: 12px 14px; border-radius: 12px; background: rgba(255, 255, 255, 0.04); }
  .sv { font-size: 16px; font-weight: 800; }
  .sk { font-size: 11px; color: var(--muted); margin-top: 2px; }

  .pbtop { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 14px; }
  .pbm { display: flex; flex-direction: column; gap: 3px; }
  .pbv { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
  .pbk { font-size: 10.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .pbbar { height: 10px; border-radius: 999px; background: color-mix(in srgb, var(--muted) 22%, transparent); overflow: hidden; margin-bottom: 16px; }
  .pbfill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--success), color-mix(in srgb, var(--success) 60%, var(--acc))); transition: width 0.6s; }
  .devlist { display: flex; flex-direction: column; gap: 8px; }
  .drow { display: grid; grid-template-columns: 130px 1fr auto; align-items: center; gap: 12px; }
  @media (max-width: 480px) { .drow { grid-template-columns: 96px 1fr auto; } }
  .dn { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dn.dim { color: var(--muted); font-style: italic; }
  .dtrack { height: 8px; border-radius: 999px; background: rgba(255, 255, 255, 0.06); overflow: hidden; }
  .dfill { height: 100%; border-radius: 999px; background: var(--grad); }
  .dfill.mut { background: color-mix(in srgb, var(--muted) 55%, transparent); }
  .dw { font-size: 12px; font-weight: 700; min-width: 52px; text-align: right; white-space: nowrap; }
  .dkwh { font-size: 10.5px; font-weight: 500; color: var(--muted); }
  .warns { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
  .warn { font-size: 11.5px; color: #fecaca; background: color-mix(in srgb, var(--error) 12%, transparent); padding: 7px 11px; border-radius: 9px; }
  .flowlegend { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 18px; font-size: 12px; color: var(--dim); margin-top: 6px; }
  .note { font-size: 11.5px; color: var(--muted-2); margin-top: 10px; }

  .charge { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
  .cseg { display: flex; align-items: center; gap: 7px; padding: 7px 14px; border-radius: 999px; background: rgba(255, 255, 255, 0.04); font-size: 12px; font-weight: 600; color: var(--muted); }
  .cseg .cdot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255, 255, 255, 0.2); }
  .cseg.done { color: var(--text); }
  .cseg.done .cdot { background: var(--solar); box-shadow: 0 0 8px var(--solar); }
  .cseg.cur { background: color-mix(in srgb, var(--solar) 16%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--solar) 40%, transparent); }
  .cnow { font-size: 11.5px; color: var(--dim); margin-left: auto; }

  .vgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(198px, 1fr)); gap: 12px; }
  .vtile { padding: 15px; border-radius: 14px; background: rgba(255, 255, 255, 0.04); }
  .vhead { display: flex; align-items: center; gap: 9px; margin-bottom: 13px; }
  .vic { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; font-size: 15px; }
  .vn { font-size: 12.5px; font-weight: 700; }
  .vrows { display: grid; grid-template-columns: 1fr 1fr; gap: 11px 10px; }
  .vv { font-size: 14.5px; font-weight: 800; }
  .vk { font-size: 9.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1px; }
  .appgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .app { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 15px; border-radius: 14px; background: rgba(255, 255, 255, 0.05); text-align: left; }
  .app.on { background: color-mix(in srgb, var(--warning) 14%, transparent); box-shadow: inset 0 0 0 1.5px var(--warning); }
  .app.pumping { background: color-mix(in srgb, var(--water) 16%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--water) 58%, transparent); }
  .app.pumping .apill.apon { background: color-mix(in srgb, var(--water) 34%, transparent); }
  .app:disabled { opacity: 0.4; }
  .al { display: flex; flex-direction: column; gap: 2px; }
  .an { font-size: 13.5px; font-weight: 600; }
  .aw { font-size: 12px; color: var(--dim); }
  .apill { flex-shrink: 0; padding: 4px 10px; border-radius: 999px; font-size: 10.5px; font-weight: 800; background: rgba(255, 255, 255, 0.08); color: var(--muted); }
  .apill.apon { background: color-mix(in srgb, var(--warning) 30%, transparent); color: #fff; }
</style>
