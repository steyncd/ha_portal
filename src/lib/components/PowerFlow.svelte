<script lang="ts">
  import { power } from "../format";

  let {
    pv,
    battP,
    gridP,
    load,
    soc,
  }: {
    pv: number | null;
    battP: number | null;
    gridP: number | null;
    load: number | null;
    soc: number | null;
  } = $props();

  // Flow semantics:
  //  battP < 0 → discharging (battery → house);  > 0 → charging (→ battery)
  //  gridP > 0 → importing (grid → house);        < 0 → exporting (→ grid)
  const solar = $derived({ active: (pv ?? 0) > 40, dir: "in", w: pv ?? 0 });
  const batt = $derived({
    active: Math.abs(battP ?? 0) > 20,
    dir: (battP ?? 0) < 0 ? "in" : "out",
    w: Math.abs(battP ?? 0),
  });
  const grid = $derived({
    active: Math.abs(gridP ?? 0) > 20,
    dir: (gridP ?? 0) > 0 ? "in" : "out",
    w: Math.abs(gridP ?? 0),
    importing: (gridP ?? 0) > 0,
  });

  const fmt = (w: number) => {
    const p = power(w);
    return `${p.val} ${p.unit}`;
  };
</script>

<div class="pf card">
  <svg viewBox="0 0 320 250">
    <!-- connecting lines: node → house -->
    <!-- Solar (top) -->
    <path class="link {solar.active ? 'flow-' + solar.dir : 'idle'}" style="--c:var(--solar)"
      d="M160,66 L160,104" />
    <!-- Battery (bottom-left) -->
    <path class="link {batt.active ? 'flow-' + batt.dir : 'idle'}" style="--c:var(--brand)"
      d="M78,196 L138,146" />
    <!-- Grid (bottom-right) -->
    <path class="link {grid.active ? 'flow-' + grid.dir : 'idle'}"
      style="--c:{grid.importing ? 'var(--error)' : 'var(--success)'}"
      d="M242,196 L182,146" />

    <!-- House (center) -->
    <g>
      <circle cx="160" cy="125" r="34" class="node house" />
      <text x="160" y="120" class="ic">🏠</text>
      <text x="160" y="140" class="nv">{fmt(load ?? 0)}</text>
    </g>

    <!-- Solar node -->
    <g>
      <circle cx="160" cy="40" r="26" class="node" style="--c:var(--solar)" />
      <text x="160" y="37" class="ic sm">☀️</text>
      <text x="160" y="52" class="nv sm">{fmt(solar.w)}</text>
    </g>
    <!-- Battery node -->
    <g>
      <circle cx="55" cy="215" r="26" class="node" style="--c:var(--brand)" />
      <text x="55" y="212" class="ic sm">🔋</text>
      <text x="55" y="227" class="nv sm">{soc == null ? "—" : Math.round(soc) + "%"}</text>
    </g>
    <!-- Grid node -->
    <g>
      <circle cx="265" cy="215" r="26" class="node"
        style="--c:{grid.importing ? 'var(--error)' : 'var(--success)'}" />
      <text x="265" y="212" class="ic sm">🔌</text>
      <text x="265" y="227" class="nv sm">{fmt(grid.w)}</text>
    </g>
  </svg>

  <div class="legend">
    <span><i style="background:var(--solar)"></i>Solar</span>
    <span><i style="background:var(--brand)"></i>Battery {batt.dir === "in" ? "→ home" : "charging"}</span>
    <span><i style="background:{grid.importing ? 'var(--error)' : 'var(--success)'}"></i>Grid {grid.active ? (grid.importing ? "import" : "export") : "idle"}</span>
  </div>
</div>

<style>
  .pf {
    padding: 12px 12px 16px;
  }
  svg {
    width: 100%;
    max-width: 460px;
    margin: 0 auto;
    display: block;
  }
  .node {
    fill: rgba(16, 14, 30, 0.72);
    stroke: color-mix(in srgb, var(--c, var(--border-strong)) 60%, transparent);
    stroke-width: 2;
  }
  .house {
    fill: rgba(40, 30, 20, 0.7);
    stroke: color-mix(in srgb, var(--warning) 50%, transparent);
  }
  .ic {
    font-size: 22px;
    text-anchor: middle;
  }
  .ic.sm {
    font-size: 16px;
  }
  .nv {
    font-size: 12px;
    font-weight: 700;
    fill: var(--text);
    text-anchor: middle;
  }
  .nv.sm {
    font-size: 10.5px;
  }
  .link {
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;
    stroke: var(--c);
  }
  .link.idle {
    stroke: var(--fill-strong);
    opacity: 0.5;
  }
  .link.flow-in,
  .link.flow-out {
    stroke-dasharray: 3 7;
    filter: drop-shadow(0 0 3px color-mix(in srgb, var(--c) 60%, transparent));
  }
  .link.flow-in {
    animation: dash-in 0.7s linear infinite;
  }
  .link.flow-out {
    animation: dash-out 0.7s linear infinite;
  }
  @keyframes dash-in {
    to {
      stroke-dashoffset: -10;
    }
  }
  @keyframes dash-out {
    to {
      stroke-dashoffset: 10;
    }
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px;
    margin-top: 4px;
    font-size: 11px;
    color: var(--text-2);
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .legend i {
    width: 9px;
    height: 9px;
    border-radius: 2px;
    display: inline-block;
  }
  @media (prefers-reduced-motion: reduce) {
    .link {
      animation: none !important;
    }
  }
</style>
