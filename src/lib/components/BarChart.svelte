<script lang="ts">
  let {
    bars,
    height = 150,
    unit = "",
    digits = 0,
  }: {
    bars: { label: string; value: number | null; color?: string }[];
    height?: number;
    unit?: string;
    digits?: number;
  } = $props();

  const max = $derived(Math.max(1, ...bars.map((b) => (b.value != null ? b.value : 0))));
  const n = $derived(bars.length);

  // Measure the real pixel width so the SVG maps 1:1 (crisp bars + undistorted text).
  let cw = $state(600);

  const rotate = $derived(n > 12); // rotate x-labels once they'd collide
  const labelH = $derived(rotate ? 42 : 20);
  const valH = 16; // headroom for the top value label
  const showVals = $derived(n <= 14); // always-on values only when uncrowded
  const padX = 6;
  const svgH = $derived(height + labelH);
  const band = $derived((cw - padX * 2) / Math.max(1, n));
  const barW = $derived(Math.max(3, Math.min(band * 0.68, 46)));

  const geo = $derived(
    bars.map((b, i) => {
      const v = b.value ?? 0;
      const cx = padX + band * (i + 0.5);
      const h = b.value == null ? 0 : Math.max(v > 0 ? 2 : 0, (v / max) * (height - valH));
      return { label: b.label, value: b.value, color: b.color ?? "var(--brand)", cx, h, y: height - h };
    }),
  );

  let hi = $state<number | null>(null);
  function onmove(e: MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * cw;
    hi = Math.max(0, Math.min(n - 1, Math.floor((x - padX) / band)));
  }
  const hover = $derived(hi != null && geo[hi] ? geo[hi] : null);
  const fmt = (v: number | null) => (v == null ? "—" : v.toFixed(digits) + unit);
</script>

<div class="bc" bind:clientWidth={cw} style="height:{svgH}px" role="img" onmousemove={onmove} onmouseleave={() => (hi = null)}>
  <svg width={cw} height={svgH} viewBox="0 0 {cw} {svgH}">
    <!-- baseline -->
    <line x1={padX} x2={cw - padX} y1={height} y2={height} stroke="var(--divider, rgba(255,255,255,0.08))" stroke-width="1" />
    {#each geo as g, i}
      <rect
        x={g.cx - barW / 2}
        y={g.y}
        width={barW}
        height={g.h}
        rx={Math.min(4, barW / 3)}
        fill={g.color}
        opacity={hi == null || hi === i ? 1 : 0.4}
      />
      {#if showVals && g.value != null}
        <text x={g.cx} y={g.y - 5} text-anchor="middle" class="val">{fmt(g.value)}</text>
      {/if}
      {#if rotate}
        <text x={g.cx} y={height + 12} text-anchor="end" transform="rotate(-42 {g.cx} {height + 12})" class="lbl">{g.label}</text>
      {:else}
        <text x={g.cx} y={height + 14} text-anchor="middle" class="lbl">{g.label}</text>
      {/if}
    {/each}
  </svg>
  {#if hover}
    <div class="tip" style="left:{Math.max(6, Math.min(94, (hover.cx / cw) * 100))}%">
      <b style="color:{hover.color}">{fmt(hover.value)}</b><span>{hover.label}</span>
    </div>
  {/if}
</div>

<style>
  .bc { position: relative; width: 100%; }
  svg { width: 100%; display: block; overflow: visible; }
  rect { transition: opacity 0.12s ease; }
  .val { font-size: 11px; font-weight: 700; fill: var(--text-2); }
  .lbl { font-size: 10px; fill: var(--muted); font-variant-numeric: tabular-nums; }
  .tip {
    position: absolute; top: -2px; transform: translateX(-50%);
    background: rgba(10, 14, 22, 0.94); border: 1px solid var(--line, rgba(255, 255, 255, 0.12));
    border-radius: 8px; padding: 4px 9px; white-space: nowrap; pointer-events: none;
    display: flex; flex-direction: column; align-items: center; gap: 1px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
  }
  .tip b { font-size: 12.5px; font-weight: 800; }
  .tip span { font-size: 9.5px; color: var(--muted); }
</style>
