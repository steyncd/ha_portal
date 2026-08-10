<script lang="ts">
  // Small multiples — Phase 3.2.
  //
  // Eight panels, ONE shared time axis, on a fixed four-column grid. Two rules
  // and both are load-bearing:
  //
  // 1. `repeat(4, ...)` not `auto-fit`. The cardinality is known, and auto-fit
  //    reflows to 3+3+2 or 5+3 at intermediate widths, which orphans the last
  //    panel and — worse — silently changes which panels sit above each other.
  //    Small multiples only work if the reader can trust the grid.
  // 2. One axis for all of them. The whole point is comparing shapes at the same
  //    instant; per-panel autoscaling would make a 40 W wobble and a 4 kW spike
  //    look identical.
  //
  // Clicking a panel EXPANDS IT IN PLACE rather than pushing a new screen: the
  // comparison you were making is the context, and navigating away destroys it.
  import { clock } from "../format";
  import { gapFraction, TOO_SPARSE } from "../fn";
  import Failed from "./Failed.svelte";

  export type Panel = {
    key: string;
    label: string;
    /** Headline for the panel. Pre-formatted, units included. */
    value: string;
    /** Series in chronological order. Nulls are gaps, NOT zeroes. */
    points: (number | null)[];
    tint?: string;
    /** Shown when expanded. */
    note?: string;
  };

  let {
    panels = [],
    from,
    to,
  }: {
    panels?: Panel[];
    from: number;
    to: number;
  } = $props();

  let open = $state<string | null>(null);

  const W = 100;
  const H = 34;

  // One domain across every panel is wrong when the panels are different units,
  // so the shared axis here is TIME (the x scale), which is what the comparison
  // actually needs. Each panel's y is normalised within itself and labelled by
  // its own headline — the alternative, a shared y across kW and %, would be
  // meaningless.
  function path(points: (number | null)[]): string {
    const vals = points.filter((v): v is number => v != null);
    if (vals.length < 2) return "";
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const span = hi - lo || 1;
    // Gaps break the line rather than interpolating across them: a straight
    // segment through missing data is a claim we cannot support.
    let d = "";
    let pen = false;
    points.forEach((v, i) => {
      if (v == null) { pen = false; return; }
      const x = (i / (points.length - 1)) * W;
      const y = H - ((v - lo) / span) * H;
      d += `${pen ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)} `;
      pen = true;
    });
    return d.trim();
  }

  const axis = $derived(`${clock(from)} → ${clock(to)}`);
</script>

<section class="sm">
  <header class="sm-h">
    <h2>Today, one axis</h2>
    <span class="sm-ax">{axis} · click a panel to open it in place</span>
  </header>

  <div class="grid">
    {#each panels as p (p.key)}
      {@const isOpen = open === p.key}
      {@const sparse = gapFraction(p.points) > TOO_SPARSE}
      <!-- Above a third missing, a line misleads BY SHAPE rather than by value —
           four points strung across a day look like a trend. At that point the
           honest answer is the Failed state, not a chart with holes in it. -->
      {#if sparse}
        <div class="panel sparse">
          <span class="p-lb">{p.label}</span>
          <Failed what={p.label} detail="too few readings in this window to draw" />
        </div>
      {:else}
      <button
        class="panel"
        class:open={isOpen}
        onclick={() => (open = isOpen ? null : p.key)}
        aria-expanded={isOpen}
      >
        <span class="p-lb">{p.label}</span>
        <span class="p-v">{p.value}</span>
        <svg class="p-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <path d={path(p.points)} fill="none" stroke={p.tint ?? "var(--mut)"} stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
        </svg>
        {#if isOpen}
          <span class="p-note">
            {p.note ?? "No note for this one."}
            {#if p.points.some((v) => v == null)}
              <em>Gaps are missing readings, not zeroes.</em>
            {/if}
          </span>
        {/if}
      </button>
      {/if}
    {/each}
  </div>
</section>

<style>
  .sm { background: var(--s1); border-radius: var(--r-surface); padding: 14px 15px; }
  .sm-h { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 11px; }
  .sm-h h2 { font-size: 13px; font-weight: 700; color: var(--tx); margin: 0; }
  .sm-ax { font-size: 11.5px; color: var(--mut); }

  /* Fixed 4 — see the note at the top of this file. */
  .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  @media (max-width: 900px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

  .panel {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    gap: 5px;
    padding: 11px 12px;
    border-radius: var(--r-control);
    background: var(--s2);
    min-width: 0;
  }
  .panel:hover { background: color-mix(in srgb, var(--tx) 8%, var(--s2)); }
  /* Expanding in place: the panel spans the row rather than opening a sheet, so
     the neighbours it is being compared against stay on screen. */
  .panel.open { grid-column: 1 / -1; }
  /* Not a button: there is nothing to expand into. */
  .panel.sparse { cursor: default; }
  .p-lb { font-size: 11px; font-weight: 700; color: var(--mut); }
  .p-v { font-size: 16px; font-weight: 800; letter-spacing: -0.02em; color: var(--tx); font-variant-numeric: tabular-nums; }
  .p-svg { width: 100%; height: 34px; display: block; }
  .panel.open .p-svg { height: 96px; }
  .p-note { font-size: 11.5px; color: var(--mut); line-height: 1.5; text-wrap: pretty; }
  .p-note em { color: var(--tx2); font-style: normal; display: block; margin-top: 3px; }
</style>
