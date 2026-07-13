<script lang="ts">
  import { ha } from "../store.svelte";
  import { E } from "../entities";
  import { power } from "../format";

  let { big = false }: { big?: boolean } = $props();

  const pv = $derived(ha.num(E.pvPower) ?? 0);
  const battP = $derived(ha.num(E.batteryPower) ?? 0);
  const gridP = $derived(ha.num(E.gridPower) ?? 0);
  const load = $derived(ha.num(E.loads) ?? 0);
  const ess = $derived(ha.num(E.essentialLoads) ?? 0);

  const battDischarging = $derived(battP < -20);
  const battCharging = $derived(battP > 20);
  const gridImport = $derived(gridP > 20);
  const gridExport = $derived(gridP < -20);
  const solarOn = $derived(pv > 40);

  const f = (w: number) => { const p = power(Math.abs(w)); return `${p.val} ${p.unit}`; };
</script>

<svg viewBox="0 0 600 {big ? 336 : 250}" style="width:100%;max-width:{big ? 600 : 460}px;margin:0 auto;display:block">
  <!-- Solar → House -->
  <path class="lnk" class:flow={solarOn} style="--c:var(--solar)" d="M300,80 L300,{big ? 120 : 118}" />
  <!-- Battery → House -->
  <path class="lnk" class:flow={battDischarging} class:rev={battCharging} style="--c:var(--acc)"
    d="M118,150 L{big ? 266 : 262},150" />
  <!-- Grid → House -->
  <path class="lnk" class:flow={gridImport} class:rev={gridExport} style="--c:var(--water)"
    d="M482,150 L{big ? 334 : 338},150" />

  {#if big}
    <!-- essential / non-essential load boxes -->
    <rect x="176" y="270" width="120" height="48" rx="12" fill="color-mix(in srgb,var(--water) 12%,transparent)" stroke="color-mix(in srgb,var(--water) 48%,transparent)" stroke-width="1.5" />
    <text x="236" y="289" font-size="9.5" font-weight="700" fill="#7dd3fc" text-anchor="middle" letter-spacing="0.05em">ESSENTIAL</text>
    <text x="236" y="307" font-size="15" font-weight="800" fill="var(--text)" text-anchor="middle">{f(ess)}</text>
    <rect x="304" y="270" width="120" height="48" rx="12" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.16)" stroke-width="1.5" />
    <text x="364" y="289" font-size="9.5" font-weight="700" fill="var(--dim)" text-anchor="middle" letter-spacing="0.05em">NON-ESSENTIAL</text>
    <text x="364" y="307" font-size="15" font-weight="800" fill="var(--text-2)" text-anchor="middle">{f(Math.max(0, load - ess))}</text>
    <path class="lnk" class:flow={load > 20} style="--c:var(--text-2)" d="M300,184 L300,268" opacity="0.5" />
  {/if}

  <!-- House -->
  <circle cx="300" cy="150" r="34" fill="rgba(20,30,40,.72)" stroke="var(--line)" stroke-width="2"><title>House load now: {f(load)} ({f(ess)} essential)</title></circle>
  <text x="300" y="146" font-size="20" text-anchor="middle">🏠</text>
  <text x="300" y="167" font-size="11" font-weight="800" fill="var(--text)" text-anchor="middle">{f(load)}</text>

  <!-- Solar -->
  <circle cx="300" cy="58" r="22" fill="rgba(16,24,34,.85)" stroke="color-mix(in srgb,var(--solar) 50%,transparent)" stroke-width="2"><title>Solar generating {f(pv)}{solarOn ? '' : ' (idle)'}</title></circle>
  <text x="300" y="55" font-size="15" text-anchor="middle">☀️</text>
  <text x="300" y="70" font-size="9.5" font-weight="700" fill="var(--text)" text-anchor="middle">{f(pv)}</text>

  <!-- Battery -->
  <circle cx="92" cy="150" r="24" fill="rgba(16,24,34,.85)" stroke="var(--line)" stroke-width="2"><title>Battery {Math.round(ha.num(E.batterySoc) ?? 0)}% · {battCharging ? 'charging ' + f(battP) : battDischarging ? 'discharging ' + f(battP) : 'idle'}</title></circle>
  <text x="92" y="147" font-size="15" text-anchor="middle">🔋</text>
  <text x="92" y="163" font-size="9.5" font-weight="700" fill="var(--text)" text-anchor="middle">{Math.round(ha.num(E.batterySoc) ?? 0)}%</text>

  <!-- Grid -->
  <circle cx="508" cy="150" r="24" fill="rgba(16,24,34,.85)" stroke="color-mix(in srgb,var(--water) 40%,transparent)" stroke-width="2"><title>Grid {gridImport ? 'importing ' + f(gridP) : gridExport ? 'exporting ' + f(gridP) : 'idle'}</title></circle>
  <text x="508" y="147" font-size="15" text-anchor="middle">🔌</text>
  <text x="508" y="163" font-size="9.5" font-weight="700" fill="var(--text)" text-anchor="middle">{f(gridP)}</text>
</svg>

<style>
  .lnk {
    fill: none;
    stroke: var(--fill-strong);
    stroke-width: 3;
    stroke-linecap: round;
    opacity: 0.5;
  }
  .lnk.flow,
  .lnk.rev {
    stroke: var(--c);
    opacity: 1;
    stroke-dasharray: 3 7;
    filter: drop-shadow(0 0 3px color-mix(in srgb, var(--c) 60%, transparent));
    animation: dashmove 0.7s linear infinite;
  }
  .lnk.rev {
    animation-direction: reverse;
  }
</style>
